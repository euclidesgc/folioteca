-- Nível de acesso de um compartilhamento direto com uma pessoa. `EDIT` fica
-- reservado para a fatia 148; por enquanto só `VIEW` é gravado.
CREATE TYPE "ShareLevel" AS ENUM ('VIEW', 'EDIT');

-- Compartilhamento direto de um documento com uma pessoa da instância: no
-- máximo uma linha por par documento-pessoa.
CREATE TABLE "DocumentShare" (
    "documentId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "level" "ShareLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentShare_pkey" PRIMARY KEY ("documentId", "personId")
);

-- Busca os documentos compartilhados com uma pessoa.
CREATE INDEX "DocumentShare_personId_idx" ON "DocumentShare"("personId");

-- Apagar o documento ou a pessoa apaga o compartilhamento junto.
ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentShare" ADD CONSTRAINT "DocumentShare_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
