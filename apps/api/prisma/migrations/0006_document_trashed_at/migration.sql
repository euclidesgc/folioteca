-- AlterTable
ALTER TABLE "Document" ADD COLUMN "trashedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_ownerId_trashedAt_idx" ON "Document"("ownerId", "trashedAt" DESC);
