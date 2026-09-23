# PLAN 013 — free-spaces

Branch: `feature/013-free-spaces`, que **sai de `feature/012-unit-spaces`** (entrega empilhada). **Toda** comparação de diff e de "arquivo intocado" deste plano é contra `feature/012-unit-spaces`, nunca contra `develop` nem `main`. Onde um critério diz `<base>`, leia `feature/012-unit-spaces`.

Fonte: `docs/features/013-free-spaces/spec.md` (D1…D10 são as decisões técnicas da SPEC e R1…R10 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

A pessoa com sessão cria um **espaço livre**, vira **dona** dele e chega a ele pela seção "Espaços" da barra lateral. Fora desta fatia: nome repetido recusado (137), membros e tabela de membros (134), rota por id `GET /spaces/{spaceId}` (128/134), a página placeholder `/spaces` (129).

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Diffs e commits.** Os critérios são conferidos **antes** do commit da fase: todo diff é `git diff feature/012-unit-spaces -- <caminhos>` (dois argumentos, **sem** `...`, para incluir o que ainda não foi commitado), completado por `git status --porcelain -uall <caminhos>` para arquivos novos não rastreados. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita e nenhum critério exige commit.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Uma migration só, escrita à mão** (`apps/api/prisma/migrations/0013_free_space/migration.sql`). Os únicos subcomandos de Prisma permitidos são `prisma validate`, `prisma generate`, `prisma migrate status` e `prisma migrate deploy`, sempre contra `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test`; **nunca** `migrate diff`, `migrate dev` ou `migrate reset`. As migrations `0001…0012` não mudam.
- O arquivo `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); **todo botão nosso é o componente `Button`** de `apps/web/src/components/ui/button/button.tsx`; navegação interna só com `<Link>`/`<NavLink>`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Textos de tela em pt_BR; código, comentários, caminhos de URL e nomes de teste em en_US.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar. Nenhum segredo em `VITE_*`; nenhum literal com cara de senha, token ou hash em arquivo versionado.
- Cobertura ≥ 80% de linhas **por arquivo** novo ou alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Reprova quem aparecer no JSON com `lines.pct < 80`. Não contam arquivos só de tipos, arquivos com 0 de 0 linhas, nem os já excluídos pelo `vitest.config.ts` da raiz. Nenhuma exclusão nova.
- **Toda** espera logo após mudança de rota ou chunk `lazy` tem timeout explícito: nos testes da web pela constante `LAZY_TIMEOUT` declarada no arquivo; no e2e pela constante `ROUTE_TIMEOUT = { timeout: 10_000 }` no topo do spec. Nunca `setTimeout`/sleep fixo nem `waitForTimeout`.
- Testes de API são de integração contra o Postgres real (sem mock do Prisma), exceto `spaces.service.test.ts`, que usa Prisma falso. "Teste passa" é medido pelo **exit code** (zero), nunca pela leitura da saída `--verbose`.
- **Escopo por sessão**: `organizationId` e `ownerId`/`personId` vêm sempre de `@CurrentPerson()`, nunca do corpo. `isAdmin` **não** é lido: administração não vê espaço livre alheio.
- Nenhuma tarefa acrescenta escopo: sem tabela de membros, sem índice único de nome, sem rota por id, sem documentos no espaço, sem mexer em `apps/web/src/app/routes/app/spaces.tsx`.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: `POST /spaces` cria espaço livre e `GET /spaces` o devolve ao dono

Caminhos relativos à raiz do repositório.

- [x] T1.1 — Contrato primeiro: `post` em `/spaces`, `CreateSpaceInput`, `SpaceResponse` e `type: free`
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script)
  - O que fazer (D2, R4, R5, R10):
    - **No mesmo caminho `/spaces`** que já tem o `get`, acrescentar `post` com `operationId: createSpace`, tag `spaces`, `requestBody` obrigatório com `CreateSpaceInput`, respostas **201** (`SpaceResponse`), **400** e **401** (schema `Error` existente). Sem 403, sem 404, sem 409.
    - Schemas novos:
      ```yaml
      CreateSpaceInput:
        type: object
        required: [name]
        additionalProperties: false
        properties:
          name: { type: string, minLength: 1, maxLength: 120 }  # contado após trim
      SpaceResponse:
        type: object
        required: [data]
        properties:
          data: { $ref: '#/components/schemas/Space' }
      ```
    - `Space.type` passa de `enum: [unit]` a `enum: [unit, free]`; a descrição de `name` passa a "Nome da unidade, no espaço de unidade; nome dado pelo dono, no espaço livre". A `description` do `get` acrescenta, em pt_BR: e os espaços livres de que a pessoa da sessão é dona, na organização dela; mesma ordem.
    - **Identidade de caminho conferida à mão, contra o YAML inteiro, antes de escrever**: nenhum caminho novo é declarado; `/spaces` só ganha um método; continua sem nenhum segmento literal sob `/spaces/`; o caminho é idêntico ao do controller de T1.3 (`@Controller('spaces')` + `@Post()` sem argumento).
    - Regenerar com `pnpm --filter @folioteca/api-contract generate`.
  - Skills: security
  - Complexidade: baixa

- [x] T1.2 — Banco: colunas do espaço livre, migration 0013 escrita à mão e esquema Prisma
  - Arquivos: `apps/api/prisma/migrations/0013_free_space/migration.sql` (criar); `apps/api/prisma/schema.prisma` (alterar)
  - O que fazer (D1, R5, R7):
    - `migration.sql`, **escrita à mão**, com comentários em pt_BR explicando cada bloco (como na 0012), com exatamente este conteúdo SQL:
      ```sql
      ALTER TABLE "Space" ADD COLUMN "organizationId" TEXT;
      ALTER TABLE "Space" ADD COLUMN "name" TEXT;
      ALTER TABLE "Space" ADD COLUMN "ownerId" TEXT;

      ALTER TABLE "Space" ADD CONSTRAINT "Space_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerId_fkey"
          FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

      CREATE INDEX "Space_ownerId_idx" ON "Space"("ownerId");

      ALTER TABLE "Space" DROP CONSTRAINT "Space_type_owner_check";
      ALTER TABLE "Space" ADD CONSTRAINT "Space_type_owner_check" CHECK (
          ("type" = 'PERSONAL' AND "personId" IS NOT NULL AND "orgUnitId" IS NULL
              AND "organizationId" IS NULL AND "name" IS NULL AND "ownerId" IS NULL)
          OR ("type" = 'UNIT' AND "orgUnitId" IS NOT NULL AND "personId" IS NULL
              AND "organizationId" IS NULL AND "name" IS NULL AND "ownerId" IS NULL)
          OR ("type" = 'FREE' AND "personId" IS NULL AND "orgUnitId" IS NULL
              AND "organizationId" IS NOT NULL AND "name" IS NOT NULL AND "ownerId" IS NOT NULL)
      );
      ```
      Sem índice único de nome (é da 137); nenhum preenchimento de linhas existentes.
    - `schema.prisma`: `Space` ganha `organizationId String?`, `name String?`, `ownerId String?`, `organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Restrict)`, `owner Person? @relation("SpaceOwner", fields: [ownerId], references: [id], onDelete: Restrict)` e `@@index([ownerId])`; a relação pessoal existente passa a `@relation("PersonalSpace", …)` nos dois lados; `Person.ownedSpaces Space[] @relation("SpaceOwner")`; `Organization.spaces Space[]`. O comentário de `Space` registra que a restrição de tipo vive só na migration.
    - Conferência: `pnpm --filter api exec prisma validate`, `prisma generate`, e `migrate deploy` + `migrate status` no banco de teste. Nunca `migrate diff/dev/reset`; se `validate` apontar diferença que exigiria outro SQL, o agente para e relata.
  - Skills: security
  - Complexidade: alta

- [x] T1.3 — Módulo `spaces`: schema do nome, `create` e `list` com espaços livres, `@Post()` no controller
  - Arquivos: `apps/api/src/spaces/spaces.schema.ts` (criar); `apps/api/src/spaces/spaces.service.ts` (alterar); `apps/api/src/spaces/spaces.controller.ts` (alterar)
  - O que fazer (D3, R4, R5, R7):
    - `spaces.schema.ts`: `spaceNameSchema` com as mesmas regras e mensagens de `apps/api/src/org-units/org-units.schema.ts` (copiado, **não** importado): obrigatório com "Informe o nome.", máximo 120 com "O nome pode ter no máximo 120 caracteres.", `trim` + `normalize('NFC')`. `createSpaceSchema = z.strictObject({ name: spaceNameSchema }, { error: 'Campo não permitido.' })`.
    - `spaces.service.ts`: `create(organizationId: string, personId: string, body: unknown): Promise<SpaceResponse>` → `parseBody(createSpaceSchema, body)` → `prisma.space.create({ data: { type: 'FREE', organizationId, ownerId: personId, name }, select: { id: true, name: true } })` → `{ data: { id, type: 'free', name } }`. Uma escrita, sem transação.
    - `list` passa a:
      ```ts
      where: {
        OR: [
          { type: 'UNIT', orgUnit: { organizationId, assignments: { some: { personId } } } },
          { type: 'FREE', organizationId, ownerId: personId },
        ],
      },
      select: { id: true, type: true, name: true, orgUnit: { select: { name: true } } },
      ```
      com `flatMap` mapeando `UNIT → { id, type: 'unit', name: orgUnit.name }` e `FREE → { id, type: 'free', name }` (linha sem nome descartada, sem `!`); a ordenação pt-BR com desempate por `id` continua a mesma, sobre a lista misturada. `isAdmin` continua fora do arquivo.
    - `spaces.controller.ts`: `@Post()` com `@HttpCode(201)`, `@CurrentPerson() person` e `@Body() body: unknown`, chamando `create(person.organizationId, person.id, body)`. O guard continua **só na classe** (`SessionGuard`), sem `@UseGuards` por método e sem `AdminGuard`. `CsrfGuard` global já cobre o `POST`.
    - `access/**`, `documents/**` e `document-access-boundary.test.ts` intocados.
  - Skills: authorization, security
  - Complexidade: alta

- [x] T1.4 — Testes da fase 1
  - Arquivos: `apps/api/src/spaces/__tests__/spaces.service.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.contract.test.ts` (alterar)
  - O que fazer (D9): integração e contrato contra o Postgres real com `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes (`createPersonWithSession`, `apps/api/test/http.ts`, `contract.ts`); `apps/api/test/**` **não muda**. Casos preexistentes não são renomeados, exceto a asserção do `where` exato de `list queries unit spaces scoped by the given organization and person`, que passa a esperar o `OR` (o nome fica).
    - `spaces.service.test.ts`, casos novos: `list queries unit and free spaces with the OR scoped by organization and person` (asserção do `where` **exato** com o `OR`); `list maps free rows to id, type free and name`; `list sorts unit and free spaces together with the pt-BR collator`; `create writes a FREE space with the given organization and owner`; `create ignores organizationId and ownerId sent in the body` (o corpo com extras é recusado por `parseBody` antes de `create` do Prisma).
    - `spaces.integration.test.ts`, casos novos: `POST spaces creates a free space owned by the session person` ("  Projeto Alfa  " → 201, `name` "Projeto Alfa", `type: 'free'`; no banco `type = FREE`, `ownerId` e `organizationId` da sessão); `POST spaces rejects an empty name with 400`; `POST spaces rejects a name made only of spaces with 400`; `POST spaces rejects a name longer than 120 characters with 400`; `POST spaces rejects extra fields with 400` (`organizationId` e `ownerId` no corpo); `POST spaces accepts two spaces with the same name from the same owner`; `POST spaces answers 401 to an anonymous request`; `POST spaces without the CSRF token is refused`; `GET spaces returns free and unit spaces mixed in pt-BR order`; `a free space is not listed for another person of the same organization`; `a free space is not listed for an admin who is not the owner`; `a free space of another organization never appears` (inserido pelo Prisma); `the database rejects a FREE space without name`; `the database rejects a FREE space without owner`; `the database rejects a PERSONAL space with a name` (os três últimos por Prisma cru, esperando falha da restrição).
    - `spaces.contract.test.ts`, casos novos: `POST spaces answers the documented 201`, `POST spaces answers the documented 400` e `POST spaces answers the documented 401`, via `expectMatchesContract`.
  - Skills: unit-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d` rodando, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e **sem aviso**. `git diff feature/012-unit-spaces -- package.json apps/api/package.json apps/web/package.json packages/api-contract/package.json pnpm-lock.yaml` é vazio.
- [x] CA1.2 — `packages/api-contract/openapi.yaml`: o caminho `/spaces` tem `get` (`listSpaces`) e `post` com `operationId: createSpace`, tag `spaces`, `requestBody` com `$ref` para `CreateSpaceInput`, e respostas exatamente `201` (`SpaceResponse`), `400` e `401` (`Error`). `CreateSpaceInput` tem `required: [name]`, `additionalProperties: false` e `name` com `minLength: 1`, `maxLength: 120`; `SpaceResponse` tem `data` com `$ref` para `Space`; `Space.type` tem `enum: [unit, free]`.
- [x] CA1.3 — Identidade de caminho, conferida à mão: `git diff feature/012-unit-spaces -- packages/api-contract/openapi.yaml | rg -n "^[+-]  /"` é vazio (nenhum caminho novo, renomeado ou removido); `rg -n "^  /spaces" packages/api-contract/openapi.yaml` devolve só `/spaces:`; `apps/api/src/spaces/spaces.controller.ts` tem `@Controller('spaces')` e `@Post()` sem argumento.
- [x] CA1.4 — Tipos regenerados pelo script: `rg -n "createSpace|CreateSpaceInput|SpaceResponse" packages/api-contract/src/generated/openapi.d.ts` encontra os três; `rg -n '"free"' packages/api-contract/src/generated/openapi.d.ts` encontra o novo valor do enum.
- [x] CA1.5 — Migration: `git status --porcelain -uall apps/api/prisma/migrations` lista **só** `apps/api/prisma/migrations/0013_free_space/migration.sql`, e `git diff feature/012-unit-spaces -- apps/api/prisma/migrations` é vazio (nenhuma migration anterior alterada). O arquivo contém as três `ADD COLUMN` (`organizationId`, `name`, `ownerId`), `Space_organizationId_fkey` e `Space_ownerId_fkey` com `ON DELETE RESTRICT`, `CREATE INDEX "Space_ownerId_idx"`, o `DROP CONSTRAINT "Space_type_owner_check"` e a nova restrição com os três ramos PERSONAL/UNIT/FREE; `rg -n "UNIQUE|UPDATE \"Space\"" apps/api/prisma/migrations/0013_free_space/migration.sql` é vazio. `pnpm --filter api exec prisma validate` termina com exit code 0 e `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test pnpm --filter api exec prisma migrate status` reporta o banco em dia. Nenhum `migrate diff`, `migrate dev` ou `migrate reset` foi usado: `git diff feature/012-unit-spaces -- apps packages | rg -n "migrate (diff|dev|reset)"` é vazio e não existe `apps/api/prisma/migrations/*` além de `0001…0013` e `migration_lock.toml`.
- [x] CA1.6 — `apps/api/prisma/schema.prisma`: `Space` tem `organizationId String?`, `name String?`, `ownerId String?`, relações `organization` e `owner` (`@relation("SpaceOwner", …)`) e `@@index([ownerId])`; a relação pessoal usa `@relation("PersonalSpace"` nos dois lados; `Person` tem `ownedSpaces Space[] @relation("SpaceOwner")` e `Organization` tem `spaces Space[]`.
- [x] CA1.7 — `apps/api/src/spaces/spaces.schema.ts` exporta `spaceNameSchema` e `createSpaceSchema` (`z.strictObject`), com os textos literais `Informe o nome.`, `O nome pode ter no máximo 120 caracteres.` e `Campo não permitido.`; `rg -n "org-units" apps/api/src/spaces` é vazio. `apps/api/src/spaces/spaces.service.ts` tem `create(organizationId: string, personId: string, body: unknown)` que chama `parseBody(createSpaceSchema, body)` e `prisma.space.create` com `type: 'FREE'`, `organizationId` e `ownerId: personId`; `list` tem o `where` com `OR` de `{ type: 'UNIT', orgUnit: { organizationId, assignments: { some: { personId } } } }` e `{ type: 'FREE', organizationId, ownerId: personId }`. `rg -n "isAdmin|\$transaction|\$queryRaw" apps/api/src/spaces --glob '!**/__tests__/**'` é vazio; `rg -n "!\." apps/api/src/spaces/spaces.service.ts` é vazio.
- [x] CA1.8 — `apps/api/src/spaces/spaces.controller.ts`: `rg -n "@UseGuards" apps/api/src/spaces/spaces.controller.ts` devolve **exatamente uma** ocorrência, acima da classe, com `SessionGuard`; `rg -n "@UseGuards\(.*AdminGuard" apps/api/src/spaces` é vazio. O método `@Post()` tem `@HttpCode(201)`, `@CurrentPerson()` e `@Body() body: unknown`, e chama `create(person.organizationId, person.id, body)`. `rg -n "@Param|@Query|Logger|console\." apps/api/src/spaces --glob '!**/__tests__/**'` é vazio.
- [x] CA1.9 — Intocados: `git diff --stat feature/012-unit-spaces -- apps/api/src/access apps/api/src/documents apps/api/src/auth apps/api/src/common apps/api/src/org-units apps/api/src/unit-assignments apps/api/src/people apps/api/src/admin-roles apps/api/src/invitations apps/api/src/installation apps/api/test apps/web vitest.config.ts eslint.config.js docs/design.md docs/architecture.md` é vazio, e `git status --porcelain -uall` dos mesmos caminhos não lista nada.
- [x] CA1.10 — `pnpm exec vitest run --project api` termina com exit code 0 e existem, pelos nomes de T1.4: em `spaces.service.test.ts`, `list queries unit and free spaces with the OR scoped by organization and person`, `list maps free rows to id, type free and name`, `list sorts unit and free spaces together with the pt-BR collator`, `create writes a FREE space with the given organization and owner` e `create ignores organizationId and ownerId sent in the body`; em `spaces.integration.test.ts`, `POST spaces creates a free space owned by the session person`, `POST spaces rejects an empty name with 400`, `POST spaces rejects a name made only of spaces with 400`, `POST spaces rejects a name longer than 120 characters with 400`, `POST spaces rejects extra fields with 400`, `POST spaces accepts two spaces with the same name from the same owner`, `POST spaces answers 401 to an anonymous request`, `POST spaces without the CSRF token is refused`, `GET spaces returns free and unit spaces mixed in pt-BR order`, `a free space is not listed for another person of the same organization`, `a free space is not listed for an admin who is not the owner`, `a free space of another organization never appears`, `the database rejects a FREE space without name`, `the database rejects a FREE space without owner` e `the database rejects a PERSONAL space with a name`; em `spaces.contract.test.ts`, `POST spaces answers the documented 201`, `POST spaces answers the documented 400` e `POST spaces answers the documented 401`. Conferir com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/spaces/__tests__`. Os casos da 012 continuam com os mesmos nomes. `rg -n "vi\.mock\(.*prisma" apps/api/src/spaces/__tests__/spaces.integration.test.ts apps/api/src/spaces/__tests__/spaces.contract.test.ts` é vazio.
- [x] CA1.11 — O escopo está provado. Lendo `POST spaces creates a free space owned by the session person`: a linha é lida pelo Prisma e `ownerId`/`organizationId` são comparados aos da sessão. Lendo `a free space is not listed for an admin who is not the owner`: a sessão tem `isAdmin: true`, está na mesma organização, e a resposta não contém o id do espaço. Lendo `POST spaces rejects extra fields with 400`: o corpo leva `organizationId` e `ownerId` e nenhuma linha FREE é criada.
- [x] CA1.12 — `rg -n "setTimeout\(|sleep\(" apps/api/src/spaces` é vazio; `rg -n "eslint-disable" apps/api/src apps/web/src | rg -v -- "--"` é vazio.
- [x] CA1.13 — Cobertura ≥ 80% de linhas para `apps/api/src/spaces/spaces.schema.ts`, `apps/api/src/spaces/spaces.service.ts` e `apps/api/src/spaces/spaces.controller.ts`, medida só por `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, sem `--project` e sem filtro de caminho.

## Fase 2 — Web: seção "Espaços", diálogo "Novo espaço" e página generalizada

Caminhos relativos à raiz do repositório. A ordem importa: a renomeação e a API simulada vêm antes de quem as usa.

- [x] T2.1 — Renomear a feature `unit-spaces` para `spaces`, a rota e o caminho
  - Arquivos: `apps/web/src/features/unit-spaces/**` → `apps/web/src/features/spaces/**` (mover, `git mv`, com os testes); `eslint.config.js` (alterar); `apps/web/src/config/paths.ts` (alterar); `apps/web/src/app/router.tsx` (alterar); `apps/web/src/app/routes/app/unit-space.tsx` → `apps/web/src/app/routes/app/space.tsx` (mover e alterar); `apps/web/src/app/routes/app/__tests__/unit-space.test.tsx` → `apps/web/src/app/routes/app/__tests__/space.test.tsx` (mover e alterar imports); `apps/web/src/features/spaces/components/sidebar-unit-spaces.tsx` (alterar); `apps/web/src/app/routes/app/root.tsx` (alterar imports)
  - O que fazer (D5, D7): conteúdo preservado; só imports e nomes mudam. `eslint.config.js`: a zona de `features/unit-spaces` passa a `features/spaces`. `paths.ts`: `unitSpace` passa a **`space`** (mesmo `path: '/spaces/:spaceId'` e `getHref` com `encodeURIComponent`); `paths.spaces` não muda. `router.tsx`: a entrada `lazy` aponta para `space.tsx`, sem `Authorization`. `SidebarUnitSpaces` passa a usar `paths.space`. `features/unit-assignments/**` não muda (a chave literal `['spaces']` continua).
  - Skills: project-structure, routing
  - Complexidade: baixa

- [x] T2.2 — API simulada, schema do nome e mutação `useCreateSpace`
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/spaces.ts` (alterar); `apps/web/src/testing/mocks/utils.ts` (alterar); `apps/web/src/features/spaces/utils/space-name-schema.ts` (criar); `apps/web/src/features/spaces/api/create-space.ts` (criar); `apps/web/src/features/spaces/api/get-spaces.ts` (alterar)
  - O que fazer (D5, D8, R4, R5):
    - `space-name-schema.ts`: `spaceNameSchema` Zod com as mesmas regras e mensagens da API ("Informe o nome.", "O nome pode ter no máximo 120 caracteres.", `trim`, NFC). Não importa de `features/org-units`.
    - `create-space.ts`: `createSpaceInputSchema = z.object({ name: spaceNameSchema })`; tipo `CreateSpaceInput` aliado do contrato; `createSpace(data)` → `api.post<SpaceResponse, SpaceResponse>('/spaces', data, { silentError: true })`; `useCreateSpace()` cujo `onSuccess` **aguarda** `queryClient.invalidateQueries({ queryKey: getSpacesQueryOptions().queryKey })` antes de chamar o `onSuccess` do chamador (padrão de `features/org-units/api/create-org-unit.ts`). `get-spaces.ts` ganha o alias `SpaceResponse` do contrato.
    - `db.ts`: `MockSpace` vira união `{ id; type: 'unit'; orgUnitId }` | `{ id; type: 'free'; name; ownerId }`; helper **único** `addFreeSpace(ownerId: string, name: string): MockSpace` com id `space-free-${contador}` e `push` no array existente (nunca substituindo). `listSpacesOf(personId)` passa a incluir os `free` com `ownerId === personId`, mesmo colador e desempate, retorno tipado com o `Space` do contrato. Nenhum `state.spaces.push` fora de `addUnitSpace` e `addFreeSpace`.
    - `handlers/spaces.ts`: `http.post(\`${env.API_URL}/spaces\`)` com o mesmo preâmbulo do `GET` (`networkDelay()`, `devOverride('spaces')`, 401 sem instalação, cookie ou `getSignedInPerson()`), valida o corpo com `spaceNameSchema` da web (400 com `{ message }` da primeira issue) e responde **201** `{ data }` criado por `addFreeSpace`.
    - `utils.ts`: o comentário de `mock-error=spaces` passa a citar também o `POST`.
  - Skills: api-mocking, api-requests, client-state, forms
  - Complexidade: média

- [x] T2.3 — Seção "Espaços" com o diálogo "Novo espaço" sempre montado
  - Arquivos: `apps/web/src/features/spaces/components/create-space-form.tsx` (criar); `apps/web/src/features/spaces/components/sidebar-free-spaces.tsx` (criar); `apps/web/src/app/routes/app/root.tsx` (alterar)
  - O que fazer (D6, Interface, R1–R5, R9). Aparência pelo `docs/design.md` e pelo piso de `interface-design`, com as receitas "Seção da barra lateral", "Item da barra lateral", "Diálogo de formulário", "Campo de formulário", "Alerta dentro de formulário", "Notificação", "Erro", botões principal e secundário, e a receita **nova** "Ação da seção da barra lateral" (botão secundário `mt-2 w-full` abaixo do conteúdo; registrada em `docs/design.md` na fase 3):
    - `SidebarFreeSpaces(): React.JSX.Element`, com `useSpaces()`, montada em `root.tsx` **depois** de `<SidebarUnitSpaces />` e **antes** de `<SidebarAdmin />`. Sempre `<nav aria-label="Espaços">`, `<h2>` **"Espaços"**, o conteúdo por estado e, abaixo, o `Button` secundário de largura total **"Novo espaço"** (`type="button"`), presente **nos quatro estados**:
      - carregando: `role="status"` **"Carregando espaços…"**;
      - erro: `role="alert"` **"Não foi possível carregar seus espaços."** + `Button` secundário **"Tentar novamente"** (chama `refetch`);
      - vazio (nenhum item `type === 'free'`): **"Você ainda não tem espaços."** em tom suave;
      - com dados: um `<NavLink>` por item `type === 'free'`, na ordem recebida, para `paths.space.getHref(id)`, com `title` igual ao nome, truncado, ativo pela receita "Item da barra lateral".
    - O `Dialog` fica **fora** do `switch` de estados, irmão do botão; o `DialogContent` é renderizado **sempre** (sem `{open ? … : null}` e sem condição sobre dados). Título **"Novo espaço"**; descrição **"Um lugar para um grupo de trabalho, um projeto ou uma comissão. Você será a pessoa dona dele."** O formulário recebe `key` de um contador incrementado a cada abertura. Foco inicial: padrão do Radix (o "Nome" é o primeiro focável; sem `onOpenAutoFocus` próprio). Fechar sem criar devolve o foco ao "Novo espaço" pelo `Dialog`.
    - Ao criar: `closedByCreationRef.current = true`, notificação de sucesso **"Espaço criado"**, fecha o diálogo e `navigate(paths.space.getHref(id), { state: { focusMain: true } })`; no `onCloseAutoFocus`, se a ref estiver ligada, `preventDefault()` e zera a ref.
    - `create-space-form.tsx`: `Form` com `createSpaceInputSchema`, `Input` com rótulo **"Nome"** e `autoComplete="off"`; rodapé com `DialogClose` **"Cancelar"** (secundário) e **"Criar espaço"** / **"Criando…"** (principal, `isLoading`); `isSubmittingRef` contra duplo Enter; 400 do servidor → `setError('name', { message }, { shouldFocus: true })` com a mensagem recebida; outra falha → `role="alert"` **"Não foi possível criar o espaço. Tente de novo em instantes."** com o diálogo aberto.
  - Skills: interface-design, forms, component-robustness, error-handling
  - Complexidade: alta

- [x] T2.4 — Página do espaço generalizada por tipo e foco no `<main>` após criar
  - Arquivos: `apps/web/src/features/spaces/components/unit-space-view.tsx` → `apps/web/src/features/spaces/components/space-view.tsx` (mover e alterar; o teste `unit-space-view.test.tsx` → `space-view.test.tsx` acompanha); `apps/web/src/components/layouts/content-layout.tsx` (alterar); `apps/web/src/app/routes/app/space.tsx` (alterar)
  - O que fazer (D4, D7, Interface, R6, R8, R9). Receitas "Contêiner de página"/"Título de página" (via `ContentLayout`), "Texto de apoio", "Vazio", "Carregando", "Erro", "Link de navegação":
    - `SpaceView({ query, spaceId }): React.JSX.Element` (antes `UnitSpaceView`). `<h1>` enquanto carrega, em erro e em não encontrado: **"Espaço"**; achado: o nome (`break-words`).
    - carregando: `role="status"` **"Carregando o espaço…"**; erro: `role="alert"` **"Não foi possível carregar o espaço."** + **"Tentar novamente"**; não encontrado, **um só** para os dois tipos: `role="alert"` **"Espaço não encontrado."** + **"Ele não existe ou você não tem acesso a ele."** + `<Link>` **"Voltar para o início"**.
    - achado `unit` (inalterado): **"O espaço de documentos da sua unidade."** e o texto "Vazio" da 012. Achado `free`: **"Um espaço livre, de que você é dona."** e, na receita "Vazio", **"Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui."**
    - Foco: lê `useLocation().state?.focusMain` e, com o espaço achado, foca o `<main>` **uma vez** (efeito com ref). `ContentLayout` ganha as props opcionais `ref` (prop comum, `React.Ref<HTMLElement>`) e `tabIndex`, repassadas ao `<main>`; a página passa `tabIndex={-1}`. Nada de `document.getElementById`.
  - Skills: interface-design, routing, error-handling, ui-components
  - Complexidade: média

- [x] T2.5 — Testes da fase 2 e os e2e antigos afetados
  - Arquivos: `apps/web/src/features/spaces/utils/__tests__/space-name-schema.test.ts` (criar); `apps/web/src/features/spaces/api/__tests__/create-space.test.tsx` (criar); `apps/web/src/features/spaces/components/__tests__/sidebar-free-spaces.test.tsx` (criar); `apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx` (criar); `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` (alterar, renomeado em T2.4); `apps/web/src/components/layouts/__tests__/content-layout.test.tsx` (alterar ou criar); `apps/web/src/app/routes/app/__tests__/space.test.tsx` (alterar, renomeado em T2.1)
  - O que fazer (D9): banco falso pelos ajudantes (`seedInstalled`, `addFreeSpace`, `addAssignment`); `userEvent`; localizar por papel e nome acessível em pt_BR; `LAZY_TIMEOUT` declarada em cada arquivo que espera após rota ou `lazy`. Sem espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Casos preexistentes não são renomeados (só textos de asserção que a SPEC mudou: `<h1>` "Espaço" e "Ele não existe ou você não tem acesso a ele.").
    - `space-name-schema.test.ts`: `accepts a trimmed name`; `rejects an empty name with Informe o nome.`; `rejects a name of only spaces`; `rejects a name longer than 120 characters`.
    - `create-space.test.tsx`: `createSpace calls POST spaces and returns the envelope`; `useCreateSpace awaits the spaces invalidation before onSuccess`.
    - `sidebar-free-spaces.test.tsx`: `shows Carregando espaços while loading`; `shows the empty text when the person has no free spaces`; `on error shows the message and Tentar novamente refetches`; `renders only free spaces in the received order with the space href`; `shows the Novo espaço button in every state`; `opening the dialog focuses the Nome field`; `Escape closes the dialog and returns focus to Novo espaço`; `a validation error keeps the dialog open`; `creating notifies Espaço criado and navigates to the space`.
    - `create-space-form.test.tsx`: `a double Enter sends a single request`; `a 500 shows the form alert and keeps the dialog open`; `a 400 from the server shows its message on the Nome field`.
    - `space-view.test.tsx`, casos novos: `shows the free space texts when the space is free`; `focuses the main element when focusMain is in the location state`.
    - `content-layout.test.tsx`: `forwards ref and tabIndex to the main element`.
    - `space.test.tsx` (rota), casos novos: `creating a space from the sidebar opens its page with the name in the heading and the item in the section`; `a space of another owner and an unknown id render the same not found state`.
    - Por mexer em invalidação e em diálogo, rodar `pnpm test:e2e` com os e2e existentes (em especial `apps/web/e2e/tests/unit-spaces.spec.ts`); se algum quebrar, o conserto é no código de produção, nunca no spec.
  - Skills: unit-testing, component-testing, integration-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d` rodando, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e **sem aviso**; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` termina com exit code 0 (os e2e existentes, inclusive `unit-spaces.spec.ts`). `git diff feature/012-unit-spaces -- package.json apps/web/package.json pnpm-lock.yaml` é vazio.
- [x] CA2.2 — Renomeação: `apps/web/src/features/unit-spaces` não existe; `rg -n "unit-spaces|unitSpace|UnitSpaceView|unit-space-view" apps/web/src eslint.config.js` é vazio; `eslint.config.js` tem zona de `import/no-restricted-paths` para `features/spaces`. `apps/web/src/config/paths.ts` tem `space` com `path: '/spaces/:spaceId'` e `getHref` com `encodeURIComponent`; `apps/web/src/app/router.tsx` registra `paths.space.path` com `lazy` para `space.tsx`, sem `Authorization`. `apps/web/src/app/routes/app/unit-space.tsx` não existe e `space.tsx` existe.
- [x] CA2.3 — `apps/web/src/features/spaces/utils/space-name-schema.ts` exporta `spaceNameSchema` com `Informe o nome.` e `O nome pode ter no máximo 120 caracteres.`; `rg -n "features/org-units" apps/web/src/features/spaces` é vazio. `apps/web/src/features/spaces/api/create-space.ts` exporta `createSpaceInputSchema`, `createSpace` (chama `api.post` em `'/spaces'` com `silentError: true`) e `useCreateSpace`, cujo `onSuccess` faz `await` de `invalidateQueries` com `getSpacesQueryOptions().queryKey` antes do `onSuccess` do chamador.
- [x] CA2.4 — `apps/web/src/features/spaces/components/sidebar-free-spaces.tsx` exporta `SidebarFreeSpaces` com retorno `React.JSX.Element`, e contém literalmente `Espaços`, `Carregando espaços…`, `Não foi possível carregar seus espaços.`, `Tentar novamente`, `Você ainda não tem espaços.`, `Novo espaço`, `Um lugar para um grupo de trabalho, um projeto ou uma comissão. Você será a pessoa dona dele.` e `Espaço criado`; tem `<nav aria-label="Espaços">`, filtra `type === 'free'`, usa `NavLink` com `paths.space.getHref`, e o `Button` "Novo espaço" fica fora do `switch`/condicional de estados. O `DialogContent` não está dentro de condicional (`rg -n "open \? |open &&" apps/web/src/features/spaces/components/sidebar-free-spaces.tsx` é vazio); há `onCloseAutoFocus` com `preventDefault()` condicionado à ref de criação e `navigate(..., { state: { focusMain: true } })`. `apps/web/src/app/routes/app/root.tsx` monta `<SidebarFreeSpaces />` entre `<SidebarUnitSpaces />` e `<SidebarAdmin />`.
- [x] CA2.5 — `apps/web/src/features/spaces/components/create-space-form.tsx` contém literalmente `Nome`, `Cancelar`, `Criar espaço`, `Criando…` e `Não foi possível criar o espaço. Tente de novo em instantes.` (dentro de `role="alert"`); usa `autoComplete="off"`, `DialogClose`, um `isSubmittingRef` e `setError('name'` com `shouldFocus: true`.
- [x] CA2.6 — `apps/web/src/features/spaces/components/space-view.tsx` exporta `SpaceView` e contém literalmente `Espaço`, `Carregando o espaço…`, `Não foi possível carregar o espaço.`, `Espaço não encontrado.`, `Ele não existe ou você não tem acesso a ele.`, `Voltar para o início`, `O espaço de documentos da sua unidade.`, `Um espaço livre, de que você é dona.` e `Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui.`; lê `focusMain` de `useLocation().state` e passa `tabIndex={-1}` e `ref` a `ContentLayout`. `apps/web/src/components/layouts/content-layout.tsx` aceita `ref` e `tabIndex` opcionais repassados ao `<main>`, sem `forwardRef`. `rg -n "getElementById|/spaces/\\$\{|api\.get" apps/web/src/features/spaces/components apps/web/src/app/routes/app/space.tsx` é vazio.
- [x] CA2.7 — Acabamento (piso de `interface-design`, lendo o código): a página usa `ContentLayout` com um único `<h1>` e `break-words` no nome; carregando com `role="status"`; erro e não encontrado com `role="alert"`, borda ou fundo de destaque da receita "Erro" e ação estilizada; o aviso de documentos na receita "Vazio"; a seção lateral usa as mesmas classes de "Seção da barra lateral" e "Item da barra lateral" de `SidebarUnitSpaces`; o botão "Novo espaço" é `Button` secundário de largura total com `type="button"`; o diálogo usa `DialogTitle` e `DialogDescription`. `rg -n "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/spaces apps/web/src/app/routes/app/space.tsx apps/web/src/components/layouts/content-layout.tsx` é vazio; nenhuma largura fixa em px nesses arquivos.
- [x] CA2.8 — API simulada: `apps/web/src/testing/mocks/db.ts` exporta `addFreeSpace(ownerId: string, name: string)` com id `space-free-${…}` e `push`; `MockSpace` é união com `type: 'free'`; `listSpacesOf` inclui os `free` do dono. `rg -n "spaces\.push" apps/web/src/testing` devolve só as linhas dentro de `addUnitSpace` e `addFreeSpace`. `apps/web/src/testing/mocks/handlers/spaces.ts` tem `http.post` em `${env.API_URL}/spaces` com `networkDelay()`, `devOverride('spaces')`, `getSignedInPerson()`, validação por `spaceNameSchema` com 400 e resposta 201. `git diff feature/012-unit-spaces -- apps/web/src/testing/mocks/utils.ts` só mexe em linhas de comentário.
- [x] CA2.9 — `pnpm exec vitest run --project web` termina com exit code 0 e existem, pelos nomes de T2.5: em `space-name-schema.test.ts`, `accepts a trimmed name`, `rejects an empty name with Informe o nome.`, `rejects a name of only spaces` e `rejects a name longer than 120 characters`; em `create-space.test.tsx`, `createSpace calls POST spaces and returns the envelope` e `useCreateSpace awaits the spaces invalidation before onSuccess`; em `sidebar-free-spaces.test.tsx`, `shows Carregando espaços while loading`, `shows the empty text when the person has no free spaces`, `on error shows the message and Tentar novamente refetches`, `renders only free spaces in the received order with the space href`, `shows the Novo espaço button in every state`, `opening the dialog focuses the Nome field`, `Escape closes the dialog and returns focus to Novo espaço`, `a validation error keeps the dialog open` e `creating notifies Espaço criado and navigates to the space`; em `create-space-form.test.tsx`, `a double Enter sends a single request`, `a 500 shows the form alert and keeps the dialog open` e `a 400 from the server shows its message on the Nome field`; em `space-view.test.tsx`, `shows the free space texts when the space is free` e `focuses the main element when focusMain is in the location state`; em `content-layout.test.tsx`, `forwards ref and tabIndex to the main element`; em `apps/web/src/app/routes/app/__tests__/space.test.tsx`, `creating a space from the sidebar opens its page with the name in the heading and the item in the section` e `a space of another owner and an unknown id render the same not found state`. Conferir com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/spaces apps/web/src/components/layouts/__tests__ apps/web/src/app/routes/app/__tests__/space.test.tsx`. Os casos da 012 nos arquivos renomeados continuam com os mesmos nomes.
- [x] CA2.10 — Lendo os testes: em `useCreateSpace awaits the spaces invalidation before onSuccess` há asserção de ordem (a invalidação de `['spaces']` terminou antes do `onSuccess`); em `Escape closes the dialog and returns focus to Novo espaço` há `toHaveFocus()` no botão "Novo espaço"; em `a double Enter sends a single request` o contador de pedidos do handler é 1; em `a space of another owner and an unknown id render the same not found state` o espaço de outro dono existe no banco falso (criado por `addFreeSpace`) e o conteúdo renderizado das duas URLs é comparado como igual, com `Espaço não encontrado.`.
- [x] CA2.11 — Cada arquivo de teste desta fase que espera após rota ou `lazy` declara `LAZY_TIMEOUT` e a usa. `rg -n "setTimeout\(|sleep\(|waitForTimeout" apps/web/src/features/spaces apps/web/src/app/routes/app/__tests__/space.test.tsx apps/web/src/components/layouts/__tests__` é vazio. `rg -n "eslint-disable" apps/web/src apps/api/src | rg -v -- "--"` é vazio.
- [x] CA2.12 — Cobertura ≥ 80% de linhas para `apps/web/src/features/spaces/utils/space-name-schema.ts`, `apps/web/src/features/spaces/api/create-space.ts`, `apps/web/src/features/spaces/api/get-spaces.ts`, `apps/web/src/features/spaces/components/sidebar-free-spaces.tsx`, `apps/web/src/features/spaces/components/create-space-form.tsx`, `apps/web/src/features/spaces/components/sidebar-unit-spaces.tsx`, `apps/web/src/features/spaces/components/space-view.tsx`, `apps/web/src/components/layouts/content-layout.tsx`, `apps/web/src/app/routes/app/space.tsx`, `apps/web/src/app/routes/app/root.tsx`, `apps/web/src/config/paths.ts` e `apps/web/src/app/router.tsx`, medida só por `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, sem `--project` e sem filtro de caminho.
- [x] CA2.13 — Intocados: `git diff --stat feature/012-unit-spaces -- apps/web/src/lib apps/web/src/components/ui apps/web/src/components/layouts/app-layout.tsx apps/web/src/components/layouts/sidebar-admin.tsx apps/web/src/app/routes/app/spaces.tsx apps/web/src/features/unit-assignments apps/web/src/testing/setup-tests.ts apps/web/e2e docs/design.md docs/architecture.md` é vazio, e `git status --porcelain -uall` dos mesmos caminhos não lista nada. Os outros handlers falsos (`admin-roles.ts`, `unit-assignments.ts`, `org-units.ts`, `invitations.ts`, `people.ts`, `auth.ts`, `installation.ts` em `apps/web/src/testing/mocks/handlers/`) não aparecem em `git diff --stat feature/012-unit-spaces`.

## Fase 3 — e2e da jornada e documentação: a fatia utilizável de ponta a ponta

Caminhos relativos à raiz do repositório.

- [x] T3.1 — Documentação: arquitetura, receita nova e roadmap
  - Arquivos: `docs/architecture.md` (alterar); `docs/design.md` (alterar); `docs/roadmap.md` (alterar)
  - O que fazer (D10), em pt_BR:
    - `docs/architecture.md` §6: parágrafo novo **"Entrega `free-spaces` (fatia 013)"**: `POST /spaces` no mesmo caminho do `GET`, `SessionGuard` na classe, sem `AdminGuard`; `organizationId` e `ownerId` sempre da sessão; espaço livre visível só ao dono, `isAdmin` não lido; colunas nulas com a restrição de tipo exigindo as três só em FREE (0013 escrita à mão); dono em coluna até a 134; nome repetido aceito até a 137; não encontrado único continua da tela; API simulada cria espaço livre por um helper só; espaço livre não dá acesso a documento (§3). No parágrafo da 012, "a 128" passa a "a primeira rota por id (128/134)" onde cita a rota por id; nada mais é reescrito.
    - `docs/design.md`: receita nova **"Ação da seção da barra lateral"** — botão secundário `mt-2 w-full` logo abaixo do conteúdo da seção, presente em todos os estados — com as classes usadas em `sidebar-free-spaces.tsx`.
    - `docs/roadmap.md`: 013 concluída; dívidas da SPEC registradas (página `/spaces` ainda placeholder, fatia 129; esquema do nome copiado na API e na web).
  - Skills: interface-design
  - Complexidade: baixa

- [x] T3.2 — Testes da fase 3 (e2e: criar um espaço livre só pelo teclado)
  - Arquivos: `apps/web/e2e/tests/free-spaces.spec.ts` (criar)
  - O que fazer (D9): contra a API simulada, estado inicial por `page.addInitScript` com `mock-installation=signed-in`. No topo, `const ROUTE_TIMEOUT = { timeout: 10_000 }`; **toda** espera logo após mudança de rota (`toHaveURL`, primeira visibilidade da tela nova) o recebe; nenhum `waitForTimeout` nem espera fixa. Depois de cada `Tab` e antes do `Enter`, `await expect(locator).toBeFocused()`. `apps/web/e2e/a11y.ts` e os outros specs não são tocados; nenhuma regra do axe é desativada.
    - Caso `the Espaços section shows the empty text and the Novo espaço button`: `navigation` "Espaços" com "Você ainda não tem espaços." e o botão "Novo espaço".
    - Caso `a person creates a free space using only the keyboard`: alcança "Novo espaço" pelo teclado (`toBeFocused()` antes do `Enter`); o diálogo "Novo espaço" abre com o foco no campo "Nome" (`toBeFocused()`); `expectNoSeriousA11yViolations(page)` com o diálogo aberto; envia vazio e vê "Informe o nome."; digita "Projeto Alfa" e envia com `Enter`; `toHaveURL(/\/spaces\//, ROUTE_TIMEOUT)`; `heading` de nível 1 "Projeto Alfa"; o link "Projeto Alfa" na `navigation` "Espaços"; `expectNoSeriousA11yViolations(page)` na página.
    - Caso `closing the dialog with Escape returns focus to Novo espaço`: abre o diálogo, `Escape`, o diálogo some e "Novo espaço" `toBeFocused()`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [x] CA3.1 — `pnpm test:e2e` na raiz termina com exit code 0, e continuam terminando com exit code 0 e **sem aviso**, com `docker compose up -d` e o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.
- [x] CA3.2 — `apps/web/e2e/tests/free-spaces.spec.ts` contém os casos `the Espaços section shows the empty text and the Novo espaço button`, `a person creates a free space using only the keyboard` e `closing the dialog with Escape returns focus to Novo espaço`, e `pnpm --filter web exec playwright test --list` os lista. `git diff --stat feature/012-unit-spaces -- apps/web/e2e` é vazio e `git status --porcelain -uall apps/web/e2e` lista **só** `apps/web/e2e/tests/free-spaces.spec.ts` (nenhum e2e existente alterado, inclusive `unit-spaces.spec.ts`). `rg -n "test\.skip|test\.only|waitForTimeout|disableRules" apps/web/e2e/tests/free-spaces.spec.ts` é vazio.
- [x] CA3.3 — Lendo o spec: `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo e passado em toda asserção logo após mudança de rota; há `toBeFocused()` antes de cada `Enter`; o segundo caso asserta o foco no campo "Nome", o texto "Informe o nome.", o `heading` de nível 1 "Projeto Alfa", o link na `navigation` "Espaços" e chama `expectNoSeriousA11yViolations(page)` duas vezes (diálogo aberto e página); o terceiro asserta `toBeFocused()` no botão "Novo espaço" depois do `Escape`.
- [x] CA3.4 — `docs/architecture.md` tem, na §6, o parágrafo "Entrega `free-spaces` (fatia 013)" com os pontos de T3.1, e o parágrafo da 012 cita "a primeira rota por id (128/134)". `docs/design.md` tem a receita "Ação da seção da barra lateral" e `git diff feature/012-unit-spaces -- docs/design.md` só acrescenta linhas. `docs/roadmap.md` marca a 013 como concluída e registra as duas dívidas.
- [x] CA3.5 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (exit code 0) inclui `POST spaces creates a free space owned by the session person` e `a free space is not listed for an admin who is not the owner`; `pnpm exec vitest run --project web` (exit code 0) inclui `creating a space from the sidebar opens its page with the name in the heading and the item in the section`; `pnpm test:e2e` (exit code 0) inclui os três casos de `free-spaces.spec.ts`.

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
