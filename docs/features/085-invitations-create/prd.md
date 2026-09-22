# PRD 085 — invitations-create

Fatia derivada da 009 `invitations` (PRD de origem em `prd-origem-009.md`, nesta mesma pasta), junto com a 086 (aceitar o link), a 087 (revogar), a 088 (listar os pendentes) e a 089 (enviar por e-mail).

## Valor

A administração traz novas pessoas para a organização: convida um e-mail e recebe, na hora, o link do convite para enviá-lo por fora do app.

## Usuários

Administradores da organização, numa página de convites dentro da área "Administração" na barra lateral, no momento em que convidam alguém.

## Requisitos

- **R1** (origem R1) — A administração convida informando só o e-mail; nome e senha ficam com a pessoa convidada, que os escolhe ao criar a conta.
- **R2** (origem R7) — O convite criado expira 7 dias depois de criado.
- **R3** (origem R3) — Convidar um e-mail que já tem convite pendente substitui o convite anterior por um novo, com novo prazo e novo link; o link antigo deixa de valer.
- **R4** (origem R2) — Convidar um e-mail já cadastrado como pessoa é recusado, com mensagem clara.
- **R5** (origem R4) — Ao criar um convite, a administração vê o link gerado e um botão para copiá-lo; copiar informa o resultado, inclusive a quem usa leitor de tela.
- **R6** (origem R4/R13) — O link completo é devolvido **uma única vez**, no momento da criação, e a tela diz isso a quem está convidando: depois de sair da confirmação, o link não é mostrado de novo, e obter um novo link exige convidar o mesmo e-mail outra vez (R3). É o mesmo desenho de segurança de uma chave de API — o servidor não guarda como recuperar o token, só como conferi-lo.
- **R7** (origem R13, parte do servidor) — O token do convite existe em claro apenas na URL do link; no servidor fica só o hash dele, nunca aparece em log e não é guardado em localStorage.
- **R8** (origem R14, parte de criar) — Quem não é administração não consegue criar convites mesmo chamando o servidor diretamente; a decisão é sempre do servidor.
- **R9** (origem R15) — Todos os textos da página de convites estão em pt_BR e a página é acessível: rótulos associados aos campos, navegável por teclado, erros anunciados, sem violação crítica nem séria de acessibilidade.

## Fora de escopo

- Listar os convites pendentes com e-mail, quando foram criados e quando expiram (origem R5) — **fatia 088 `invitations-list`**, empilhada logo depois desta. Enquanto a 088 não existir, a administração precisa copiar o link no instante em que cria o convite, porque ele não é mostrado de novo (R6) e não há tela onde reencontrá-lo; perder esse momento custa convidar o mesmo e-mail de novo. Isso é aceitável porque 085 e 088 vão para revisão empilhadas e são mescladas juntas.
- Abrir o link do convite, criar nome e senha e entrar na aplicação — **fatia 086 `invitations-accept`**. Nesta fatia o link gerado ainda não abre nada. Por isso as fatias 085 e 086 vão para revisão empilhadas e só são mescladas juntas, para que nenhum link morto chegue a uma pessoa.
- Revogar um convite pendente e derrubar o link na hora — **fatia 087 `invitations-revoke`**.
- Uso único do convite, tela de erro genérica para link inválido/expirado/usado e as regras do formulário de aceite (origem R8 a R12) — **fatia 086**.
- Envio do e-mail de convite por SMTP — **fatia 089 `invitations-email`**. Nesta fatia o envio é externo ao app: a administração copia o link e manda por fora.
- Lotar a pessoa convidada em uma unidade organizacional — **fatia 010 `unit-assignments`**.
- Reenviar um convite existente sem alterar o e-mail: não existe ação de reenvio; convidar de novo o mesmo e-mail substitui o convite (R3).
- Convidar várias pessoas de uma vez (convite em massa) — sem fatia.
- Promover a pessoa convidada a administração ou qualquer gestão de papéis — **fatia 011 `admin-roles`**.

## Pontos em aberto

- Nenhum.
