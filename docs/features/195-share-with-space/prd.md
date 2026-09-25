# PRD 195 — share-with-space

Desde a fatia **145** `share-with-person-view`, o proprietário compartilha um
documento com uma pessoa, e desde a **148** `share-edit-level` escolhe "Pode
ver" ou "Pode editar". A **190** `share-with-instance` acrescentou o
compartilhamento com "Todos da organização", a **191**
`share-with-instance-manage` o controle dessa linha na lista "Quem tem acesso"
e a **192** `share-with-instance-live` o efeito na hora. O compartilhamento com
espaço (antiga **186**, do item **016** `share-with-groups`) foi dividido em
**195** (conceder, só espaços livres), **198** `share-with-unit-space`
(conceder também para espaços de unidade), **196** `share-with-space-manage`
(trocar e remover pela lista) e **197** `share-with-space-live` (efeito ao
vivo). Esta é a **195**.

## Valor

O proprietário abre um documento para todos de um espaço livre de uma vez, em
leitura ou edição, e o acesso acompanha quem faz parte do espaço, sem
manutenção pessoa a pessoa.

## Usuários

- **Proprietário do documento**: compartilha com um ou mais espaços livres de
  que é dono ou membro e troca o nível compartilhando de novo.
- **Quem alcança o espaço livre**: o dono ou um membro do espaço, em qualquer
  papel; abre o documento pelo link com o nível dado ao espaço (ou maior, se
  tiver outro caminho).
- **Quem entra no espaço livre depois**: ganha o acesso na próxima vez que
  abrir.
- **Quem sai do espaço livre**: perde o acesso na próxima leitura.

## Requisitos

- **R1** — No diálogo "Compartilhar documento", o proprietário pode escolher,
  além de pessoa e de "Todos da organização", um **espaço**, entre os espaços
  livres de que ele é dono ou membro hoje (em qualquer papel), com o mesmo
  grupo de rádios "Nível de acesso": **"Pode ver"** marcado por padrão ou
  **"Pode editar"**. Confirmar em "Compartilhar" cria o compartilhamento e
  mostra "Documento compartilhado com <nome do espaço>.".
- **R2** — Um documento pode ser compartilhado com vários espaços, com no
  máximo um compartilhamento por espaço. Compartilhar de novo com o mesmo
  espaço troca o nível, nos dois sentidos, sem criar outra linha.
- **R3** — Na lista "Quem tem acesso", cada espaço compartilhado aparece como
  uma linha própria, com o nome do espaço, o selo **"Espaço"** e o nível dado:
  depois do proprietário e de "Todos da organização", antes das pessoas, em
  ordem alfabética. A linha aparece na hora, sem fechar o diálogo.
- **R4** — O acesso efetivo continua decidido pelo servidor a cada pedido, pelo
  caminho único de decisão de acesso: proprietário → lixeira → o maior entre
  compartilhamento com a pessoa, com a organização, com os espaços que a pessoa
  alcança e participação no espaço do documento → nenhum.
- **R5** — O acesso pelo espaço não é gravado pessoa a pessoa: vale para quem é
  dono ou membro do espaço livre no momento do pedido. Quem sai do espaço, ou é
  removido dele, perde o acesso a partir do pedido seguinte, com a mesma
  resposta de documento inexistente.
- **R6** — Quem tem acesso por espaço, em qualquer nível, não vê
  "Compartilhar", mover para a lixeira nem excluir, e o servidor recusa esses
  pedidos com mensagem. O servidor também recusa compartilhar com um espaço que
  o proprietário não alcança (espaço livre de que não é dono nem membro, ou
  qualquer espaço que não seja livre).
- **R7** — Documento na lixeira: vale a regra da 145 e da 179. O
  compartilhamento com o espaço fica guardado com o nível, só o proprietário
  abre, a lista fica só leitura, o servidor recusa novos compartilhamentos, e
  ao restaurar o espaço volta com o nível que tinha.
- **R8** — A escolha do espaço, o grupo de nível e a linha da lista funcionam
  por teclado, têm nomes acessíveis e as mudanças são anunciadas por leitor de
  tela, seguindo o `docs/design.md`, sem violação crítica nem séria de
  acessibilidade.
- **R9** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- Compartilhar com **espaços de unidade** (lotados na unidade do espaço,
  inclusive pela herança de unidade da **140**): fatia **198**
  `share-with-unit-space`. Nesta fatia o seletor não oferece espaço de unidade.
- Trocar o nível e remover pela linha do espaço: fatia **196**
  `share-with-space-manage`.
- Efeito na hora para quem está com o documento aberto, inclusive encerrar a
  conexão de colaboração de quem sai do espaço: fatia **197**
  `share-with-space-live`.
- Compartilhar com unidade (**187**), com unidade e tudo abaixo (**188**) e
  exclusões de subunidades (**189**).
- Ver quantas pessoas passam a ter acesso (**017**) e por qual caminho (**018**);
  lista "Compartilhados comigo" (**019**).
- Avisar os membros do espaço (e-mail ou notificação).

## Decisões

- **Só espaços livres nesta fatia** (R1, R6): os espaços de unidade entram na
  **198**, com a regra de alcance por lotação.
- **Vários espaços por documento** (R2): sim, uma linha por espaço.
- **Quais espaços aparecem** (R1): todo espaço livre de que o proprietário é
  dono ou membro, em qualquer papel (leitor do espaço também); o espaço
  pessoal não aparece, porque só tem o próprio dono.
- **Quem alcança o espaço livre** (R5): o dono e os membros, em qualquer papel.
- **Nível independe do papel no espaço** (R4): o nível do compartilhamento vale
  para todos que alcançam o espaço, leitores do espaço livre inclusive; o papel
  de leitor ou editor continua valendo só para os documentos do espaço.
- **Espaço do próprio documento** (R1): pode ser escolhido, sem caso especial;
  pela regra do maior, serve para dar "Pode editar" a quem é leitor ali.
- **Proprietário que sai do espaço depois** (R6): o compartilhamento continua
  valendo para o espaço; a restrição de alcance vale só ao compartilhar.
- **Texto do aviso** (R1): o nome do espaço ocupa o lugar do nome da pessoa no
  texto da 145.
