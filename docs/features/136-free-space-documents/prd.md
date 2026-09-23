# PRD 136 — free-space-documents

A página de um espaço livre (fatia **013** `free-spaces`) hoje mostra o nome, o
aviso "Os documentos deste espaço ainda não chegaram…" e, desde a fatia **135**
`free-space-members`, quem está no espaço. Esta fatia coloca os documentos
nesse espaço, espelhando o que a fatia **127** `unit-space-documents` fez no
espaço de unidade.

## Valor

O dono e os membros de um espaço livre criam documentos no espaço e trabalham
neles juntos. Quem é removido do espaço perde o acesso na hora.

## Usuários

- **Dono do espaço livre**: vê a lista de documentos, cria documentos e abre e
  edita qualquer um deles em colaboração.
- **Membro do espaço** (adicionado pela fatia **134**): o mesmo que o dono.
- **Pessoa removida do espaço** (fatia **135**): deixa de ver os documentos do
  espaço, menos os que ela mesma criou.
- **Quem não alcança o espaço**, inclusive a administração que não é membro:
  continua sem saber que o espaço e os documentos dele existem.

## Requisitos

- **R1** — Na página do espaço livre, o dono e os membros veem, no lugar do
  aviso "Os documentos deste espaço ainda não chegaram…", a lista de documentos
  do espaço. Cada item mostra o título e a data de atualização, do mais recente
  para o mais antigo. É a mesma apresentação da lista do espaço de unidade
  (fatia **127**) e de "Meus documentos". A seção "Pessoas neste espaço" da
  fatia **135** continua na página.
- **R2** — A lista tem os estados de carregando e de erro, com "Tentar de
  novo". Com o espaço sem documentos, mostra um estado vazio que convida a
  criar o primeiro documento.
- **R3** — O dono e os membros veem o botão **"Novo documento"** na página do
  espaço. Ele se comporta como no espaço pessoal e no de unidade: cria o
  documento no espaço livre e abre esse documento.
- **R4** — Quem cria o documento é o proprietário dele. O dono do espaço e
  todos os membros abrem e editam qualquer documento do espaço (título e
  conteúdo) e editam juntos no mesmo documento.
- **R5** — Só o proprietário do documento manda para a lixeira, restaura ou
  apaga de vez. O dono do espaço não é proprietário dos documentos dos
  membros: edita, mas não vê essas ações neles, e o servidor recusa o pedido se
  ele chegar por outro caminho. O mesmo vale para os outros membros.
- **R6** — Um documento do espaço criado por mim aparece em "Meus documentos".
  Os documentos que os colegas criaram no espaço não aparecem lá.
- **R7** — Documento na lixeira sai da lista do espaço, e só o proprietário o
  abre. Para o dono do espaço e os outros membros, ele responde como
  inexistente. Restaurado, volta para a lista e para todos do espaço.
- **R8** — Quem é removido do espaço perde o acesso na hora no servidor, sem
  sair da sessão: os documentos do espaço somem da lista, o endereço de cada um
  responde como inexistente e, se o editor estiver aberto, a próxima conexão de
  colaboração é recusada e a pessoa não grava mais nada.
- **R9** — A regra do proprietário vem primeiro: quem é removido do espaço
  continua vendo, editando e administrando os documentos que criou, pelo
  endereço e por "Meus documentos". Esses documentos continuam no espaço, na
  lista e editáveis para o dono e os membros que ficaram. A pessoa removida não
  vê mais os documentos dos colegas nem a lista do espaço.
- **R10** — Quem não alcança o espaço, inclusive a administração que não é
  membro, recebe "não encontrado" para a lista, para a criação e para cada
  documento do espaço, sem distinção entre espaço inexistente e espaço sem
  acesso.
- **R11** — O compartilhamento direto (fatia **145**) continua valendo para
  documentos do espaço livre. Quem recebe o compartilhamento sem ser do espaço
  abre o documento no nível compartilhado, mas não vê a lista do espaço.
- **R12** — O servidor decide todo acesso pelo caminho único de decisão de
  acesso a documentos e relê a participação no espaço a cada pedido.
