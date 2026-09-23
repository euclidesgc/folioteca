-- Apagar uma unidade nunca cria raízes órfãs nem espaços sem dono: o banco
-- recusa enquanto houver filha ou espaço apontando para ela.
ALTER TABLE "OrgUnit" DROP CONSTRAINT "OrgUnit_parentId_fkey";
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Space" DROP CONSTRAINT "Space_orgUnitId_fkey";
ALTER TABLE "Space" ADD CONSTRAINT "Space_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
