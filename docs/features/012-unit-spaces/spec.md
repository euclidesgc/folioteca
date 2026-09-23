# SPEC 012 — unit-spaces

Primeira das duas fatias em que o item 012 foi cortado: **012 abre o espaço**
(seção "Unidades" na barra lateral e página do espaço com o nome da unidade e o
aviso de documentos); **128 `unit-space-members`** acrescenta a lista de
membros. PRD aprovado em `prd.md`, nesta mesma pasta, com 8 requisitos.

Parte de `docs/architecture.md` §2 (contrato primeiro), §3 (lotação **não** dá
acesso a documento — esta fatia não muda isso), §4 (unidades e lotação, 010 e
108) e §6 (guards na classe, `organizationId` sempre da sessão).

**Base da entrega**: a branch `feature/012-unit-spaces` sai de
`feature/115-admin-roles-demote`. **Toda** comparação de "arquivo intocado" e
todo diff é contra `feature/115-admin-roles-demote`, nunca contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca
o `JSX` global); `ref` é prop comum, sem `forwardRef`; botão nosso é sempre o
componente `Button`; navegação interna é sempre `<Link>`/`<NavLink>`; cobertura
≥ 80% por arquivo; nenhum aviso em `install`, `lint`, `typecheck`, `test` e
`build`; **toda** espera depois de mudança de rota ou chunk `lazy` com
`timeout` explícito (`LAZY_TIMEOUT`, `ROUTE_TIMEOUT`), nunca `sleep` fixo;
typecheck e lint finais com o cache limpo (`pnpm exec tsc -b --clean`);
**migration é escrita à mão**, e **nenhum** `prisma migrate diff/dev/reset` —
só `validate`, `status` e `deploy`; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita (nada disso é criado de novo):

- Banco: `Space` com `type SpaceType` (`UNIT`) e `orgUnitId String? @unique`,
  criado **na mesma transação** que a unidade (`org-units.service.ts`, e a raiz
  em `installation.service.ts`), e apagado junto com ela; `OrgUnitAssignment`
  com PK `(orgUnitId, personId)` e `@@index([personId])` — o índice que a SPEC
  da 010 reservou para "em que unidades esta pessoa está".
- API: `SessionGuard`, `@CurrentPerson()`, `CsrfGuard` global, o colador
  `Intl.Collator('pt-BR', { sensitivity: 'base' })` com desempate por `id`
  (padrão de `unit-assignments.service.ts` e `admin-roles.service.ts`), o teste
  estrutural `access/__tests__/document-access-boundary.test.ts`,
  `createPersonWithSession`, `apps/api/test/http.ts` e `contract.ts`.
- Web: `AppLayout` com o slot `sidebarSection`, `root.tsx` compondo as seções,
  a receita "Seção da barra lateral" (004), `ContentLayout`, `Button`,
  `paths`/`router` com rotas `lazy`, `useUser`, e as mutações
  `assign-person.ts` e `remove-assignment.ts` da 010/108.
- Mocks: `getSignedInPerson()`, `allPeople()`, `addAssignment`,
  `removeAssignment`, `addOrgUnit`, `removeOrgUnit`, `rootOrgUnit`,
  `seedSampleOrgUnits`, `devOverride`/`networkDelay`/`SESSION_COOKIE_NAME`,
  `expectNoSeriousA11yViolations`.

