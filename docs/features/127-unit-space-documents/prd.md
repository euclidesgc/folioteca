# PRD 127 — unit-space-documents

A página do espaço de uma unidade (fatia **012** `unit-spaces`) hoje mostra só
o nome da unidade e o aviso de que os documentos chegam depois. Esta fatia
coloca os documentos nesse espaço.

## Valor

Quem está lotado diretamente numa unidade cria documentos no espaço dela e
trabalha neles junto com os colegas da unidade. Quem sai da unidade perde o
acesso na hora.

## Usuários

- **Pessoa lotada diretamente na unidade**: vê a lista de documentos do
  espaço, cria documentos novos e abre e edita qualquer um deles em
  colaboração.
- **Quem alcança o espaço só pela herança da unidade-pai** (fatia **140**):
  vê a página do espaço, mas não os documentos. Isso fica para a fatia **152**.
  _Atualizado pela fatia **152**: essa pessoa passa a ter nos documentos o
  mesmo acesso dos lotados diretos._
- **Quem não alcança o espaço**, inclusive a administração não lotada: continua
  sem saber que o espaço e os documentos dele existem.

## Requisitos

- **R1** — Na página do espaço, quem está lotado diretamente na unidade vê,
  no lugar do aviso da fatia **012**, a lista de documentos do espaço. Cada
  item mostra o título e a data de atualização, e a lista vem do mais
  recente para o mais antigo. É a mesma apresentação da lista de "Meus
  documentos".
- **R2** — A lista tem os estados de carregando e de erro, com "Tentar de
  novo". Com o espaço sem documentos, mostra um estado vazio que convida a
  criar o primeiro documento.
- **R3** — Quem está lotado diretamente vê o botão **"Novo documento"** na
  página do espaço. Ele se comporta como no espaço pessoal: cria o documento
  no espaço da unidade e abre esse documento.
- **R4** — Quem cria o documento é o proprietário dele. Todos os lotados
  diretamente na unidade abrem e editam qualquer documento do espaço (título
  e conteúdo) e editam juntos no mesmo documento.
- **R5** — Só o proprietário manda um documento do espaço para a lixeira,
  restaura ou apaga de vez. Os outros membros não veem essas ações, e o
  servidor recusa o pedido se ele chegar por outro caminho.
- **R6** — Um documento do espaço criado por mim aparece em "Meus documentos".
  Os documentos que os colegas criaram no espaço não aparecem lá.
- **R7** — Documento na lixeira sai da lista do espaço, e só o proprietário o
  abre. Para os outros membros, ele responde como inexistente. Restaurado,
  volta para a lista e para os membros.
- **R8** — Quem é removido da unidade (fatia **108**) perde o acesso na hora,
  sem sair da sessão. Os documentos somem da lista, o endereço de cada um
  responde como inexistente e, se o editor estiver aberto, a colaboração é
  recusada na verificação seguinte e a pessoa não grava mais nada.
- **R9** — A regra do proprietário vem primeiro: quem é removido da unidade
  continua vendo, editando e administrando os documentos que criou, pelo
  endereço e por "Meus documentos". Ele não vê mais os documentos dos colegas
  nem a lista do espaço.
- **R10** — Quem alcança o espaço só pela herança da unidade-pai vê a página
  do espaço, mas no lugar da lista vê o aviso "Os documentos deste espaço
  estão disponíveis para quem está lotado diretamente na unidade.". Essa
  pessoa não vê o botão "Novo documento" e, ao abrir um documento do espaço,
  recebe a resposta de inexistente.
  _Substituído pela fatia **152** `unit-space-documents-inherit`: quem alcança
  pela herança vê a lista, o botão "Novo documento" e abre e edita os
  documentos como os lotados diretos; o aviso deixa de existir._
- **R11** — Quem não alcança o espaço, inclusive a administração não lotada,
  recebe "não encontrado" para a lista, para a criação e para cada documento
  do espaço, sem distinção entre espaço inexistente e espaço sem acesso.
