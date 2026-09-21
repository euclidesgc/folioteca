# PRD 003 — login-logout

## Valor

Quem tem conta numa instância já instalada ganha uma forma de entrar e sair do Folioteca com sessão segura, substituindo o aviso provisório de "acesso por login em breve".

## Usuários

Qualquer pessoa com conta numa instância do Folioteca já instalada: sem sessão, ao tentar abrir o app; e com sessão aberta, ao encerrá-la pela barra lateral.

## Requisitos

- **R1** — Numa instância instalada, quem não tem sessão é levado à tela de entrar, com campos de e-mail e senha.
- **R2** — Credenciais erradas são recusadas com uma mensagem única e genérica, sem indicar se o e-mail existe.
- **R3** — O e-mail não diferencia maiúsculas de minúsculas.
- **R4** — Ao entrar com sucesso, a pessoa volta à página interna do app que tentou abrir antes de ser desviada para a tela de entrar; sem destino anterior, cai no início.
- **R5** — O destino após entrar nunca é um endereço fora do app, mesmo que informado na navegação.
- **R6** — Quem já tem sessão e abre a tela de entrar é levado ao início, sem ver o formulário.
- **R7** — Na barra lateral, junto à identidade da pessoa, há a opção "Sair".
- **R8** — Ao escolher "Sair", a sessão é encerrada no servidor imediatamente: o cookie de sessão deixa de ser aceito mesmo se copiado para outro lugar, e a pessoa é levada à tela de entrar.
- **R9** — Quando a sessão está vencida ou já foi encerrada em outra aba, a próxima ação da pessoa no app a leva à tela de entrar, sem mostrar tela quebrada ou erro técnico.
- **R10** — O aviso provisório "acesso por login em breve" deixa de ser exibido em qualquer situação.
- **R11** — Todos os textos da tela de entrar estão em pt_BR e o formulário é acessível (rótulos associados aos campos, navegável por teclado, erros anunciados).

## Fora de escopo

- Recuperação de senha.
- Convites e cadastro de novas contas.
- Opção "lembrar de mim".
- Login com Google ou outro provedor externo (SSO).
- Limite de tentativas de login (registrado como dívida técnica).
- Encerrar todas as sessões de uma pessoa de uma vez.

## Pontos em aberto

nenhum
