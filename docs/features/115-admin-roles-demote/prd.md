# PRD 115 — admin-roles-demote

Terceira e última fatia da pilha nascida do corte da 011 `admin-roles` (PRD de
origem em `docs/features/011-admin-roles/prd.md`): **ver quem administra**
(011), **promover** (114 `admin-roles-promote`, PRD em
`docs/features/114-admin-roles-promote/prd.md`) e **rebaixar** (esta). A 011 e a
114 disseram que, enquanto esta fatia não existisse, tirar o papel de alguém só
acontecia no banco — inclusive para desfazer uma promoção feita por engano.
Esta fatia fecha isso e traz com ela a regra que protege a instância: **nunca
ficar sem nenhuma administração**.

Depende da 011, porque a ação vive nas linhas da lista da página
"Administradores", e da 114, porque é ela que dá a ida e vinda completa
(promover e desfazer) sem passar pelo banco.

## Valor

A administração tira o papel de administrar de quem não deve mais tê-lo pela
própria tela, com a garantia de que a instância nunca fica sem ninguém para
administrá-la.

## Usuários

Administradores da organização, na página "Administradores" da área
"Administração" na barra lateral — ao desfazer uma promoção por engano, ao
encerrar a participação de alguém no trabalho de administrar, ou ao abrir mão do
próprio papel depois de passá-lo adiante. E, do outro lado, a pessoa rebaixada,
que deixa de enxergar a área "Administração" no app que já está usando.

## Requisitos

- **R1** — Cada linha da lista de administradores ganha **uma** ação de tirar o
  papel de administração daquela pessoa, no mesmo lugar das ações de item de
  lista já usadas no app (à direita da linha, sempre visível, nunca só ao passar
  o ponteiro), identificada **pelo nome da pessoa daquela linha** e alcançável
  por teclado. A ação **invalida um papel, não apaga ninguém**: em nenhum momento
  ela é apresentada como remoção ou exclusão de pessoa, e a página diz, em
  texto, que a pessoa continua na instância como membro.
- **R2** — A ação **só vale depois de uma confirmação** que **nomeia a pessoa** e
  diz o que ela deixa de poder fazer. O verbo do botão de confirmar é o mesmo do
  gatilho. Desistir não muda nada e devolve a pessoa ao ponto em que estava na
  lista.
- **R3** — A linha de **quem está usando o app** (a que a 011 marca com "você")
  tem a mesma ação, e não uma ação diferente nem uma linha sem ação. A
  confirmação dela é **reforçada e em primeira pessoa**: diz que quem confirma
  perde o acesso à área "Administração" e **não poderá devolver o papel a si
  mesmo** — só outra administração poderá.
- **R4** — **A instância nunca fica sem nenhuma administração.** Quando resta uma
  única pessoa administrando, a ação daquela linha aparece **indisponível**, com
  a explicação **em texto** ao lado — legível por leitor de tela, nunca apenas
  por cor, ícone ou posição —, dizendo que é preciso promover outra pessoa antes
  de tirar o papel desta. A explicação vale igual para si mesmo e para outra
  pessoa.
- **R5** — A recusa da última administração é **decidida pelo servidor**, não
  pela tela: mesmo com duas abas, dois pedidos simultâneos ou uma chamada direta
  ao servidor, é impossível chegar a zero administrações. Quando a recusa vier
  do servidor — porque a lista na tela estava velha —, a confirmação **continua
  aberta**, o aviso aparece em pt_BR com a mesma explicação de R4 e a lista se
  atualiza para o estado real.
- **R6** — Rebaixar quem **já não é** administração — outra aba chegou antes, ou
  dois envios simultâneos — nunca gera erro: a pessoa segue como membro uma única
  vez, a tela **trata como sucesso**, apenas atualiza a lista e **não mostra
  aviso** de "já não era administração".