- **R12** — O compartilhamento direto (fatia **145**) continua valendo para
  documentos do espaço. Quem recebe o compartilhamento sem ser da unidade abre
  o documento no nível compartilhado, mas não vê a lista do espaço.
- **R13** — O servidor decide todo acesso pelo caminho único de decisão de
  acesso a documentos e relê a lotação a cada pedido.
- **R14** — Lista, estados e botão funcionam por teclado e têm nomes
  acessíveis. Carregamento, vazio e erro são anunciados por leitor de tela. A
  página não tem violação crítica nem séria de acessibilidade e segue o
  `docs/design.md`.
- **R15** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- **Documentos para quem alcança o espaço por herança**: fatia **152**
  `unit-space-documents-inherit`.
- **Membros do espaço da unidade**: fatia **128** `unit-space-members`.
- **Documentos no espaço livre**: fatia **136** `free-space-documents`.
- Mover documento entre espaços (pessoal e unidade, ou entre unidades).
- Lixeira do espaço: ver ou restaurar ali os documentos do espaço que estão na
  lixeira. A lixeira continua a do proprietário (fatia **007**).
- Níveis diferentes de acesso entre os membros da unidade (leitor ou editor).
- Transferir a propriedade de um documento do espaço.

## Decisões tomadas

- **Só a lotação direta dá acesso aos documentos** (R10). A herança fica na
  fatia **152**. _Desde a fatia **152**, a herança também dá acesso._
- **Todos os membros diretos podem editar**, e o compartilhamento direto
  continua valendo para quem não é da unidade (R4, R12).
- **Administração não tem acesso especial** (R11), igual à página do espaço
  na fatia **012**. A administração lotada na unidade tem o mesmo acesso de
  qualquer membro.
- **Membros não veem as ações de lixeira** (R5): elas são exclusivas do
  proprietário, como na fatia **007**. Assim ninguém vê um botão que o
  servidor recusaria.
- **O proprietário removido da unidade mantém os próprios documentos** (R9),
  mas perde a lista do espaço, que continua só para quem está lotado.
- **Unidade apagada** (fatia **066**): o espaço deixa de existir para todos.
  Cada proprietário continua com os próprios documentos em "Meus documentos"
  e pelo endereço. Para os outros, esses documentos respondem como
  inexistentes. Nada é apagado junto com a unidade.
- **Criar pelo estado vazio e pelo botão "Novo documento" dá no mesmo
  resultado** (R2, R3): o convite do vazio usa a mesma ação do botão.
- **O título do documento novo segue o padrão do espaço pessoal** (fatia
  **004**).

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- Uma pessoa lotada diretamente cria um documento pelo "Novo documento". Ele
  abre na hora, aparece no topo da lista do espaço e em "Meus documentos"
  dela.
- Um colega lotado diretamente vê o documento na lista, abre e edita junto,
  e as duas edições aparecem para os dois. O documento não aparece em "Meus
  documentos" do colega, e o colega não vê as ações de lixeira.
- A administração remove o colega da unidade enquanto ele está com o
  documento aberto. Ele deixa de gravar na verificação seguinte, o endereço
  responde "não encontrado" e a lista some da página dele.
- O proprietário, removido da unidade, continua abrindo e editando o próprio
  documento. O documento de um colega passa a responder "não encontrado" para
  ele.
- Com o documento na lixeira, ele some da lista do espaço e um membro recebe
  "não encontrado". Restaurado, volta para a lista e o membro volta a abri-lo.
- Quem alcança o espaço pela herança vê o aviso de lotação direta, sem lista
  e sem botão. A administração não lotada recebe "não encontrado" para a
  página, a lista, a criação e o documento. _Desde a fatia **152**, quem
  alcança pela herança vê a lista e o botão; a administração não lotada
  continua recebendo "não encontrado"._
- Um espaço sem documentos mostra o estado vazio com o convite para criar, e
  uma falha ao carregar mostra o erro com "Tentar de novo".
