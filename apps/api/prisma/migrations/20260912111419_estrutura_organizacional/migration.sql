-- CreateTable
CREATE TABLE "UnitType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitType_normalizedName_key" ON "UnitType"("normalizedName");

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isRoot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,
    "unitTypeId" TEXT,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id"),
    -- motivo (M5/D2): a raiz não tem pai nem tipo, e toda unidade que não é
    -- raiz tem os dois — nunca um estado intermediário.
    CONSTRAINT "Unit_root_pair_check" CHECK (
        ("isRoot" = true AND "parentId" IS NULL AND "unitTypeId" IS NULL)
        OR
        ("isRoot" = false AND "parentId" IS NOT NULL AND "unitTypeId" IS NOT NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_parentId_normalizedName_key" ON "Unit"("parentId", "normalizedName");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_unitTypeId_fkey" FOREIGN KEY ("unitTypeId") REFERENCES "UnitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "UnitClosure" (
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitClosure_pkey" PRIMARY KEY ("ancestorId", "descendantId")
);

-- CreateIndex
CREATE INDEX "UnitClosure_descendantId_idx" ON "UnitClosure"("descendantId");

-- AddForeignKey
ALTER TABLE "UnitClosure" ADD CONSTRAINT "UnitClosure_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitClosure" ADD CONSTRAINT "UnitClosure_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "UnitMembership" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UnitMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitMembership_unitId_userId_key" ON "UnitMembership"("unitId", "userId");

-- AddForeignKey
ALTER TABLE "UnitMembership" ADD CONSTRAINT "UnitMembership_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitMembership" ADD CONSTRAINT "UnitMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTrigger (M5/D2): cada unidade inserida grava a própria linha do
-- fecho (depth 0) e, quando tem pai, uma linha por ancestral do pai, com a
-- profundidade do ancestral mais um. É o que mantém `UnitClosure` correta
-- sem o app ter de calcular a árvore a cada escrita.
CREATE FUNCTION "unit_closure_after_insert"() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "UnitClosure" ("ancestorId", "descendantId", "depth")
    VALUES (NEW."id", NEW."id", 0);

    IF NEW."parentId" IS NOT NULL THEN
        INSERT INTO "UnitClosure" ("ancestorId", "descendantId", "depth")
        SELECT "ancestorId", NEW."id", "depth" + 1
        FROM "UnitClosure"
        WHERE "descendantId" = NEW."parentId";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "unit_closure_after_insert_trigger"
AFTER INSERT ON "Unit"
FOR EACH ROW
EXECUTE FUNCTION "unit_closure_after_insert"();

-- CreateTrigger (D2): `parentId` é imutável — mover unidade é fora deste
-- plano. A condição `WHEN` deixa passar um `UPDATE` que toca a coluna sem
-- mudar o valor (por exemplo, um `UPDATE` em lote que reescreve a linha).
CREATE FUNCTION "unit_parent_immutable"() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'parentId é imutável; mover unidade está fora deste plano';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "unit_parent_immutable_trigger"
BEFORE UPDATE OF "parentId" ON "Unit"
FOR EACH ROW
WHEN (OLD."parentId" IS DISTINCT FROM NEW."parentId")
EXECUTE FUNCTION "unit_parent_immutable"();

-- AlterTable: novas colunas de "Organization" (D8) antes do backfill, ainda
-- sem a CHECK/UNIQUE de singleton — pode haver mais de uma linha agora.
ALTER TABLE "Organization" ADD COLUMN "spacesInheritByDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "singleton" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: a organização mais antiga por "createdAt" vira a unidade raiz,
-- com o nome dela. O INSERT dispara o gatilho acima, que já grava a própria
-- linha do fecho. Ninguém é lotado automaticamente — decisão registrada em
-- "Riscos e decisões em aberto" do PLANO.md.
INSERT INTO "Unit" ("id", "name", "normalizedName", "isRoot", "parentId", "unitTypeId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, o."name", lower(btrim(o."name")), true, NULL, NULL, now(), now()
FROM "Organization" o
ORDER BY o."createdAt" ASC
LIMIT 1;

-- "User.organizationId" sai antes de apagar as organizações excedentes, ou a
-- FK recusaria o DELETE a seguir (D8): com uma organização só por instância,
-- pertencer a ela é fato, não relação.
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";
DROP INDEX "User_organizationId_idx";
ALTER TABLE "User" DROP COLUMN "organizationId";

-- Mantém só a organização mais antiga — risco descrito em "Riscos e decisões
-- em aberto" do PLANO.md: conferir em homologação antes do merge.
DELETE FROM "Organization" WHERE "id" <> (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1);

-- AlterTable: o nome passou à unidade raiz; a organização não guarda mais
-- nome próprio (D8).
ALTER TABLE "Organization" DROP COLUMN "name";

-- AlterTable: agora resta no máximo uma linha — seguro fechar o singleton.
CREATE UNIQUE INDEX "Organization_singleton_key" ON "Organization"("singleton");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_singleton_check" CHECK ("singleton" = true);
