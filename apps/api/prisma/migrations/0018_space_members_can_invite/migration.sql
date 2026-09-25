-- Quem adiciona pessoas ao espaço livre: `true` deixa qualquer membro
-- adicionar; `false` deixa só o dono. Todo espaço existente nasce com
-- `false`, ou seja, fechado, como até aqui.
ALTER TABLE "Space" ADD COLUMN "membersCanInvite" BOOLEAN NOT NULL DEFAULT false;

-- Só espaço livre abre para membros: pessoal e de unidade não têm membros
-- adicionados. O Prisma não expressa esta restrição, por isso ela só existe
-- aqui.
ALTER TABLE "Space" ADD CONSTRAINT "Space_members_can_invite_free_check" CHECK ("type" = 'FREE' OR "membersCanInvite" = false);
