-- CreateEnum
CREATE TYPE "SpaceKind" AS ENUM ('UNIT', 'FREE');

-- CreateTable
CREATE TABLE "Space" (
    "id" TEXT NOT NULL,
    "kind" "SpaceKind" NOT NULL,
    "unitId" TEXT,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "inheritsFromParent" BOOLEAN NOT NULL,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "managerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Space_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpaceMember" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("spaceId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Space_unitId_key" ON "Space"("unitId");

-- CreateIndex
CREATE INDEX "Space_parentId_idx" ON "Space"("parentId");

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Space" ADD CONSTRAINT "Space_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- motivo (M7/M12): só espaço livre pode ser restrito e só ele tem gestor;
-- espaço de unidade nunca tem `managerId` nem `restricted = true`. A CHECK
-- garante o par no banco, não só no serviço.
ALTER TABLE "Space" ADD CONSTRAINT "Space_kind_shape_check" CHECK (
    (kind = 'UNIT' AND "unitId" IS NOT NULL AND "managerId" IS NULL AND restricted = false)
    OR
    (kind = 'FREE' AND "unitId" IS NULL AND "managerId" IS NOT NULL)
);

-- Backfill (M8): um `Space` `kind = 'UNIT'` por `Unit` já existente, raiz
-- primeiro, para que o pai já tenha `Space` quando o filho é inserido. A
-- profundidade vem da contagem de linhas de `UnitClosure` em que a unidade é
-- descendente — a raiz tem 1 (só ela mesma), cada nível abaixo soma 1.
DO $$
DECLARE
    default_inherit boolean;
    unit_row RECORD;
BEGIN
    SELECT "spacesInheritByDefault" INTO default_inherit FROM "Organization" LIMIT 1;

    FOR unit_row IN
        SELECT u."id", u."name", u."parentId"
        FROM "Unit" u
        ORDER BY (SELECT count(*) FROM "UnitClosure" cl WHERE cl."descendantId" = u."id") ASC
    LOOP
        INSERT INTO "Space" (
            "id", "kind", "unitId", "parentId", "name",
            "inheritsFromParent", "restricted", "managerId", "createdAt"
        )
        VALUES (
            gen_random_uuid()::text,
            'UNIT',
            unit_row."id",
            CASE
                WHEN unit_row."parentId" IS NULL THEN NULL
                ELSE (SELECT s."id" FROM "Space" s WHERE s."unitId" = unit_row."parentId")
            END,
            unit_row."name",
            COALESCE(default_inherit, false),
            false,
            NULL,
            now()
        );
    END LOOP;
END $$;

-- contorno (M8, achado fora da prosa do "Modelo de dados" do PLANO.md): o
-- backfill acima só cobre unidade que já existia quando esta migration
-- rodou — `POST /installation` e `POST /units` criam unidade em transação de
-- aplicação, não em migration, então sem este gatilho toda instância nova
-- (inclusive o Postgres do Testcontainers, sempre vazio antes das
-- migrations) nasceria com unidade sem espaço, quebrando M8/M7 (a árvore de
-- Espaços que espelha a estrutura). Espelha `unit_closure_after_insert_trigger`
-- (D2): a garantia mora no banco, não num hook de serviço que um módulo
-- futuro pode esquecer de chamar.
CREATE FUNCTION "space_for_unit_after_insert"() RETURNS TRIGGER AS $$
DECLARE
    default_inherit boolean;
    parent_space_id text;
BEGIN
    SELECT "spacesInheritByDefault" INTO default_inherit FROM "Organization" LIMIT 1;

    IF NEW."parentId" IS NOT NULL THEN
        SELECT "id" INTO parent_space_id FROM "Space" WHERE "unitId" = NEW."parentId";
    END IF;

    INSERT INTO "Space" (
        "id", "kind", "unitId", "parentId", "name",
        "inheritsFromParent", "restricted", "managerId", "createdAt"
    )
    VALUES (
        gen_random_uuid()::text,
        'UNIT',
        NEW."id",
        parent_space_id,
        NEW."name",
        COALESCE(default_inherit, false),
        false,
        NULL,
        now()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "space_for_unit_after_insert_trigger"
AFTER INSERT ON "Unit"
FOR EACH ROW
EXECUTE FUNCTION "space_for_unit_after_insert"();

-- motivo (D1/decisão 5): primeira função de acesso da casa — espaços cuja
-- audiência inclui a pessoa: onde ela é membro direto (`SpaceMember`), o
-- espaço de unidade onde está lotada diretamente (`UnitMembership`), e desce
-- por `parentId` só enquanto o filho herda (`inheritsFromParent = true`); a
-- cadeia para no primeiro filho que não herda (M11). Chamada só por
-- `AccessRepository` — mudar a regra é migration nova com `CREATE OR REPLACE`.
-- Os ids são `text`, não `uuid`: todo id desta base nasce `String @default(uuid())`
-- e vira coluna `TEXT` (visível nas migrations anteriores), não o tipo nativo
-- `uuid` do Postgres.
CREATE OR REPLACE FUNCTION user_audience_spaces(p_user_id text)
RETURNS TABLE(space_id text)
LANGUAGE sql
STABLE
AS $$
    WITH RECURSIVE audience AS (
        SELECT "spaceId" AS id
        FROM "SpaceMember"
        WHERE "userId" = p_user_id

        UNION

        SELECT s."id"
        FROM "Space" s
        JOIN "UnitMembership" m ON m."unitId" = s."unitId"
        WHERE s."kind" = 'UNIT' AND m."userId" = p_user_id

        UNION

        SELECT c."id"
        FROM "Space" c
        JOIN audience a ON c."parentId" = a.id
        WHERE c."inheritsFromParent" = true
    )
    SELECT id AS space_id FROM audience
$$;
