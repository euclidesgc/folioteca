# PRD 002 — installation

## Valor

Quem contratou o Folioteca ganha uma forma de ativar a instância pela primeira vez, criando de uma só vez a organização e sua conta de administrador.

## Usuários

A pessoa responsável pela contratação, ao abrir pela primeira vez uma instância do Folioteca ainda não instalada, e que possui o código de instalação fornecido no processo de compra.

## Requisitos

- **R1** — Ao abrir uma instância ainda não instalada, a pessoa é levada à tela de instalação.
- **R2** — A tela de instalação pede código de instalação, nome da organização, nome da pessoa, e-mail e senha.
- **R3** — Um código de instalação incorreto é recusado com um aviso genérico, sem indicar se algum outro dado está certo ou errado.
- **R4** — A senha exige no mínimo 12 caracteres; senhas menores são recusadas antes do envio.
- **R5** — Ao concluir com sucesso, a organização e o primeiro administrador (com seu espaço pessoal) passam a existir.
- **R6** — Ao concluir com sucesso, a pessoa já está com sessão aberta e cai na página inicial.
- **R7** — A página inicial, após a instalação, mostra o nome da pessoa e o nome da organização na barra lateral.
- **R8** — Numa instância já instalada, a tela de instalação não é exibida; quem tenta acessá-la é avisado de que a instância já foi instalada.
- **R9** — Numa instância já instalada, uma tentativa de instalar novamente pelo servidor é sempre recusada, mesmo quando duas tentativas chegam ao mesmo tempo (só uma pode ter vencido).
- **R10** — Numa instância já instalada, quem abre o app sem sessão vê um aviso de que o acesso por login chega em breve, em vez da tela de instalação.
- **R11** — Todos os textos da tela de instalação estão em pt_BR e o formulário é acessível (rótulos associados aos campos, navegável por teclado, erros anunciados).

## Fora de escopo

- Tela de login (fatia 003).
- Sair da sessão (fatia 003).
- Convites para novos membros.
- Recuperação de senha.
- Unidades além da raiz da organização.

## Pontos em aberto

nenhum