- **R13** — Lista, estados e botão funcionam por teclado e têm nomes
  acessíveis. Carregamento, vazio e erro são anunciados por leitor de tela. A
  página não tem violação crítica nem séria de acessibilidade, segue o
  `docs/design.md` e tem o mesmo acabamento da fatia **127**.
- **R14** — Todos os textos de tela estão em pt_BR.

## Casos de borda

- **Membro removido com o documento aberto**: o editor continua na tela até a
  próxima conexão de colaboração, que é recusada; nada mais é gravado, e o
  endereço passa a responder "não encontrado" (R8).
- **Proprietário removido do espaço**: continua com o próprio documento em
  "Meus documentos" e pelo endereço, com todas as ações; o documento segue no
  espaço para os demais, que continuam editando, e os documentos dos colegas
  passam a responder "não encontrado" para ele (R9).
- **Documento na lixeira**: some da lista do espaço e responde como
  inexistente para todos, menos o proprietário; restaurado, volta (R7).
- **Dono do espaço diante do documento de um membro**: edita, mas não vê as
  ações de lixeira; o pedido direto ao servidor é recusado (R5).
- **Espaço com só o dono**: lista, estado vazio e "Novo documento" funcionam
  igual; os documentos dele aparecem na lista e em "Meus documentos" (R1–R3,
  R6).

## Fora de escopo

- Papéis de leitor e editor no espaço livre: fatia **142**
  `free-space-member-roles`. Aqui todos editam.
- Deixar membros adicionarem pessoas: fatia **141**
  `free-space-restrict-invite`.
- Mover documento entre espaços (pessoal, unidade ou livre).
- Lixeira do espaço: ver ou restaurar ali os documentos do espaço que estão na
  lixeira. A lixeira continua a do proprietário (fatia **007**).
- Transferir a propriedade de um documento do espaço, inclusive para o dono do
  espaço.
- Mostrar em "Meus documentos" os documentos dos colegas do espaço.
- Apagar o espaço livre e o que acontece com os documentos dele.
- Atualização ao vivo da lista do espaço.

## Decisões tomadas

- **Dono do espaço e membros têm o mesmo nível: editar** (R4). Papéis ficam
  para a fatia **142**.
- **O dono do espaço não é dono dos documentos** (R5): edita os dos membros,
  mas lixeira, restauração e exclusão são só do proprietário, como na fatia
  **007**. Quem não pode não vê o botão, para não ver algo que o servidor
  recusaria.
- **O documento do proprietário removido fica no espaço** (R9): ele o mantém,
  e os que ficaram continuam trabalhando nele.
- **Administração não tem acesso especial** (R10), igual à página do espaço
  livre na fatia **013**.
- **O compartilhamento direto continua valendo** (R11), como na fatia **127**.
- **Criar pelo estado vazio e pelo botão "Novo documento" dá no mesmo
  resultado** (R2, R3), e o título do documento novo segue o padrão do espaço
  pessoal (fatia **004**).
- **Removido com a página do espaço aberta**: a lista e a página seguem a regra
  da fatia **135** e mostram "Espaço não encontrado." no próximo carregamento.

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- Um membro cria um documento pelo "Novo documento". Ele abre na hora, aparece
  no topo da lista do espaço e em "Meus documentos" dele.
- O dono do espaço vê o documento na lista, abre e edita junto, e as duas
  edições aparecem para os dois. O documento não aparece em "Meus documentos"
  do dono do espaço, e ele não vê as ações de lixeira.
- O dono remove um membro que está com um documento de outro aberto. Ele deixa
  de gravar na conexão seguinte, o endereço responde "não encontrado" e a lista
  some para ele.
- O membro removido continua abrindo e editando o documento que criou, e o dono
  do espaço continua vendo esse documento na lista e editando.
- Com o documento na lixeira, ele some da lista do espaço e o dono do espaço
  recebe "não encontrado". Restaurado, volta para a lista.
- Uma terceira pessoa e a administração que não é membro recebem "não
  encontrado" para a lista, a criação e o documento.
- O aviso "Os documentos deste espaço ainda não chegaram…" não aparece mais; um
  espaço sem documentos mostra o estado vazio com o convite para criar, e uma
  falha ao carregar mostra o erro com "Tentar de novo".
