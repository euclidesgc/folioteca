# PRD 190 — share-with-instance

Desde a fatia **145** `share-with-person-view`, o proprietário compartilha um
documento com uma pessoa, e desde a **148** `share-edit-level` escolhe "Pode
ver" ou "Pode editar". A **147** `share-access-list` mostra a lista "Quem tem
acesso", a **179** `share-level-change` permite trocar o nível e remover pela
lista, e a **180** `share-change-live` faz essas mudanças valerem na hora para
quem está com o documento aberto. O item **016** `share-with-groups` foi
dividido nas fatias **185** a **189**, e a **185** `share-with-instance`
(compartilhar com toda a instância, isto é, com todos da organização; uma
instância é uma organização) foi dividida em **190** (conceder), **191**
`share-with-instance-manage` (trocar e remover pela lista) e **192**
`share-with-instance-live` (efeito ao vivo). Esta é a **190**.

## Valor

O proprietário abre um documento para a organização inteira de uma vez, em
leitura ou edição, sem escolher pessoa por pessoa, e quem chega à organização
depois já encontra o acesso.

## Usuários

- **Proprietário do documento**: compartilha com todos da organização e troca o
  nível compartilhando de novo.
- **Pessoa ativa da organização**: abre o documento pelo link com o nível dado
  à organização (ou maior, se tiver outro caminho).
- **Quem entra na organização depois**: passa a ter o acesso na próxima vez que
  abrir o documento.
- **Quem sai da organização**: perde o acesso na próxima leitura.

## Requisitos

- **R1** — No diálogo "Compartilhar documento", além da busca de pessoa, o
  proprietário encontra a opção **"Todos da organização"**, com o mesmo grupo
  de rádios "Nível de acesso" da 148: **"Pode ver"** marcado por padrão ou
  **"Pode editar"**. Confirmar em "Compartilhar" cria o compartilhamento com a
  instância e mostra o aviso de sucesso "Documento compartilhado com Todos da
  organização.".
- **R2** — Há no máximo um compartilhamento com a instância por documento.
  Compartilhar de novo com "Todos da organização" troca o nível para o
  escolhido, nos dois sentidos, sem criar outro compartilhamento nem outra
  linha na lista.
- **R3** — Na lista "Quem tem acesso", o compartilhamento com a instância
  aparece como uma linha própria, **"Todos da organização"**, com o nível dado,
  logo depois da linha do proprietário e antes das pessoas. A linha aparece na
  hora ao compartilhar, sem fechar o diálogo.
- **R4** — O acesso efetivo continua decidido pelo servidor, relido a cada
  pedido, pelo caminho único de decisão de acesso a documentos, agora com a
  instância como mais uma fonte: proprietário → lixeira → o maior entre
  compartilhamento com a pessoa, compartilhamento com a instância e
  participação no espaço → nenhum.
- **R5** — O acesso pela instância não é gravado pessoa a pessoa: quem entra na
  organização depois do compartilhamento abre o documento com o nível dado à
  organização; quem sai da organização perde o acesso a partir do pedido
  seguinte, recebendo a mesma resposta de documento inexistente.
- **R6** — Quem tem acesso pela instância, em qualquer nível, não vê
  "Compartilhar", nem mover para a lixeira, nem excluir, e o servidor recusa
  esses pedidos. Só o proprietário cria ou altera o compartilhamento com a
  instância.
- **R7** — Documento na lixeira: vale a regra da 145 e da 179. O
  compartilhamento com a instância fica guardado com o nível, só o proprietário
  abre, a lista fica só leitura, e ao restaurar a organização volta com o nível
  que tinha.
- **R8** — A opção "Todos da organização", o grupo de nível e a linha da lista
  funcionam por teclado, têm nomes acessíveis e as mudanças são anunciadas por
  leitor de tela, seguindo o `docs/design.md`, sem violação crítica nem séria
  de acessibilidade.
- **R9** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- Trocar o nível e remover pela linha "Todos da organização" da lista: fatia
  **191** `share-with-instance-manage`.
- Efeito na hora das mudanças no compartilhamento com a instância para quem
  está com o documento aberto: fatia **192** `share-with-instance-live`.
- Encerrar no ato a conexão de colaboração aberta de quem sai da organização:
  dívida **049**.
- Compartilhar com espaço (**186**), com unidade (**187**), com unidade e tudo
  abaixo (**188**) e exclusões de subunidades (**189**).
- Lista "Compartilhados comigo": fatia **019** `shared-with-me`.
- Ver quantas pessoas passam a ter acesso antes de confirmar (**017**) e quem vê
  o documento por qual caminho (**018**).
- Avisar a organização (e-mail ou notificação) de que o documento foi
  compartilhado.
- Link público ou acesso para quem não tem conta na instância.

## Decisões

- **Texto do aviso de sucesso** (R1): "Todos da organização" ocupa o lugar do
  nome da pessoa no texto da 145: "Documento compartilhado com Todos da
  organização.".
- **Quem sai da organização** (R5): hoje isso só acontece apagando a pessoa. A
  perda do acesso vale na próxima leitura; encerrar no ato a conexão de
  colaboração já aberta fica na dívida **049**.
