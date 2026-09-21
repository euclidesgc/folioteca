-- One root per database: only one OrgUnit may have a null parentId.
CREATE UNIQUE INDEX "OrgUnit_single_root_key" ON "OrgUnit"(("parentId" IS NULL)) WHERE "parentId" IS NULL;

-- Sibling names are unique regardless of letter case (accents still differ).
CREATE UNIQUE INDEX "OrgUnit_parentId_lower_name_key" ON "OrgUnit"("parentId", lower("name"));