**Nenhuma migration** (D1).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `GET /spaces` devolve os espaços de unidade da pessoa, **já ordenados** pelo colador pt-BR no servidor (D3); `SidebarUnitSpaces` desenha um `<NavLink>` por item para `/spaces/:spaceId`, sem reordenar (D5). |
| R2 | Com `data` vazia, `SidebarUnitSpaces` devolve `null`: nem `<nav>`, nem `<h2>` (D5). Também devolve `null` enquanto carrega (D5). |
| R3 | A rota `/spaces/:spaceId` põe `space.name` no `<h1>` e, no lugar dos documentos, o aviso "Os documentos deste espaço ainda não chegaram…" (Interface). |
| R4 | O `where` do servidor exige `type: 'UNIT'`, `orgUnit.organizationId` **da sessão** e `orgUnit.assignments.some.personId` **da sessão** — só lotação direta, `isAdmin` não é lido (D3). A página só mostra o espaço se ele estiver nessa lista (D6). `SessionGuard` na classe, **sem** `AdminGuard` (D2). |
| R5 | Não existe rota por id: a página procura o `spaceId` da URL na lista. Inexistente, de outra organização, id malformado e "não lotado" caem **todos** no mesmo estado "Espaço não encontrado." por construção — não há resposta do servidor que possa diferir (D4, D6). |
| R6 | A consulta é refeita do banco a cada pedido (nada em sessão); na web, `staleTime: 0` e `refetchOnWindowFocus` (padrões do React Query do projeto), a página relê a lista ao montar, e as mutações de lotação da 010/108 passam a invalidar `['spaces']` (D5). |
| R7 | Itens da seção são `<NavLink>` (teclado nativo); a página tem `role="status"` no carregando e `role="alert"` no erro e no não encontrado; e2e com `expectNoSeriousA11yViolations` na página e com a seção visível (D8). |
| R8 | Textos literais em pt_BR na seção Interface; caminhos `/spaces` e `/spaces/:spaceId` em inglês. |

## Decisões técnicas

### D1 — Nenhuma migration (`security`)

- Tudo o que a fatia lê já está no esquema: `Space.type = UNIT`,
  `Space.orgUnitId @unique` (o vínculo único espaço–unidade) e
  `OrgUnitAssignment` com índice por `personId`. `apps/api/prisma/schema.prisma`
  e `apps/api/prisma/migrations/**` ficam **intocados**.
- Se durante a implementação alguém concluir que precisa de migration, o achado
  **volta ao dono antes** de qualquer arquivo ser escrito; e ela seria escrita à
  mão, numerada na sequência — **nunca** `prisma migrate diff/dev/reset` (as
  migrations têm índices por expressão e parciais que o schema não enxerga).
  Conferência de rotina: `prisma validate` + `prisma migrate status`.

### D2 — Contrato: uma operação, `GET /spaces` (contrato primeiro, §2)

- Em `packages/api-contract/openapi.yaml`, caminho novo **`/spaces`** com
  `get`, `operationId: listSpaces`, tag `spaces`. Respostas **200**
  `SpacesResponse`, **401** com `Error`. Sem 403 (qualquer pessoa com sessão) e
  sem 404 (lista).

  ```yaml
  Space:
    type: object
    required: [id, type, name]
    additionalProperties: false
    properties:
      id:   { type: string }            # id do Space, não da unidade
      type: { type: string, enum: [unit] }
      name: { type: string }            # nome da unidade
  SpacesResponse:
    type: object
    required: [data]
    properties:
      data: { type: array, items: { $ref: '#/components/schemas/Space' } }
  ```

- **`/spaces` e não `/me/org-units` nem `/org-units/.../space`**: o que a tela
  abre é o espaço (é nele que a 127 vai pendurar documentos, pelo id do
  `Space`), e `/org-units/**` é território de administração, com `AdminGuard`
  na classe. Alternativa descartada: `GET /org-units/{orgUnitId}/space` —
  obrigaria um segundo controller com o mesmo prefixo e guards diferentes, a
  confusão que a 086 resolveu com controller separado.
- **`type` com um único valor (`unit`) desde já**: `/spaces` é o nome genérico,
  e os espaços pessoal e livre vão entrar nessa mesma lista em fatias futuras.
  Com o discriminador no contrato, a seção "Unidades" filtra por `type` e não
  quebra quando o enum crescer. Alternativa descartada: `/spaces?type=unit` —
  um parâmetro que hoje só aceitaria um valor e criaria um 400 sem caso de uso.
- **`name` achatado, e não `orgUnit: { id, name }`**: a tela só precisa do nome;
  o id da unidade não é usado por ninguém que não seja administração, e expô-lo
  seria abrir uma porta para quem tenta `/admin/structure/:id/people`. A 128
  acrescenta o que precisar.
- **Identidade de caminho, conferida à mão**: `/spaces` não colide com nenhum
  caminho existente (lista em `openapi.yaml`: `/health`, `/installation`,
  `/auth/*`, `/documents*`, `/org-units*`, `/people`, `/admins*`,
  `/invitations*`). **Nenhum segmento literal** sob `/spaces` é declarado; a
  128 vai declarar `/spaces/{spaceId}/members`, e a regra fica escrita aqui:
  nenhum literal no segundo segmento de `/spaces` (ex.: `/spaces/mine`) poderá
  existir ao lado de `/spaces/{spaceId}`.
