# PRD 198 — share-with-unit-space

A fatia **195** `share-with-space` permite ao proprietário compartilhar um
documento com os espaços livres de que é dono ou membro, em "Pode ver" ou "Pode
editar", com uma linha por espaço e o selo "Espaço" na lista "Quem tem acesso".
Os espaços de unidade (criados pela **012** `unit-spaces`) ficaram de fora.
Hoje quem alcança um espaço de unidade é quem está lotado na unidade e, quando o
espaço está marcado como "herda da unidade-pai" (fatia **140**
`unit-space-inherit-parent`), também quem está lotado nas unidades de cima; é a
mesma regra que decide quem vê o espaço na barra lateral e quem abre seus
documentos (fatias **127** e **152**). Esta fatia, a segunda da divisão do
compartilhamento com espaço (**195**, **198**, **196** e **197**), estende o
compartilhamento aos espaços de unidade.

## Valor

O proprietário abre um documento para todos de uma unidade de uma vez, pelo
espaço dela, e o acesso acompanha a lotação, sem manutenção pessoa a pessoa.

## Usuários

- **Proprietário do documento**: compartilha também com espaços de unidade que
  ele alcança.
- **Quem alcança o espaço de unidade**: lotado na unidade ou, pela herança da
  140, nas unidades de cima; abre o documento pelo link com o nível dado ao
  espaço (ou maior, se tiver outro caminho).
- **Quem passa a alcançar depois** (nova lotação ou herança marcada): ganha o
  acesso na próxima vez que abrir.
- **Quem deixa de alcançar** (sai da lotação ou herança desmarcada): perde o
  acesso na próxima leitura.

## Requisitos

- **R1** — No diálogo "Compartilhar documento", o seletor de espaço passa a
  oferecer, além dos espaços livres da 195, os espaços de unidade que o
  proprietário alcança hoje, pela mesma regra da barra lateral (lotação direta
  e herança de unidade). Nível, confirmação e aviso são os da 195.
- **R2** — O compartilhamento com espaço de unidade segue as regras da 195:
  vários espaços por documento, no máximo um compartilhamento por espaço, e
  compartilhar de novo troca o nível, nos dois sentidos, sem criar outra linha.
- **R3** — Na lista "Quem tem acesso", o espaço de unidade aparece como uma
  linha de espaço igual à da 195 (nome do espaço, selo "Espaço", nível), na
  mesma ordem alfabética junto dos espaços livres.
- **R4** — O acesso pelo espaço de unidade não é gravado pessoa a pessoa: vale
  para quem alcança o espaço no momento do pedido, pela mesma regra que decide
  quem vê o espaço na barra lateral. Quem deixa de alcançar (perde a lotação ou
  a herança é desmarcada) perde o acesso a partir do pedido seguinte, com a
  mesma resposta de documento inexistente; quem passa a alcançar ganha o
  acesso na leitura seguinte.
- **R5** — O acesso efetivo continua decidido pelo caminho único da 195: o
  maior entre compartilhamento com a pessoa, com a organização, com os espaços
  (livres ou de unidade) que a pessoa alcança e participação no espaço do
  documento.
- **R6** — O servidor recusa compartilhar com um espaço de unidade que o
  proprietário não alcança. Quem tem acesso pelo espaço de unidade não vê
  "Compartilhar", mover para a lixeira nem excluir, e o servidor recusa esses
  pedidos com mensagem. Lixeira como na 195.
- **R7** — O seletor com os espaços de unidade funciona por teclado, tem nomes
  acessíveis e as mudanças são anunciadas por leitor de tela, seguindo o
  `docs/design.md`, sem violação crítica nem séria de acessibilidade.
- **R8** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- Trocar o nível e remover pela linha do espaço: fatia **196**
  `share-with-space-manage` (vale para os dois tipos de espaço).
- Efeito na hora para quem está com o documento aberto, inclusive para quem
  perde a lotação: fatia **197** `share-with-space-live`.
- Compartilhar com a unidade em si, sem passar pelo espaço (**187**), com
  unidade e tudo abaixo (**188**) e exclusões de subunidades (**189**).
- Ver quantas pessoas passam a ter acesso (**017**) e por qual caminho (**018**).
- Avisar os lotados (e-mail ou notificação).

## Decisões

- **Regra de alcance** (R1, R4): a mesma da barra lateral e dos documentos do
  espaço de unidade (127, 140, 152), sem regra nova.
- **Nível independe do papel** (R5): o nível do compartilhamento vale para
  todos que alcançam o espaço de unidade, como na 195.
- **Proprietário que deixa de alcançar depois** (R6): o compartilhamento
  continua valendo para o espaço; o alcance só é exigido ao compartilhar, como
  na 195.
- **Texto do aviso** (R1): o da 195, com o nome do espaço de unidade.

## Pontos em aberto

- **Distinguir espaço livre de espaço de unidade**: o seletor e a lista usam o
  mesmo selo "Espaço" para os dois tipos, ou o espaço de unidade ganha um selo
  ou indicação própria (por exemplo, quando um espaço livre e um de unidade têm
  o mesmo nome)?
