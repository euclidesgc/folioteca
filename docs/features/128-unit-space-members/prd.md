# PRD 128 — unit-space-members

A página do espaço de uma unidade (fatia **012** `unit-spaces`) mostra o nome
da unidade e, desde a fatia **127** `unit-space-documents`, os documentos do
espaço. Mas não mostra quem faz parte dela. Esta fatia mostra essas pessoas.
Ela também paga uma dívida da **012**: hoje a página acha o espaço procurando
na lista inteira da barra lateral. Com esta fatia, ela passa a carregar só o
espaço aberto.

## Valor

Quem alcança o espaço de uma unidade sabe quem está lotado nela e com quem
está trabalhando, sem precisar pedir à administração.

## Usuários

- **Pessoa lotada diretamente na unidade**: vê a lista de pessoas lotadas na
  unidade, com ela mesma em primeiro, marcada como "você".
- **Quem alcança o espaço só pela herança da unidade-pai** (fatia **140**
  `unit-space-inherit-parent`): vê a mesma lista, que pode estar vazia.
- **Quem não alcança o espaço**, inclusive a administração não lotada: recebe
  "Espaço não encontrado.", como hoje.

## Requisitos

- **R1** — Na página do espaço de uma unidade, abaixo dos documentos, quem
  alcança o espaço vê a seção **"Pessoas nesta unidade"** com as pessoas
  lotadas **diretamente** na unidade. Cada linha mostra o nome e o e-mail.
- **R2** — A linha da própria pessoa tem o selo **"você"** e vem primeiro. As
  outras vêm em ordem alfabética de nome.
- **R3** — A seção tem os estados de carregando e de erro, com "Tentar de
  novo". Sem ninguém lotado diretamente, mostra "Ninguém está lotado
  diretamente nesta unidade.". Isso só acontece para quem alcança pela
  herança.
- **R4** — A lista é só de leitura: não tem ação de lotar nem de remover. Essas
  ações continuam na área de Administração (fatias **010** e **108**).
- **R5** — Quem alcança o espaço só pela herança vê a seção com as pessoas
  lotadas diretamente na unidade, e não aparece nela.
- **R6** — A página do espaço carrega só o espaço aberto, pelo endereço dele,
  sem baixar a lista de todos os espaços. Quem não alcança o espaço, inclusive
  a administração não lotada, recebe "Espaço não encontrado.". A mensagem é a
  mesma para endereço inválido, espaço inexistente e espaço sem acesso. O
  servidor relê a lotação e a herança a cada pedido.
- **R7** — A barra lateral continua como está: mesma seção "Unidades", mesmos
  itens, mesmo comportamento.
- **R8** — O espaço livre (fatia **013** `free-spaces`) não mostra a seção
  "Pessoas nesta unidade".
- **R9** — A lista e os estados dela têm nomes acessíveis e são navegáveis por
  teclado. Carregamento, vazio e erro são anunciados por leitor de tela. A
  apresentação segue o `docs/design.md`: linhas com nome e e-mail como na
  lista de lotados da Administração, sem ações, e o "você" como "Selo de
  status". Não há violação crítica nem séria de acessibilidade.
- **R10** — Todos os textos de tela estão em pt_BR.

## Casos de borda

- **Só eu estou lotado**: a lista tem uma linha, a minha, com "você".
- **Minha lotação é removida enquanto vejo a página**: ao recarregar a
  página, voltar a ela ou tentar de novo, recebo "Espaço não encontrado.". Se
  ainda alcanço pela herança, vejo a página sem a minha linha.
- **Um colega é lotado ou removido enquanto vejo a página**: a lista muda ao
  recarregar ou voltar à página. Não há atualização ao vivo.
- **Unidade herdada sem ninguém lotado diretamente**: aparece o estado vazio
  do R3.
- **Administração não lotada**: não alcança o espaço e recebe "Espaço não
  encontrado." para a página e para a lista.
- **Endereço com identificador inválido**: "Espaço não encontrado.", sem erro
  técnico na tela.

## Fora de escopo

- Lotar ou remover pessoas pela página do espaço (continua na Administração).
- Mostrar quem alcança o espaço pela herança: a lista tem só quem está lotado
  diretamente.
- Membros do espaço livre: fatia **135** `free-space-members`.
- Busca e paginação na lista.
- Atualização ao vivo da lista.

## Decisões tomadas

- **Quem alcança pela herança vê os membros** (R5): é informação da estrutura
  que a pessoa já alcança. É diferente dos documentos (fatia **127**), que
  exigem lotação direta.
- **O e-mail aparece para todos que alcançam o espaço** (R1): a lista é um
  diretório interno da organização.
- **Sem paginação** nesta fatia: unidades têm dezenas de pessoas. Fica como
  dívida possível, caso surjam unidades com centenas de lotados.
- **Nome igual**: a ordem alfabética é pelo nome, e o e-mail desempata.
- **Resposta opaca** (R6): a página não revela se o espaço existe para quem
  não o alcança, igual à fatia **012**.

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- Uma pessoa lotada diretamente abre o espaço e vê "Pessoas nesta unidade"
  abaixo dos documentos: ela em primeiro, com "você", e os colegas em ordem
  alfabética, com nome e e-mail, sem nenhuma ação.
- Quem alcança pela herança vê a lista dos lotados diretamente, sem a própria
  linha. Numa unidade sem lotados, vê "Ninguém está lotado diretamente nesta
  unidade.".
- A administração não lotada e um endereço com identificador inválido recebem
  "Espaço não encontrado.".
- Ao abrir o espaço, a página não pede a lista de todos os espaços, e a barra
  lateral continua igual.
- Uma falha ao carregar a lista mostra o erro com "Tentar de novo", e a nova
  tentativa carrega a lista.
- Um espaço livre não mostra a seção.
