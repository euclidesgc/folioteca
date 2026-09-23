# PRD 086 — invitations-accept

Fatia derivada da 009 `invitations` (PRD de origem em `docs/features/085-invitations-create/prd-origem-009.md`), junto com a 085 (convidar, entregue no PR #109), a 087 (revogar), a 088 (listar os pendentes) e a 089 (enviar por e-mail).

As fatias 085 e 086 vão para revisão empilhadas e são **mescladas juntas**: só com esta fatia o link copiado na 085 abre alguma coisa, e sem ela nenhum link enviado a uma pessoa levaria a lugar nenhum.

## Valor

A pessoa convidada abre o link recebido por fora do app, escolhe o próprio nome e a própria senha e entra no Folioteca já dentro da organização, sem depender de ninguém para criar a conta.

## Usuários

Pessoas convidadas, sem sessão nenhuma no Folioteca, ao abrir o link do convite recebido por fora do app.

## Requisitos

- **R1** (origem R9) — Quem abre o link do convite sem estar autenticado vê a quem o convite se destina — o e-mail convidado — e de que organização ele é, antes de preencher qualquer coisa.
- **R2** (origem R9) — A mesma tela pede nome e senha. A senha segue exatamente as regras da instalação (mínimo de 12 caracteres), sem regra nova nem regra afrouxada para o convite; o e-mail não é editável, porque é o do convite.
- **R3** (origem R10) — Ao confirmar com um convite válido, a conta é criada, a sessão começa em cookie httpOnly e a pessoa cai na aplicação já autenticada, sem passar pela tela de entrar.
- **R4** (origem R11) — A pessoa criada por convite entra sem ser administração e sem pertencer a nenhuma unidade: vê o próprio espaço pessoal e os próprios documentos, e **não** vê a área "Administração" na barra lateral. Espaços de unidade só aparecem quando ela for lotada em alguma (fatia 010).
- **R5** (origem R8) — O convite vale uma vez: assim que a conta é criada a partir dele, abrir o mesmo link de novo cai na tela de erro de R6.
- **R6** (origem R12) — Link inválido, expirado, já usado ou revogado mostra **a mesma** tela de erro, genérica, com caminho para a tela de entrar. A mensagem não diz qual foi o motivo nem revela se o e-mail do convite existe, e nada na resposta do servidor (código, tempo, texto) permite distinguir os casos.
- **R7** (origem R12) — Quem já está autenticado e abre um link de convite vê a mesma tela de erro genérica de R6, e **a sessão em curso não é encerrada**. É o comportamento mais seguro: encerrar a sessão de quem está trabalhando por causa de um link qualquer seria um jeito de derrubar sessão alheia, e aceitar o convite com a sessão aberta criaria uma segunda conta sem a pessoa perceber. Quem quiser aceitar o convite sai da sessão e abre o link de novo.
- **R8** (origem R13) — O token do convite existe em claro apenas na URL do link: não é guardado em localStorage, nem em nenhum outro armazenamento do navegador, e não aparece em log.
- **R9** (origem R15) — Todos os textos da tela de aceite e da tela de erro estão em pt_BR, com rótulos associados aos campos, navegação por teclado com foco previsível, erros de formulário anunciados a leitor de tela e nenhuma violação crítica ou séria de acessibilidade.

## Fora de escopo

- Revogar um convite pendente e derrubar o link na hora — **fatia 087 `invitations-revoke`**. Aqui o convite revogado já cai na tela de erro genérica (R6), mas não existe ação para revogá-lo.
- Listar os convites pendentes com e-mail, criação e expiração — **fatia 088 `invitations-list`**.
- Envio do e-mail de convite por SMTP — **fatia 089 `invitations-email`**. O link continua sendo entregue por fora do app.
- Lotar a pessoa convidada em uma unidade organizacional — **fatia 010 `unit-assignments`**.
- Promover a pessoa convidada a administração ou qualquer gestão de papéis — **fatia 011 `admin-roles`**.
- Reenviar um convite: não existe ação de reenvio; convidar de novo o mesmo e-mail substitui o convite (fatia 085).
- Criar o convite e copiar o link — **fatia 085 `invitations-create`**, já entregue.

## Riscos

- Link morto se as fatias forem mescladas separadas: 085 entrega um link que só esta fatia atende. Mitigação: mesclar 085 e 086 juntas.
- Enumeração de e-mails pela tela de aceite: se a recusa distinguir "não existe" de "expirado", o link vira oráculo. Mitigação está em R6 — uma só tela, uma só mensagem.
- Conta duplicada de quem já tem sessão: tratado por R7.

## Pontos em aberto

- Regras do campo nome (tamanho mínimo, caracteres aceitos) não foram definidas no PRD de origem; vale o que a instalação já usa hoje para nome de pessoa.
- Não foi decidido para onde exatamente a pessoa cai depois de entrar (R3 diz "a aplicação"): a tela inicial padrão de quem não tem unidade.
