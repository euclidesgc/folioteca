# PRD 141 — free-space-restrict-invite

Hoje só o dono de um espaço livre adiciona pessoas a ele (fatia **134**
`free-space-invite`) e só ele remove membros (fatia **135**
`free-space-members`). Esta fatia é a segunda das três em que o item **014**
`space-permissions` foi dividido (as outras são **140** e **142**). Ela deixa o
dono abrir o espaço para que qualquer membro adicione pessoas.

## Valor

Na página do espaço livre, o dono escolhe entre "Só eu adiciono pessoas" e
"Qualquer membro adiciona pessoas". Aberto, os membros trazem outras pessoas
da instância sem depender do dono; fechado, tudo continua como hoje.

## Usuários

- **Dono do espaço livre**: escolhe quem adiciona pessoas e continua sendo o
  único que remove membros.
- **Membro do espaço livre**: com o espaço aberto, adiciona pessoas da
  instância; com o espaço fechado, só vê o espaço, como hoje.

## Requisitos

- **R1** — Todo espaço livre, o que já existe e o que nascer depois, fica com
  **"Só eu adiciono pessoas"** por padrão: só o dono adiciona, como hoje.
- **R2** — Na página do espaço livre, só o dono vê o controle **"Quem adiciona
  pessoas"**, dentro da própria página e acima de "Adicionar pessoa", com dois
  modos: **"Só eu adiciono pessoas"** e **"Qualquer membro adiciona pessoas"**.
  O controle traz o modo atual e a frase "Quando aberto, qualquer membro pode
  adicionar pessoas; só você remove.". O membro não vê o controle.
- **R3** — Espaço pessoal e espaço de unidade não têm esse controle.
- **R4** — A troca vale ao escolher o outro modo, sem pedir confirmação.
  Durante o envio, o controle mostra "Salvando…", os dois modos ficam
  indisponíveis sem perder o foco, e o foco continua no modo escolhido. Uma
  falha devolve o controle ao modo anterior, com aviso.
- **R5** — Só o dono muda o modo. Um membro que tenta mudar pelo servidor
  recebe recusa; quem não alcança o espaço recebe a mesma resposta de espaço
  inexistente.
- **R6** — Com o espaço aberto, cada membro vê a ação **"Adicionar pessoa"** na
  página do espaço e usa o mesmo diálogo da **134**: mesma busca, mesma
  confirmação "<nome> agora é membro deste espaço.", mesmo diálogo aberto para
  adicionar outra pessoa. Quem ele adiciona vira membro como qualquer outro.
- **R7** — Para o membro, a busca não lista ele mesmo nem o dono do espaço. O
  servidor recusa, com mensagem de erro no diálogo, o membro adicionar a si
  mesmo ou o dono, e mantém as outras recusas da **134** (pessoa que não
  existe, saiu da instância ou é de outra organização).
- **R8** — Adicionar quem já é membro não duplica nem dá erro, para o dono ou
  para o membro: mostra a mesma confirmação (regra da **134**).
- **R9** — Com o espaço fechado de novo, a ação "Adicionar pessoa" some para os
  membros no próximo carregamento da página, e o servidor volta a recusar a
  adição feita por membro. Quem já foi adicionado continua membro.
- **R10** — Se o dono fecha o espaço enquanto um membro está com o diálogo
  aberto (por exemplo, em outra aba), a confirmação do membro é recusada com a
  mensagem "Só o dono pode adicionar pessoas a este espaço." no diálogo, e
  ninguém é adicionado. Se o membro foi removido nesse meio-tempo, recebe a
  resposta de espaço inexistente.
- **R11** — Remover membros continua só do dono (fatia **135**), com o espaço
  aberto ou fechado. O membro não vê a ação de remover.
- **R12** — A lista de membros não muda: não mostra quem adicionou quem.
- **R13** — O controle funciona por teclado, tem nome acessível e anuncia a
  mudança, o "Salvando…" e os erros por leitor de tela. A página segue o
  `docs/design.md` com o mesmo acabamento do controle da **140**, sem violação
  crítica nem séria de acessibilidade.
- **R14** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- **Papéis de leitor e editor**: fatia **142** `free-space-member-roles`. Aqui
  todo membro é igual, e o modo aberto vale para todos.
- **Registrar ou mostrar quem adicionou cada membro** (autoria, histórico).
- **Remoção por membro**, inclusive de quem ele mesmo adicionou.
- **Transferir a posse do espaço** ou ter mais de um dono.
- Avisar alguém (e-mail ou notificação) da troca de modo ou da adição.
- Convidar por e-mail quem não está na instância: fatia **089**.

## Decisões tomadas

- **Padrão fechado** (R1): nada muda para os espaços que já existem até o dono
  abrir.
- **Controle na página do espaço, só para o dono** (R2): o modo é assunto do
  dono, e é ali que ele já adiciona e remove pessoas.
- **Sem confirmação na troca** (R4): a frase explica o efeito e a troca se
  desfaz com um clique, como na **140**.
- **Membro que adiciona não remove** (R11): abrir o espaço só amplia quem
  traz gente; tirar alguém continua decisão do dono.
- **Membro não adiciona o dono nem a si mesmo** (R7): os dois já estão no
  espaço, então a busca os esconde e o servidor recusa, como na **134**.
- **Fechar não desfaz adições** (R9): quem entrou por um membro continua
  membro; o dono remove se quiser.
- **Recusa explícita quando o espaço fechou no meio do caminho** (R10): o
  membro já sabe que o espaço existe, então a recusa não revela nada (mesma
  regra da **134**).
- **Sem autoria na lista** (R12): mostrar quem adicionou quem fica fora desta
  fatia.

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- Num espaço novo ou já existente, o dono vê "Só eu adiciono pessoas"
  selecionado, e o membro não vê "Adicionar pessoa" nem o controle.
- O dono escolhe "Qualquer membro adiciona pessoas"; o controle mostra
  "Salvando…" e fica no novo modo, com o foco no modo escolhido. O membro, ao
  recarregar a página, vê "Adicionar pessoa", adiciona uma terceira pessoa e
  ela passa a ver o espaço na barra lateral.
- Com o espaço aberto, o membro não encontra o dono nem a si mesmo na busca, e
  adicionar qualquer um dos dois pelo servidor é recusado.
- O dono volta para "Só eu adiciono pessoas"; a terceira pessoa continua
  membro, o membro deixa de ver "Adicionar pessoa" ao recarregar, e uma adição
  dele por uma aba antiga recebe "Só o dono pode adicionar pessoas a este
  espaço.".
- Um membro que tenta mudar o modo pelo servidor é recusado; uma falha na
  troca devolve o controle ao modo anterior, com aviso.
- Espaço pessoal e espaço de unidade não mostram o controle.
