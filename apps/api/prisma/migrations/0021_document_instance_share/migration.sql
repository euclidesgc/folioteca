-- Compartilhamento de um documento com todos da organização do dono: no
-- máximo uma linha por documento. A organização não é gravada: é a do dono,
-- lida a cada decisão de acesso.
CREATE TABLE "DocumentInstanceShare" (
    "documentId" TEXT NOT NULL,
    "level" "ShareLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentInstanceShare_pkey" PRIMARY KEY ("documentId")
);

-- Apagar o documento apaga o compartilhamento junto; ir para a lixeira não.
ALTER TABLE "DocumentInstanceShare" ADD CONSTRAINT "DocumentInstanceShare_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
