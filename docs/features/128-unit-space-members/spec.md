# SPEC 128 — unit-space-members

Quem alcança o espaço de uma unidade vê, abaixo dos documentos, as pessoas
lotadas **diretamente** nela, com a própria linha primeiro e marcada "você". A
página do espaço passa a carregar só o espaço aberto (`GET /spaces/{spaceId}`),
e deixa de procurá-lo na lista da barra lateral (dívida da 012). PRD aprovado em
`prd.md`, nesta pasta, com 10 requisitos. A branch
`feature/128-unit-space-members` está empilhada sobre a 127
(`unit-space-documents`), a 145 e a 140.

Lições vigentes para toda tarefa do PLAN: `React.JSX.Element`; `ref` é prop
comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo, medida com
`pnpm exec vitest run --coverage --coverage.reporter=json-summary` na raiz, sem
`--project`; nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`;
typecheck e lint finais com cache limpo (`pnpm exec tsc -b --clean`); arquivo
gerado do contrato só pelo script; **sem Prettier reformatando arquivo
existente**; o agente derruba tudo o que subir. **Sem migration.**

O que **já existe** e esta fatia só aproveita (conferido no código):

- `SpacesService.reachOf(organizationId, personId, spaceId)` → `'direct' |
  'inherited' | 'none'` (só espaço `UNIT`, organização por
  `orgUnit.organizationId`), `findReachUnits` e `resolveReach`; `list` usa um
  `Intl.Collator('pt-BR', { sensitivity: 'base' })` próprio.
- `SpacesController` (`@Controller('spaces')`, `SessionGuard` na classe) com
  `GET /spaces`, `POST /spaces` e `GET /spaces/:spaceId/documents` (ordem
  `isUuid` → `reachOf` → 404/403/200). `spaceNotFound()` em
  `common/space-not-found.ts`; `isUuid` em `common/is-uuid.ts`.
- `UnitAssignmentsService.list` ordena as pessoas com um colador pt-BR local:
  `collator.compare(a.name, b.name) || a.id.localeCompare(b.id)`.
- Web: `SpaceView({ query, spaceId, unitContent })` acha o espaço em
  `query.data?.data.find(...)` com os estados "Carregando o espaço…", erro com
  "Tentar novamente" e "Espaço não encontrado."; foco no `<main>` após criar
  (`focusMain`). A rota `app/routes/app/space.tsx` chama `useSpaces()` e passa
  `<SpaceDocuments spaceId />` em `unitContent`. `UnitPeopleList` (em
  `features/unit-assignments`) tem a aparência de linha nome + e-mail.
- Mocks: `db.ts` com `state.assignments`, `state.spaces`, `reachesUnit`,
  `listSpacesOf`, `spaceReachOf`, `getSignedInPerson`; `handlers/spaces.ts` com
  o preâmbulo `networkDelay` → `devOverride('spaces')` → 401.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `GET /spaces/{spaceId}/members` (D2) + `SpaceMembers` abaixo de `unitContent` em `SpaceView`, linhas nome + e-mail (D5, D6). |
| R2 | Ordem no servidor: `isCurrentPerson` primeiro, depois nome e e-mail pelo colador pt-BR, desempate por id (D2, D3); selo "você" (Interface). |
| R3 | Quatro estados de `SpaceMembers`, com "Tentar novamente" e o vazio literal (D6). |
| R4 | Nenhum botão na linha; sem rota de escrita nova (D6). |
| R5 | A guarda aceita `direct` e `inherited`; a lista é só de lotados diretos, logo o herdado não aparece (D2). |
| R6 | `GET /spaces/{spaceId}` com 404 opaco (D1); `useSpace(spaceId)` substitui o `find` em `SpaceView`; a rota deixa de chamar `useSpaces` (D4). Relido a cada pedido: nada materializado. |
| R7 | `useSpaces`, `SidebarUnitSpaces`, `SidebarFreeSpaces` e `GET /spaces` intocados. |
| R8 | `SpaceMembers` só é montado no ramo `unit` de `SpaceView`; o endpoint responde 404 para `FREE`/`PERSONAL` (D2, D5). |
| R9 | `<section aria-labelledby>`, `<ul aria-label>`, `role="status"`/`role="alert"`, região `aria-live`; axe no e2e (D6, D8). |
| R10 | Textos literais em Interface. |

## Decisões técnicas

### D1 — `GET /spaces/{spaceId}` → `SpaceDetailResponse`

- Contrato: tag `spaces`, operação `getSpace`, parâmetro de caminho `spaceId`
  (string). **200** `SpaceDetailResponse = { data: SpaceDetail }`; **401** e
  **404** com `Error`. Nenhum segmento literal novo sob `/spaces/` (regra da
  012): `{spaceId}` não colide com `/spaces` nem com `{spaceId}/documents`.
- `SpaceDetail` = campos de `Space` (`id`, `type`, `name`) + `reach`, enum
  `direct | inherited | owner`, obrigatório. `owner` é o espaço livre de quem
  chama (a única forma de alcançar um `FREE` hoje). Escrito com `allOf: [Space]`
  + objeto com `reach`, para `Space` continuar sendo a forma da lista.
  - Decisão: incluir `reach` agora. A web desta fatia não depende dele (membros
    aparecem para `direct` e `inherited`), mas é a resposta de "como alcanço
    este espaço" que o servidor já calcula; a 152 (documentos por herança) e a
    135 (membros do livre) o leem sem mudar o contrato.
  - Alternativa descartada: reaproveitar `SpaceResponse` sem `reach` — mais
    curto hoje, mas obrigaria mudar a forma de uma resposta publicada depois.
  - Alternativa descartada: `reach` opcional — um campo que às vezes vem deixa
    a web com um terceiro caso sem significado.
- Identidade de caminho conferida à mão: YAML `/spaces/{spaceId}` ↔
  `@Get(':spaceId')` no `SpacesController` com `@Param('spaceId')`. O teste de
  contrato chama exatamente esse caminho.
- Ordem fixa: sessão (**401**, guard) → `isUuid` falso → **404**
  `spaceNotFound()` → `SpacesService.getDetail` `null` → **404** (mesma
  mensagem) → 200. Administração não lotada cai no `null` (`isAdmin` não é
  lido).
- `SpacesService.getDetail(organizationId, personId, spaceId):
  Promise<SpaceDetail | null>`: uma leitura `space.findFirst({ where: { id:
  spaceId, OR: [{ type: 'FREE', organizationId, ownerId: personId }, { type:
  'UNIT', orgUnit: { organizationId } }] }, select: { id, type, name, orgUnit:
  { select: { id, name } } } })`. `FREE` com nome → `reach: 'owner'`, `name`
  do espaço. `UNIT` → alcance por `reachOfUnit` (D2) → `'none'` vira `null`;
  senão `name` da unidade. `PERSONAL` nunca casa → `null`.

### D2 — `GET /spaces/{spaceId}/members`

- Contrato: tag `spaces`, operação `listSpaceMembers`. **200**
  `SpaceMembersResponse = { data: SpaceMember[] }`, `SpaceMember = { id, name,
  email, isCurrentPerson: boolean }`, todos obrigatórios; **401**, **404** com
  `Error`. Schema próprio em vez de `AssignedPerson`: esse é da administração e
  não tem `isCurrentPerson`. Caminho conferido à mão: `/spaces/{spaceId}/members`
  ↔ `@Get(':spaceId/members')`.
- Ordem: 401 → `isUuid` falso → 404 → `SpacesService.listMembers` `null` →
  404 → 200. Mesma mensagem "Espaço não encontrado." em todos os 404.
- `reachOf` é refeito sobre um privado `reachOfUnit(organizationId, personId,
  spaceId): Promise<{ reach: 'direct' | 'inherited' | 'none'; orgUnitId:
  string | null }>` (a consulta de hoje, que já lê `orgUnit.id`). `reachOf`
  mantém assinatura e comportamento (a rota de documentos da 127 não muda).
- `listMembers(organizationId, personId, spaceId): Promise<SpaceMembersResponse
  | null>`: `reachOfUnit` → `'none'` → `null` (espaço livre, pessoal, de outra
  organização, inexistente, sem alcance); senão `orgUnitAssignment.findMany({
  where: { orgUnitId }, select: { person: { select: { id, name, email } } } })`,
  mapeado com `isCurrentPerson: person.id === personId` e ordenado por
  `compareMembers` (D3). Sem `take`: PRD dispensa paginação (Dívida).
- Guarda por alcance, não por lotação direta: diferente dos documentos (403 ao
  herdado), a lista de membros é da estrutura que a pessoa já alcança (PRD,
  decisão R5). Nenhum 403 nesta rota.
- Alternativa descartada: reaproveitar `GET /org-units/{id}/people` — exige
  administração e expõe o id da unidade; o espaço é a porta de quem não
  administra.
- Alternativa descartada: incluir os membros em `GET /spaces/{id}` — a página
  mostraria erro de membro como erro de espaço, e o espaço livre carregaria um
  campo sem sentido.

### D3 — Comparador pt-BR em `common/`

- `apps/api/src/common/pt-br-collator.ts` exporta `ptBrCollator = new
  Intl.Collator('pt-BR', { sensitivity: 'base' })` (as mesmas opções dos três
  lugares de hoje) e o comentário da collation do Postgres, uma vez só.
- `UnitAssignmentsService.list` troca o `collator` local pelo importado, com a
  **mesma** expressão `compare(name) || id` — comportamento idêntico, provado
  pelo teste existente sem mudar asserção. `SpacesService.list` idem.
  `admin-roles.service.ts` fica como está (fora da área; ver Dívida).
- `compareMembers(a, b)` fica em `spaces.service.ts` (só spaces o usa):
  `isCurrentPerson` primeiro → `ptBrCollator.compare(name)` →
  `ptBrCollator.compare(email)` → `a.id.localeCompare(b.id)`.
- Alternativa descartada: exportar um comparador de pessoas completo para os
  dois serviços — a lotação não desempata por e-mail, e mudar isso alteraria o
  comportamento dela.

### D4 — `useSpace(spaceId)` e a página

- `features/spaces/api/get-space.ts`: `getSpace(spaceId)` →
  `api.get<SpaceDetailResponse, SpaceDetailResponse>(`/spaces/${spaceId}`, {
  silentError: true })`; `queryKey: ['space', spaceId]`; `useSpace({ spaceId
  })`. `silentError`: o 404 é um estado da página, não notificação.
- Chave `['space', spaceId]`, **não** `['spaces', spaceId]`: o prefixo
  `['spaces']` é invalidado por criar espaço e por lotar/remover lotação, e
  arrastaria o espaço aberto junto. Documentado no comentário da chave. O
  efeito colateral aceito: remover a própria lotação na administração não
  refaz a página do espaço — o PRD pede a mudança ao recarregar/voltar/tentar
  de novo, e o padrão de `refetchOnMount`/`refetchOnWindowFocus` do React
  Query já cobre voltar.
- `SpaceView` recebe `query: ReturnType<typeof useSpace>` no lugar do de
  `useSpaces`; o `find` sai. 404 (`NotFoundError` do cliente) → estado
  "Espaço não encontrado." de hoje; outro erro → "Não foi possível carregar o
  espaço." + "Tentar novamente"; `query.data.data` é o espaço. Textos e
  estrutura dos estados não mudam. O foco pós-criação continua (o livre recém
  criado responde 200 com `reach: 'owner'`).
- A rota troca `useSpaces()` por `useSpace({ spaceId: id })`. A barra lateral
  continua chamando `useSpaces` no layout — R7; a métrica "a página não pede a
  lista" vale para a página (ver Riscos).
- `Space` segue exportado de `get-spaces.ts`; `SpaceDetail` e
  `SpaceDetailResponse` ficam em `get-space.ts`.
- Alternativa descartada: `initialData` vindo do cache de `['spaces']` —
  mostraria um espaço que o servidor não confirmou e mantém a dependência da
  lista.

### D5 — Membros na feature `spaces`, dentro de `SpaceView`

- `features/spaces/api/get-space-members.ts`: `getSpaceMembers(spaceId)` →
  `api.get(`/spaces/${spaceId}/members`, { silentError: true })`; `queryKey:
  ['space-members', spaceId]`; `useSpaceMembers({ spaceId })`.
- `features/spaces/components/space-members.tsx`: `SpaceMembers({ spaceId })`
  chama o hook e desenha os quatro estados. `SpaceView` o monta no ramo
  `unit`, depois de `unitContent` — é da própria feature, a rota não muda por
  causa dele. Espaço livre não o monta (R8).
- Aparência copiada da linha de `UnitPeopleList` (nome `truncate` à esquerda,
  e-mail `break-words` em tom suave), **sem** importar de
  `features/unit-assignments` e sem ações. Não vai para `components/ui/`: são
  duas marcações parecidas com comportamentos diferentes (uma com remoção e
  foco pós-remoção); extrair agora acoplaria as duas.
- Alternativa descartada: montar pela rota como `SpaceDocuments` — só faz
  sentido quando a peça é de outra feature.

### D6 — Estados e acessibilidade de `SpaceMembers`

- `<section aria-labelledby>` com `<h2>` "Pessoas nesta unidade" (receita de
  subtítulo de seção já usada em `UnitPeopleList`: `mt-8 text-lg
  font-semibold`); estados dentro de uma `div aria-live="polite"` (mesma razão
  de `UnitPeopleList`: o vazio é anunciado).
- Carregando também no retry (`isPending || (isError && isFetching)`), igual a
  `UnitPeopleList`. Erro: `role="alert"`, `Button variant="secondary"`
  "Tentar novamente" (mesmo par de `SpaceView`). Um 404 da lista (lotação
  removida entre os dois pedidos) cai no mesmo erro; tentar de novo e
  recarregar levam ao "Espaço não encontrado." pela página.
- `<ul aria-label="Pessoas nesta unidade">`; nenhum elemento focável na linha
  (R4) — nada a navegar além do que já é focável na página.

### D7 — API simulada (`api-mocking`)

- `db.ts`: `spaceDetailOf(personId, spaceId): SpaceDetail | null` (livre do
  dono → `owner`; unidade → `spaceReachOf`; `none` → `null`) e
  `listSpaceMembers(personId, spaceId)` a partir de `state.assignments` +
  pessoas, com `isCurrentPerson` e a ordem de D3 (colador pt-BR já existente
  em `spacesCollator`). As sementes atuais já lotam pessoas em unidades
  (amostra `mock-org-units=sample`); acrescentar um colega lotado na unidade de
  lotação direta da amostra e nenhum na herdada, para o e2e.
- `handlers/spaces.ts`: `GET ${env.API_URL}/spaces/:spaceId` e
  `/spaces/:spaceId/members`, preâmbulo de sempre, 404 "Espaço não encontrado."
  ou 200. O MSW casa `/spaces/:spaceId` sem engolir `/documents` e `/members`
  (segmentos a mais não casam).

### D8 — Testes

- **API, integração (Postgres real, serviço real)** em
  `spaces.integration.test.ts`:
  - `GET /spaces/{id}`: lotado → 200 `reach: 'direct'` com o nome da unidade;
    herdado → `inherited`; dono do livre → `owner` com o nome do livre; livre
    alheio, administração não lotada, sem lotação, `randomUUID()`, id
    malformado → 404 idêntico; sem sessão → 401.
  - `GET /spaces/{id}/members`: lotado → quem pede primeiro com
    `isCurrentPerson`, depois "Álvaro" antes de "Zilda", homônimos
    desempatados por e-mail; herdado → lista sem ele (e vazia na unidade sem
    lotados); lotação removida → 404 no pedido seguinte; livre do próprio dono,
    administração não lotada, `randomUUID()`, malformado → 404; 401.
  - Outra organização: `getDetail(randomUUID(), …)` e
    `listMembers(randomUUID(), …)` → `null` no serviço real.
  - `unit-assignments.*.test.ts` seguem verdes **sem mudar asserção** (prova
    de D3).
- **API, unitário/contrato**: `pt-br-collator.test.ts` (acentos e caixa);
  `compareMembers`; `spaces.contract.test.ts` com os dois caminhos exatos.
- **Web** (Vitest + MSW): `get-space.test.tsx` e `get-space-members.test.tsx`
  (caminho, chave); `space-members.test.tsx` (carregando, vazio, erro +
  tentar de novo recarrega, lista com "você" na primeira linha, sem botões);
  `space-view.test.tsx` passa a usar `useSpace` (404 → não encontrado, erro →
  tentar de novo, `unit` mostra membros depois de `unitContent`, `free` não
  mostra); `space.test.tsx` da rota: não pede `GET /spaces` pela página (conta
  pedidos no handler com a barra lateral fora do teste da rota).
- **e2e** — `apps/web/e2e/tests/unit-space-members.spec.ts`, API simulada, só
  teclado: (1) lotado abre o espaço, vê "Pessoas nesta unidade" com a própria
  linha e "você" e o colega abaixo; axe sem crítica/séria; (2) espaço herdado
  da amostra → vê o vazio; axe. `unit-space-documents.spec.ts` segue verde.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Contêiner de página" (via `ContentLayout`), "Lista", "Selo de status" (par
`bg-gray-100 text-gray-700` para "você"), "Carregando", "Vazio", "Erro",
"Botão secundário". Nenhuma receita nova: o subtítulo de seção já existe em
`UnitPeopleList`; se não estiver em `docs/design.md`, acrescentar "Subtítulo de
seção" (`mt-8 text-lg font-semibold`) com a fatia 128.

### Página do espaço — o que muda

Título, descrição, documentos (127) e os estados da página ficam como estão;
passam a vir de `GET /spaces/{spaceId}`. Abaixo dos documentos, só em espaço de
unidade, a seção:

- `<h2>` "Pessoas nesta unidade".
- **Carregando**: `role="status"` "Carregando as pessoas desta unidade…".
- **Erro**: alerta "Não foi possível carregar as pessoas desta unidade." com
  "Tentar novamente".
- **Vazio**: "Ninguém está lotado diretamente nesta unidade." (tom suave,
  borda tracejada, como os outros vazios).
- **Com dados**: lista com divisória; cada linha com o nome (`truncate`) à
  esquerda e, na linha de quem vê, o selo "você" logo após o nome; o e-mail à
  direita (quebra abaixo em tela estreita, `break-words`). Nenhum botão.

A 360px a linha usa `flex-wrap` e `min-w-0`, sem rolagem horizontal. Espaço
livre: sem a seção.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| título da seção | "Pessoas nesta unidade" | `<h2>` e `aria-label` da lista |
| carregando | "Carregando as pessoas desta unidade…" | `role="status"` |
| vazio | "Ninguém está lotado diretamente nesta unidade." | vazio |
| erro | "Não foi possível carregar as pessoas desta unidade." + "Tentar novamente" | `role="alert"` |
| própria linha | "você" | selo de status |
| página sem acesso | "Espaço não encontrado." / "Ele não existe ou você não tem acesso a ele." / "Voltar para o início" | inalterado |
| servidor 404 | "Espaço não encontrado." | corpo da API (detalhe e membros) |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `GET /spaces/{spaceId}`, `GET /spaces/{spaceId}/members`; `SpaceDetail`, `SpaceDetailResponse`, `SpaceMember`, `SpaceMembersResponse` (D1, D2) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| criar | `apps/api/src/common/pt-br-collator.ts` | colador compartilhado (D3) | — |
| alterar | `apps/api/src/unit-assignments/unit-assignments.service.ts` | usa `ptBrCollator`, mesma expressão (D3) | — |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `reachOfUnit`, `getDetail`, `listMembers`, `compareMembers`, colador compartilhado (D1–D3) | `authorization`, `security` |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | `@Get(':spaceId')`, `@Get(':spaceId/members')` (D1, D2) | `security` |
| criar | `apps/api/src/common/__tests__/pt-br-collator.test.ts` | D8 | `unit-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | D8 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/spaces/api/get-space.ts` | D4 | `api-requests`, `error-handling` |
| criar | `apps/web/src/features/spaces/api/get-space-members.ts` | D5 | `api-requests` |
| criar | `apps/web/src/features/spaces/components/space-members.tsx` | D5, D6 | `interface-design`, `component-robustness` |
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | `query` de `useSpace`, sem `find`, 404 → não encontrado, monta `SpaceMembers` no `unit` (D4, D5) | `interface-design`, `error-handling` |
| alterar | `apps/web/src/app/routes/app/space.tsx` | `useSpace` no lugar de `useSpaces` (D4) | `routing` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `spaceDetailOf`, `listSpaceMembers`, colega na semente (D7) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | dois handlers (D7) | `api-mocking` |
| criar | `apps/web/src/features/spaces/api/__tests__/get-space.test.tsx` | D8 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/spaces/api/__tests__/get-space-members.test.tsx` | D8 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/spaces/components/__tests__/space-members.test.tsx` | D8 | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` | D8 | `component-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/space.test.tsx` | D8 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/unit-space-members.spec.ts` | D8 | `e2e-testing` |
| alterar | `docs/design.md` | "Subtítulo de seção", se ainda não constar | `interface-design` |
| alterar | `docs/architecture.md` | §6/§spaces: `GET /spaces/{spaceId}` (com `reach`) e `/members` com 401→404; a página lê o espaço por id; remove a nota "sem rota por id" da 012 | — |

Intocados de propósito: `get-spaces.ts`, `sidebar-unit-spaces.tsx`,
`sidebar-free-spaces.tsx`, `features/unit-assignments/**`,
`features/documents/**`, `admin-roles.service.ts`, `schema.prisma` e
migrations (nenhuma nova).

## Estimativa de tamanho

Jornadas: 1 (abrir o espaço e ver quem está nele) · Telas novas: 0 (seção na
página existente) · Fases: 3 · Linhas alteradas sem testes e sem gerado: ~430
(YAML ~90; `spaces` service/controller ~110; colador + lotação ~15; web:
chamadas ~45, `SpaceMembers` ~85, `SpaceView`/rota ~25; mocks ~50; docs ~10).
Sem YAML, mocks e docs: **~280 de código de produção**.

Sinais de "grande demais": nenhum dispara (abaixo de ~450 com YAML e mocks).
Corte, se estourar: separar a troca do `find` por `GET /spaces/{id}` (R6)
numa fatia própria — não recomendado, porque R6 é requisito do PRD e o endpoint
de detalhe reaproveita a mesma guarda.

## Riscos

- **"A página não pede a lista de todos os espaços"**: a barra lateral
  continua pedindo `GET /spaces` no layout (R7). A métrica do PRD só é
  verificável como "a rota/`SpaceView` não chamam `useSpaces`"; um e2e que
  conte pedidos de rede à `/spaces` vai contar o da barra lateral.
- **Cache `['space', id]` fora das invalidações**: renomear a unidade ou
  remover a própria lotação na administração não refaz a página aberta até
  voltar/recarregar/foco. Aceito pelo PRD (sem atualização ao vivo).
- **Duas leituras por página** (detalhe e membros) e, para o herdado, o
  `findReachUnits` roda duas vezes (uma por endpoint). Custo pequeno; medir se
  a árvore crescer.
- **Organização dos membros** não é refiltrada: depende de lotação e unidade
  serem da mesma organização, garantido pelos serviços e não pelo banco (mesmo
  risco registrado na 127).
- MSW: a ordem dos handlers `/spaces/:spaceId` e `/spaces/:spaceId/documents`
  não importa porque o `path-to-regexp` não casa segmentos a mais; conferir no
  teste de `get-space`.

## Dívida encontrada

- **Colador pt-BR repetido**: `admin-roles.service.ts` mantém o próprio
  `Intl.Collator` (fora da área desta fatia); `db.ts` do mock também.
- **Sem limite na lista de membros**: `findMany` sem `take`; unidade com
  centenas de lotados traz tudo (PRD adia paginação).
- **Dois caminhos de alcance no servidor**: `list` (em massa) e
  `reachOf`/`getDetail` (por id) usam a mesma `resolveReach`, mas com leituras
  diferentes; uma mudança de regra precisa tocar os dois.
- **Marcação de linha de pessoa duplicada** entre `UnitPeopleList` e
  `SpaceMembers` (D5): se uma terceira lista aparecer, extrair para
  `components/ui/`.
