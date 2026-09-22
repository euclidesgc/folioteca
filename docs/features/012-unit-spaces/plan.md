# PLAN 012 — unit-spaces

Branch: `feature/012-unit-spaces`, que **sai de `feature/115-admin-roles-demote`** (entrega empilhada). **Toda** comparação de diff e de "arquivo intocado" deste plano é contra `feature/115-admin-roles-demote`, nunca contra `develop` nem `main`. Onde um critério diz `<base>`, leia `feature/115-admin-roles-demote`.

Fonte: `docs/features/012-unit-spaces/spec.md` (D1…D9 são as decisões técnicas da SPEC e R1…R8 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

Esta é a primeira de duas fatias do item 012: aqui a pessoa **lotada** numa unidade vê a seção "Unidades" na barra lateral e abre a página do espaço (nome da unidade + aviso de que os documentos ainda não chegaram). A lista de membros é da fatia 128 e **não** entra aqui.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

O projeto **não usa Prettier**: formatação é assunto do ESLint, e nenhuma tarefa roda formatador.

**Commits da branch.** O intervalo `git log feature/115-admin-roles-demote..HEAD` começa com **um commit de documentação** (PRD, SPEC e PLAN desta fatia), feito antes da fase 1, e ganha **um commit por fase**. Um commit final de documentação de fechamento, feito pela orquestração depois da fase 3, fica fora dessa contagem. Todos em inglês, Conventional Commits, sem `--no-verify`.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Nenhuma migration** (D1): tudo o que a fatia lê já existe no esquema (`Space.type = UNIT`, `Space.orgUnitId @unique`, `OrgUnitAssignment` com `@@index([personId])`). Nenhuma migration em `apps/api/prisma/migrations`, e `apps/api/prisma/**` inteiro fica intocado. Os únicos subcomandos de Prisma permitidos são `prisma validate`, `prisma migrate status` e `prisma migrate deploy`, sempre contra `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test`; **nunca** `migrate diff`, `migrate dev` ou `migrate reset`. Se alguém concluir que precisa de migration, o agente **para e relata ao dono**, sem escrever SQL nem rodar comando.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); **todo botão nosso é o componente `Button`** de `apps/web/src/components/ui/button/button.tsx`; navegação interna só com `<Link>`/`<NavLink>`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Textos de tela em pt_BR; código, comentários, caminhos de URL e nomes de teste em en_US.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar. Nenhum segredo em `VITE_*`; nenhum literal com cara de senha, token ou hash em arquivo versionado.
- Cobertura ≥ 80% de linhas **por arquivo** novo ou alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text`, **sem `--project`** e **sem filtro de caminho**. O reporter `text` omite arquivos com 100%: ausência na tabela de texto não reprova — reprova só quem aparecer no JSON com `lines.pct < 80`. Não contam arquivos só de tipos, arquivos com 0 de 0 linhas, nem os já excluídos pelo `vitest.config.ts` da raiz (`**/types/**`, `**/generated/**`, `**/src/testing/**`, `**/test/**`, `**/*.config.*`). Nenhuma exclusão nova.
- **Toda** espera dos casos novos logo após mudança de rota ou chunk `lazy` tem timeout explícito: nos testes da web pela constante `LAZY_TIMEOUT` declarada no arquivo; no e2e pela constante `ROUTE_TIMEOUT = { timeout: 10_000 }` no topo do spec. Nunca `setTimeout`/sleep fixo nem `waitForTimeout`. Casos preexistentes não são alterados nem renomeados.
- Testes de API são de integração contra o Postgres real (sem mock do Prisma), exceto `spaces.service.test.ts`, que usa Prisma falso. "Teste passa" é medido pelo **exit code** (zero), nunca pela leitura da saída `--verbose`.
- **Escopo por sessão**: `organizationId` e `personId` vêm sempre de `@CurrentPerson()`; a rota não tem parâmetro, query nem corpo. `isAdmin` **não** é lido: administração não vê espaço a mais. Lotação é **direta** (nada lê `parentId`).
- Nenhuma tarefa acrescenta escopo: sem lista de membros (128), sem rota por id `GET /spaces/{spaceId}`, sem documentos no espaço, sem mexer na página placeholder `/spaces` ("Espaços"), sem receita nova em `docs/design.md`, sem componente novo em `src/components/`.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: `GET /spaces` com os espaços de unidade da pessoa da sessão

Caminhos relativos à raiz do repositório.

- [x] T1.1 — Contrato primeiro: `GET /spaces` e os schemas `Space` e `SpacesResponse`
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script)
  - O que fazer (D2, R1, R4, R6, R8):
    - Caminho novo **`/spaces`** com `get`, `operationId: listSpaces`, tag `spaces` (declarada na lista de tags se o arquivo tiver uma). Respostas **200** com `SpacesResponse` e **401** com o schema `Error` existente. **Sem 403, sem 404, sem parâmetros e sem `requestBody`.**
    - Schemas novos:
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
      O id da unidade **não** entra no contrato (só a administração o usa).
    - A `description` da operação, em pt_BR, registra: só espaços de unidade em que a pessoa **da sessão** está lotada **direto** (sem herança); ser administração não inclui nada a mais; ordem alfabética pt-BR pelo nome, desempate por id; relido a cada pedido.
    - **Identidade de caminho conferida à mão, contra o YAML inteiro, antes de escrever**: `/spaces` não colide com nenhum caminho existente (`/health`, `/installation`, `/auth/*`, `/documents*`, `/org-units*`, `/people`, `/admins*`, `/invitations*`); o caminho do contrato é **idêntico** ao do controller de T1.2 (`@Controller('spaces')` + `@Get()` = `/spaces`); **nenhum segmento literal** sob `/spaces/` é declarado (a 128 vai declarar `/spaces/{spaceId}/members`, e um `/spaces/mine` colidiria com `{spaceId}`).
    - Regenerar com `pnpm --filter @folioteca/api-contract generate`; o `.d.ts` nunca é editado à mão.
  - Skills: security
  - Complexidade: baixa

- [x] T1.2 — Módulo `spaces`: serviço com escopo de sessão e lotação direta, controller com `SessionGuard` na classe
  - Arquivos: `apps/api/src/spaces/spaces.service.ts` (criar); `apps/api/src/spaces/spaces.controller.ts` (criar); `apps/api/src/spaces/spaces.module.ts` (criar); `apps/api/src/app.module.ts` (alterar)
  - O que fazer (D3, R1, R4, R6):
    - `spaces.service.ts`: `SpacesService` com `list(organizationId: string, personId: string): Promise<SpacesResponse>`:
      ```ts
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
      ```
      depois `flatMap` para `{ id: row.id, type: 'unit' as const, name: row.orgUnit.name }` (o `flatMap` descarta `orgUnit` nulo e evita `!`) e ordenação **em memória** por `collator.compare(a.name, b.name) || a.id.localeCompare(b.id)`, com `const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })` **declarado neste arquivo** (copiado, não importado de outro serviço). Retorna `{ data }`. `isAdmin` e `parentId` **não aparecem** no arquivo. O serviço não toca `.document`, `.favorite` nem `.documentContent` (o teste estrutural existente `apps/api/src/access/__tests__/document-access-boundary.test.ts` cobre o módulo novo sem alteração).
    - `spaces.controller.ts`: `@Controller('spaces')` com `@UseGuards(SessionGuard)` **na classe**, **sem `AdminGuard`**, nenhum `@UseGuards` por método; um `@Get()` que recebe `@CurrentPerson() person` e devolve `this.spaces.list(person.organizationId, person.id)` como `Promise<SpacesResponse>`. Sem `@Param`, `@Query` nem `@Body`. Sem `Logger` e sem `console.`.
    - `spaces.module.ts`: `SpacesModule` com o controller e o serviço (padrão dos módulos vizinhos); `app.module.ts` importa `SpacesModule`.
  - Skills: authorization, security, project-structure
  - Complexidade: média

- [x] T1.3 — Testes da fase 1
  - Arquivos: `apps/api/src/spaces/__tests__/spaces.service.test.ts` (criar); `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (criar); `apps/api/src/spaces/__tests__/spaces.contract.test.ts` (criar)
  - O que fazer (D8): integração e contrato contra o Postgres real, `resetDatabase(prisma)` em `beforeEach`, instalação e sessões pelos ajudantes existentes (`createPersonWithSession`, `apps/api/test/http.ts`, `contract.ts`). `apps/api/test/**` **não muda**. Senhas só das constantes de teste existentes.
    - `spaces.service.test.ts` (Prisma falso), casos: `list queries unit spaces scoped by the given organization and person` (asserção do `where` **exato** `{ type: 'UNIT', orgUnit: { organizationId, assignments: { some: { personId } } } }`); `list never reads isAdmin` (o argumento serializado de `findMany` não contém `isAdmin` nem `parentId`); `list sorts by name with the pt-BR collator ignoring accents and case` (ex.: "zilda", "Álvaro", "Beatriz" → "Álvaro", "Beatriz", "zilda"); `list breaks name ties by id`; `list maps rows to id, type unit and name`.
    - `spaces.integration.test.ts`, casos: `a person without assignments gets an empty list`; `a person assigned to two units gets both in pt-BR order with the space id` (unidades "Zilda" e "Álvaro"; `id` conferido contra o `Space` lido pelo Prisma, `type: 'unit'`); `a person assigned only to a child unit does not get the parent`; `an admin without assignments gets an empty list even with units in the organization`; `a unit of another organization never appears`; `after the assignment is removed the next request no longer returns the unit` (mesma sessão); `an anonymous request answers 401`; `each item has exactly the id, type and name keys` (`expect(Object.keys(item).sort()).toEqual(['id','name','type'])`).
    - `spaces.contract.test.ts`, casos: `GET spaces answers the documented 200` e `GET spaces answers the documented 401`, via `expectMatchesContract`.
    - Fecha a fase com um commit, por exemplo `feat(api): list the unit spaces of the signed-in person`.
  - Skills: unit-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d` rodando, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules` antes do typecheck): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e **sem aviso** (o aviso do Vitest sobre jsdom não conta; o de chunk grande do Vite conta). A saída de `pnpm test` não tem `console.error`/`console.warn` vazando nem aviso do Nest ou do Prisma. `git diff feature/115-admin-roles-demote... -- package.json apps/api/package.json apps/web/package.json packages/api-contract/package.json pnpm-lock.yaml` é vazio.
- [x] CA1.2 — `packages/api-contract/openapi.yaml` declara o caminho `/spaces` com **só** a operação `get`, `operationId: listSpaces`, tag `spaces`, sem `parameters` e sem `requestBody`; as respostas são exatamente `200` (`$ref` para `SpacesResponse`) e `401` (schema `Error`). O schema `Space` tem `required: [id, type, name]`, `additionalProperties: false`, `type` com `enum: [unit]`, e **nenhuma** propriedade além de `id`, `type` e `name`; `SpacesResponse` tem `data` como array de `Space`. A `description` da operação diz, em pt_BR: lotação direta da pessoa da sessão, sem herança; administração não inclui nada a mais; ordem alfabética pt-BR com desempate por id; relido a cada pedido. O diff do YAML contra a base **só acrescenta linhas**.
- [x] CA1.3 — Identidade de caminho, conferida à mão: `git diff feature/115-admin-roles-demote... -- packages/api-contract/openapi.yaml | rg -n "^\+  /"` devolve **exatamente uma** linha, `/spaces:`; `rg -n "^  /spaces" packages/api-contract/openapi.yaml` devolve só `/spaces:` (nenhum segmento literal sob `/spaces/`); e esse caminho é o mesmo que resulta de `@Controller('spaces')` + `@Get()` em `apps/api/src/spaces/spaces.controller.ts` (sem argumento no `@Get`). Nenhum caminho existente foi renomeado.
- [x] CA1.4 — Tipos regenerados pelo script: `rg -n "listSpaces" packages/api-contract/src/generated/openapi.d.ts` encontra a operação e `rg -n "SpacesResponse" packages/api-contract/src/generated/openapi.d.ts` encontra o schema; `git diff feature/115-admin-roles-demote... -- apps/api/test` é vazio.
- [x] CA1.5 — Nenhuma migration: `git diff --stat feature/115-admin-roles-demote... -- apps/api/prisma` é vazio (nenhuma em `apps/api/prisma/migrations`, `schema.prisma` intocado) e `git status --porcelain -uall apps/api/prisma` não lista nada. `git diff feature/115-admin-roles-demote... -- apps/api apps/web packages | rg -n "migrate (diff|dev|reset)"` é vazio. `pnpm --filter api exec prisma validate` termina com exit code 0 e `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test pnpm --filter api exec prisma migrate status` reporta nenhuma migration pendente.
- [x] CA1.6 — `apps/api/src/spaces/spaces.service.ts` exporta `SpacesService` com `list(organizationId: string, personId: string): Promise<SpacesResponse>`, cujo `findMany` tem `where` com `type: 'UNIT'` e `orgUnit: { organizationId, assignments: { some: { personId } } }` e `select` de `id` e `orgUnit.name`; a ordenação usa um `Intl.Collator('pt-BR', { sensitivity: 'base' })` declarado no próprio arquivo, com desempate por `id`. `rg -n "isAdmin|parentId|\.document|\.favorite|documentContent|findUnique|\$queryRaw" apps/api/src/spaces --glob '!**/__tests__/**'` é vazio; `rg -n "!\." apps/api/src/spaces/spaces.service.ts` não encontra asserção não-nula.
- [x] CA1.7 — `apps/api/src/spaces/spaces.controller.ts` tem `@Controller('spaces')` e `rg -n "@UseGuards" apps/api/src/spaces/spaces.controller.ts` devolve **exatamente uma** ocorrência, acima da classe, com `SessionGuard` e **sem** `AdminGuard` (`rg -n "AdminGuard" apps/api/src/spaces` é vazio). O único método tem `@Get()`, recebe `@CurrentPerson()` e chama `list(person.organizationId, person.id)`. `rg -n "@Param|@Query|@Body|Logger|console\." apps/api/src/spaces --glob '!**/__tests__/**'` é vazio. `apps/api/src/spaces/spaces.module.ts` exporta `SpacesModule` e `apps/api/src/app.module.ts` o importa.
- [x] CA1.8 — Intocados nesta fase: `git diff --stat feature/115-admin-roles-demote... -- apps/api/prisma apps/api/src/access apps/api/src/documents apps/api/src/auth apps/api/src/common apps/api/src/org-units apps/api/src/unit-assignments apps/api/src/people apps/api/src/admin-roles apps/api/src/invitations apps/api/src/installation apps/api/test apps/web vitest.config.ts eslint.config.js docs/design.md docs/architecture.md` é vazio. (`docs/roadmap.md` e `docs/features/012-unit-spaces/**` ficam fora de toda lista de intocados deste plano.)
- [x] CA1.9 — `npx vitest run --project api` termina com exit code 0 e existem, pelos nomes de T1.3: em `spaces.service.test.ts`, `list queries unit spaces scoped by the given organization and person`, `list never reads isAdmin`, `list sorts by name with the pt-BR collator ignoring accents and case`, `list breaks name ties by id` e `list maps rows to id, type unit and name`; em `spaces.integration.test.ts`, `a person without assignments gets an empty list`, `a person assigned to two units gets both in pt-BR order with the space id`, `a person assigned only to a child unit does not get the parent`, `an admin without assignments gets an empty list even with units in the organization`, `a unit of another organization never appears`, `after the assignment is removed the next request no longer returns the unit`, `an anonymous request answers 401` e `each item has exactly the id, type and name keys`; em `spaces.contract.test.ts`, `GET spaces answers the documented 200` e `GET spaces answers the documented 401`. Conferir com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/spaces/__tests__`. `rg -n "vi\.mock\(.*prisma" apps/api/src/spaces/__tests__/spaces.integration.test.ts apps/api/src/spaces/__tests__/spaces.contract.test.ts` é vazio. Nenhum `.only(` nem `.skip(`.
- [x] CA1.10 — O escopo está provado, não só afirmado. Lendo `an admin without assignments gets an empty list even with units in the organization`: a pessoa da sessão tem `isAdmin: true`, existe ao menos uma unidade (além da raiz) na organização, e a asserção é `data` igual a `[]`. Lendo `a unit of another organization never appears`: a lotação da pessoa na unidade da outra organização é criada **pelo Prisma** e a resposta não contém o id daquele espaço. Lendo `after the assignment is removed the next request no longer returns the unit`: a **mesma** variável de cookie é usada no `GET` antes (unidade presente) e depois (ausente) da remoção. Lendo `a person assigned only to a child unit does not get the parent`: a unidade filha tem `parentId` da pai e a resposta traz só o espaço da filha.
- [x] CA1.11 — `rg -n "setTimeout\(|sleep\(" apps/api/src/spaces` é vazio; `rg -n "eslint-disable" apps/api/src apps/web/src | rg -v -- "--"` é vazio; nenhum arquivo de `apps/api/src/spaces/**` contém senha literal.
- [x] CA1.12 — Cobertura ≥ 80% de linhas para `apps/api/src/spaces/spaces.service.ts`, `apps/api/src/spaces/spaces.controller.ts` e `apps/api/src/spaces/spaces.module.ts`, medida **só** por `coverage/coverage-summary.json` gerado na raiz com `npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text`, **sem `--project`** e sem filtro de caminho; reprova quem aparecer no JSON com `lines.pct < 80`.
- [x] CA1.13 — `git log feature/115-admin-roles-demote..HEAD --format=%s` mostra o commit inicial de documentação da fatia e **um** commit desta fase, ambos em inglês e em Conventional Commits.

## Fase 2 — Web: a seção "Unidades" na barra lateral e a página do espaço

Caminhos relativos à raiz do repositório. A ordem importa: a API simulada e a consulta vêm antes de quem as usa.

- [ ] T2.1 — API simulada: o espaço nasce e morre com a unidade (fecha a dívida 075) e o handler `GET /spaces`
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/installation.ts` (alterar); `apps/web/src/testing/mocks/handlers/spaces.ts` (criar); `apps/web/src/testing/mocks/handlers/index.ts` (alterar); `apps/web/src/testing/mocks/utils.ts` (alterar)
  - O que fazer (D7):
    - `db.ts`: o banco falso ganha `spaces: MockSpace[]`, com `type MockSpace = { id: string; type: 'unit'; orgUnitId: string }` e id `space-${orgUnitId}` (a convenção que o arquivo já usa). Helper `addUnitSpace(orgUnitId: string): MockSpace`, chamado em **todo** lugar onde uma unidade nasce: `seedInstalled` (raiz), `seedSampleOrgUnits` e `addOrgUnit`. `removeOrgUnit` tira o espaço junto com `splice` no array existente, **nunca** substituindo o array (a razão escrita em `touchDocumentUpdatedAt`). O comentário que diz que o espaço `UNIT` não é simulado é reescrito. Função `listSpacesOf(personId: string): { id: string; type: 'unit'; name: string }[]`: espaços cuja unidade tem lotação com esse `personId`, ordenados por `Intl.Collator('pt-BR', { sensitivity: 'base' })` com desempate por `id`.
    - `handlers/installation.ts`: o `POST /installation` falso cria o espaço da raiz com `addUnitSpace`.
    - `handlers/spaces.ts`: `http.get(\`${env.API_URL}/spaces\`)` com o preâmbulo da casa — `networkDelay()`, `devOverride('spaces')`, 401 sem cookie ou sem instalação — e a pessoa decidida por **`getSignedInPerson()`** (como `handlers/auth.ts`), **não** por `installation.person`. Responde `{ data: listSpacesOf(person.id) }`. Sem 403. Os outros handlers **não** são tocados (a troca deles é do item 124).
    - `handlers/index.ts` inclui o handler; `utils.ts` só ganha, no comentário das chaves de desenvolvimento, `mock-error=spaces`.
  - Skills: api-mocking
  - Complexidade: média

- [ ] T2.2 — A consulta `['spaces']`, a feature `unit-spaces` no lint e a invalidação pelas mutações de lotação
  - Arquivos: `apps/web/src/features/unit-spaces/api/get-spaces.ts` (criar); `eslint.config.js` (alterar); `apps/web/src/features/unit-assignments/api/assign-person.ts` (alterar); `apps/web/src/features/unit-assignments/api/remove-assignment.ts` (alterar)
  - O que fazer (D5, R1, R6):
    - `get-spaces.ts`: `getSpaces(): Promise<SpacesResponse>` → `api.get<SpacesResponse>('/spaces')`; `getSpacesQueryOptions()` com `queryKey: ['spaces']`; `useSpaces()`. Sem `staleTime` próprio e sem `silentError`.
    - `eslint.config.js`: zona nova de `apps/web/src/features/unit-spaces` em `import/no-restricted-paths`, no mesmo formato das outras features (não importa de outra feature nem de `app/`).
    - `assign-person.ts` e `remove-assignment.ts`: no sucesso, invalidam **também** a chave literal `['spaces']`, escrita como literal (sem importar de `unit-spaces`), como a 114 faz com `['people','search']`. Nada mais muda nesses arquivos.
  - Skills: api-requests, client-state, project-structure
  - Complexidade: baixa

- [ ] T2.3 — A seção "Unidades" na barra lateral
  - Arquivos: `apps/web/src/features/unit-spaces/components/sidebar-unit-spaces.tsx` (criar); `apps/web/src/app/routes/app/root.tsx` (alterar)
  - O que fazer (D5, Interface, R1, R2, R7). Aparência pelo `docs/design.md` e pelo piso de `interface-design`, com as receitas **já existentes** "Seção da barra lateral", "Item da barra lateral", "Erro" e "Botão secundário"; **nenhuma receita nova**:
    - `SidebarUnitSpaces(): React.JSX.Element | null`, usando `useSpaces()`, montada em `root.tsx` **entre** `<SidebarDocuments />` e `<SidebarAdmin />`.
    - **carregando → `null`**; **vazio → `null`** (nem `<nav>`, nem título).
    - **erro** → a seção aparece com `<nav aria-label="Unidades">`, `<h2>` **"Unidades"** e `role="alert"` com **"Não foi possível carregar suas unidades."** e o `Button` secundário **"Tentar novamente"** (largura total, como a seção de documentos), que chama `refetch`.
    - **com dados** → `<nav aria-label="Unidades">`, `<h2>` **"Unidades"** e um `<NavLink>` por espaço com `type === 'unit'`, para `paths.unitSpace.getHref(space.id)`, na ordem recebida (sem reordenar); o nome trunca, com `title` igual ao nome; o item da página aberta fica no estado ativo da receita "Item da barra lateral".
  - Skills: interface-design, component-robustness, project-structure
  - Complexidade: média

- [ ] T2.4 — A rota `/spaces/:spaceId` e a página do espaço com seus estados
  - Arquivos: `apps/web/src/config/paths.ts` (alterar); `apps/web/src/app/router.tsx` (alterar); `apps/web/src/app/routes/app/unit-space.tsx` (criar); `apps/web/src/features/unit-spaces/components/unit-space-view.tsx` (criar)
  - O que fazer (D4, D6, Interface, R3, R5, R7, R8). Receitas **já existentes**: "Contêiner de página" e "Título de página" (via `ContentLayout`), "Texto de apoio", "Vazio", "Carregando", "Erro", "Link de navegação", "Botão secundário":
    - `paths.ts`: `unitSpace: { path: '/spaces/:spaceId', getHref: (spaceId: string): string => \`/spaces/${encodeURIComponent(spaceId)}\` }`. `spaces` (a lista) não muda.
    - `router.tsx`: entrada `lazy` para `paths.unitSpace.path`, no molde das outras rotas do app; **sem `Authorization`** (não é área de administração).
    - `unit-space.tsx`: `useParams` + `useSpaces()`, delega a `UnitSpaceView`.
    - `unit-space-view.tsx`: `UnitSpaceView({ query, spaceId }): React.JSX.Element` dentro de `ContentLayout`. Procura o espaço em `data` comparando `id === spaceId` (o id da URL nunca vai para HTML senão como texto do React). **Não existe** chamada por id: inexistente, de outra organização, malformado e não lotado caem todos no mesmo estado.
      - `<h1>`: o nome da unidade quando achado (quebra com `break-words`); **"Espaço da unidade"** enquanto carrega, em erro e em não encontrado.
      - carregando: `role="status"` com **"Carregando o espaço…"**.
      - erro: `role="alert"`, receita "Erro", **"Não foi possível carregar o espaço."** + `Button` **"Tentar novamente"** que chama `refetch`.
      - não encontrado: `role="alert"`, receita "Erro", **"Espaço não encontrado."** + **"Ele não existe ou você não está lotado nesta unidade."** + `<Link>` **"Voltar para o início"** (receita "Link de navegação") para o início de `paths`.
      - achado: texto de apoio **"O espaço de documentos da sua unidade."** e, no lugar dos documentos, na receita "Vazio", **"Os documentos deste espaço ainda não chegaram. Em breve você e as pessoas lotadas nesta unidade vão guardar e encontrar documentos aqui."**
  - Skills: routing, interface-design, component-robustness, error-handling
  - Complexidade: média

- [ ] T2.5 — Testes da fase 2
  - Arquivos: `apps/web/src/features/unit-spaces/api/__tests__/get-spaces.test.tsx` (criar); `apps/web/src/features/unit-spaces/components/__tests__/sidebar-unit-spaces.test.tsx` (criar); `apps/web/src/features/unit-spaces/components/__tests__/unit-space-view.test.tsx` (criar); `apps/web/src/features/unit-assignments/api/__tests__/assign-person.test.tsx` (alterar); `apps/web/src/features/unit-assignments/api/__tests__/remove-assignment.test.tsx` (alterar); `apps/web/src/app/routes/app/__tests__/unit-space.test.tsx` (criar)
  - O que fazer (D8): banco falso pelos ajudantes existentes (`seedInstalled`, `seedSampleOrgUnits`, `addAssignment`, `removeAssignment`); interação por `userEvent`; localizar por papel e nome acessível em pt_BR. `LAZY_TIMEOUT` declarada em cada arquivo que espera após rota ou `lazy`. Sem espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. `src/testing/setup-tests.ts` não muda; casos preexistentes não são renomeados.
    - `get-spaces.test.tsx`: `getSpaces calls GET spaces and returns the envelope`; `getSpacesQueryOptions uses the spaces query key`.
    - `sidebar-unit-spaces.test.tsx`: `renders nothing while loading`; `renders nothing when the person has no unit spaces` (sem `nav` "Unidades" e sem o texto "Unidades"); `renders one link per space in the received order`; `each link points to the unit space href`; `on error shows the message and Tentar novamente refetches` (contador do handler sobe).
    - `unit-space-view.test.tsx`: `shows the loading status with the stable heading`; `shows the error alert and retries`; `shows Espaço não encontrado with a link to the home page when the id is not in the list`; `shows the unit name in the heading and the documents notice when found`.
    - `assign-person.test.tsx` e `remove-assignment.test.tsx`, um caso novo em cada: `invalidates the spaces query on success`.
    - `unit-space.test.tsx` (rota): `an assigned person opens the space by URL and sees the unit name`; `an unknown id and a space the person is not assigned to render the same not found state` (compara o conteúdo renderizado dos dois); `the Unidades section shows the open space as active`.
    - Fecha a fase com um commit, por exemplo `feat(web): open the unit space from the sidebar`.
  - Skills: unit-testing, component-testing, integration-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [ ] CA2.1 — Com `docker compose up -d` rodando, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e **sem aviso** (o do Vitest sobre jsdom não conta; o de chunk grande do Vite conta). A saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `git diff feature/115-admin-roles-demote... -- package.json apps/web/package.json pnpm-lock.yaml` é vazio.
- [ ] CA2.2 — `apps/web/src/features/unit-spaces/api/get-spaces.ts` exporta `getSpaces(): Promise<SpacesResponse>` chamando `api.get` em `'/spaces'`, `getSpacesQueryOptions()` com `queryKey: ['spaces']` e `useSpaces()`; `rg -n "staleTime|silentError" apps/web/src/features/unit-spaces/api/get-spaces.ts` é vazio. `apps/web/src/features/unit-assignments/api/assign-person.ts` e `remove-assignment.ts` invalidam `['spaces']` escrito como literal, e `rg -n "features/unit-spaces" apps/web/src/features/unit-assignments` é vazio. `eslint.config.js` tem uma zona de `import/no-restricted-paths` para `features/unit-spaces`.
- [ ] CA2.3 — `apps/web/src/features/unit-spaces/components/sidebar-unit-spaces.tsx` exporta `SidebarUnitSpaces` com retorno `React.JSX.Element | null`; devolve `null` enquanto carrega e com lista vazia; com dados, renderiza `<nav aria-label="Unidades">`, um `<h2>` com `Unidades` e um `NavLink` por item para `paths.unitSpace.getHref(...)`, com `title` igual ao nome e truncamento; em erro, contém literalmente `Não foi possível carregar suas unidades.` dentro de `role="alert"` e o `Button` `Tentar novamente`. `apps/web/src/app/routes/app/root.tsx` monta `<SidebarUnitSpaces />` entre `<SidebarDocuments />` e `<SidebarAdmin />`.
- [ ] CA2.4 — `apps/web/src/config/paths.ts` tem `unitSpace` com `path: '/spaces/:spaceId'` e `getHref` usando `encodeURIComponent`; `paths.spaces` não mudou. `apps/web/src/app/router.tsx` registra `paths.unitSpace.path` com `lazy`, sem `Authorization`. `apps/web/src/app/routes/app/unit-space.tsx` usa `useParams` e `useSpaces` e renderiza `UnitSpaceView`. `apps/web/src/features/unit-spaces/components/unit-space-view.tsx` contém literalmente `Espaço da unidade`, `Carregando o espaço…`, `Não foi possível carregar o espaço.`, `Tentar novamente`, `Espaço não encontrado.`, `Ele não existe ou você não está lotado nesta unidade.`, `Voltar para o início`, `O espaço de documentos da sua unidade.` e `Os documentos deste espaço ainda não chegaram. Em breve você e as pessoas lotadas nesta unidade vão guardar e encontrar documentos aqui.`; encontra o espaço por comparação `===` com o `spaceId`; `rg -n "/spaces/\\$\{|api\.get" apps/web/src/features/unit-spaces/components apps/web/src/app/routes/app/unit-space.tsx` é vazio (nenhuma chamada por id).
- [ ] CA2.5 — Acabamento (piso de `interface-design`, lendo o código): a página usa `ContentLayout` (contêiner e `<h1>` de título de página do `docs/design.md`), com um único `<h1>` e `break-words` no nome; o carregando tem `role="status"`; erro e não encontrado têm `role="alert"`, borda ou fundo de destaque da receita "Erro" e ação estilizada (`Button` ou `Link` com a receita "Link de navegação"); o aviso de documentos usa a receita "Vazio", em tom suave; a seção lateral usa as classes das receitas "Seção da barra lateral" e "Item da barra lateral" iguais às de `SidebarDocuments`/`SidebarAdmin`. `rg -n "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/unit-spaces apps/web/src/app/routes/app/unit-space.tsx` é vazio; nenhuma largura fixa em px nesses arquivos. `git diff --stat feature/115-admin-roles-demote... -- docs/design.md apps/web/src/components` é vazio.
- [ ] CA2.6 — API simulada: `apps/web/src/testing/mocks/db.ts` exporta `addUnitSpace(orgUnitId: string)` e `listSpacesOf(personId: string)`, tem `spaces` com itens `{ id: \`space-${orgUnitId}\`, type: 'unit', orgUnitId }`, chama `addUnitSpace` em `seedInstalled`, `seedSampleOrgUnits` e `addOrgUnit`, e `removeOrgUnit` remove o espaço com `splice`; o comentário antigo dizendo que o espaço `UNIT` não é simulado não existe mais. `apps/web/src/testing/mocks/handlers/installation.ts` chama `addUnitSpace` para a raiz. `apps/web/src/testing/mocks/handlers/spaces.ts` tem `http.get` em `${env.API_URL}/spaces` com `networkDelay()`, `devOverride('spaces')`, 401 sem cookie ou sem instalação e a pessoa vinda de `getSignedInPerson()` (`rg -n "installation\.person" apps/web/src/testing/mocks/handlers/spaces.ts` é vazio); `handlers/index.ts` o inclui; o diff de `utils.ts` só acrescenta linhas de comentário que mencionam `mock-error=spaces`. `git diff --stat feature/115-admin-roles-demote... -- apps/web/src/testing/mocks/handlers/admin-roles.ts apps/web/src/testing/mocks/handlers/unit-assignments.ts apps/web/src/testing/mocks/handlers/org-units.ts apps/web/src/testing/mocks/handlers/invitations.ts apps/web/src/testing/mocks/handlers/people.ts apps/web/src/testing/mocks/handlers/auth.ts apps/web/src/testing/setup-tests.ts` é vazio.
- [ ] CA2.7 — `npx vitest run --project web` termina com exit code 0 e existem, pelos nomes de T2.5: em `get-spaces.test.tsx`, `getSpaces calls GET spaces and returns the envelope` e `getSpacesQueryOptions uses the spaces query key`; em `sidebar-unit-spaces.test.tsx`, `renders nothing while loading`, `renders nothing when the person has no unit spaces`, `renders one link per space in the received order`, `each link points to the unit space href` e `on error shows the message and Tentar novamente refetches`; em `unit-space-view.test.tsx`, `shows the loading status with the stable heading`, `shows the error alert and retries`, `shows Espaço não encontrado with a link to the home page when the id is not in the list` e `shows the unit name in the heading and the documents notice when found`; em `assign-person.test.tsx` e em `remove-assignment.test.tsx`, `invalidates the spaces query on success`; em `apps/web/src/app/routes/app/__tests__/unit-space.test.tsx`, `an assigned person opens the space by URL and sees the unit name`, `an unknown id and a space the person is not assigned to render the same not found state` e `the Unidades section shows the open space as active`. Conferir com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/unit-spaces apps/web/src/features/unit-assignments/api/__tests__ apps/web/src/app/routes/app/__tests__/unit-space.test.tsx`. Os casos preexistentes de `assign-person.test.tsx` e `remove-assignment.test.tsx` continuam com os mesmos nomes. Nenhum `.only(` nem `.skip(`.
- [ ] CA2.8 — Lendo os testes: em `renders nothing when the person has no unit spaces` há asserção negativa de `navigation` com nome `Unidades` e do texto `Unidades`; em `renders one link per space in the received order` a ordem dos links é asserida igual à ordem da resposta do handler; em `an unknown id and a space the person is not assigned to render the same not found state` há um espaço que existe no banco falso mas cuja unidade não tem lotação da pessoa, e a asserção compara o conteúdo renderizado das duas URLs (iguais, com `Espaço não encontrado.`); em `the Unidades section shows the open space as active` há asserção de `aria-current="page"` no link do espaço aberto; nos dois `invalidates the spaces query on success` há asserção de que a invalidação recebeu a chave `['spaces']`.
- [ ] CA2.9 — Cada arquivo de teste desta fase que espera após rota ou `lazy` declara `LAZY_TIMEOUT` e a passa nessas esperas. `rg -n "setTimeout\(|sleep\(|waitForTimeout" apps/web/src/features/unit-spaces apps/web/src/app/routes/app/__tests__/unit-space.test.tsx` é vazio. `rg -n "eslint-disable" apps/web/src apps/api/src | rg -v -- "--"` é vazio.
- [ ] CA2.10 — Cobertura ≥ 80% de linhas para `apps/web/src/features/unit-spaces/api/get-spaces.ts`, `apps/web/src/features/unit-spaces/components/sidebar-unit-spaces.tsx`, `apps/web/src/features/unit-spaces/components/unit-space-view.tsx`, `apps/web/src/app/routes/app/unit-space.tsx`, `apps/web/src/app/routes/app/root.tsx`, `apps/web/src/config/paths.ts`, `apps/web/src/app/router.tsx`, `apps/web/src/features/unit-assignments/api/assign-person.ts` e `apps/web/src/features/unit-assignments/api/remove-assignment.ts`, medida **só** por `coverage/coverage-summary.json` gerado na raiz com `npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text`, **sem `--project`** e sem filtro de caminho; reprova quem aparecer no JSON com `lines.pct < 80`.
- [ ] CA2.11 — Intocados nesta fase (base é o commit da fase 1): `git diff --stat <commit da fase 1> -- apps/api packages apps/web/src/lib apps/web/src/components apps/web/src/types apps/web/src/hooks apps/web/src/app/routes/app/spaces.tsx apps/web/e2e vitest.config.ts docs/design.md docs/architecture.md` é vazio. (`docs/roadmap.md` e `docs/features/012-unit-spaces/**` ficam fora.)
- [ ] CA2.12 — `git log feature/115-admin-roles-demote..HEAD --format=%s` mostra o commit inicial de documentação da fatia e um commit por fase (1 e 2), todos em inglês e em Conventional Commits.

## Fase 3 — e2e da jornada e documentação: a fatia utilizável de ponta a ponta

Caminhos relativos à raiz do repositório.

- [ ] T3.1 — Documentação: a entrega na arquitetura e o roadmap
  - Arquivos: `docs/architecture.md` (alterar); `docs/roadmap.md` (alterar)
  - O que fazer (D9), em pt_BR:
    - `docs/architecture.md` §6: **um parágrafo novo**, título **"Entrega `unit-spaces` (fatia 012)"**, sem reescrever nenhuma outra seção, dizendo: `GET /spaces` com `SessionGuard` na classe e sem `AdminGuard`; `organizationId` e `personId` sempre da sessão; lotação **direta**, `isAdmin` não lido; o "não encontrado" único é da tela, por construção (sem rota por id até a 128, que usará `findFirst` escopado e 404 opaco sem `isUuid`); nenhum segmento literal sob `/spaces/`; nenhuma migration; a API simulada cria o espaço junto com a unidade (075 fechada) e o handler novo usa `getSignedInPerson` (padrão do item 124); espaço de unidade continua **sem** dar acesso a documento (§3).
    - `docs/roadmap.md`: 012 (`unit-spaces`) concluída, 075 fechada, e as dívidas da SPEC registradas (a página `/spaces` "Espaços" ainda placeholder; handlers antigos com `installation.person.isAdmin` até a 124; criação do espaço em quatro lugares do banco falso; página baixa a lista inteira até a 128; falta Playwright contra a API real). Só acrescentar ou marcar, sem reescrever outros itens.
  - Skills: —
  - Complexidade: baixa

- [ ] T3.2 — Testes da fase 3 (e2e: a pessoa lotada chega ao espaço pelo teclado)
  - Arquivos: `apps/web/e2e/tests/unit-spaces.spec.ts` (criar)
  - O que fazer (D8): contra a API simulada, estado inicial por `page.addInitScript` com `mock-installation=signed-in` e `mock-org-units=sample`. No topo, `const ROUTE_TIMEOUT = { timeout: 10_000 }`; **toda** espera logo após mudança de rota (`toHaveURL`, primeira visibilidade da tela nova) o recebe; nenhum `waitForTimeout` e nenhuma espera fixa. Depois de cada `Tab`/seta e antes do `Enter`, `await expect(locator).toBeFocused()`. `apps/web/e2e/a11y.ts` e os outros specs não são tocados; **nenhuma regra do axe é desativada**.
    - Caso `without an assignment the Unidades section does not exist`: a barra lateral não tem `navigation` com nome "Unidades".
    - Caso `an admin assigns themselves to a unit and opens its space using the keyboard`: pela página de pessoas da unidade (fluxo da 010) a administração se lota numa unidade de exemplo; a seção "Unidades" aparece com o item da unidade; o item é alcançado **pelo teclado** (`toBeFocused()` antes do `Enter`); a URL passa a `/spaces/…` (`toHaveURL` com `ROUTE_TIMEOUT`), o `<h1>` mostra o nome da unidade e o aviso "Os documentos deste espaço ainda não chegaram." está visível; `expectNoSeriousA11yViolations(page)` nesse estado.
    - Caso `removing their own assignment hides the section and the space becomes not found`: depois de lotada e com a URL do espaço guardada, volta à página da 010, tira a própria lotação, a seção "Unidades" some, e ao abrir a URL guardada a página mostra "Espaço não encontrado.".
    - Os e2e existentes das fatias anteriores **não** mudam; se algum quebrar, o conserto é no código de produção.
    - Fecha a fase com um commit, por exemplo `test(e2e): cover opening a unit space`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [ ] CA3.1 — `pnpm test:e2e` na raiz termina com exit code 0, e continuam terminando com exit code 0 e **sem aviso**, com `docker compose up -d` e o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.
- [ ] CA3.2 — `apps/web/e2e/tests/unit-spaces.spec.ts` contém os casos `without an assignment the Unidades section does not exist`, `an admin assigns themselves to a unit and opens its space using the keyboard` e `removing their own assignment hides the section and the space becomes not found`, e `pnpm --filter web exec playwright test --list` os lista. `git diff --stat feature/115-admin-roles-demote... -- apps/web/e2e` lista **só** `apps/web/e2e/tests/unit-spaces.spec.ts` (nenhum e2e existente alterado). `rg -n "test\.skip|test\.only|waitForTimeout|disableRules" apps/web/e2e/tests/unit-spaces.spec.ts` é vazio.
- [ ] CA3.3 — Lendo o spec: `ROUTE_TIMEOUT = { timeout: 10_000 }` declarado no topo e passado em **toda** asserção logo após mudança de rota (`toHaveURL` e primeira visibilidade da tela nova); há `toBeFocused()` entre cada `Tab`/seta e o `Enter` seguinte; no segundo caso, há asserção do nome da unidade no `heading` de nível 1, do texto "Os documentos deste espaço ainda não chegaram." e uma chamada a `expectNoSeriousA11yViolations(page)`; no terceiro, asserção negativa da `navigation` "Unidades" e asserção de "Espaço não encontrado." na URL do espaço.
- [ ] CA3.4 — `docs/architecture.md` tem, na §6, o parágrafo "Entrega `unit-spaces` (fatia 012)" com: `GET /spaces` com `SessionGuard` na classe e sem `AdminGuard`; `organizationId` e `personId` da sessão; lotação direta e `isAdmin` não lido; não encontrado único da tela, por construção, e a rota por id adiada para a 128; nenhum segmento literal sob `/spaces/`; nenhuma migration; 075 fechada e handler com `getSignedInPerson`; espaço de unidade sem acesso a documento. `git diff feature/115-admin-roles-demote... -- docs/architecture.md` só acrescenta linhas. `docs/roadmap.md` marca a 012 como concluída e a 075 como fechada.
- [ ] CA3.5 — Intocados nesta fase: `git diff --stat <commit da fase 2> -- apps/api packages apps/web/src` é vazio.
- [ ] CA3.6 — A fatia está utilizável de ponta a ponta: `npx vitest run --project api` (exit code 0) inclui `a person assigned to two units gets both in pt-BR order with the space id` e `an admin without assignments gets an empty list even with units in the organization`; `npx vitest run --project web` (exit code 0) inclui `an assigned person opens the space by URL and sees the unit name` e `an unknown id and a space the person is not assigned to render the same not found state`; `pnpm test:e2e` (exit code 0) inclui os três casos de `apps/web/e2e/tests/unit-spaces.spec.ts`.
- [ ] CA3.7 — `git log feature/115-admin-roles-demote..HEAD --format=%s` mostra o commit inicial de documentação da fatia e um commit por fase (1, 2 e 3), todos em inglês e em Conventional Commits; um commit final `docs:` de fechamento feito pela orquestração, se já existir, não conta nem reprova.

## DoD da entrega

- [ ] DoD1 — Todas as tarefas e critérios do plano marcados
- [ ] DoD2 — Suíte de testes inteira passa
- [ ] DoD3 — Lint do projeto inteiro sem erros nem avisos
- [ ] DoD4 — Tipos de todos os `tsconfig` sem erros
- [ ] DoD5 — Console dos testes sem erro nem aviso
- [ ] DoD6 — `build` passa
- [ ] DoD7 — Nenhum import entre features nem contra o fluxo compartilhado → features → app
- [ ] DoD8 — Nenhum `console.log`, `TODO`, `// @debug`, `.only(` ou `.skip(` no diff da branch
- [ ] DoD9 — Nenhuma worktree ou branch temporária sobrando
