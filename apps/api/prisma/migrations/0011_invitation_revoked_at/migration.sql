ALTER TABLE "Invitation" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- "One pending invitation per e-mail" must stop counting the revoked ones:
-- with the 0010 predicate, an address whose invitation was revoked could never
-- be invited again. The index stays partial, now over the rows that still
-- count as pending. The column is born NULL on every existing row, so the set
-- covered by the new predicate is exactly the old one and the unique index
-- cannot fail on a duplicate.
DROP INDEX "Invitation_lower_email_key";

CREATE UNIQUE INDEX "Invitation_lower_email_key" ON "Invitation"(lower("email"))
    WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;
