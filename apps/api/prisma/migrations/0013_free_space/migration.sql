-- Espaço livre: criado por uma pessoa, que vira a dona dele, dentro da
-- organização dela. As três colunas são opcionais porque espaços pessoais e
-- de unidade não as usam; quem exige cada uma, por tipo, é a restrição abaixo.
-- Nenhuma linha existente é preenchida: nenhum espaço livre existe antes daqui.
ALTER TABLE "Space" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Space" ADD COLUMN "name" TEXT;
ALTER TABLE "Space" ADD COLUMN "ownerId" TEXT;

-- RESTRICT dos dois lados, pela mesma razão da 0008 e da 0012: apagar a
-- organização ou a pessoa nunca pode apagar junto, em silêncio, um espaço
-- com os documentos dele.
ALTER TABLE "Space" ADD CONSTRAINT "Space_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A listagem procura os espaços livres pela dona.
CREATE INDEX "Space_ownerId_idx" ON "Space"("ownerId");

-- A restrição da 0002 é refeita para cobrir as colunas novas: pessoal e de
-- unidade não podem ter organização, nome nem dona; livre exige os três e
-- não pode ter pessoa nem unidade. O Prisma não expressa esta restrição, por
-- isso ela só existe aqui. Sem índice único de nome: nomes repetidos são
-- aceitos nesta versão.
ALTER TABLE "Space" DROP CONSTRAINT "Space_type_owner_check";
ALTER TABLE "Space" ADD CONSTRAINT "Space_type_owner_check" CHECK (
    ("type" = 'PERSONAL' AND "personId" IS NOT NULL AND "orgUnitId" IS NULL
        AND "organizationId" IS NULL AND "name" IS NULL AND "ownerId" IS NULL)
    OR ("type" = 'UNIT' AND "orgUnitId" IS NOT NULL AND "personId" IS NULL
        AND "organizationId" IS NULL AND "name" IS NULL AND "ownerId" IS NULL)
    OR ("type" = 'FREE' AND "personId" IS NULL AND "orgUnitId" IS NULL
        AND "organizationId" IS NOT NULL AND "name" IS NOT NULL AND "ownerId" IS NOT NULL)
);
