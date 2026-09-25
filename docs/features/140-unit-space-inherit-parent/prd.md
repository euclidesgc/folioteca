# PRD 140 — unit-space-inherit-parent

Hoje só quem está lotado direto numa unidade vê o espaço dela (fatia **012**
`unit-spaces`). Esta fatia é a primeira das três em que o item **014**
`space-permissions` foi dividido (as outras são **141** e **142**). Ela
permite que a administração abra o espaço de uma unidade para quem está
lotado nas unidades acima dela.

## Valor

Na página "Estrutura", a administração marca o espaço de uma unidade como
"herda da unidade-pai". Quem está lotado na unidade-pai (e, em cadeia, nas de
cima) passa a ver esse espaço na hora, sem precisar ser lotado também em cada
unidade filha.

## Usuários

- **Administração**: escolhe, na página "Estrutura", se o espaço de cada
  unidade tem permissões próprias ou herda da unidade-pai.
- **Pessoas lotadas numa unidade-pai**: passam a encontrar na barra lateral o
  espaço das unidades de baixo que herdam dela.

## Requisitos

- **R1** — Todo espaço de unidade, o que já existe e o que nascer depois, fica
  com **"Permissões próprias"** por padrão: só quem está lotado direto na
  unidade vê o espaço, como hoje.
- **R2** — Na página "Estrutura" (área Administração), o painel da unidade
  selecionada mostra, ao lado das ações de renomear e apagar (fatias **065** e
  **066**), um controle com dois estados, **"Permissões próprias"** e **"Herda
  da unidade-pai"**. O controle traz o modo atual do espaço dessa unidade e uma
  frase explicando quem vê o espaço no estado escolhido. Como a "Estrutura" é
  só da administração, só ela vê e muda o modo.
- **R3** — Quando a unidade selecionada é a raiz, o painel não mostra o
  controle: ela não tem unidade-pai.
- **R4** — A administração muda o modo de qualquer unidade da árvore, esteja
  ou não lotada nela. Mudar o modo não dá à administração acesso ao espaço:
  ela abre a página do espaço só onde está lotada ou onde herda acesso, pela
  regra da **012**.
- **R5** — A troca vale ao escolher o outro estado, sem pedir confirmação. O
  resultado aparece no próprio controle e na frase, e um erro deixa o controle
  no estado anterior, com aviso.
- **R6** — Com "Herda da unidade-pai", o espaço é visto por quem está lotado
  direto na unidade e também por quem vê a unidade-pai por lotação direta. Se
  o espaço da unidade-pai também herda, a lotação da avó vale igualmente, e
  assim por diante. A cadeia para no primeiro espaço com "Permissões
  próprias": a lotação dessa unidade conta, mas a das unidades acima dela não.
- **R7** — Quem ganha acesso por herança vê o espaço na seção "Unidades" da
  barra lateral, na mesma ordem alfabética dos outros e sem marcação que o
  diferencie, e abre a página dele. A seção aparece para quem só tem acesso
  por herança, mesmo sem nenhuma lotação direta.
- **R8** — A pessoa lotada em várias unidades da mesma cadeia (por exemplo, na
  filha e na mãe) vê o espaço uma vez só na barra lateral.
- **R9** — A mudança de modo vale na hora. Quem ganhou acesso vê o espaço na
  próxima leitura, e quem perdeu acesso ao voltar para "Permissões próprias"
  (ou por uma quebra no meio da cadeia) deixa de ver o item na barra lateral.
  A página passa a responder como espaço inexistente. Ninguém precisa sair e
  entrar de novo na sessão.
- **R10** — A lotação continua mandando: quem deixa de estar lotado numa
  unidade da cadeia perde o acesso herdado por ela na leitura seguinte, e quem
  passa a ser lotado ganha o acesso.
- **R11** — Ao apagar uma unidade (sempre sem filhas, fatia **066**), o espaço
  dela some para todos, inclusive para quem o via por herança. Nenhuma cadeia
  fica pendurada.
- **R12** — A página do espaço da unidade não muda nesta fatia: não mostra o
  modo nem o controle. A página continua respondendo igual para espaço
  inexistente e para espaço sem acesso, e a decisão de acesso é sempre do
  servidor, relida a cada pedido (mesmo padrão da **012**).
- **R13** — O controle funciona por teclado, tem nome acessível e anuncia a
  mudança e os erros por leitor de tela. O painel não tem violação crítica nem
  séria de acessibilidade.
- **R14** — Todos os textos de tela e rótulos estão em pt_BR.

## Fora de escopo

- **Direção contrária** (quem está lotado na filha vê o espaço da mãe) e
  compartilhar com unidade e tudo abaixo dela: fatia **016**
  `share-with-groups`.
- **Fechar o espaço livre para convite só do dono**: fatia **141**.
- **Leitor e editor em espaço livre**: fatia **142**.
- **Documentos no espaço da unidade**: fatia **127**. Aqui a herança dá acesso
  só ao espaço (barra lateral e página).
- **Herança em espaço pessoal ou livre**: esses espaços não têm essa
  configuração.
- **Mostrar ou mudar o modo na página do espaço** e mostrar o modo de cada
  unidade na árvore da "Estrutura": o modo aparece só no painel da unidade
  selecionada.
- **Marcar na barra lateral o item obtido por herança** e explicar por qual
  caminho a pessoa tem acesso: fatia **018** `who-can-see`.
- **Prévia de quem ganha e quem perde acesso** antes de confirmar: fatia
  **020**.
- **Lista de membros por herança** na página do espaço: a fatia **128** trata
  só da lotação direta.

## Decisões tomadas

- **Só a administração muda o modo**: é assunto de estrutura, como nas fatias
  **064** a **066**. Quem está lotado só vê o efeito.
- **O controle fica na "Estrutura"**, no painel da unidade selecionada, junto
  de renomear e apagar (R2). Assim a administração alcança qualquer unidade sem
  precisar abrir o espaço, e a regra da **012**, pela qual a administração não
  tem acesso próprio ao espaço, continua valendo (R4, R12).
- **Herança de cima para baixo**: o público da mãe desce para a filha. A
  direção contrária fica para a **016**.
- **Sem confirmação ao ativar a herança** (R5): a frase do controle já diz
  quem passa a ver, e a prévia com números é a fatia **020**.
- **Sem marcação do item herdado na barra lateral** (R7): explicar o caminho
  do acesso fica para a fatia **018**.
- **Perda de acesso na hora**, e a página responde como inexistente (R9),
  mesmo padrão das fatias **010**, **012** e **013**.

## Métricas de pronto (observáveis)

- Com a filha marcada, na "Estrutura", como "Herda da unidade-pai", uma pessoa
  lotada só na mãe vê o espaço da filha na barra lateral e abre a página dele,
  sem sair da sessão.
- Na cadeia avó → mãe → filha, com a filha e a mãe herdando, quem está lotado
  só na avó vê o espaço da filha. Se a mãe voltar para "Permissões próprias",
  essa pessoa deixa de ver o espaço da filha, e quem está lotado na mãe
  continua vendo.
- Voltar a filha para "Permissões próprias" tira o item da barra lateral de
  quem só herdava, e a página responde como inexistente.
- Na "Estrutura", selecionar a raiz não mostra o controle. Uma administração
  sem lotação na unidade muda o modo e, mesmo assim, não passa a ver o espaço
  na barra lateral.
