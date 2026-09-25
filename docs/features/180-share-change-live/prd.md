# PRD 180 — share-change-live

O item **146** `share-level-change` foi dividido na fatia **179**
`share-level-change` e nesta. Desde a 179, o proprietário muda o nível ou
remove o acesso de uma pessoa pela lista "Quem tem acesso", e desde a **148**
`share-edit-level` pode trocar o nível compartilhando de novo; em ambos os
casos, quem está com o documento aberto só sente a mudança ao reabrir. Esta
fatia faz a mudança valer na hora. **Depende da 179.**

## Valor

Ninguém continua editando ou lendo um documento aberto além do que pode: a
mudança de nível ou a remoção do acesso vale na hora, sem recarregar.

## Usuários

- **Pessoa com acesso por compartilhamento, com o documento aberto**: é
  rebaixada, promovida ou perde o acesso enquanto está no documento.
- **Pessoa que também alcança o documento pelo espaço**: fica com o nível do
  espaço quando o compartilhamento muda ou some.

## Requisitos

- **R1** — Quem está com o documento aberto e é rebaixado para ver passa a
  somente leitura sem recarregar: o rótulo "Somente leitura" aparece e surge o
  aviso discreto **"Agora você só pode ver este documento."**, anunciado por
  leitor de tela e em pt_BR. Alterações feitas depois da mudança não são
  gravadas.
- **R2** — Quem está com o documento aberto e é promovido a editar passa a
  poder editar título e conteúdo sem recarregar, colaborando em tempo real.
- **R3** — Quem está com o documento aberto e tem o acesso removido perde a
  colaboração na hora e passa a ver a mesma tela de documento inexistente ou
  sem acesso já usada, sem perder a navegação do app. Ao abrir o endereço de
  novo, recebe a mesma resposta.
- **R4** — O acesso efetivo continua decidido pelo servidor, relido a cada
  pedido, pelo caminho único: proprietário → lixeira → o maior entre
  compartilhamento e espaço → nenhum. Quem perde o compartilhamento mas
  alcança o documento pelo espaço fica com o nível do espaço, e é isso que
  sente na hora (R1 a R3): continua editando, passa a só ver, ou nada muda.
- **R5** — O efeito na hora (R1 a R3) vale para qualquer mudança de nível por
  compartilhamento: pela lista da 179 e também compartilhando de novo pelo
  seletor (R2 da 148).

Correspondência com o PRD 146: R1–R5 = R8–R12 (o anúncio do aviso vem do R14
original).

## Casos de borda

- **Pessoa que edita pelo espaço perde o compartilhamento "Pode ver"**:
  continua editando, sem aviso (R4).
- **Pessoa com "Pode editar" por compartilhamento e "ver" pelo espaço é
  removida**: passa a só ver, com o aviso de R1.
- **Pessoa rebaixada ou removida sem o documento aberto**: sente a mudança ao
  abrir o documento.

## Fora de escopo

- Controle de nível e remoção na lista "Quem tem acesso": fatia **179**.
- Mudança de nível ou remoção **pelo espaço** derrubando ou rebaixando quem
  está com o documento aberto: outra fatia.
- Avisar a pessoa por e-mail ou notificação fora do documento de que o nível
  mudou ou o acesso foi retirado.

## Decisões

- **Efeito imediato para quem está com o documento aberto** (R1 a R3). Resolve
  a dívida **049** (encerrar a conexão de colaboração de quem perde acesso)
  para o caso de compartilhamento.
- **Perder o compartilhamento não tira o acesso pelo espaço** (R4): vale o
  caminho único de acesso.

## Pontos em aberto

- Nenhum.
