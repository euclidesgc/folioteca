# PRD 196 — share-with-space-manage

A fatia **195** `share-with-space` permite ao proprietário compartilhar um
documento com um ou mais espaços livres de que é dono ou membro, e a **198**
`share-with-unit-space` estende isso aos espaços de unidade que ele alcança;
cada espaço aparece como uma linha com o nome do espaço e o selo "Espaço" na
lista "Quem tem acesso". A **179** `share-level-change` já permite trocar o
nível e remover o acesso de uma pessoa pela lista, e a **191**
`share-with-instance-manage` fez o mesmo para a linha "Todos da organização".
Esta fatia, da divisão do compartilhamento com espaço em **195**, **198**,
**196** e **197**, leva esse controle para as linhas de espaço, dos dois
tipos.

## Valor

O proprietário ajusta ou retira o acesso de um espaço inteiro direto na lista,
sem refazer o compartilhamento.

## Usuários

- **Proprietário do documento**: troca o nível do compartilhamento com um
  espaço ou o remove.

## Requisitos

- **R1** — Cada linha de espaço (livre ou de unidade) tem o mesmo controle de
  nível da 179: "Pode ver", "Pode editar" e, por último, "Remover acesso". Só
  o proprietário vê esse controle.
- **R2** — Trocar o nível vale na hora, sem confirmação, e é anunciado por
  leitor de tela como "Nível de <nome do espaço> alterado para Pode editar."
  (ou "Pode ver"). Se falhar, volta ao nível anterior e mostra "Não foi
  possível mudar o nível de <nome do espaço>. Tente de novo.".
- **R3** — "Remover acesso" pede confirmação com "Remover o acesso de <nome do
  espaço>?" e se comporta como a remoção da 179: envio em andamento, remoção
  repetida sem erro, falha mantendo a confirmação aberta e foco na linha de
  cima depois de remover.
- **R4** — Mexer num espaço não afeta os outros compartilhamentos do documento.
  Removido ou rebaixado o compartilhamento, quem só tinha esse caminho perde o
  acesso (ou o nível) a partir do pedido seguinte; quem tem outro caminho
  (pessoa, organização, outro espaço ou o espaço do documento) fica com o maior
  nível que restar.
- **R5** — O servidor recusa trocar o nível ou remover o compartilhamento com
  espaço pedido por quem não é o proprietário: sem acesso ao documento, a
  resposta é a de documento inexistente; com acesso, uma recusa com mensagem.
  Com o documento na lixeira a linha fica só leitura e o servidor recusa a
  mudança, como na 179.
- **R6** — O controle de nível e a confirmação funcionam por teclado, têm nomes
  acessíveis e as mudanças são anunciadas por leitor de tela, seguindo o
  `docs/design.md`, sem violação crítica nem séria de acessibilidade.
- **R7** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- Criar o compartilhamento com espaço: fatias **195** `share-with-space` e
  **198** `share-with-unit-space`.
- Efeito na hora da troca ou da remoção para quem está com o documento aberto:
  fatia **197** `share-with-space-live`.
- Compartilhar com unidade (**187**), com unidade e tudo abaixo (**188**) e
  exclusões de subunidades (**189**).
- Avisar os membros do espaço (e-mail ou notificação) de que o acesso mudou.

## Decisões

- **Textos da linha do espaço** (R2, R3): o nome do espaço ocupa o lugar do
  nome da pessoa nos textos da 179.
- **Proprietário que já não alcança o espaço** (R1): continua podendo trocar
  o nível e remover; o alcance só é exigido ao criar o compartilhamento (195 e
  198).
