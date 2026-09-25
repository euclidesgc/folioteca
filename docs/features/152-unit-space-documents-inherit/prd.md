# PRD 152 — unit-space-documents-inherit

Desde a fatia **140** `unit-space-inherit-parent`, quem está lotado numa
unidade-pai vê, na barra lateral, o espaço das unidades de baixo que herdam
dela. Mas, pela fatia **127** `unit-space-documents`, essa pessoa só vê o
aviso de que os documentos são para a lotação direta. Esta fatia junta as
duas: quem alcança o espaço pela herança passa a trabalhar nos documentos dele.

## Valor

Quem alcança o espaço de uma unidade pela herança vê, abre, edita e cria
documentos nele como qualquer pessoa lotada diretamente. Uma só regra decide
quem alcança o espaço: a barra lateral, a lista do espaço e os documentos.

## Usuários

- **Quem alcança o espaço só pela herança da unidade-pai** (fatia **140**):
  passa a ter nos documentos do espaço o mesmo acesso dos lotados diretos.
- **Pessoa lotada diretamente na unidade**: nada muda para ela, e passa a
  trabalhar junto com quem chega pela herança.
- **Quem não alcança o espaço**, inclusive a administração não lotada e sem
  herança: continua sem saber que o espaço e os documentos dele existem.

## Requisitos

- **R1** — Quem alcança o espaço pela herança vê, na página do espaço, a lista
  de documentos com os mesmos estados (carregando, vazio com convite para
  criar, erro com "Tentar de novo") que os lotados diretos veem. O aviso "Os
  documentos deste espaço estão disponíveis para quem está lotado diretamente
  na unidade." deixa de existir.
- **R2** — Quem alcança pela herança vê o botão **"Novo documento"** e cria
  documentos no espaço, como os lotados diretos. Quem cria é o proprietário, e
  o documento aparece em "Meus documentos" dessa pessoa.
- **R3** — Quem alcança pela herança abre e edita (título e conteúdo) qualquer
  documento do espaço e edita junto com os outros no mesmo documento.
- **R4** — A regra de alcance é a mesma da barra lateral (fatia **140**):
  lotação direta na unidade ou lotação numa unidade acima, subindo pela cadeia
  de espaços que herdam até o primeiro com "Permissões próprias". Quem vê o
  espaço na barra lateral vê os documentos; quem não vê, não vê nenhum deles.
- **R5** — O acesso a cada documento continua decidido nesta ordem:
  proprietário, depois lixeira, depois o maior entre o compartilhamento direto
  (fatia **145**) e a participação no espaço, e por fim nenhum acesso. A
  herança só amplia quem conta como participante do espaço.
- **R6** — Lixeira continua exclusiva do proprietário (fatia **127**, R5 e R7):
  quem chega pela herança não vê as ações de lixeira de documentos alheios, e
  documento na lixeira responde para essa pessoa como inexistente.
- **R7** — A perda é imediata. Se o espaço volta para "Permissões próprias",
  se a cadeia se quebra no meio ou se a pessoa deixa de estar lotada na
  unidade de cima, ela deixa de ver a lista e os documentos alheios na próxima
  leitura, sem sair da sessão, e o endereço de cada um responde como
  inexistente. Nada é guardado por pessoa: o acesso é recalculado a cada
  pedido. Quem ganha acesso também o recebe na próxima leitura.
- **R8** — Quem perde a herança continua com os documentos que criou no espaço,
  pelo endereço e por "Meus documentos", como o proprietário removido da
  unidade (fatia **127**, R9).
- **R9** — Com o editor aberto no momento da perda, a conexão de colaboração
  segue o mesmo comportamento que vale hoje para quem sai da unidade (fatia
  **127**, R8). Encerrá-la na hora é a dívida **049**.
- **R10** — A seção "Pessoas nesta unidade" (fatia **128**) não muda: mostra só
  a lotação direta, e quem chega pela herança não aparece nela.
- **R11** — O servidor decide todo acesso pelo caminho único de decisão de
  acesso a documentos. Quem não alcança o espaço recebe "não encontrado" para a
  lista, a criação e cada documento, sem distinção entre espaço inexistente e
  espaço sem acesso.
- **R12** — Lista, estados e botão seguem acessíveis por teclado e leitor de
  tela e o `docs/design.md`, sem violação crítica nem séria. Textos em pt_BR.

## Fora de escopo

- Encerrar ou rebaixar na hora a conexão de colaboração aberta quando o acesso
  pelo espaço acaba: dívida **049**.
- Mostrar em "Pessoas nesta unidade" quem alcança pela herança, ou marcar na
  página ou na barra lateral por qual caminho a pessoa tem acesso: fatia
  **018** `who-can-see`.
- Níveis diferentes entre herdeiros e lotados diretos (leitor ou editor).
- Herança de baixo para cima e compartilhamento com unidade: fatia **016**.
- Mudar o controle de herança da "Estrutura" (fatia **140**).

## Decisões tomadas

- **Mesmo acesso dos lotados diretos, sem exceção** (R1 a R4), inclusive criar
  documento.
- **Uma só regra de alcance** para barra lateral, lista do espaço e documentos
  (R4).
- **Perda imediata e nada materializado** (R7); a conexão já aberta fica para a
  **049** (R9).
- **A ordem de decisão do acesso não muda** (R5).
- **"Pessoas nesta unidade" continua só com a lotação direta** (R10).

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- Com a filha herdando, uma pessoa lotada só na mãe vê a lista de documentos
  do espaço da filha, abre e edita um documento de um lotado direto, e os dois
  veem as edições um do outro.
- Essa pessoa cria um documento pelo "Novo documento"; ele aparece na lista do
  espaço e em "Meus documentos" dela, e um lotado direto o abre e edita.
- A filha volta para "Permissões próprias": a pessoa deixa de ver o espaço e a
  lista, o documento do colega responde "não encontrado", e o que ela criou
  continua em "Meus documentos".
- Na cadeia avó → mãe → filha, com a mãe em "Permissões próprias", quem está
  lotado só na avó recebe "não encontrado" para os documentos da filha.
- "Pessoas nesta unidade" continua sem a pessoa que chega pela herança.
