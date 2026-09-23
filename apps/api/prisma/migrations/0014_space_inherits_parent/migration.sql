-- Modo de acesso do espaço de unidade: `true` faz quem vê o espaço da
-- unidade-pai ver também este. Todo espaço existente nasce com `false`, ou
-- seja, visível só para quem está lotado na própria unidade, como até aqui.
ALTER TABLE "Space" ADD COLUMN "inheritsParent" BOOLEAN NOT NULL DEFAULT false;

-- Só espaço de unidade herda: pessoal e livre não têm unidade-pai. O Prisma
-- não expressa esta restrição, por isso ela só existe aqui.
ALTER TABLE "Space" ADD CONSTRAINT "Space_inherits_parent_unit_check" CHECK ("type" = 'UNIT' OR "inheritsParent" = false);
