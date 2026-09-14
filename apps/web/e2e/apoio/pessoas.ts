// por quê: a instância só tem pessoas reais desde que o cadastro público
// fechou (M2, plano 03) — a administradora nasce do próprio `POST
// /installation`, e as pessoas `MEMBER` são semeadas direto no banco (convite
// só chega no plano 04). Dados fixos, e não gerados por teste, porque os três
// nomes precisam ser os mesmos em toda a suíte: quem instala, quem a suíte
// busca depois em `LotarPessoaDialog` e quem recebe convite para espaço
// restrito (plano 05) têm de ser sempre as mesmas pessoas.
export const PESSOA_ADMIN = {
  name: "Administradora da Instalação",
  organizationName: "Empresa da Instalação",
  email: "administradora@teste.folioteca",
  password: "uma-senha-de-teste-bem-longa",
};

export const PESSOA_MEMBRO = {
  name: "Pessoa Membro de Teste",
  email: "membro@teste.folioteca",
  password: "outra-senha-de-teste-bem-longa",
};

export const PESSOA_COLEGA = {
  name: "Pessoa Colega de Teste",
  email: "colega@teste.folioteca",
  password: "terceira-senha-de-teste-bem-longa",
};
