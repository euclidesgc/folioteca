// por quê: a instância só tem duas pessoas reais desde que o cadastro público
// fechou (M2, plano 03) — a administradora nasce do próprio `POST
// /installation`, e a pessoa `MEMBER` é semeada direto no banco (convite só
// chega no plano 04). Dados fixos, e não gerados por teste, porque os dois
// nomes precisam ser os mesmos em toda a suíte: quem instala e quem a suíte
// busca depois em `LotarPessoaDialog` têm de ser a mesma pessoa.
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
