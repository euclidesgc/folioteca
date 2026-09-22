# SPEC 088 — invitations-list

Quarta das fatias em que o item 009 `invitations` foi cortado (085 criar, 086
aceitar, 087 revogar, 088 listar, 089 enviar por e-mail). PRD aprovado em
`prd.md`, nesta mesma pasta. Parte de `docs/architecture.md` §2 (contrato
primeiro), §6 (parágrafos das fatias 085 e 086: token guardado só como
`sha256`, `AdminGuard` sempre depois do `SessionGuard`, rotas públicas num
controller separado) e §7 (testes).

**Base da entrega**: a branch `feature/088-invitations-list` sai de
`feature/086-invitations-accept`. **Toda** comparação de "arquivo intocado" e
todo diff é contra `feature/086-invitations-accept`, nunca contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN (herdadas da 085/086):
`React.JSX.Element` (nunca o `JSX` global); botão nosso é sempre o componente
`Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`, `lint`,
`typecheck`, `test` e `build`; **toda** espera depois de mudança de rota ou
chunk `lazy` com `timeout` explícito (unitário: `LAZY_TIMEOUT`; e2e:
`ROUTE_TIMEOUT`), nunca `sleep` fixo; typecheck e lint finais rodados de
verdade com o cache limpo (`pnpm exec tsc -b --clean`); **nenhum** `prisma
migrate diff/dev/reset` — só `validate`, `status` e `deploy`; nenhum literal
com cara de senha ou de token; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita: o módulo
`apps/api/src/invitations/` (serviço, `InvitationsController` com os guards na
classe, `PublicInvitationsController`, schema), o modelo `Invitation` com
`acceptedAt` (migration `0010`) e o índice
`@@index([organizationId, createdAt(sort: Desc)])` (migration `0009`), a feature
`apps/web/src/features/invitations/`, a página `/admin/invitations` e
`apps/web/src/utils/format-date-time.ts`. **Nada disso é criado de novo.**

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `GET /invitations` devolve `{ data: Invitation[] }` com `id`, `email`, `createdAt` e `expiresAt` (D1); o componente `InvitationsList` entra abaixo do formulário e do bloco do link, na página que já existe (D5). |
| R2 | As duas datas passam por `formatDateTime` de `@/utils/format-date-time.ts` — `Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })`, que já existe e já trata data inválida (D5). **Nenhum utilitário novo de data.** |
| R3 | O filtro é do servidor: `acceptedAt: null` **e** `expiresAt: { gt: new Date() }` (D2). A API simulada repete as duas condições (D6). |
| R4 | `orderBy: { createdAt: 'desc' }`, atendido pelo índice que já existe (D2, D3). |
| R5 | O schema `Invitation` **não tem** `token` (D1): o campo não existe no tipo, então a web não teria como mostrá-lo nem por engano. O texto fixo da lista diz a regra (Interface). |
| R6 | `useCreateInvitation` ganha `invalidateQueries({ queryKey: getInvitationsQueryOptions().queryKey })` no `onSuccess` — o comentário de `create-invitation.ts` já reserva o lugar (D4). A substituição por e-mail é do servidor (085), então a lista recarregada já vem sem duplicata. |
| R7 | Estado vazio na receita "Vazio" do `docs/design.md`, texto "Nenhum convite pendente." (Interface). |
| R8 | Carregando (`role="status"`) e erro (`role="alert"` + "Tentar novamente" que chama `refetch`), copiados de `OrgUnitsTree` (D5). |
| R9 | `@Get()` dentro de `InvitationsController`, que já tem `@UseGuards(SessionGuard, AdminGuard)` **na classe**: a rota nasce protegida sem uma linha de guard (D2). Integração prova 403 e 401; a API simulada repete (D6). |
| R10 | Textos literais em pt_BR na seção Interface; estrutura de lista com `<dl>` por item, escolhida em D5 contra `<table>`; a lista é conteúdo estático (nada focável nesta fatia), então atualizar não rouba foco de ninguém; e2e com axe (D7). |

## Decisões técnicas

### D1 — Contrato `GET /invitations` (contrato primeiro, §2)

