ALTER TABLE "Invitation" ADD COLUMN "acceptedAt" TIMESTAMP(3);

-- "One pending invitation per e-mail" must stop counting the accepted ones:
-- with the 0009 index, an address that already accepted an invitation could
-- never be invited again. The index becomes partial over the pending rows.
-- The 087 adds "revokedAt" to this same predicate when it adds the column.
DROP INDEX "Invitation_lower_email_key";

CREATE UNIQUE INDEX "Invitation_lower_email_key" ON "Invitation"(lower("email"))
    WHERE "acceptedAt" IS NULL;