- **R7** — Ao rebaixar **outra pessoa**: ela some da lista, a contagem de quantas
  pessoas administram se atualiza sem recarregar a página, e surge uma
  notificação de sucesso em pt_BR que **nomeia a pessoa rebaixada**.
- **R8** — Depois de rebaixar outra pessoa, **o foco do teclado é previsível**:
  vai para a ação de rebaixar da linha que passou a ocupar o lugar da removida
  (ou da linha anterior, se a removida era a última); se nenhuma ação da lista
  estiver disponível, vai para o campo de busca de pessoas da 114.
- **R9** — Ao **rebaixar a si mesmo**, a pessoa é **levada ao início** e recebe
  uma notificação em pt_BR dizendo que deixou de administrar a instância. Ela
  **não vê tela proibida, erro de permissão nem página em branco** em nenhum
  instante — nem na página "Administradores", nem em outra página da área
  "Administração".
- **R10** — A pessoa rebaixada **deixa de ver** a área "Administração" na barra
  lateral e de entrar nas páginas dela, **sem precisar recarregar o app**, se
  estiver com ele aberto: a mudança aparece **na próxima navegação dentro do app
  ou ao voltar para a aba**. Não se exige que apareça com ela parada na mesma
  tela. Se tentar pelo endereço, é levada ao início, como na R4 da 011.
- **R11** (origem R4 da 011) — Só a administração rebaixa. Quem não é
  administração não consegue rebaixar nem chamando o servidor diretamente, e
  ninguém rebaixa pessoa de outra organização; a decisão é sempre do servidor,
  que relê o papel a cada pedido.
- **R12** — Pessoa inexistente, de outra organização ou com identificador
  malformado responde o mesmo "não encontrada", sem distinguir os casos.
- **R13** — A ação, a confirmação e o que vier depois dela são alcançáveis e
  acionáveis por teclado do começo ao fim; a mudança da lista e da contagem é
  anunciada por leitor de tela.
- **R14** — Sem nenhuma violação crítica ou séria de acessibilidade (axe) na
  página com a lista, com a confirmação aberta e com a ação indisponível da
  última administração visível.
- **R15** — A página deixa de dizer que rebaixar ainda não é possível por aqui.
  Todos os textos de tela, rótulos e mensagens estão em pt_BR.

## Fora de escopo

- **Desligar a pessoa da instância** — fatia **032** `offboarding`. Aqui ninguém
  é apagado: quem perde o papel continua membro.
- **Devolver o papel** a quem acabou de perdê-lo por um atalho de "desfazer" na
  notificação — o caminho é promover de novo, pela 114.
- **Transferir a administração** num passo só (promover um e rebaixar o outro
  numa ação) — são duas ações, cada uma com sua confirmação.
- **Histórico de rebaixamentos** — quem tirou o papel de quem e quando;
  auditoria é a fatia **033** `access-audit`.
- **Avisar a pessoa rebaixada** por e-mail ou notificação fora do app.
- **Rebaixar várias pessoas de uma vez.**
- **Refletir o rebaixamento na hora**, com a pessoa parada na mesma tela, por
  consulta periódica ou canal de envio do servidor.
- **Papéis além de administração e membro**, administração só de uma unidade,
  "dono" da instância — como na 011.
- **Encerrar as sessões** da pessoa rebaixada; ela continua conectada, só sem a
  área "Administração".

## Riscos

- **Instância órfã.** É o risco que esta fatia existe para eliminar; por isso a
  garantia é do servidor (R5) e não só da tela (R4).
- **Rebaixar a si mesmo sem volta.** Quem tira o próprio papel não o devolve
  sozinho. Mitigação: a confirmação reforçada em primeira pessoa de R3, que diz
  isso antes, e R4, que impede que seja a última.
- **Confundir tirar o papel com apagar a pessoa.** Mitigação: R1 — ícone e verbo
  de invalidar, nunca de remoção, e o texto dizendo que a pessoa continua membro.

## Pontos em aberto

Nenhum.
