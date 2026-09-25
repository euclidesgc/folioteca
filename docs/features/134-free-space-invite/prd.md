# PRD 134 — free-space-invite

Hoje só o dono vê o espaço livre que criou (fatia **013** `free-spaces`). Esta
fatia deixa o dono adicionar outras pessoas da instância ao espaço.

## Valor

O dono de um espaço livre adiciona uma pessoa da instância, escolhida pela
busca por nome ou e-mail, e ela passa a ver o espaço na barra lateral.

## Usuários

- **Dono do espaço livre**: adiciona pessoas ao espaço, uma de cada vez.
- **Pessoa adicionada (membro)**: vê o espaço na barra lateral e abre a página
  dele.
- **Qualquer outra pessoa**: continua sem ver o espaço, sem saber que ele
  existe.

## Requisitos

- **R1** — Na página do espaço livre, só o dono vê a ação **"Adicionar
  pessoa"**. O membro não vê a ação.
- **R2** — "Adicionar pessoa" abre um diálogo com busca de pessoas igual à do
  compartilhamento de documento: a partir de 2 caracteres, por nome ou e-mail
  sem diferenciar maiúsculas, no máximo 10 resultados com nome e e-mail. Com
  menos de 2 caracteres, pede para digitar mais. Sem resultado, mostra "Nenhuma
  pessoa encontrada.". A busca lista só pessoas ativas da mesma organização e
  nunca o próprio dono.
- **R3** — O dono escolhe a pessoa e confirma. O diálogo avisa "<nome> agora é
  membro deste espaço.", com o nome devolvido pelo servidor, limpa a busca e
  continua aberto para adicionar outra pessoa. O botão de confirmar mantém o
  foco enquanto o envio acontece.
- **R4** — Adicionar de novo quem já é membro não duplica nem dá erro: mostra a
  mesma confirmação.
- **R5** — O servidor recusa, com mensagem de erro no diálogo, adicionar a si
  mesmo e adicionar pessoa que não existe, saiu da instância ou é de outra
  organização. O erro mantém a pessoa escolhida, para tentar de novo.
- **R6** — Só o dono adiciona. Um membro que tenta adicionar pelo servidor
  recebe recusa. Quem não alcança o espaço recebe a mesma resposta de espaço
  inexistente, ao abrir a página ou ao tentar adicionar.
- **R7** — O membro passa a ver o espaço na seção "Espaços" da barra lateral no
  próximo carregamento da lista: ao trocar de tela, voltar à janela ou
  recarregar, sem sair da sessão.
- **R8** — O membro abre a página do espaço e vê o nome dele e o aviso de que
  os documentos chegam depois, sem a ação "Adicionar pessoa".
- **R9** — Diálogo, busca e confirmação funcionam por teclado e têm nomes
  acessíveis; o foco fica preso no diálogo e volta ao botão ao fechar ("Fechar").
  Resultados, confirmação e erros são anunciados por leitor de tela. O diálogo
  segue o `docs/design.md` (carregando, vazio, selecionado, erro) sem violação
  crítica nem séria de acessibilidade.
- **R10** — Todos os textos de tela estão em pt_BR.

## Fora de escopo

- **Ver a lista de membros e remover alguém**: fatia **135**
  `free-space-members`. O diálogo não marca quem já é membro.
- **Documentos no espaço livre**: fatia **136** `free-space-documents`. O
  membro não acessa documento nenhum por ser membro.
- **Impedir nome de espaço repetido**: fatia **137** `free-space-unique-name`.
- **Deixar membros adicionarem (espaço aberto/fechado)**: fatia **141**
  `free-space-restrict-invite`. Aqui só o dono adiciona.
- **Papéis de leitor e editor**: fatia **142** `free-space-member-roles`.
- Convidar por e-mail quem não está na instância: fatia **089**.
- Avisar a pessoa (e-mail ou notificação) de que foi adicionada.
- Apagar espaço: não existe ainda, então não há caso de espaço apagado.

## Decisões tomadas

- **Mesma busca do compartilhamento (145)**: mesmos limites, mesmas regras de
  quem aparece. Quem já é membro continua aparecendo; confirmar não muda nada
  (R4).
- **Membro que tenta adicionar recebe recusa, não "inexistente"**: ele já sabe
  que o espaço existe, então a recusa não revela nada (R6).
- **Pessoa que deixou a instância depois de adicionada**: o vínculo fica
  guardado, sem efeito, e ela some da busca.
- **Barra lateral atualiza no próximo carregamento**, não em tempo real (R7).

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- O dono adiciona uma pessoa; ela, com a sessão aberta, troca de tela e vê o
  espaço em "Espaços", abre a página e vê o nome e o aviso de documentos, sem
  "Adicionar pessoa".
- Adicionar de novo a mesma pessoa mostra a mesma confirmação e não cria um
  segundo vínculo.
- A busca não lista o dono; adicionar a si mesmo pelo servidor é recusado com
  erro de validação.
- Um membro que tenta adicionar é recusado; uma terceira pessoa recebe
  "não encontrado" ao abrir a página ou ao tentar adicionar.
- Depois de uma confirmação, o diálogo continua aberto e adiciona uma segunda
  pessoa.
