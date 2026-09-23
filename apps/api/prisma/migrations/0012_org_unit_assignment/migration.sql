-- Lotação: par unidade–pessoa. A chave primária composta é a garantia de
-- "uma pessoa não se lota duas vezes na mesma unidade": não há consulta
-- prévia de duplicidade em lugar nenhum, o 409 nasce daqui. A linha não tem
-- identidade própria — ela *é* o par —, por isso não há coluna "id".
CREATE TABLE "OrgUnitAssignment" (
    "orgUnitId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgUnitAssignment_pkey" PRIMARY KEY ("orgUnitId", "personId")
);

-- O índice da chave primária já responde "quem está nesta unidade"; este é o
-- caminho contrário, "em que unidades esta pessoa está".
CREATE INDEX "OrgUnitAssignment_personId_idx" ON "OrgUnitAssignment"("personId");

-- RESTRICT dos dois lados, pela mesma razão da 0008: apagar nunca pode
-- apagar junto, em silêncio, uma lotação montada à mão pela administração.
ALTER TABLE "OrgUnitAssignment" ADD CONSTRAINT "OrgUnitAssignment_orgUnitId_fkey"
    FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrgUnitAssignment" ADD CONSTRAINT "OrgUnitAssignment_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
