# PRD 009 — invitations

## Valor

A administração traz novas pessoas para a organização sem depender de outra forma de cadastro: gera um link de convite, envia por fora (fatia de e-mail ainda não existe) e a pessoa convidada cria a própria conta a partir dele.

## Usuários

Administradores da organização, numa página de convites dentro da área "Administração" na barra lateral, ao convidar alguém por e-mail ou revogar um convite pendente.

Pessoas convidadas, sem sessão nenhuma no Folioteca, ao abrir o link recebido por fora do app.

## Requisitos

- **R1** — A administração convida informando só o e-mail; a pessoa convidada é quem escolhe o próprio nome ao criar a conta.
- **R2** — Convidar um e-mail já cadastrado como pessoa é recusado, com mensagem clara.
- **R3** — Convidar um e-mail que já tem convite pendente substitui o convite anterior por um novo (novo prazo, novo link); o link antigo para de funcionar.
- **R4** — Ao criar um convite, a administração vê o link gerado e um botão para copiá-lo; copiar informa o resultado (inclusive a quem usa leitor de tela). O envio do e-mail em si é externo ao app nesta fatia — existirá fatia própria para o envio automático.
- **R5** — A página de convites lista os convites pendentes com e-mail, quando foram criados e quando expiram.
- **R6** — A administração revoga qualquer convite pendente da lista; a partir da revogação, o link correspondente para de funcionar imediatamente.
- **R7** — Um convite expira 7 dias depois de criado.
- **R8** — Um convite vale uma vez só: assim que uma conta é criada a partir dele, o mesmo link não funciona de novo.
- **R9** — Quem abre um link de convite sem estar autenticado vê um formulário para informar nome e senha, com as mesmas regras de senha da instalação (mínimo de 12 caracteres).
- **R10** — Ao concluir o formulário com um convite válido, a conta é criada, a sessão começa e a pessoa cai na aplicação.
- **R11** — A pessoa criada por convite entra sem ser administração e sem pertencer a nenhuma unidade; ao cair na aplicação, vê o próprio espaço pessoal, sem a área "Administração" na barra lateral (lotação em unidade é outra fatia).
- **R12** — Um link inválido, expirado, já usado ou revogado mostra uma tela de erro única e genérica, com caminho para a tela de entrar; a mensagem não revela se o e-mail do convite existe ou qual foi o motivo específico da recusa.
- **R13** — O token do convite nunca é guardado em claro no banco (fica na URL do link e, no servidor, só o hash dele), nunca aparece em log, e não é guardado em localStorage.
- **R14** — Quem não é administração não consegue criar, listar nem revogar convites mesmo chamando o servidor diretamente; a decisão é sempre do servidor.
- **R15** — Todos os textos da página de convites e do formulário de aceite estão em pt_BR, e ambos são acessíveis (rótulos associados aos campos, navegável por teclado, erros anunciados, sem violação crítica nem séria de acessibilidade).

## Fora de escopo

- Envio do e-mail de convite por SMTP (fica combinado só o link a copiar; o envio automático é fatia própria).
- Lotar a pessoa convidada em uma unidade organizacional (fatia 010).
- Reenviar um convite existente sem alterar o e-mail (usar R3: convidar de novo o mesmo e-mail substitui).
- Convidar várias pessoas de uma vez (convite em massa).
- Promover a pessoa convidada a administração ou qualquer gestão adicional de papéis (fatia 011).

## Pontos em aberto

nenhum
