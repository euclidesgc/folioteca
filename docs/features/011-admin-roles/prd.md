# PRD 011 — admins-list

Fatia do pedido inicial, depende da 086 `invitations-accept` (é ela que faz
existir mais de uma pessoa na instância) e nasce do corte de uma fatia grande
demais: **ver quem administra** (esta), **promover** (fatia **114** `admin-roles-promote`) e
**rebaixar** (fatia **115** `admin-roles-demote`, que carrega a regra de nunca ficar sem
administração). As três vão **empilhadas para revisão**, uma sobre a outra, na
ordem em que estão no roadmap.

O custo honesto do corte: enquanto as outras duas não existirem, **mudar quem
administra só acontece no banco**. Esta fatia entrega a visão — e é ela que dá
sustentação às outras duas, porque quem vai promover ou rebaixar precisa ver,
antes, quantas pessoas administram.

Desde a 064 a instância já tem duas condições — administração e membro —
derivadas de `isAdmin`, relido do banco a cada pedido. A 010 `unit-assignments`
e a 108 `unit-assignments-remove` já disseram que lotação nunca foi permissão
para administrar.

## Valor

A administração vê, pela própria tela, quem administra a instância e quantas
pessoas são — sem abrir o banco para descobrir.

## Usuários

Administradores da organização, numa página "Administradores" dentro da área
"Administração" na barra lateral, depois de "Estrutura" e "Convites" — ao
conferir com quem divide o trabalho de administrar, ou antes de decidir
promover ou rebaixar alguém (nas fatias seguintes).

## Onde isso vive

Uma página própria da área "Administração", e não uma coluna numa lista de
pessoas da instância, porque **esta lista não é a lista de pessoas**: ela mostra
quem é administração hoje — sempre poucas, sempre inteira, sem paginação.

Justificativa de não listar todo mundo: a instância pode ter milhares de
pessoas, e a 010 já resolveu esse problema uma vez, com busca que não propõe
ninguém sem texto digitado e mostra um número limitado de correspondentes
(dívida 110 anotada para o índice de texto). Listar a instância inteira aqui
repetiria, numa página nova, exatamente o problema que aquela fatia decidiu não
ter — e ainda por cima numa tela em que o que importa cabe em poucas linhas: o
conjunto de quem administra. A lista inteira de administradores, por outro
lado, é o que vai dar sustentação à regra de nunca ficar sem ninguém: quem for
rebaixar alguém verá, na mesma tela, quantos sobram.

## Requisitos

- **R1** — A área "Administração" ganha o item **"Administradores"** na barra
  lateral, **depois de "Estrutura" e "Convites"**, na mesma lista. O nome é o
  plural do que a página mostra, sem jargão de papel ou permissão. A página
  lista **todas as pessoas que são administração** na instância, cada uma com
  **nome e e-mail**, em ordem alfabética de nome, sem paginação.
- **R2** — A lista diz, **em texto**, quantas pessoas administram a instância; e
  a linha de quem está usando o app traz, **em texto**, a marcação de **"você"**.
  Nada além de nome, e-mail e essa marcação: nem data de entrada no papel, nem
  quem promoveu.
- **R3** — A página é **só de leitura**: não há ação nenhuma sobre as pessoas
  listadas. A lista mostra sempre o estado atual; se o papel de alguém mudou por
  fora, recarregar a página mostra a lista como ela está.
- **R4** — Só a administração vê a página. Quem não é administração não vê o
  item na barra lateral, é levado ao início ao tentar pelo endereço e não
  obtém a lista chamando o servidor diretamente; ninguém vê administradores de
  outra organização. A decisão é sempre do servidor, que relê o papel a cada
  pedido.
- **R5** — Ser administração **não dá acesso a documento**: ninguém vê um
  documento que já não via por administrar a instância. A página diz isso em
  texto, pelo mesmo motivo da 010 — não prometer o que a fatia não entrega.
- **R6** — O estado "é administração" e a marcação de "você" são **legíveis por
  leitor de tela**: vêm em texto próprio, **nunca apenas por cor, ícone ou
  posição na tela**.
