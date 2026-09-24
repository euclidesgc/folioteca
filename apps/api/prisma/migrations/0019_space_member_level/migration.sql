-- Nível do membro no espaço livre: `EDIT` cria e edita documentos, `VIEW` só
-- lê. Todo membro existente nasce com `EDIT`, ou seja, editor, como até aqui.
ALTER TABLE "SpaceMember" ADD COLUMN "level" "ShareLevel" NOT NULL DEFAULT 'EDIT';
