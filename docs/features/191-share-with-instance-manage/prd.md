# PRD 191 — share-with-instance-manage

A fatia **190** `share-with-instance` permite ao proprietário compartilhar um
documento com todos da organização (uma instância é uma organização) e mostra
esse compartilhamento como a linha **"Todos da organização"** na lista "Quem
tem acesso". A **179** `share-level-change` já permite trocar o nível e remover
o acesso de uma pessoa pela lista. Esta fatia, parte da divisão da antiga
**185** em **190**, **191** e **192**, leva esse mesmo controle para a linha
"Todos da organização".

## Valor

O proprietário ajusta ou retira o acesso da organização inteira direto na
lista, sem refazer o compartilhamento.

## Usuários

- **Proprietário do documento**: troca o nível do compartilhamento com a
  organização ou o remove.

## Requisitos

- **R1** — A linha "Todos da organização" tem o mesmo controle de nível da 179:
  "Pode ver", "Pode editar" e, por último, "Remover acesso". Só o proprietário
  vê esse controle.
- **R2** — Trocar o nível vale na hora, sem confirmação, e é anunciado por
  leitor de tela como "Nível de Todos da organização alterado para Pode
  editar." (ou "Pode ver"). Se falhar, volta ao nível anterior e mostra a
  notificação "Não foi possível mudar o nível de Todos da organização. Tente de
  novo.".
- **R3** — "Remover acesso" pede confirmação com "Remover o acesso de Todos da
  organização?" e se comporta como a remoção da 179: envio em andamento,
  remoção repetida sem erro, falha mantendo a confirmação aberta e foco na
  linha de cima depois de remover.
- **R4** — Removido o compartilhamento com a instância, quem só tinha esse
  caminho perde o acesso a partir do pedido seguinte; quem tem outro caminho
  (compartilhamento próprio ou espaço) fica com o maior nível que restar. O
  mesmo vale para a troca de nível.
- **R5** — O servidor recusa trocar o nível ou remover o compartilhamento com a
  instância pedido por quem não é o proprietário. Com o documento na lixeira a
  linha fica só leitura, como na 179.
- **R6** — O controle de nível e a confirmação funcionam por teclado, têm nomes
  acessíveis e as mudanças são anunciadas por leitor de tela, seguindo o
  `docs/design.md`, sem violação crítica nem séria de acessibilidade.
- **R7** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- Criar o compartilhamento com a instância: fatia **190**
  `share-with-instance`.
- Efeito na hora da troca ou da remoção para quem está com o documento aberto:
  fatia **192** `share-with-instance-live`.
- Compartilhar com espaço (**186**), com unidade (**187**), com unidade e tudo
  abaixo (**188**) e exclusões de subunidades (**189**).
- Avisar a organização (e-mail ou notificação) de que o acesso mudou.

## Decisões

- **Textos da linha "Todos da organização"** (R2, R3): "Todos da organização"
  ocupa o lugar do nome da pessoa nos textos da 179: "Remover o acesso de Todos
  da organização?", "Não foi possível mudar o nível de Todos da organização.
  Tente de novo." e o anúncio "Nível de Todos da organização alterado para Pode
  editar.".