- **R7** — A página é alcançável e navegável por teclado do começo ao fim, e o
  carregamento e o resultado são anunciados por leitor de tela.
- **R8** — Sem nenhuma violação crítica ou séria de acessibilidade (axe) na
  página.
- **R9** — Todos os textos de tela e rótulos estão em pt_BR.

## Fora de escopo

- **Promover alguém a administração** — fatia **fatia **114** `admin-roles-promote`**, a
  seguinte desta pilha: a busca de pessoas por nome ou e-mail (reaproveitando a
  010), promover direto na linha do resultado, o efeito imediato na barra
  lateral de quem foi promovido e o texto que diz o que a promoção significa.
  Enquanto ela não existir, promover alguém só acontece no banco.
- **Rebaixar alguém** — fatia **fatia **115** `admin-roles-demote`**, a terceira desta pilha,
  e com ela **tudo o que protege a instância**: a regra de **nunca ficar sem
  administração** (recusa do servidor ao rebaixar a última pessoa, válida também
  com envios simultâneos), a ação de rebaixar na linha com confirmação que nomeia
  a pessoa, a **confirmação reforçada em primeira pessoa** de quem rebaixa a si
  mesma e o **redirecionamento ao início** depois disso. Nada disso vale aqui:
  esta fatia não tira o papel de ninguém, e enquanto a terceira não existir
  rebaixar só acontece no banco.
- **Papéis além de administração e membro** — cargos, perfis intermediários,
  permissão por área ou administração só de uma unidade. A instância tem duas
  condições, como desde a 064. Nenhuma fatia no roadmap prevê outros papéis.
- **Dono da instância e transferir esse título** — não existe "dono" da
  organização no produto: a pessoa criada na instalação é administração como
  qualquer outra. Não há fatia prevista. Transferir a propriedade de um
  **documento** é outra coisa, e é a fatia **031 `ownership-transfer`**.
- **Histórico de promoções e rebaixamentos** — quem promoveu quem e quando não
  fica registrado nem visível em lugar nenhum, e a lista não mostra data de
  entrada no papel. A auditoria de acesso é a fatia **033 `access-audit`**, e a
  lacuna equivalente nos convites já está anotada como dívida **104
  `invitation-revoked-by`**.
- **Tudo que é acesso a documento**: o espaço espelhado da unidade (**fatia 012
  `unit-spaces`**), espaços livres (**013**), permissões de espaço (**014**) e
  compartilhamento com pessoa, unidade ou instância (**015**, **016**).
- **Desligar a pessoa da instância** — **fatia 032 `offboarding`**.
- **Convidar alguém já como administração** — o convite (fatias **085**/**086**)
  continua criando pessoa membro.
- **Paginação e busca dentro da lista de administradores** — a lista é pequena
  por natureza e vem inteira. Se um dia não for, vale a mesma dívida da 100 e da
  111.
- **Lotação em unidade** — lotar e listar (**fatia 010**), remover (**fatia
  108**). Lotação e papel são coisas independentes.
- **Escolher a chave e o modelo de IA da organização** — **fatia 027
  `ai-settings`**, que depende desta só por também morar na área
  "Administração".

## Riscos

- **Tela que não resolve o problema sozinha.** Ver quem administra sem poder
  mudar pode frustrar: quem abrir a página para promover alguém sai de mãos
  vazias. Mitigação: as três fatias vão empilhadas para revisão, então a lacuna
  dura o tempo da pilha; e o corte é o que mantém cada PRD de uma página.
- **Prometer poder que não existe.** A página de administradores sugere "quem
  vê tudo"; não é isso. Mitigação: R5, dito na própria tela e não só aqui.
- **Instância órfã sem conserto pela tela.** Continua valendo como risco do
  produto, mas a garantia é da fatia fatia **115** `admin-roles-demote`; aqui nada tira o
  papel de ninguém, então esta fatia não pode criar o problema.

## Pontos em aberto

nenhum
