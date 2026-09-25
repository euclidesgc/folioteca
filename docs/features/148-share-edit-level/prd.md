# PRD 148 — share-edit-level

Desde a fatia **145** `share-with-person-view`, o proprietário compartilha um
documento com uma pessoa, mas só para leitura ("Pode ver"). Desde a **147**
`share-access-list`, o diálogo "Compartilhar documento" mostra a lista "Quem tem
acesso", com o selo do nível de cada pessoa. O item **015** `share-with-person`
foi dividido nas fatias **145**, **146**, **147** e **148**. Esta fatia permite
compartilhar em "Pode editar" e trocar o nível de alguém compartilhando de novo.

## Valor

O proprietário chama outra pessoa para escrever o documento com ele: ela edita
título e conteúdo junto, em tempo real, e o proprietário troca o nível dela
compartilhando de novo, sem criar uma segunda entrada.

## Usuários

- **Proprietário do documento**: escolhe a pessoa, escolhe o nível e
  compartilha; troca o nível de quem já tem acesso.
- **Pessoa com "Pode editar"**: abre o documento pelo link e edita junto com os
  outros.
- **Pessoa com "Pode ver"**: continua lendo, como na 145.

## Requisitos

- **R1** — No diálogo "Compartilhar documento", depois de escolher a pessoa, o
  proprietário escolhe o nível num grupo de rádios com o rótulo **"Nível de
  acesso"**: **"Pode ver"** (marcado por padrão) ou **"Pode editar"**. Depois
  confirma em "Compartilhar". O aviso de sucesso continua o da 145
  ("Documento compartilhado com <nome>.").
- **R2** — Compartilhar com quem já tem acesso por compartilhamento troca o
  nível dele para o escolhido, nos dois sentidos, sem criar um segundo
  compartilhamento nem uma segunda linha em "Quem tem acesso". A linha passa a
  mostrar o selo do nível atual na hora, sem fechar o diálogo.
- **R3** — Quem tem "Pode editar" abre o documento pelo endereço direto, sem
  sair e entrar de novo na sessão, sem o rótulo "Somente leitura", e edita
  título e conteúdo. As alterações dele e das outras pessoas no documento
  aparecem para todos em tempo real, como colaboradores.
- **R4** — Quem tem "Pode editar" não vê a ação "Compartilhar" nem a de mover
  para a lixeira ou excluir. Se um desses pedidos chegar ao servidor por outro
  caminho, ele recusa: compartilhar, mover para a lixeira e excluir continuam só
  do proprietário.
- **R5** — O acesso efetivo é decidido pelo servidor, relido a cada pedido, pelo
  caminho único de decisão de acesso a documentos: proprietário → lixeira →
  o maior entre compartilhamento e participação no espaço → nenhum. "Pode
  editar" por compartilhamento vence "ver" pelo espaço, e editar pelo espaço
  vence "Pode ver" por compartilhamento.
- **R6** — Documento na lixeira: vale o R10 da 145. Os compartilhamentos, com o
  nível de cada um, ficam guardados; só o proprietário abre. Ao restaurar, cada
  pessoa volta com o nível que tinha.
- **R7** — Quem tem "Pode ver" continua como na 145: somente leitura, e o
  servidor recusa qualquer alteração.
- **R8** — O grupo "Nível de acesso" funciona por teclado (setas trocam a
  opção), tem nome acessível e a troca de nível na lista é anunciada por leitor
  de tela. A apresentação segue o `docs/design.md`, sem violação crítica nem
  séria de acessibilidade.
- **R9** — Todos os textos de tela estão em pt_BR.

## Casos de borda

- **Rebaixar de "Pode editar" para "Pode ver"** compartilhando de novo: o nível
  guardado e o selo trocam (R2). Quem estiver com o documento aberto só sente a
  mudança ao reabrir; o efeito na hora é da **146**.
- **Compartilhar de novo com o mesmo nível**: nada muda, mesmo aviso de sucesso
  (R5 da 145).
- **Pessoa que já edita pelo espaço** recebe "Pode ver" por compartilhamento:
  continua editando (R5).

## Fora de escopo

- **Rebaixar ou remover o acesso com efeito na hora** para quem está com o
  documento aberto, trocar o nível ou remover alguém direto pela lista, e "sem
  acesso" explícito: fatia **146** `share-level-change`.
- **Compartilhar com espaço, unidade ou toda a instância**: fatia **016**
  `share-with-groups`.
- **Ver quem acessa pelo espaço e por qual caminho**: fatia **018**
  `who-can-see`.
- **Lista "Compartilhados comigo"**: fatia **019** `shared-with-me`.
- Nível de comentário ou sugestão; editor com poder de compartilhar.
- Avisar a pessoa de que recebeu acesso ou de que o nível mudou.

## Decisões tomadas

- **Nível por rádios, "Pode ver" por padrão** (R1): mantém o comportamento da
  145 para quem não mexe na opção.
- **Compartilhar de novo troca o nível** (R2), em vez de dar erro ou duplicar;
  a lista mostra sempre o nível atual.
- **Editor não compartilha, não move para a lixeira nem exclui** (R4): isso
  continua do proprietário.
- **Acesso efetivo é o maior entre compartilhamento e espaço** (R5), pelo
  caminho único já decidido.
- **Rebaixar compartilhando de novo é permitido**, mas o efeito imediato em
  sessão aberta fica para a **146**.

## Pontos em aberto

nenhum

## Métricas de pronto (observáveis)

- O proprietário compartilha em "Pode editar"; a pessoa abre o endereço sem
  "Somente leitura", edita título e conteúdo, e o proprietário vê as alterações
  em tempo real.
- A lista mostra a pessoa com "Pode editar"; compartilhar de novo em "Pode ver"
  troca o selo sem duplicar a linha.
- A pessoa com "Pode editar" não vê "Compartilhar" nem a lixeira, e o servidor
  recusa esses pedidos enviados direto.
- Com o documento na lixeira, a pessoa recebe "não encontrado"; ao restaurar,
  volta a editar.
