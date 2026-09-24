# PRD 142 — free-space-member-roles

Hoje todo membro de um espaço livre abre, cria e edita os documentos do espaço
(fatia **136** `free-space-documents`) e, com o espaço aberto, adiciona pessoas
(fatia **141** `free-space-restrict-invite`). Esta fatia é a última das três em
que o item **014** `space-permissions` foi dividido (as outras são **140** e
**141**). Ela deixa o dono dar a cada membro o nível "Pode editar" ou "Pode
ver".

## Valor

O dono do espaço livre traz pessoas só para ler, sem que elas criem ou mudem
documentos, e muda o nível de alguém a qualquer momento.

## Usuários

- **Dono do espaço livre**: define o nível de cada membro na lista "Pessoas
  neste espaço". Não tem nível: faz tudo o que faz hoje.
- **Membro editor** ("Pode editar"): faz tudo o que um membro faz hoje.
- **Membro leitor** ("Pode ver"): vê o espaço, a lista de documentos e as
  pessoas, e abre os documentos em somente leitura.

## Requisitos

- **R1** — Todo membro de espaço livre tem um nível: **"Pode editar"** ou
  **"Pode ver"**. Quem já é membro e quem entrar depois começa em "Pode
  editar".
- **R2** — Na lista "Pessoas neste espaço", todos veem na linha de cada membro
  o selo **"editor"** ou **"leitor"**, conforme o nível. O dono continua com o
  selo **"dono"** e não tem nível.
- **R3** — Só o dono vê, na linha de cada membro (nunca na própria), o seletor
  **"Nível de {nome}"** com as opções "Pode editar" e "Pode ver", mostrando o
  nível atual. Membros não veem o seletor, nem o próprio.
- **R4** — A troca vale ao escolher a outra opção, sem confirmação. Durante o
  envio, a linha mostra "Salvando…", o seletor fica indisponível sem perder o
  foco e o foco continua nele. No sucesso, a notificação **"Nível de {nome}
  atualizado"** confirma e o selo da linha muda. Uma falha devolve o seletor ao
  valor anterior, com aviso.
- **R5** — Só o dono muda o nível, e só de membros. O servidor recusa o pedido
  de um membro, o pedido do dono sobre o próprio nível e o pedido sobre quem não
  é membro. Quem não alcança o espaço recebe a mesma resposta de espaço
  inexistente.
- **R6** — O leitor vê a lista de documentos do espaço e abre cada um em
  somente leitura, como quem recebe um compartilhamento em "Pode ver" (fatia
  **145**): não altera título nem conteúdo, e o servidor não grava nada que
  venha dele.
- **R7** — O leitor não cria documento no espaço: o botão "Novo documento" não
  aparece, e o estado vazio da lista mostra **"Nenhum documento neste espaço
  ainda."**, sem convite para criar. Se ele tentar criar pelo servidor, recebe
  a recusa **"Só quem pode editar cria documentos neste espaço."**.
- **R8** — O leitor não adiciona pessoas, mesmo com o espaço aberto (fatia
  **141**): a ação "Adicionar pessoa" não aparece para ele, e o servidor recusa
  a adição com a mensagem **"Só quem pode editar adiciona pessoas a este
  espaço."**.
- **R9** — O editor continua como hoje: cria, abre e edita documentos do
  espaço e, com o espaço aberto, adiciona pessoas.
- **R10** — A troca vale na hora no servidor. Rebaixado para leitor, o membro
  tem a próxima conexão de colaboração em somente leitura e, ao recarregar,
  vê a página do documento em somente leitura, a página do espaço sem "Novo
  documento" e sem "Adicionar pessoa". Promovido a editor, volta a editar e
  criar da mesma forma.
- **R11** — A regra do proprietário vem primeiro: os documentos que o membro
  criou no espaço continuam dele depois de rebaixado, e ele continua editando e
  administrando esses documentos (lixeira, restauração, exclusão), como na
  **136**.