- A `description` da operação registra: só espaços de unidade em que a pessoa
  **da sessão** está lotada **direto** (sem herança); ser administração não
  inclui nada a mais; ordem alfabética pt-BR por nome, desempate por id;
  relido a cada pedido.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`.

### D3 — API: módulo `spaces` (`authorization`, `security`)

- `apps/api/src/spaces/spaces.service.ts`:

  ```ts
  async list(organizationId: string, personId: string): Promise<SpacesResponse> {
    const rows = await this.prisma.space.findMany({
      where: {
        type: 'UNIT',
        orgUnit: {
          organizationId,
          assignments: { some: { personId } },
        },
      },
      select: { id: true, orgUnit: { select: { name: true } } },
    });
    // `orgUnit` é não-nulo pelo `where`; o `flatMap` evita `!`.
    const data = rows
      .flatMap((row) => (row.orgUnit ? [{ id: row.id, type: 'unit' as const, name: row.orgUnit.name }] : []))
      .sort((a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id));
    return { data };
  }
  ```

  - **`organizationId` e `personId` sempre de `@CurrentPerson()`**, nunca de
    query nem corpo (não há parâmetro nenhum na rota).
  - **Lotação direta**: `assignments.some.personId` só olha a própria unidade;
    nada lê `parentId` (herança é da 016). **`isAdmin` não aparece** na
    consulta — é a prova de R4 no código, e o teste unitário afirma o `where`
    exato.
  - Ordenação **em memória** com o colador pt-BR, pela mesma razão escrita na
    064/010 (collation do banco). O colador é copiado para o arquivo (três
    linhas), não importado de outro serviço.
- `apps/api/src/spaces/spaces.controller.ts`: `@Controller('spaces')` com
  `@UseGuards(SessionGuard)` **na classe**, **sem `AdminGuard`**, nenhum
  `@UseGuards` por método, `@Get()` com `@CurrentPerson() person`.
- **Nenhuma rota pública**; se uma futura precisar ser, vai para controller
  próprio (regra da 086), nunca para um decorador por método.
- `apps/api/src/spaces/spaces.module.ts` e a entrada em `app.module.ts`.
- **Fronteira de acesso (§3)**: o serviço não toca `.document.`, `.favorite.`
  nem `.documentContent.`; o teste estrutural existente cobre o módulo novo
  sem alteração. `access/**` e `documents/**` intocados.

### D4 — O "não encontrado" único é da tela, por construção

- Não há `GET /spaces/{spaceId}` nesta fatia (aprovado no corte). A página
  procura `spaceId` em `data` da lista; ausente → estado "Espaço não
  encontrado.". Como a resposta do servidor não depende do id pedido, **não
  existe** canal pelo qual inexistente, outra organização, id malformado e
  "não lotado" possam se distinguir (R5) — nem por status, nem por corpo, nem
  por tempo.
- Alternativa descartada: rota por id com `findFirst` escopado e 404 opaco
  (padrão da 115) — é o desenho certo quando houver dado por espaço, e fica
  para a 128, que precisa dele para os membros. Aqui seria uma segunda rota
  para devolver um nome que a lista já tem.
- Custo aceito: a página baixa a lista inteira de espaços da pessoa — dezenas,
  no máximo, e é a **mesma** consulta já em cache da barra lateral (chave
  `['spaces']`), então em navegação normal nenhuma requisição a mais sai.

### D5 — Web: a chamada e a seção "Unidades" (`api-requests`, `client-state`, `interface-design`)

- Feature nova `apps/web/src/features/unit-spaces/`, com zona própria em
  `import/no-restricted-paths` no `eslint.config.js` (obrigatório em feature
  nova).
- `features/unit-spaces/api/get-spaces.ts`: `getSpaces()` →
  `api.get<SpacesResponse>('/spaces')`; `getSpacesQueryOptions()` com
  `queryKey: ['spaces']`; `useSpaces()`. Sem `staleTime` próprio (0, padrão):
  R6 pede a leitura seguinte, e a consulta é barata. Sem `silentError`: falha é
  notificada como toda leitura.
- **Invalidação cruzada sem import entre features**: `assign-person.ts` e
  `remove-assignment.ts` (feature `unit-assignments`) passam a invalidar também
  a chave literal `['spaces']` — a administração que lota ou tira **a si
  mesma** vê a seção mudar na hora. A chave é escrita como literal, como a 114
  já faz com `['people','search']`; nenhuma feature importa da outra.
- `features/unit-spaces/components/sidebar-unit-spaces.tsx`, montada em
  `root.tsx` **entre** `<SidebarDocuments />` e `<SidebarAdmin />`, na receita
  "Seção da barra lateral" (004) com `<nav aria-label="Unidades">`:
  - **carregando → `null`**; **vazio → `null`** (R2). Mostrar "Carregando
    unidades…" faria a seção piscar e sumir para todo mundo que não está
    lotado — o que o PRD quer evitar. O carregamento anunciado de R7 é o da
    página.
  - **erro → a seção aparece** com o `<h2>` "Unidades", a mensagem e "Tentar
    novamente": sem dado não dá para saber se ela deveria sumir, e esconder uma
    falha é pior que mostrar uma seção a mais.
  - **com dados**: um `<NavLink>` por espaço (`type === 'unit'`), `title` e
    `block truncate` no nome, estado ativo da receita "Item da barra lateral".
  - Alternativa descartada: pôr a seção em `components/layouts/` como a
    `SidebarAdmin` — ela é de uma feature só (a página também é), então fica na
    feature; quem junta é `root.tsx` (`project-structure`).

### D6 — Web: rota e página (`routing`, `interface-design`, `component-robustness`)

- `config/paths.ts`: `unitSpace = { path: '/spaces/:spaceId', getHref:
  (spaceId) => \`/spaces/${encodeURIComponent(spaceId)}\` }`. **Debaixo de
  `/spaces`**, que já existe como página de lista (placeholder); `/spaces` e
  `/spaces/:spaceId` não colidem (número de segmentos). `app/router.tsx` ganha
  a entrada `lazy`.
- `app/routes/app/unit-space.tsx`: `useParams` + `useSpaces()`; delega a
  `features/unit-spaces/components/unit-space-view.tsx`, que recebe a consulta
  e o `spaceId` e desenha os estados. **Sem `Authorization`**: não é área de
  administração, e a decisão é do servidor (a lista).
- `<h1>` estável: **"Espaço da unidade"** enquanto carrega, em erro e em não
  encontrado; o nome da unidade quando achado — mesma razão da 010 (não trocar
  o `<h1>` por vazio na frente do leitor de tela).
- `id` vindo da URL só é comparado com `===`; nunca vai para o HTML sem ser
  texto do React.

### D7 — API simulada: o espaço nasce com a unidade (dívida 075) (`api-mocking`)

- `testing/mocks/db.ts`: o banco falso ganha `spaces: MockSpace[]`, com
  `MockSpace = { id: string; type: 'unit'; orgUnitId: string }` e o id na
  convenção já escrita no arquivo, `space-${orgUnitId}` (a mesma que o
  documento de exemplo de "Sala Infantil" já usa). Um helper
  `addUnitSpace(orgUnitId)` é chamado em **todo** lugar onde uma unidade nasce:
  `seedInstalled` (raiz), o `POST /installation` de
  `handlers/installation.ts` (raiz), `seedSampleOrgUnits` e `addOrgUnit`; e
  `removeOrgUnit` tira o espaço junto (`splice` no array existente, nunca
  substituição — razão de `touchDocumentUpdatedAt`). O comentário "The `UNIT`
  space the real API creates in the same transaction is not simulated" é
  reescrito. Isso fecha a **075**.
- `listSpacesOf(personId)`: espaços cuja unidade tem `assignments` com esse
  `personId`, com o mesmo colador pt-BR e desempate por `id`.
- `testing/mocks/handlers/spaces.ts`: `http.get(\`${env.API_URL}/spaces\`)` com
  o preâmbulo da casa (`networkDelay()`, `devOverride('spaces')`, 401 sem
  cookie ou sem instalação) e a pessoa decidida por **`getSignedInPerson()`**,
  como `handlers/auth.ts` — **não** por `installation.person`. É o padrão que o
  item **124** `msw-auth-guard-consistency` do roadmap quer para todos os
  handlers; aqui ele nasce certo, e os handlers antigos **não** são tocados
  (continuam sob a 124). Sem 403: não há papel exigido.
- `handlers/index.ts` inclui o handler; `utils.ts` anota
  `mock-error=spaces`.
- Semente: nada novo. O e2e lota a pessoa pela tela da 010 (D8), que é a
  jornada real e prova R6 de graça.

### D8 — Testes

- **API, integração** (`spaces/__tests__/spaces.integration.test.ts`, Postgres
  real): sem lotação → `{ data: [] }`; lotada em duas unidades ("Zilda",
  "Álvaro") → as duas, na ordem do colador, com `id` do **Space** (conferido
  pelo Prisma) e `type: 'unit'`; lotada só na **filha** → a pai **não** aparece
  (sem herança); **administração não lotada** → `data: []` mesmo existindo
  unidades (R4); unidade de **outra organização** em que a pessoa foi lotada
  pelo Prisma → não aparece; depois de remover a lotação, o **próximo** `GET`
  já não traz a unidade, na mesma sessão (R6); anônimo → 401; o corpo tem
  exatamente `['id','type','name']` por item.
- **API, unitários** (`spaces.service.test.ts`): o `where` exato, com
  `organizationId` e `personId` recebidos e **sem** `isAdmin`; ordenação com
  acento e caixa.
- **API, contrato** (`spaces.contract.test.ts`): 200 e 401 por
  `expectMatchesContract`.
- **Web, unitário** (`unit-spaces/api/__tests__/get-spaces.test.tsx`): chama
  `/spaces`, chave `['spaces']`.
- **Web, componente**: `sidebar-unit-spaces.test.tsx` — vazio e carregando não
  renderizam `<nav>` nem "Unidades"; com dados, links na ordem recebida e para
  o `href` certo; erro com "Tentar novamente" que refaz o pedido.
  `unit-space-view.test.tsx` — carregando (`role="status"`), erro com nova
  tentativa (`role="alert"`), não encontrado (`role="alert"`, link para o
  início), achado (nome no `<h1>` e aviso de documentos).
- **Web, 010/108**: os testes de `assign-person` e `remove-assignment` afirmam
  a invalidação de `['spaces']`.
- **Web, integração de rota** (`app/routes/app/__tests__/unit-space.test.tsx`):
  pessoa lotada abre `/spaces/:id` direto pela URL e vê o nome; id
  inexistente e id de espaço em que ela não está lotada mostram **o mesmo**
  estado (comparação do conteúdo renderizado); a seção aparece na barra
  lateral com o item ativo.
- **e2e** (`apps/web/e2e/tests/unit-spaces.spec.ts`, API simulada,
  `ROUTE_TIMEOUT` em toda espera pós-rota, `mock-installation=signed-in` +
  `mock-org-units=sample`): sem lotação, a seção "Unidades" não existe; a
  administração se lota em uma unidade pela página da 010, a seção aparece com
  o item; abre o item **pelo teclado** e vê o nome no `<h1>` e o aviso;
  `expectNoSeriousA11yViolations` nesse estado; volta à 010, tira a própria
  lotação, e a seção some e a página passa a "Espaço não encontrado.".

### D9 — Documentação

- `docs/architecture.md` §6, parágrafo **"Entrega `unit-spaces` (fatia
  012)"**: `GET /spaces` com `SessionGuard` na classe e sem `AdminGuard`;
  `organizationId` e `personId` sempre da sessão; lotação **direta**, `isAdmin`
  não lido; o não encontrado único é da tela, por construção (sem rota por id
  até a 128, que usará `findFirst` escopado e 404 opaco sem `isUuid`); regra de
  caminho: nenhum segmento literal sob `/spaces/`; nenhuma migration; a API
  simulada cria o espaço junto com a unidade (075 fechada) e o handler novo usa
  `getSignedInPerson` (padrão da 124); espaço de unidade continua **sem** dar
  acesso a documento (§3).
- `docs/design.md`: **nenhuma receita nova** (tudo abaixo já existe).

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. Uma tela nova e
uma seção nova na barra lateral. Receitas usadas, **todas já existentes**:
"Seção da barra lateral" e "Item da barra lateral", "Contêiner de página" e
"Título de página" (via `ContentLayout`), "Texto de apoio", "Aviso
informativo", "Vazio", "Carregando", "Erro", "Link de navegação", "Botão
secundário". **Nenhuma receita nova.**

### Seção "Unidades" (barra lateral, entre "Meus documentos" e "Administração")

| Estado | O que aparece |
|---|---|
| carregando | nada |
| vazio (sem lotação) | nada — nem o título |
| erro | `<h2>` **"Unidades"**; `role="alert"` com **"Não foi possível carregar suas unidades."** e o botão secundário **"Tentar novamente"** (`w-full`, como a seção de documentos) |
| com dados | `<h2>` **"Unidades"** e um item por unidade com o **nome** (truncado, com `title`); o item da página aberta fica no estado ativo |

### Página `/spaces/:spaceId`

`ContentLayout`, de cima para baixo:

| Parte | Texto |
|---|---|
| `<h1>` | o nome da unidade — **"Espaço da unidade"** enquanto carrega, em erro e em não encontrado |
| texto de apoio | **"O espaço de documentos da sua unidade."** |
| no lugar dos documentos, receita "Vazio" | **"Os documentos deste espaço ainda não chegaram. Em breve você e as pessoas lotadas nesta unidade vão guardar e encontrar documentos aqui."** |

| Estado | O que aparece (no lugar do texto de apoio e do bloco de documentos) |
|---|---|
| carregando | `role="status"`: **"Carregando o espaço…"** |
| erro | `role="alert"`, receita "Erro": **"Não foi possível carregar o espaço."** + botão **"Tentar novamente"** |
| não encontrado | `role="alert"`, receita "Erro": **"Espaço não encontrado."** + **"Ele não existe ou você não está lotado nesta unidade."** + link **"Voltar para o início"** (receita "Link de navegação") |
| achado | nome no `<h1>`, texto de apoio e o bloco de documentos acima |

A 360px: o nome longo quebra no `<h1>` (`break-words`) e na barra lateral é
truncado com `title`. Nada com largura fixa em px.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `/spaces` `get`, schemas `Space` e `SpacesResponse` (D2) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado (D2) | — |
| criar | `apps/api/src/spaces/spaces.service.ts` | `list` com escopo de sessão e lotação direta (D3) | `authorization`, `security` |
| criar | `apps/api/src/spaces/spaces.controller.ts` | `@Controller('spaces')`, `SessionGuard` na classe (D3) | `authorization` |
| criar | `apps/api/src/spaces/spaces.module.ts` | módulo | `project-structure` |
| alterar | `apps/api/src/app.module.ts` | `SpacesModule` | `project-structure` |
| criar | `apps/api/src/spaces/__tests__/{spaces.service.test.ts,spaces.integration.test.ts,spaces.contract.test.ts}` | D8 | `unit-testing`, `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/unit-spaces/api/get-spaces.ts` | chamada, `['spaces']`, `useSpaces` (D5) | `api-requests`, `client-state` |
| criar | `apps/web/src/features/unit-spaces/components/sidebar-unit-spaces.tsx` | seção "Unidades", some sem dado (D5) | `interface-design`, `component-robustness` |
| criar | `apps/web/src/features/unit-spaces/components/unit-space-view.tsx` | estados da página, não encontrado único (D6) | `interface-design`, `error-handling` |
| criar | `apps/web/src/app/routes/app/unit-space.tsx` | rota: `useParams` + `useSpaces` (D6) | `routing` |
| alterar | `apps/web/src/config/paths.ts` | `unitSpace` (D6) | `routing` |
| alterar | `apps/web/src/app/router.tsx` | entrada `lazy` (D6) | `routing` |
| alterar | `apps/web/src/app/routes/app/root.tsx` | monta `SidebarUnitSpaces` (D5) | `project-structure` |
| alterar | `eslint.config.js` | zona de `unit-spaces` (D5) | `project-structure` |
| alterar | `apps/web/src/features/unit-assignments/api/assign-person.ts` | invalida `['spaces']` (D5) | `client-state` |
| alterar | `apps/web/src/features/unit-assignments/api/remove-assignment.ts` | invalida `['spaces']` (D5) | `client-state` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `spaces`, `addUnitSpace`, `listSpacesOf`, criação/remoção junto com a unidade (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/installation.ts` | a raiz nasce com o espaço (D7) | `api-mocking` |
| criar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `GET /spaces` com `getSignedInPerson` (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/index.ts` | o handler novo | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário `mock-error=spaces` | `api-mocking` |
| criar | `apps/web/src/features/unit-spaces/{api,components}/__tests__/*` | D8 | `unit-testing`, `component-testing`, `api-mocking` |
| alterar | `apps/web/src/features/unit-assignments/api/__tests__/{assign-person,remove-assignment}.test.tsx` | invalidação de `['spaces']` | `unit-testing` |
| criar | `apps/web/src/app/routes/app/__tests__/unit-space.test.tsx` | D8 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/unit-spaces.spec.ts` | jornada de D8, axe | `e2e-testing` |
| alterar | `docs/architecture.md` | §6, parágrafo da fatia 012 (D9) | — |
| alterar | `docs/roadmap.md` | 012 concluída, 075 fechada, dívidas abaixo | — |

Intocados de propósito (comparar com `feature/115-admin-roles-demote`):
`apps/api/prisma/**` (D1); `apps/api/src/{access,documents,auth,common,org-units,unit-assignments,people,admin-roles,invitations,installation}/**`;
`apps/web/src/lib/**`; `apps/web/src/components/**` (inclusive `app-layout.tsx`
e `sidebar-admin.tsx`); `apps/web/src/app/routes/app/spaces.tsx`;
`apps/web/src/testing/mocks/handlers/{admin-roles,unit-assignments,org-units,invitations,people,auth}.ts`
(a troca para `getSignedInPerson` é da 124); `docs/design.md`; os e2e
existentes.

## Estimativa de tamanho

Jornadas: **1** (a pessoa lotada chega ao espaço da unidade) · Telas
principais novas: **1** · Fases previstas: **3** · Linhas alteradas (sem
testes, sem o `.d.ts` gerado): **~365** — contrato ~40; API ~55 (serviço ~35,
controller ~12, módulo e `app.module` ~8); web ~190 (`get-spaces` ~20, seção
~65, `unit-space-view` ~70, rota ~15, `paths`/`router`/`root`/eslint ~16,
invalidações ~4); `src/testing/` ~60 (db ~35, handler ~22, index/utils ~3);
docs ~20. Com testes: ~750.

Sinais de "grande demais": **nenhum dispara**. Se o implementer passar de ~450,
o corte é o estado de erro próprio da seção (cair no silêncio do vazio e deixar
a notificação do interceptor falar) — **nunca** o escopo por sessão, a lotação
direta ou o não encontrado único (R4, R5).

## Dívida encontrada

- **A página `/spaces` ("Espaços") continua dizendo "Nenhum espaço ainda"**
  mesmo para quem agora tem espaços de unidade na barra lateral: é um
  placeholder da 001 que ninguém liga a `GET /spaces`. Ligar é pequeno, mas é
  outra tela; fica para a fatia que der lista de espaços (ou a 127).
- **Os handlers falsos antigos decidem o 403 por `installation.person.isAdmin`**
  (item **124** do roadmap): o handler novo já nasce com `getSignedInPerson`,
  então o projeto passa a ter os dois padrões lado a lado até a 124.
- **O banco falso cria o espaço em quatro lugares** (`seedInstalled`, o `POST
  /installation` falso, `seedSampleOrgUnits`, `addOrgUnit`): a raiz é montada
  duas vezes (`seedInstalled` e o handler de instalação) e um quinto ponto que
  crie unidade sem `addUnitSpace` reabre a 075 em silêncio. Vale unificar a
  criação da raiz num helper só.
- **Sem rota por id, a página baixa a lista inteira** (D4): serve enquanto uma
  pessoa estiver em dezenas de unidades; a 128 introduz a rota por id com 404
  opaco, e a página pode migrar para ela.
- Herdada e ainda válida: falta o projeto Playwright contra a API real, então
  o escopo por sessão só é provado pela integração da API.
