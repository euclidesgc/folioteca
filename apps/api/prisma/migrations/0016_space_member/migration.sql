-- Pessoa adicionada a um espaço livre pelo dono: no máximo uma linha por par
-- espaço-pessoa. Sem papel por enquanto (fatia 142).
CREATE TABLE "SpaceMember" (
    "spaceId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("spaceId", "personId")
);

-- Busca os espaços livres de que uma pessoa é membro.
CREATE INDEX "SpaceMember_personId_idx" ON "SpaceMember"("personId");

-- Apagar o espaço ou a pessoa apaga a participação junto.
ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