- **R12** — Vale o maior nível: um documento compartilhado diretamente com o
  leitor em "Pode editar" continua editável para ele.
- **R13** — O seletor e os selos funcionam por teclado, têm nome acessível e
  anunciam a troca, o "Salvando…", a confirmação e os erros por leitor de tela.
  A lista segue o `docs/design.md` (selos pela receita "Selo de status") com o
  mesmo acabamento dos controles da **140** e da **141**, sem violação crítica
  nem séria de acessibilidade.
- **R14** — Todos os textos de tela estão em pt_BR.

## Casos de borda

- **Rebaixado com o editor aberto**: o que ele digita até a próxima conexão de
  colaboração não é gravado pelo servidor; a conexão seguinte entra em somente
  leitura e, ao recarregar, a página do documento está em somente leitura
  (R6, R10).
- **Leitor proprietário de documento no espaço**: continua editando e
  administrando esse documento; os documentos dos colegas ficam em somente
  leitura para ele (R11).
- **Leitor com compartilhamento direto em "Pode editar"**: edita aquele
  documento; os demais do espaço seguem em somente leitura (R12).
- **Dono tentando mudar o próprio nível**: não há seletor na linha dele, e o
  pedido direto ao servidor é recusado (R3, R5).
- **Espaço aberto e leitor tentando adicionar**: não vê "Adicionar pessoa"; o
  pedido direto, ou de uma aba aberta antes do rebaixamento, é recusado com
  "Só quem pode editar adiciona pessoas a este espaço." no diálogo, e ninguém
  é adicionado (R8).

## Fora de escopo

- Níveis em espaço de unidade.
- Adicionar alguém já como leitor: todo novo membro entra editor, e o dono
  muda depois.
- Papéis por documento além do compartilhamento que já existe.
- Histórico de trocas de nível ou de quem trocou.
- Avisar o membro (e-mail ou notificação) da troca de nível.
- Membro mudar o próprio nível ou o de outro membro.
- Dar ao dono um nível, transferir a posse do espaço ou ter mais de um dono.

## Decisões tomadas

- **Padrão editor** (R1): nada muda para quem já é membro até o dono rebaixar.
- **Dono sem nível** (R2, R5): ele sempre faz tudo, e o servidor recusa mudar o
  nível dele.
- **Sem confirmação na troca** (R4): a troca se desfaz com outra escolha, como
  nos controles da **140** e da **141**.
- **Leitor não adiciona pessoas** (R8): abrir o espaço (141) amplia só quem
  pode editar. A mensagem de recusa segue o padrão da de criação (R7).
- **Proprietário vem primeiro e vale o maior nível** (R11, R12): o nível no
  espaço nunca tira o que a pessoa já tem pelo próprio documento ou pelo
  compartilhamento direto.
- **Documento aberto em tempo real não é derrubado** (R10): o rebaixamento
  vale na próxima conexão de colaboração e no recarregamento, como a remoção
  na **136**.

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- Num espaço existente, todo membro aparece com o selo "editor" e o dono com
  "dono"; só o dono vê o seletor "Nível de {nome}", e nunca na própria linha.
- O dono escolhe "Pode ver" para um membro: a linha mostra "Salvando…", o foco
  fica no seletor, a notificação "Nível de {nome} atualizado" aparece e o selo
  vira "leitor". Uma falha devolve o valor anterior, com aviso.
- O leitor, ao recarregar, não vê "Novo documento" nem "Adicionar pessoa" (com
  o espaço aberto), abre um documento de um colega em somente leitura e segue
  editando o documento que criou; a criação e a adição pelo servidor são
  recusadas com as mensagens de R7 e R8.
- Com o editor aberto no momento do rebaixamento, a próxima conexão de
  colaboração entra em somente leitura e nada novo é gravado.
- Um documento compartilhado com o leitor em "Pode editar" continua editável
  para ele.
- O pedido de um membro para mudar um nível e o do dono para mudar o próprio
  são recusados; promovido de volta, o membro volta a criar e editar.
