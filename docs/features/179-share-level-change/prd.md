# PRD 179 — share-level-change

Desde a fatia **145** `share-with-person-view`, o proprietário compartilha um
documento com uma pessoa. Desde a **147** `share-access-list`, o diálogo
"Compartilhar documento" mostra a lista "Quem tem acesso", e desde a **148**
`share-edit-level` o nível pode ser "Pode ver" ou "Pode editar", trocado só
compartilhando de novo. O item **146** `share-level-change` foi dividido nesta
fatia e na **180** `share-change-live`. Aqui o proprietário muda o nível ou
tira o acesso direto pela lista; quem está com o documento aberto sente a
mudança ao reabrir, e o efeito na hora fica para a 180.

## Valor

O proprietário ajusta ou retira o acesso de cada pessoa pela própria lista de
quem tem acesso, sem precisar compartilhar de novo.

## Usuários

- **Proprietário do documento**: muda o nível de cada pessoa com acesso por
  compartilhamento ou remove o acesso dela.
- **Pessoa com acesso por compartilhamento**: tem o nível trocado ou o acesso
  retirado, sentido ao abrir o documento.
- **Pessoa que alcança o documento pelo espaço**: nada muda para ela; o nível
  dela vem do espaço.

## Requisitos

- **R1** — Na lista "Quem tem acesso", cada pessoa com acesso por
  compartilhamento tem um controle de nível no lugar do selo, com as opções,
  nesta ordem, **"Pode ver"**, **"Pode editar"** e, por último, **"Remover
  acesso"** (ação destrutiva). O controle mostra o nível atual. A linha do
  proprietário não tem controle. Pessoas que só alcançam o documento pelo
  espaço não aparecem com controle.
- **R2** — Trocar entre "Pode ver" e "Pode editar" vale na hora, sem
  confirmação e sem fechar o diálogo: o controle passa a mostrar o novo nível e
  a linha continua no lugar. Não há notificação; um anúncio discreto para
  leitor de tela diz "Nível de {nome} alterado para Pode editar." (ou "Pode
  ver").
- **R3** — "Remover acesso" abre a confirmação **"Remover o acesso de {nome}?"**
  com o aviso "A pessoa perde o acesso na hora." e os botões "Cancelar" e
  "Remover". Durante o envio, "Remover" mostra "Removendo…" e não aceita um
  segundo clique. Cancelar não muda nada e o controle continua no nível atual.
- **R4** — Ao confirmar a remoção, a confirmação fecha, a pessoa some da lista
  sem recarregar e aparece a notificação **"{nome} não tem mais acesso ao
  documento."**.
- **R5** — Remover quem já não tem compartilhamento (outra aba chegou antes)
  não é erro: a confirmação fecha, a lista atualiza sem a pessoa e a tela não
  mostra falha.
- **R6** — Se a remoção falhar, a confirmação continua aberta, "Remover" volta
  a aceitar clique e aparece a notificação de erro "Não foi possível remover o
  acesso de {nome}. Tente de novo.". A pessoa continua na lista.
- **R7** — Se a troca de nível falhar, o controle volta ao nível anterior e
  aparece a notificação de erro **"Não foi possível mudar o nível de {nome}.
  Tente de novo."**.
- **R8** — Só o proprietário muda nível ou remove. Quem tem acesso mas não é
  proprietário recebe recusa ao tentar pelo servidor; quem não tem acesso algum
  recebe a resposta de documento inexistente. Com o documento na lixeira, a
  lista "Quem tem acesso" fica só leitura, sem controle de nível nem remoção, e
  o servidor recusa a troca e a remoção como conflito com o estado do
  documento.
- **R9** — Controle, confirmação e notificações funcionam por teclado e têm
  nomes acessíveis. O foco fica preso na confirmação; cancelar ou fechar
  devolve o foco ao controle da linha. Depois de remover, o foco vai para a
  linha de cima (a do proprietário, se a removida era a primeira). A troca de
  nível, a remoção e as notificações são anunciadas por leitor de tela. A
  apresentação segue o `docs/design.md` ("Ação destrutiva com confirmação num
  item de lista", "Diálogo de confirmação", "Notificação"), sem violação
  crítica nem séria de acessibilidade.
- **R10** — Todos os textos de tela estão em pt_BR.

Correspondência com o PRD 146: R1–R7 = R1–R7; R8 = R13 mais a decisão da
lixeira; R9 = R14 sem o aviso de somente leitura (foi para a 180); R10 = R15.

## Casos de borda

- **Remoção repetida em outra aba**: R5.
- **Remover a última pessoa**: fica só a linha do proprietário, que recebe o
  foco (R9).
- **Pessoa rebaixada ou removida com o documento aberto**: nesta fatia, sente a
  mudança ao reabrir; o efeito na hora é a 180.

## Fora de escopo

- Efeito imediato para quem está com o documento aberto (somente leitura sem
  recarregar, volta a editar, conexão encerrada): fatia **180**
  `share-change-live`.
- Mudança de nível ou remoção **pelo espaço**: outra fatia.
- Avisar a pessoa por e-mail ou notificação de que o nível mudou ou o acesso
  foi retirado.
- Histórico de quem mudou o quê.
- Ver quem acessa pelo espaço e por qual caminho: fatia **018** `who-can-see`.
- Compartilhar com espaço, unidade ou instância: fatia **016**
  `share-with-groups`.
- Mudar o nível ou remover várias pessoas de uma vez; desfazer uma remoção
  (compartilha-se de novo).

## Decisões

- **Controle de nível na linha, com "Remover acesso" por último** (R1): ação
  destrutiva no fim, como na lista de membros da **135**.
- **Trocar nível sem confirmação; remover com confirmação** (R2, R3), no padrão
  de remoção da **135** (textos, "Removendo…", remoção repetida sem erro, foco).
- **Quem só alcança pelo espaço não tem controle aqui**: o nível vem do espaço
  e muda lá.
- **Erro ao trocar o nível** (R7): notificação no padrão da remoção de membro
  da 135; o controle volta ao nível anterior.
- **Troca de nível bem-sucedida** (R2): sem notificação; controle com o nível
  novo e anúncio discreto (aria-live polite) para leitor de tela.
- **Documento na lixeira** (R8): lista só leitura, coerente com o título que
  vira texto na lixeira (**169**). Documento na lixeira só é alcançado pelo
  proprietário; mudar nível ou remover nele é recusado como conflito, sem
  revelar nada a quem não é dono.

## Pontos em aberto

- Nenhum.
