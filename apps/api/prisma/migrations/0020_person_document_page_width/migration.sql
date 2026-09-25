-- Largura da folha do documento, escolhida pela pessoa e válida para todos os
-- documentos dela. Toda pessoa existente nasce com `MEDIUM`, ou seja, Média.
CREATE TYPE "DocumentPageWidth" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'FULL');

ALTER TABLE "Person" ADD COLUMN "documentPageWidth" "DocumentPageWidth" NOT NULL DEFAULT 'MEDIUM';
