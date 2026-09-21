-- CreateTable
CREATE TABLE "Favorite" (
    "personId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("personId","documentId")
);

-- CreateIndex
CREATE INDEX "Favorite_personId_createdAt_idx" ON "Favorite"("personId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Favorite_documentId_idx" ON "Favorite"("documentId");

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
