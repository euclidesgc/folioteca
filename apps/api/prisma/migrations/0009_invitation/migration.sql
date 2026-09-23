CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

CREATE INDEX "Invitation_organizationId_createdAt_idx" ON "Invitation"("organizationId", "createdAt" DESC);

-- One pending invitation per e-mail address, regardless of letter case:
-- the same expression index the 0007 uses for sibling names. Every row in
-- this table is a pending invitation today; when the 086 adds `acceptedAt`
-- and the 087 adds `revokedAt`, this index becomes partial (WHERE both are
-- null) in the migration of those slices.
CREATE UNIQUE INDEX "Invitation_lower_email_key" ON "Invitation"(lower("email"));

ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
