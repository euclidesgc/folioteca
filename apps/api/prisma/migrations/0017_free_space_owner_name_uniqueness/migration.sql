-- The same person cannot own two free spaces with the same name, compared
-- regardless of letter case (accents and inner spaces still differ). Personal
-- and unit spaces are outside the rule, hence the partial index.
CREATE UNIQUE INDEX "Space_free_owner_name_key" ON "Space" ("ownerId", lower("name")) WHERE "type" = 'FREE';