- Escolha: em `packages/api-contract/openapi.yaml`, no caminho **`/invitations`
  que já existe** (sem o prefixo `/api`, como todos os caminhos do arquivo — o
  `/api` é do proxy do Vite e do `env.API_URL`), acrescentar a operação `get`
  ao lado do `post` da 085. `operationId: listInvitations`, tag `invitations`,
  sem parâmetro nenhum (sem paginação, sem filtro — PRD, "Fora de escopo").
- Resposta **200**: `InvitationsResponse` = `{ data: Invitation[] }`, com
  schema **novo**:

  ```yaml
  Invitation:
    type: object
    properties:
      id: { type: string }
      email: { type: string, format: email }
      createdAt: { type: string, format: date-time }
      expiresAt: { type: string, format: date-time }
    required: [id, email, createdAt, expiresAt]
  ```

- **Por que o token não pode estar aqui**: o servidor não tem o token — guarda
  só o `sha256` (§6, fatia 085) e não sabe invertê-lo. Mesmo que soubesse, um
  `GET` de lista é o caminho mais fácil de vazar segredo: cache do navegador,
  log de proxy, extensão, captura de tela do suporte. Um campo `token` opcional
  num schema compartilhado com o `post` faria o tipo da web **mentir** sobre
  quando o token existe — foi exatamente por isso que a 085 criou
  `CreatedInvitation` separado (D1 da 085, "a 088 vai listar convites sem
  token"). `Invitation` e `CreatedInvitation` seguem **dois schemas distintos**,
  sem `allOf` entre eles.
- A `description` da operação registra as regras observáveis: só a
  administração; devolve **apenas** convites pendentes (nem aceitos, nem
  vencidos); ordem do mais recente para o mais antigo; o token **nunca** sai
  aqui.
- Erros: **401** e **403** `Error` (schemas que já existem). Não há 400 (não há
  entrada) nem 404 (lista vazia é `{ data: [] }` com 200).
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`.
- Alternativa descartada: `GET /invitations?status=pending` — motivo: nenhum
  outro valor de `status` é atendido nesta fatia, e um parâmetro que só aceita
  um valor é contrato mentiroso; a 087 decide se vira filtro quando houver
  revogado para mostrar.
- Alternativa descartada: envelope com `meta` de paginação — motivo: o PRD tirou
  paginação de escopo e um `meta` vazio obrigaria a web a fingir que pagina.

### D2 — `InvitationsService.list` e o filtro de "pendente" (`authorization`)

- Escolha, em `apps/api/src/invitations/invitations.service.ts`, método novo
  `list(organizationId: string): Promise<Invitation[]>`:

  ```ts
  const rows = await this.prisma.invitation.findMany({
    where: {
      organizationId,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, createdAt: true, expiresAt: true },
  });
  ```

  O `select` é explícito e **não** inclui `tokenHash` nem `invitedById`: é a
  segunda tranca de R5 (a primeira é o schema de D1) e vale mesmo se alguém
  acrescentar campo ao contrato sem pensar. As datas viram `toISOString()` no
  retorno, como `create` já faz.
- **"Pendente" é definido em um lugar só**: as mesmas duas condições que
  `findPending` (o caminho do aceite) usa em memória — `acceptedAt === null` e
  `expiresAt > agora`. Ficam duplicadas de propósito: `findPending` roda sobre
  **uma** linha já carregada (para não dar pista de qual das recusas ocorreu) e
  a lista precisa que o **banco** filtre. O comentário de cada uma aponta para a
  outra, e a 087 acrescenta `revokedAt: null` **nas duas**. Registrado em
  "Dívida encontrada".
- `expiresAt: { gt: new Date() }` e não um `WHERE` com `now()` no banco: o
  Prisma manda o instante como parâmetro, o índice continua utilizável e o teste
  consegue inserir um convite vencido sem mexer no relógio do Postgres.
- Controller: `@Get()` em `apps/api/src/invitations/invitations.controller.ts`,
  que **já tem** `@UseGuards(SessionGuard, AdminGuard)` na classe (§6) —
  nenhuma linha de guard é escrita nesta fatia, e é essa a garantia de que R9 não
  depende de alguém lembrar. `@CurrentPerson() person` dá o `organizationId`;
  retorno `{ data }`.
- Alternativa descartada: filtrar "vencido" na web — motivo: R9 exige que a
  decisão seja do servidor, e o relógio do navegador é do usuário.

### D3 — Índice: **nenhum novo**, nenhuma migration (`security`)

- A consulta é `organizationId` + ordem por `createdAt DESC`, exatamente o
  `@@index([organizationId, createdAt(sort: Desc)])` criado pela migration
  `0009`. `acceptedAt IS NULL` e `expiresAt > $1` são filtros residuais sobre um
  conjunto que é, por construção, pequeno e transitório (convite vence em 7
  dias).
- Portanto **não existe migration `0011` nesta fatia** e `schema.prisma` não
  muda. Se um dia a tabela justificar, o índice certo é parcial
  (`WHERE "acceptedAt" IS NULL`) e vem com a fatia de paginação. Registrado em
  "Dívida encontrada".
- Regra que continua valendo caso alguém discorde e queira o índice: a migration
  é **escrita à mão** em `apps/api/prisma/migrations/0011_<nome>/migration.sql`,
  conferida com `prisma validate` e `prisma migrate status` e aplicada por
  `migrate deploy` (em hml, só pelo contêiner). `prisma migrate diff`, `dev` e
  `reset` são **proibidos** no projeto — o índice por expressão
  `lower("email")` da `0009` é invisível ao `schema.prisma` e qualquer `diff`
  proporia apagá-lo.
- Alternativa descartada: criar o índice parcial "porque é barato" — motivo:
  índice a mais custa escrita em toda criação e aceite de convite, para uma
  tabela que hoje tem dezenas de linhas; é otimização sem medida.

### D4 — Web: a consulta e a invalidação (`api-requests`, `client-state`)

- Escolha: `apps/web/src/features/invitations/api/get-invitations.ts`, no molde
  exato de `features/org-units/api/get-org-units.ts`:
  `getInvitations(): Promise<InvitationsResponse>` → `api.get('/invitations')`;
  `getInvitationsQueryOptions()` com `queryKey: ['invitations']`;
  `useInvitations({ queryConfig })`. **Sem** `silentError`: uma falha de carga
  é notificada pelo interceptor global, como em toda lista do app.
- Os tipos `Invitation` e `InvitationsResponse` são aliasados **no próprio
  arquivo** (`components['schemas'][…]`), como `create-invitation.ts` já faz com
  `CreatedInvitation`: nenhuma outra feature lê convite, então `types/api.ts`
  continua intocado.
- `apps/web/src/features/invitations/api/create-invitation.ts`:
  `useCreateInvitation` ganha o `onSuccess` que o comentário do arquivo já
  reserva (*"Slice 088 adds the invalidateQueries together with the GET
  /invitations"*) — `queryClient.invalidateQueries({ queryKey: getInvitationsQueryOptions().queryKey })`
  **antes** de chamar o `mutationConfig?.onSuccess` de quem usa o hook, e o
  comentário é substituído pelo que explica R6. O `silentError` do `post`
  continua: o 409 segue respondido no campo.
- Alternativa descartada: escrever o convite novo direto no cache
  (`setQueryData`) — motivo: o servidor pode ter **substituído** um convite
  pendente do mesmo e-mail (085, R3), e o cliente não sabe qual sumiu; recarregar
  é o único jeito de a lista bater com o banco, e é o que R6 pede.
- Alternativa descartada: `refetchInterval` para o vencimento sumir sozinho da
  tela — motivo: pedido a cada N segundos numa tela aberta o dia todo, para um
  evento que acontece uma vez em 7 dias; a lista vencida some na próxima carga.

### D5 — Web: o componente da lista (`interface-design`, `component-robustness`)

- Escolha: `apps/web/src/features/invitations/components/invitations-list.tsx`,
  com a mesma divisão de `OrgUnitsTree`: o componente exportado cuida dos quatro
  estados da consulta e um `LoadedInvitationsList` interno só recebe `Invitation[]`.
  Entra em `app/routes/app/admin/invitations.tsx` **depois** do bloco do link —
  assim nenhuma contagem de `Tab` dos e2e da 085 muda.
- Estados copiados de `OrgUnitsTree`, sem inventar variação: carregando com
  `isPending || (isError && isFetching)` (o retry volta a "pending" no TanStack
  Query v5) e `role="status"`; erro com `role="alert"`, receita "Erro" e botão
  destrutivo "Tentar novamente" que chama `refetch`; vazio na receita "Vazio".
- **Estrutura: lista (`<ul>`) com um `<dl>` por item, não `<table>`.**
  - O que decide é o leitor de tela **e** o piso de 360px. Numa `<table>` o
    rótulo da coluna só é reanunciado quando a pessoa entra no modo de navegação
    por tabela — em leitura linear, "29/09/2026 14:30" sai solto, sem dizer se é
    a criação ou o vencimento. No `<dl>`, cada `<dt>` ("Criado em", "Expira em")
    vem **antes** do seu `<dd>` na ordem do documento: a leitura linear, que é a
    que a maioria faz, já entrega o par completo, sem modo especial.
  - Três colunas de data e e-mail não cabem em 360px sem rolagem horizontal, e
    o piso da skill `interface-design` proíbe rolagem horizontal. A lista
    resolve com `flex-wrap`: o e-mail em cima, as datas embaixo.
  - A lista reaproveita as receitas "Lista", "Data em lista" e "Ações do item de
    lista" que o `docs/design.md` já tem — a mesma moldura que a 087 vai usar
    para pendurar "Revogar" na linha. Uma `<table>` obrigaria a inventar receita
    de tabela e outra de ações em célula.
  - Uma `<caption>`/`aria-label` não compensa: o problema não é achar a lista, é
    parear valor e rótulo.
  - O `<ul>` leva `aria-label="Convites pendentes"`; cada `<li>` tem `key` do
    `id` do convite.
- Datas: `<time dateTime={invitation.createdAt}>{formatDateTime(invitation.createdAt)}</time>`.
  O `dateTime` fica com o ISO cru (é o que o atributo espera) e o texto visível é
  o pt_BR. `formatDateTime` devolve string vazia para data inválida — nada
  quebra a lista.
- E-mail longo: `min-w-0 break-words` no bloco do e-mail (endereço não tem
  espaço para quebrar sozinho), nunca `truncate`, porque o e-mail é a única coisa
  que identifica a linha.
- **Nada de link nem de token na tela** (R5): o componente não recebe token, não
  importa `buildInvitationLink` e não renderiza `<a>` nenhum. O texto fixo acima
  da lista explica por quê.
- Alternativa descartada: mostrar "expira em 3 dias" (tempo relativo) — motivo:
  R2 pede dia, mês, ano e hora; tempo relativo precisaria de re-render por
  minuto e de um utilitário novo, e o PRD proíbe utilitário novo de data.
- Alternativa descartada: selo de status ("Pendente") em cada linha — motivo:
  todas as linhas são pendentes por definição (R3); um selo que nunca varia é
  ruído. O selo volta a fazer sentido na 087.

### D6 — API simulada (`api-mocking`)

- Escolha: acrescentar o handler `http.get(`${env.API_URL}/invitations`)` em
  `apps/web/src/testing/mocks/handlers/invitations.ts`, **antes** dos handlers
  de `/invitations/:token` no array (o MSW casa na ordem, e `/invitations` não
  colide com `/invitations/:token`, mas a ordem deixa a leitura óbvia). Mesmo
  preâmbulo do `post` que já está lá: `networkDelay()`,
  `devOverride('invitations')`, 401 sem cookie ou sem instalação, 403 para
  não-admin.
- O corpo repete **as mesmas duas regras** do servidor, sobre
  `getDb().invitations`: `acceptedAt === null` e
  `new Date(expiresAt).getTime() > Date.now()`, depois ordem decrescente por
  `createdAt` (`[...invitations].sort(…)`, cópia — nunca `sort` no array do
  estado). O mapeamento monta `{ id, email, createdAt, expiresAt }` campo a
  campo: **`token` e `acceptedAt` não são espalhados com `...`**, para o banco
  falso não conseguir vazar o token nem por descuido.
- Há uma função `findAvailableInvitation` no arquivo com as mesmas duas
  checagens, para um token só. Ela **não** é reaproveitada aqui: o filtro da
  lista é sobre o array inteiro e a função devolve `undefined` para "recusado",
  que é o contrato do 404 público. Um predicado interno
  `isPending(invitation: MockInvitation): boolean` passa a ser usado pelos dois.
- `db.ts` **não muda**: `MockInvitation` já tem `acceptedAt`, `addInvitation` já
  substitui por e-mail e `acceptInvitation` já marca `acceptedAt`.
- `apps/web/src/testing/mocks/utils.ts`: o comentário das chaves de
  desenvolvimento ganha a menção de que `mock-invitations=sample` agora também
  popula a lista da página; `mock-error=invitations` já dá o 500 do estado de
  erro e `mock-role=member` já dá o 403.
- Alternativa descartada: semear um convite vencido e um aceito em
  `seedSampleInvitations` — motivo: mudaria o estado que as jornadas da 086
  esperam. Os casos de borda são semeados **pelo teste**, com handler próprio.

### D7 — Testes

- **API, integração contra Postgres real** — casos novos em
  `apps/api/src/invitations/__tests__/invitations.integration.test.ts` (ajudante
  `getInvitations(cookie?)` com `X-Requested-With`): admin vê **só** os
  pendentes; um convite com `acceptedAt` preenchido (aceito pela rota pública, ou
  gravado direto pelo Prisma) **não aparece**; um convite com `expiresAt` no
  passado (gravado direto pelo Prisma) **não aparece**; três convites criados em
  instantes diferentes saem do **mais recente para o mais antigo**; sem nenhum
  pendente → **200** com `{ data: [] }`; **não-admin → 403** "Apenas a
  administração pode fazer isso."; **anônimo → 401** "Sessão não encontrada.".
- **O token nunca no corpo — prova pelo JSON**: cria um convite, guarda o
  `token` do 201 e afirma, sobre a resposta da lista, que
  `JSON.stringify(body)` **não contém** o token **nem** o `sha256` dele, e que
  `Object.keys(body.data[0])` é exatamente
  `['id', 'email', 'createdAt', 'expiresAt']`. As duas asserções juntas: a
  primeira pega o vazamento em qualquer campo, inclusive um que ninguém previu;
  a segunda pega campo novo antes de ele virar vazamento.
- **API, unitários** — casos novos em `invitations.service.test.ts` (Prisma
  falso): o `where` de `findMany` tem `organizationId`, `acceptedAt: null` e
  `expiresAt: { gt: <Date> }`; o `orderBy` é `{ createdAt: 'desc' }`; o `select`
  **não** tem `tokenHash`; as datas saem em ISO.
- **API, contrato** — `invitations.contract.test.ts`: 200, 401 e 403 do `GET`
  validados contra o `openapi.yaml`.
- **Web, unitários** —
  `features/invitations/api/__tests__/get-invitations.test.tsx`: chama
  `GET /invitations` e devolve `data`; falha rejeita **com** a notificação
  global (sem `silentError`). Em
  `api/__tests__/create-invitation.test.tsx`, caso novo: um `POST` bem-sucedido
  invalida a chave `['invitations']` (espiando `invalidateQueries` do
  `QueryClient` do teste).
- **Web, componente** —
  `features/invitations/components/__tests__/invitations-list.test.tsx`:
  carregando mostra "Carregando convites…" com `role="status"`; erro mostra a
  mensagem com `role="alert"` e "Tentar novamente" refaz a busca (handler
  contador: 2 chamadas); vazio mostra "Nenhum convite pendente."; com dados,
  cada item mostra o e-mail, "Criado em" e "Expira em" com as datas em pt_BR
  (`dd/mm/aaaa hh:mm`, com o fuso fixado no teste) e o `dateTime` com o ISO;
  a ordem na tela é a ordem que a API mandou (o componente **não** reordena);
  nenhum `link` (`queryAllByRole('link')` vazio) e o texto da resposta não
  contém nada parecido com token; um e-mail de 80 caracteres não estoura o
  item (a classe de quebra está no elemento do e-mail).
- **Web, integração de rota** — casos novos em
  `app/routes/app/admin/__tests__/invitations.test.tsx`: admin abre
  `/admin/invitations` com dois convites semeados e vê os dois, o mais recente
  primeiro; criar um convite faz o novo **aparecer no topo** sem recarregar a
  página (R6), e um convite pendente do mesmo e-mail **não** aparece duas vezes;
  não-admin continua sendo levado ao início **sem** nenhuma requisição a
  `/invitations` (o caso que já existe segue valendo, agora também para o `GET`).
- **e2e** — `apps/web/e2e/tests/invitations-list.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in` + `mock-invitations=sample`: a administração
  abre "Convites" pela barra lateral, vê o convite semeado com as duas datas,
  cria outro e vê o novo no topo sem recarregar;
  `expectNoSeriousA11yViolations` com a lista na tela. O e2e da 085
  (`invitations-create.spec.ts`) **não muda**: a lista entra depois do bloco do
  link, então nenhuma contagem de `Tab` existente muda — conferir que continua
  verde é critério do PLAN.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. A fatia **não cria
tela nova**: entra na página "Convites" (`/admin/invitations`), que a 085 criou.
Receitas usadas, todas já existentes: "Contêiner de página" (via
`ContentLayout`), "Subtítulo (`h2`)", "Texto de apoio", "Lista", "Data em
lista", "Carregando", "Vazio", "Erro", "Botão destrutivo". Receita **nova**,
acrescentada a "Padrões acrescentados pelas entregas" com a fatia 088:

| Padrão | Classes |
|---|---|
| Pares rótulo–valor no item de lista | dentro do `<li>` da receita "Lista", um `<dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1">`; cada par num `<div>`; `<dt className="text-xs text-gray-600">` com o rótulo visível e `<dd>` com a receita "Data em lista"; o `<li>` ganha `flex-wrap` e o bloco principal `min-w-0 break-words` |

### Página "Convites" (`/admin/invitations`), de cima para baixo

Sem alteração até o bloco do link (`<h1>` "Convites", texto de apoio,
formulário, bloco do convite criado). **Abaixo dele**, a seção nova:

- `<h2>` "Convites pendentes" (receita "Subtítulo").
- Texto de apoio: "O link de cada convite aparece uma única vez, quando ele é
  criado, e não pode ser mostrado de novo. Para gerar um link novo, convide o
  mesmo e-mail outra vez."
- No lugar do conteúdo, um dos quatro estados.

### A lista, com dados

`<ul aria-label="Convites pendentes">` na receita "Lista". Cada item:

- à esquerda, o e-mail convidado, em `min-w-0 break-words`;
- à direita (abaixo, a 360px), os dois pares: **"Criado em"** e **"Expira em"**,
  cada um com a data formatada por `formatDateTime`.

Ordem exatamente a que a API mandou: a lista **não** reordena nada.

### Estados

| Estado | O que aparece |
|---|---|
| carregando | "Carregando convites…" (receita "Carregando", `role="status"`) |
| vazio | "Nenhum convite pendente." (receita "Vazio") |
| erro | "Não foi possível carregar os convites." (receita "Erro", `role="alert"`) + botão "Tentar novamente" |
| com dados | a lista acima |

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| carregando | "Carregando convites…" | no lugar da lista |
| sem convites | "Nenhum convite pendente." | no lugar da lista |
| falha na carga | "Não foi possível carregar os convites." | no lugar da lista |
| ação do erro | "Tentar novamente" | botão dentro do bloco de erro |
| rótulo da lista | "Convites pendentes" | `<h2>` e `aria-label` do `<ul>` |
| rótulos das datas | "Criado em" · "Expira em" | `<dt>` de cada par |
| servidor, 401 | "Sessão não encontrada." (já existe) | interceptor global → volta ao login |
| servidor, 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |

Layout a 360px: o `<li>` é `flex-wrap`, o e-mail ocupa a linha de cima e o `<dl>`
quebra para a linha de baixo, com os dois pares lado a lado ou empilhados. Sem
rolagem horizontal em nenhum ponto.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `/invitations` `get`: 200/401/403; schemas `Invitation` e `InvitationsResponse` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| alterar | `apps/api/src/invitations/invitations.service.ts` | método `list` com filtro de pendente, ordem e `select` explícito (D2) | `authorization`, `security` |
| alterar | `apps/api/src/invitations/invitations.controller.ts` | `@Get()`, herdando os guards da classe (D2) | `authorization` |
| alterar | `apps/api/src/invitations/__tests__/invitations.service.test.ts` | casos de D7 | `unit-testing` |
| alterar | `apps/api/src/invitations/__tests__/invitations.integration.test.ts` | casos de D7, inclusive a prova do token pelo JSON | `integration-testing` |
| alterar | `apps/api/src/invitations/__tests__/invitations.contract.test.ts` | 200/401/403 do `GET` (D7) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/invitations/api/get-invitations.ts` | fetcher, `queryOptions` `['invitations']`, hook (D4) | `api-requests` |
| alterar | `apps/web/src/features/invitations/api/create-invitation.ts` | `invalidateQueries` no `onSuccess`; o comentário que reservava o lugar vira o que explica R6 (D4) | `api-requests`, `client-state` |
| criar | `apps/web/src/features/invitations/components/invitations-list.tsx` | quatro estados + `LoadedInvitationsList` com `<ul>`/`<dl>` e `formatDateTime` (D5) | `interface-design`, `component-robustness`, `error-handling` |
| alterar | `apps/web/src/app/routes/app/admin/invitations.tsx` | `<h2>`, texto de apoio e `<InvitationsList />` abaixo do bloco do link (D5) | `interface-design` |
| alterar | `apps/web/src/testing/mocks/handlers/invitations.ts` | `GET /invitations` com 401/403/200, mesmo filtro e mesma ordem; `isPending` interno (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário: `mock-invitations=sample` também popula a lista (D6) | `api-mocking` |
| criar | `apps/web/src/features/invitations/api/__tests__/get-invitations.test.tsx` | D7 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/features/invitations/api/__tests__/create-invitation.test.tsx` | caso da invalidação (D7) | `unit-testing` |
| criar | `apps/web/src/features/invitations/components/__tests__/invitations-list.test.tsx` | D7 | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/app/routes/app/admin/__tests__/invitations.test.tsx` | casos de D7 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/invitations-list.spec.ts` | jornada de D7, axe com a lista na tela | `e2e-testing` |
| alterar | `docs/design.md` | receita "Pares rótulo–valor no item de lista" (088) | `interface-design` |
| alterar | `docs/architecture.md` | §6: parágrafo "Entrega `invitations-list` (fatia 088)" — `GET /invitations` entra no `InvitationsController` e herda `SessionGuard` + `AdminGuard` da classe; "pendente" é `acceptedAt IS NULL` **e** `expiresAt > agora`, decidido no banco, com ordem `createdAt DESC` atendida pelo índice da `0009` (nenhuma migration nova); o schema `Invitation` **não tem** `token` — o servidor guarda só o `sha256` e um campo opcional faria o tipo mentir, por isso `Invitation` e `CreatedInvitation` são schemas distintos; a mesma definição de "pendente" existe duas vezes (`findPending` e `list`) e a 087 precisa acrescentar `revokedAt` nas duas | — |
| alterar | `docs/roadmap.md` | item 088 concluído; dívidas abaixo que virarem item | — |

Intocados de propósito (comparar com `feature/086-invitations-accept`):
`apps/api/prisma/**` (schema e **todas** as migrations, `0001`–`0010`),
`apps/api/src/auth/**`, `apps/api/src/common/**`,
`apps/api/src/invitations/invitations.schema.ts`,
`apps/api/src/invitations/public-invitations.controller.ts`,
`apps/api/src/invitations/invitations.module.ts`, `apps/api/src/app.module.ts`,
`apps/api/src/{access,documents,org-units,installation}/**`,
`apps/web/src/lib/**`, `apps/web/src/components/**`, `apps/web/src/config/**`
(nenhuma rota nova), `apps/web/src/utils/format-date-time.ts`,
`apps/web/src/types/api.ts`, `apps/web/src/testing/mocks/db.ts`,
`apps/web/src/features/{auth,connection,installation,documents,org-units}/**`,
`apps/web/src/features/invitations/{components/create-invitation-form.tsx,components/invitation-link.tsx,components/accept-invitation-form.tsx,api/get-invitation.ts,api/accept-invitation.ts,utils/**}`,
`eslint.config.js` (a feature `invitations` já tem a zona dela),
os e2e da 064, 065, 066, 085 e 086.

## Estimativa de tamanho

Jornadas: 1 (a administração abre "Convites" e vê quem está pendente) · Telas
principais **novas: 0** (a página já existe) · Fases previstas: 3 · Linhas
alteradas (sem testes, sem o `.d.ts` gerado): **~285** — API ~105 (YAML ~60,
serviço ~30, controller ~15; `schema.prisma` e migrations: **zero**); web ~125
(`get-invitations.ts` ~30, `invitations-list.tsx` ~80, rota ~10,
`create-invitation.ts` ~10 de alteração); `src/testing/` ~35; docs ~20. Com
testes: ~620.

Sinais de "grande demais": **nenhum dispara**. (1) uma jornada só; (2) 3 fases,
no limite; (3) nenhuma tela principal nova — a fatia acrescenta uma seção a uma
página existente; (4) ~285 linhas sem testes, abaixo do teto de ~400, com folga
de ~115. É a menor fatia da trilha, como o PRD previu: não há módulo, feature,
rota, modelo nem migration para nascer — tudo já existe desde a 085/086, e o
que entra é uma operação de leitura e um componente de lista. Se o implementer
passar de ~350 sem testes, o sinal é que o componente virou complexo demais
para o que mostra: o corte é tirar a seção de texto de apoio da lista (o aviso
sobre o link) e deixar só a lista — nunca mexer no filtro do servidor, que é
R3 e R9.

## Dívida encontrada

- **"Pendente" definido em dois lugares** (D2): `findPending` (em memória, sobre
  uma linha) e `list` (no `where` do Prisma) repetem `acceptedAt === null` +
  `expiresAt > agora`. A 087 acrescenta `revokedAt` e precisa tocar **os dois**;
  se tocar um só, um convite revogado continua aparecendo na lista ou continua
  aceitável pelo link. Comentário cruzado nos dois pontos enquanto isso.
- **Sem índice parcial para a lista** (D3): a consulta usa o índice
  `(organizationId, createdAt DESC)` da `0009` e filtra `acceptedAt`/`expiresAt`
  em cima. Funciona no tamanho de hoje; quando a tabela crescer (ela nunca é
  limpa — dívida herdada da 085), o índice certo é parcial
  `WHERE "acceptedAt" IS NULL`, numa migration escrita à mão.
- **Sem paginação, busca ou filtro** (PRD, "Fora de escopo"): a lista traz todos
  os pendentes num pedido só. Aceitável porque convite pendente é transitório,
  mas passa a doer com algumas dezenas simultâneas — e não há nada no código que
  avise quando isso acontecer. Vira fatia própria.
- **Convite vencido nunca é removido** (herdada da 085): agora ele também fica
  invisível na tela, o que **esconde** o crescimento da tabela em vez de
  denunciá-lo. Reforça a necessidade da limpeza periódica já registrada no
  roadmap.
- **A API simulada mantém o token em claro no banco falso** (herdada da 086):
  necessário para a jornada do link no navegador. O handler da lista monta o
  corpo campo a campo justamente para não espalhá-lo (D6) — é uma convenção, não
  uma tranca; um `...invitation` distraído vazaria. O teste de componente que
  procura token no DOM é a rede de proteção.
- **`types/api.ts` não conhece convite**: os aliases de contrato da feature
  moram nos arquivos de `api/`. Quando uma segunda feature precisar ler convite
  (a listagem de pessoas, provavelmente), eles sobem para `types/api.ts`.
- Herdadas e ainda válidas: falta o projeto Playwright contra a API real, então
  o 403 e o 401 do servidor só são provados pela integração da API.
