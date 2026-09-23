# PRD 012 — unit-spaces

Toda unidade já nasce com um espaço espelhado (tipo de espaço "unidade"),
decidido nas fatias **065** `org-units-create-rename` e **010**
`unit-assignments`; a tela desse espaço ficou para depois. Esta fatia abre
essa tela.

## Valor

Quem está lotado numa unidade enxerga, pela barra lateral, o espaço daquela
unidade e chega à página dele, com o nome da unidade: o primeiro passo para o
espaço de unidade ter algo visível, antes de mostrar membros (fatia **128**)
e guardar documentos (fatia **127**).

## Usuários

Qualquer pessoa lotada em uma ou mais unidades (fatia **010**
`unit-assignments`), ao abrir o app e querer chegar ao espaço da unidade em
que trabalha.

## Requisitos

- **R1** — A barra lateral ganha a seção **"Unidades"**, com um item por
  unidade em que a pessoa está lotada, em ordem alfabética de nome; cada item
  abre a página do espaço daquela unidade.
- **R2** — Quem não está lotado em nenhuma unidade não vê a seção "Unidades"
  na barra lateral.
- **R3** — A página do espaço de uma unidade mostra o **nome da unidade** e
  diz, em texto, que documentos no espaço da unidade ainda não existem e
  chegam depois (fatia **127**), no lugar onde eles apareceriam.
- **R4** — Só quem está lotado na unidade — direto, sem herança — vê a seção
  na barra lateral, o item dela e a página do espaço; ser administração da
  organização não dá, por si só, acesso ao espaço de uma unidade em que a
  pessoa não está lotada. A decisão é sempre do servidor, relida a cada
  pedido.
- **R5** — Espaço de unidade inexistente e espaço de unidade em que a pessoa
  não está lotada respondem da mesma forma, sem indicar qual dos dois casos
  é.
- **R6** — Quem deixa de estar lotado numa unidade deixa de ver a seção (se
  não sobrar nenhuma outra lotação), o item dela e a página na leitura
  seguinte; não há necessidade de a pessoa sair e voltar a entrar na sessão.
- **R7** — A página e a seção na barra lateral não têm violação crítica nem
  séria de acessibilidade, funcionam por teclado do começo ao fim, e o
  carregamento e o resultado são anunciados por leitor de tela.
- **R8** — Todos os textos de tela e rótulos estão em pt_BR.

## Fora de escopo

- **Membros do espaço da unidade** — fatia **128** `unit-space-members`: a
  lista de quem está lotado direto na unidade, com nome, e-mail e a marcação
  "você". Esta fatia só entrega a página com o nome da unidade e o aviso de
  documentos.
- **Documentos no espaço da unidade** — fatia **127**: enviar, listar, abrir
  ou organizar documento ali.
- **Herança de unidades filhas** — fatia **016**: quem está lotado numa
  unidade filha ver o espaço da unidade pai. Aqui o acesso é só de quem está
  lotado na própria unidade.
- **Permissões próprias do espaço** — fatia **014**: quem pode fazer o quê
  dentro de um espaço, além de ver.
- **Contagem de membros na barra lateral** — o item da unidade não mostra
  quantas pessoas estão lotadas nela, só o nome.
- **Criar, renomear ou apagar unidade, e lotar ou remover alguém dela** —
  fatias **065** e **010**/**108**; esta fatia só abre a leitura do espaço que
  já nasce junto com a unidade.

## Decisões tomadas

- **Seção "Unidades" some quando não há lotação, em vez de aparecer vazia**
  (diferente da seção "Favoritos", que sempre aparece com estado vazio). A
  diferença: favoritar é uma ação que a própria pessoa inicia a qualquer
  momento, então o estado vazio da fatia **006** convida a agir; lotação
  depende da administração lotar a pessoa (fatia **010**), então uma seção
  "Unidades" vazia não teria ação nenhuma para oferecer e só ocuparia espaço
  permanentemente para quem nunca foi lotado.
- **Membros saíram desta fatia para a 128** no re-fatiamento: a página do
  espaço entra primeiro só com o nome da unidade e o aviso de documentos, para
  a fatia ficar menor.
- **Unidade inexistente e unidade sem lotação respondem igual** (R5), mesmo
  padrão de não revelar existência já usado nas fatias **010** e **011** para
  unidade/pessoa fora de alcance.
- **Acesso recalculado a cada leitura** (R6), mesmo padrão das fatias
  **010**/**011**: nada fica em cache de sessão que precise expirar.
- A necessidade técnica de o ambiente de desenvolvimento passar a criar o
  espaço junto com a unidade (dívida **075**) é resolvida por esta fatia, mas
  é decisão de implementação — fica para a SPEC, não é requisito observável
  aqui.

## Pontos em aberto

nenhum
