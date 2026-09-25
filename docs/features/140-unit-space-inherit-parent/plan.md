# PLAN 140 — unit-space-inherit-parent

Branch: `feature/140-unit-space-inherit-parent`, que sai de `develop`.

Fonte: `docs/features/140-unit-space-inherit-parent/spec.md` (D1…D8 são as decisões técnicas da SPEC e R1…R14 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

A administração marca, na página "Estrutura", o espaço de uma unidade com mãe como "Herda da unidade-pai"; quem está lotado na mãe (e, em cadeia, acima enquanto os espaços herdam) passa a ver esse espaço na seção "Unidades" da barra lateral. Fora desta fatia: permissões por pessoa no espaço (141/142), documentos no espaço (127), herança de baixo para cima (016), painel de unidade selecionada.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Onde um critério prova **ausência**, o padrão exige código (não casa com comentário) ou o critério manda ler o arquivo. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Uma migration só, escrita à mão** (`apps/api/prisma/migrations/0014_space_inherits_parent/migration.sql`). Os únicos subcomandos de Prisma permitidos são `prisma validate`, `prisma generate`, `prisma migrate status` e `prisma migrate deploy`, sempre contra `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test`; **nunca** `migrate diff`, `migrate dev` ou `migrate reset`. As migrations `0001…0013` não mudam.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `session_replication_role`).
- O arquivo `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam; nada de rodar `prettier --write` em arquivo inteiro.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); **todo botão nosso é o componente `Button`** de `apps/web/src/components/ui/button/button.tsx`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case; **nenhum import entre features** (a chave `['spaces']` é literal). Textos de tela em pt_BR; código, comentários, caminhos de URL e nomes de teste em en_US.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** novo ou alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Não contam arquivos só de tipos nem os já excluídos pelo `vitest.config.ts` da raiz. Nenhuma exclusão nova.
- **Toda** espera logo após mudança de rota ou chunk `lazy` tem timeout explícito: nos testes da web pela constante `LAZY_TIMEOUT` declarada no arquivo; no e2e pela constante `ROUTE_TIMEOUT = { timeout: 10_000 }` no topo do spec. Nunca `setTimeout`/sleep fixo nem `waitForTimeout`.
- Testes de API de integração e contrato rodam contra o Postgres real (sem mock do Prisma); só os `*.service.test.ts` usam Prisma falso. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`.
- **Escopo por sessão**: `organizationId` e `personId` vêm sempre de `@CurrentPerson()`, nunca do corpo. `isAdmin` **não** é lido em `apps/api/src/spaces`. Escopo de outra organização é provado chamando o **serviço real** com `randomUUID()` como `organizationId` (`Organization.singleton` impede uma segunda organização no banco).
- Intocados de propósito: `apps/web/src/app/routes/app/space.tsx`, `apps/web/src/features/spaces/**`, `apps/api/src/access/**`, `apps/api/src/auth/**`, `apps/api/src/installation/**`, `apps/web/src/components/ui/**`, os formulários de criar e renomear unidade.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: modo de acesso no espaço, `PATCH /org-units/{orgUnitId}/space` e alcance herdado em `GET /spaces`

Caminhos relativos à raiz do repositório.

- [x] T1.1 — Contrato primeiro: `updateOrgUnitSpace` e `OrgUnit.spaceAccess`
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script)
  - O que fazer (D1, R1–R5):
    - Caminho novo `/org-units/{orgUnitId}/space` com `patch`, `operationId: updateOrgUnitSpace`, tag `org-units`, parâmetro de caminho `orgUnitId` (mesmo nome e forma do `PATCH`/`DELETE /org-units/{orgUnitId}`), `requestBody` obrigatório com `UpdateOrgUnitSpaceInput`, respostas **200** (`OrgUnitResponse`) e **400**, **401**, **403**, **404**, **409** (schema `Error`). `description` em pt_BR: muda quem vê o espaço da unidade; `inherit` é recusado na raiz com 409.
    - Schema novo `UpdateOrgUnitSpaceInput`: `type: object`, `required: [access]`, `additionalProperties: false`, `access: { type: string, enum: [own, inherit] }`.
    - `OrgUnit` ganha `spaceAccess: { type: string, enum: [own, inherit] }` em `required`, com descrição "Quem vê o espaço da unidade: só os lotados nela (own) ou também quem vê o espaço da unidade-pai (inherit)".
    - Identidade de caminho conferida à mão: o controller de T1.3 usa `@Controller('org-units')` + `@Patch(':orgUnitId/space')` com `@Param('orgUnitId')`.
    - Regenerar com `pnpm --filter @folioteca/api-contract generate`.
  - Skills: security
  - Complexidade: baixa

- [x] T1.2 — Banco: coluna `inheritsParent` com migration 0014 escrita à mão
  - Arquivos: `apps/api/prisma/migrations/0014_space_inherits_parent/migration.sql` (criar); `apps/api/prisma/schema.prisma` (alterar)
  - O que fazer (D2, R1):
    - `migration.sql`, escrita à mão, com comentários em pt_BR, com exatamente este SQL:
      ```sql
      ALTER TABLE "Space" ADD COLUMN "inheritsParent" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "Space" ADD CONSTRAINT "Space_inherits_parent_unit_check" CHECK ("type" = 'UNIT' OR "inheritsParent" = false);
      ```
    - `schema.prisma`: `Space` ganha `inheritsParent Boolean @default(false)` com comentário `///` dizendo que `true` faz quem vê o espaço da unidade-pai ver também este, e que a restrição "só UNIT herda" vive só na migration.
    - Conferência: `pnpm --filter api exec prisma validate`, `prisma generate`, e `migrate deploy` + `migrate status` no banco de teste. Se `validate` apontar diferença que exigiria outro SQL, o agente para e relata.
  - Skills: security
  - Complexidade: média

- [x] T1.3 — `org-units`: schema do corpo, `setSpaceAccess`, `spaceAccess` nas respostas e rota nova
  - Arquivos: `apps/api/src/org-units/org-units.schema.ts` (alterar); `apps/api/src/org-units/org-units.service.ts` (alterar); `apps/api/src/org-units/org-units.controller.ts` (alterar)
  - O que fazer (D3, R3, R4):
    - `org-units.schema.ts`: `updateOrgUnitSpaceSchema = z.strictObject({ access: z.enum(['own', 'inherit'], { error: 'Escolha o modo de acesso.' }) }, { error: 'Campo não permitido.' })`.
    - `org-units.service.ts`: função local `toOrgUnit` que mapeia a linha (com `space: { select: { inheritsParent: true } }`) para o `OrgUnit` do contrato, com `spaceAccess: space?.inheritsParent === true ? 'inherit' : 'own'`; `list`, `create` e `rename` passam a usá-la. Método novo `setSpaceAccess(organizationId: string, orgUnitId: string, body: unknown): Promise<OrgUnitResponse>`, nesta ordem: `isUuid(orgUnitId)` senão 404 "Unidade não encontrada." → `orgUnit.findFirst({ where: { id: orgUnitId, organizationId } })` senão o mesmo 404 → `parseBody(updateOrgUnitSpaceSchema, body)` → se `access === 'inherit'` e `parentId === null`, `ConflictException('A unidade raiz não tem unidade-pai.')` → `space.update({ where: { orgUnitId }, data: { inheritsParent: access === 'inherit' } })` → devolve `{ data: toOrgUnit(...) }`. Idempotente (marcar o modo atual devolve 200).
    - `org-units.controller.ts`: `@Patch(':orgUnitId/space')` com `@CurrentPerson() person`, `@Param('orgUnitId') orgUnitId: string`, `@Body() body: unknown`, chamando `setSpaceAccess(person.organizationId, orgUnitId, body)`. Guards **só na classe** (`SessionGuard, AdminGuard`, intocados).
  - Skills: security
  - Complexidade: média

- [x] T1.4 — `SpacesService.list` resolve o alcance herdado em memória
  - Arquivos: `apps/api/src/spaces/spaces.service.ts` (alterar)
  - O que fazer (D4, R4, R6–R10):
    - Duas consultas em `Promise.all`: (a) os FREE da dona, como hoje (`{ type: 'FREE', organizationId, ownerId: personId }`); (b) `orgUnit.findMany({ where: { organizationId }, select: { id: true, parentId: true, name: true, space: { select: { id: true, inheritsParent: true } }, assignments: { where: { personId }, select: { personId: true } } } })`.
    - Em memória: `byId: Map`; `reaches(u) = u.assignments.length > 0 || (u.space?.inheritsParent === true && u.parentId !== null && reaches(pai))`, **iterativo** (sobe pelos pais empilhando os não resolvidos e resolve na volta), memorizado em `Map<string, boolean>`, com `Set` de visitados: um nó revisitado na mesma subida (ciclo) conta como `false`. Todo espaço de unidade com `reaches` vira `{ id: space.id, type: 'unit', name }` (unidade sem espaço é ignorada); junta aos FREE; mesma ordenação pt-BR com desempate por `id`. Um item por unidade (R8).
    - `isAdmin`, `$queryRaw` e `$transaction` não entram no arquivo.
  - Skills: authorization
  - Complexidade: alta

- [x] T1.5 — Testes da fase 1
  - Arquivos: `apps/api/src/spaces/__tests__/spaces.service.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.contract.test.ts` (alterar); `apps/api/src/org-units/__tests__/org-units.service.test.ts` (alterar); `apps/api/src/org-units/__tests__/org-units.schema.test.ts` (alterar); `apps/api/src/org-units/__tests__/org-units.integration.test.ts` (alterar); `apps/api/src/org-units/__tests__/org-units.contract.test.ts` (alterar)
  - O que fazer (D8): integração e contrato contra o Postgres real com `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes; `apps/api/test/**` não muda. Casos preexistentes cujo `where`/Prisma falso muda por T1.4 são ajustados **sem trocar o nome**.
    - `spaces.service.test.ts`: `list shows a child unit space that inherits to a person assigned to the parent`; `list follows the inheritance chain while spaces inherit`; `list stops the chain at the first own space`; `list ignores inherit on a root unit`; `list treats a parent cycle as not reaching`; `list returns each unit space once when reached twice`.
    - `spaces.integration.test.ts`: `a person assigned to the parent sees the inheriting child space`; `a person assigned to the grandparent sees parent and child when both inherit`; `switching the parent back to own hides parent and child from the grandparent person but keeps the child for the parent person`; `a person assigned to parent and child sees the child space once`; `removing the parent assignment removes the inherited space`; `an admin without assignment sees no unit space after changing the access mode`; `deleting an inheriting child removes it from the list of who inherited it`; `list with another organization id returns nothing` (chama `SpacesService.list(randomUUID(), personId)` do serviço real).
    - `spaces.contract.test.ts`: `GET spaces with an inherited unit space matches the documented 200`.
    - `org-units.schema.test.ts`: `updateOrgUnitSpaceSchema accepts own and inherit`; `updateOrgUnitSpaceSchema rejects a missing access with Escolha o modo de acesso.`; `updateOrgUnitSpaceSchema rejects an unknown value`; `updateOrgUnitSpaceSchema rejects extra fields with Campo não permitido.`.
    - `org-units.service.test.ts`: `setSpaceAccess answers 404 for a malformed id`; `setSpaceAccess answers 409 for inherit on the root`; `setSpaceAccess updates inheritsParent by orgUnitId`; `list maps the space inheritsParent to spaceAccess`.
    - `org-units.integration.test.ts`: `PATCH org-units space sets inherit and GET reflects it`; `PATCH org-units space sets own back`; `PATCH org-units space is idempotent`; `PATCH org-units space answers 409 on the root with A unidade raiz não tem unidade-pai.`; `PATCH org-units space rejects an empty body with 400`; `PATCH org-units space rejects an invalid value with 400`; `PATCH org-units space rejects extra fields with 400`; `PATCH org-units space answers 404 for an unknown id`; `PATCH org-units space answers 404 for a malformed id`; `setSpaceAccess with another organization id answers 404` (serviço real, `randomUUID()`); `PATCH org-units space answers 403 to a non-admin`; `PATCH org-units space answers 401 without session`; `the database rejects inheritsParent on a FREE space` (inserção direta pelo Prisma, esperando a falha de `Space_inherits_parent_unit_check`).
    - `org-units.contract.test.ts`: `PATCH org-units space answers the documented 200`, `… 400`, `… 403`, `… 404`, `… 409`; `GET org-units returns spaceAccess in each unit`.
  - Skills: unit-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [x] CA1.2 — `packages/api-contract/openapi.yaml` tem o caminho `/org-units/{orgUnitId}/space:` com `patch`, `operationId: updateOrgUnitSpace`, parâmetro `orgUnitId`, `requestBody` com `$ref` para `UpdateOrgUnitSpaceInput`, e respostas exatamente `200` (`OrgUnitResponse`), `400`, `401`, `403`, `404`, `409` (`Error`). `UpdateOrgUnitSpaceInput` tem `required: [access]`, `additionalProperties: false` e `access` com `enum: [own, inherit]`; `OrgUnit` tem `spaceAccess` em `required` com `enum: [own, inherit]`. `rg -n "updateOrgUnitSpace|UpdateOrgUnitSpaceInput|spaceAccess" packages/api-contract/src/generated/openapi.d.ts` encontra os três.
- [x] CA1.3 — `apps/api/src/org-units/org-units.controller.ts` tem `@Patch(':orgUnitId/space')` com `@Param('orgUnitId')` chamando `setSpaceAccess(person.organizationId, orgUnitId, body)`; `rg -n "@UseGuards" apps/api/src/org-units/org-units.controller.ts` devolve exatamente uma ocorrência, acima da classe, com `SessionGuard` e `AdminGuard`.
- [x] CA1.4 — Existe `apps/api/prisma/migrations/0014_space_inherits_parent/migration.sql` com `ADD COLUMN "inheritsParent" BOOLEAN NOT NULL DEFAULT false` e `ADD CONSTRAINT "Space_inherits_parent_unit_check" CHECK ("type" = 'UNIT' OR "inheritsParent" = false)`; `ls apps/api/prisma/migrations` lista só `0001…0014` e `migration_lock.toml`. `apps/api/prisma/schema.prisma` tem `inheritsParent Boolean @default(false)` em `Space` com comentário `///`. `pnpm --filter api exec prisma validate` sai com 0 e `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test pnpm --filter api exec prisma migrate status` reporta o banco em dia.
- [x] CA1.5 — `apps/api/src/org-units/org-units.schema.ts` exporta `updateOrgUnitSpaceSchema` (`z.strictObject`) com os textos literais `Escolha o modo de acesso.` e `Campo não permitido.`. `apps/api/src/org-units/org-units.service.ts` tem `setSpaceAccess(organizationId: string, orgUnitId: string, body: unknown)`, o texto `A unidade raiz não tem unidade-pai.` numa `ConflictException`, `space.update` com `where: { orgUnitId }`, e uma função `toOrgUnit` usada por `list`, `create`, `rename` e `setSpaceAccess`.
- [x] CA1.6 — `apps/api/src/spaces/spaces.service.ts`, lido: `list` faz `Promise.all` com a consulta FREE da dona e `orgUnit.findMany({ where: { organizationId }, … })` com `assignments: { where: { personId } }`; resolve o alcance sem recursão de função (laço com pilha), com `Map` de memória e `Set` de visitados. `rg -n "^\s*[^/*].*\b(isAdmin|\$queryRaw|\$transaction)\b" apps/api/src/spaces --glob '!**/__tests__/**'` é vazio.
- [x] CA1.7 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/spaces/__tests__ apps/api/src/org-units/__tests__`, todos os casos nomeados em T1.5 (`spaces.service.test.ts`: 6; `spaces.integration.test.ts`: 8; `spaces.contract.test.ts`: 1; `org-units.schema.test.ts`: 4; `org-units.service.test.ts`: 4; `org-units.integration.test.ts`: 13; `org-units.contract.test.ts`: 6), com os nomes literais de T1.5. `rg -n "vi\.mock\(.*prisma" apps/api/src/spaces/__tests__/spaces.integration.test.ts apps/api/src/org-units/__tests__/org-units.integration.test.ts` é vazio.
- [x] CA1.8 — Lendo os testes: `list with another organization id returns nothing` e `setSpaceAccess with another organization id answers 404` chamam o serviço real (instância ligada ao Prisma de teste) com `randomUUID()` como `organizationId`, sobre dados que existem na organização da instalação; `the database rejects inheritsParent on a FREE space` espera rejeição do banco; `rg -n "DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role" apps/api/src apps/api/test` é vazio.
- [x] CA1.9 — `rg -n "setTimeout\(|sleep\(" apps/api/src/spaces apps/api/src/org-units` é vazio; `rg -n "eslint-disable" apps/api/src | rg -v -- "--"` é vazio.
- [x] CA1.10 — Cobertura ≥ 80% de linhas para `apps/api/src/spaces/spaces.service.ts`, `apps/api/src/org-units/org-units.schema.ts`, `apps/api/src/org-units/org-units.service.ts` e `apps/api/src/org-units/org-units.controller.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: botão "Acesso ao espaço" na "Estrutura", diálogo com os dois modos e a barra lateral seguindo a herança

Caminhos relativos à raiz do repositório. A ordem importa: API simulada e mutação antes da tela.

- [x] T2.1 — API simulada com `spaceAccess` e herança, e a mutação `useUpdateOrgUnitSpace`
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/org-units.ts` (alterar); `apps/web/src/features/org-units/api/update-org-unit-space.ts` (criar); `apps/web/src/types/api.ts` (alterar, só se o arquivo reexporta tipos do contrato: acrescenta `SpaceAccess`)
  - O que fazer (D5, D7, R5, R9, R10):
    - `db.ts`: unidade simulada ganha `spaceAccess: 'own' | 'inherit'` (padrão `'own'`, e assim devolvida pelos helpers existentes); `setOrgUnitSpaceAccess(id: string, access: 'own' | 'inherit')`; `listSpacesOf(personId)` aplica o mesmo `reaches` de T1.4 (lotação direta, ou herda com mãe que alcança; raiz não herda; ciclo conta como falso).
    - `handlers/org-units.ts`: `http.patch(\`${env.API_URL}/org-units/:orgUnitId/space\`)` com o mesmo preâmbulo dos outros handlers do arquivo (`networkDelay()`, `devOverride('org-units')`, 401, 403) e as respostas 404 "Unidade não encontrada.", 400 (corpo inválido), 409 "A unidade raiz não tem unidade-pai." e 200 `{ data }`; `GET`/`POST`/`PATCH` devolvem `spaceAccess`.
    - `update-org-unit-space.ts`: `updateOrgUnitSpace({ orgUnitId, access }: { orgUnitId: string; access: 'own' | 'inherit' })` → `api.patch(\`/org-units/${orgUnitId}/space\`, { access }, { silentError: true })`; `useUpdateOrgUnitSpace({ mutationConfig })` cujo `onSuccess` **aguarda** `invalidateQueries` de `['org-units']` e de `{ queryKey: ['spaces'] }` (chave literal, como `features/unit-assignments/api/assign-person.ts`) e só então chama o `onSuccess` do chamador.
  - Skills: api-mocking, api-requests
  - Complexidade: média

- [x] T2.2 — Controle "Acesso ao espaço" e o botão na linha da árvore
  - Arquivos: `apps/web/src/features/org-units/components/space-access-control.tsx` (criar); `apps/web/src/features/org-units/components/org-units-tree.tsx` (alterar)
  - O que fazer (D6, Interface, R2, R3, R5, R13, R14). Aparência pelo `docs/design.md` e pelo piso de `interface-design`, com as receitas "Ações do nó da árvore", "Botão só com ícone", "Diálogo de formulário", "Alerta dentro de formulário", "Notificação", "Botão secundário" e a receita **nova** "Escolha entre opções (rádios)" (fieldset com legenda; cada opção um rótulo com borda, respiro, destaque quando marcada e foco visível; rádio nativo; desabilitado esmaecido) — registrada no `docs/design.md` na fase 3:
    - `org-units-tree.tsx`: nas linhas das unidades **com mãe**, depois de "Apagar", um botão de ícone (cadeado, ícone local como os outros do arquivo) com `aria-label` e `title` **"Acesso ao espaço de {nome da unidade}"**; na raiz não aparece. `DialogState.mode` ganha `'space-access'`; o `Dialog` único da árvore mostra, nesse modo, título **"Acesso ao espaço"**, descrição **"Quem vê o espaço de “{nome}”."**, o `SpaceAccessControl` e o rodapé com `Button` secundário **"Fechar"** (`DialogClose`). Fecha por "Fechar", `Esc` ou clique fora; o foco volta ao botão que abriu (padrão do Radix).
    - `space-access-control.tsx`: `SpaceAccessControl({ unit, parentName }: { unit: OrgUnit; parentName: string }): React.JSX.Element`. `<fieldset>` com `<legend>` **"Modo de acesso"** e dois `<input type="radio">` nativos com o mesmo `name`, rótulos **"Permissões próprias"** e **"Herda da unidade-pai"**. Valor marcado = `mutation.isPending ? mutation.variables.access : unit.spaceAccess` (volta sozinho no erro); rádios `disabled` durante o envio; `onChange` só chama `mutate` se o valor mudou e não há envio em curso. Frase em `<p aria-live="polite">`: próprias **"Só quem está lotado em “{nome}” vê este espaço."**; herda **"Quem está lotado em “{nome}” e quem vê o espaço de “{nome da mãe}” vê este espaço."**; durante o envio acrescenta **"Salvando…"** no fim. Sucesso: notificação **"Acesso ao espaço atualizado"**. Falha: `role="alert"` **"Não foi possível mudar o acesso ao espaço. Tente de novo em instantes."**. A 360px as opções empilham, texto com `break-words`, rodapé com `flex-wrap`.
  - Skills: interface-design, component-robustness, error-handling, client-state
  - Complexidade: alta

- [x] T2.3 — Testes da fase 2 e os e2e antigos
  - Arquivos: `apps/web/src/features/org-units/api/__tests__/update-org-unit-space.test.tsx` (criar); `apps/web/src/features/org-units/components/__tests__/space-access-control.test.tsx` (criar); `apps/web/src/features/org-units/components/__tests__/org-units-tree.test.tsx` (alterar); `apps/web/src/app/routes/app/admin/__tests__/structure.test.tsx` (alterar); testes que montam `OrgUnit` literal (alterar, ganham `spaceAccess: 'own'`): `apps/web/src/features/org-units/components/__tests__/rename-org-unit-form.test.tsx`, `apps/web/src/features/org-units/api/__tests__/update-org-unit.test.tsx`, `apps/web/src/features/org-units/api/__tests__/create-org-unit.test.tsx` e qualquer outro que `pnpm typecheck` apontar
  - O que fazer (D8): banco falso pelos ajudantes; `userEvent`; localizar por papel e nome acessível em pt_BR; `LAZY_TIMEOUT` em cada arquivo que espera após rota ou `lazy`; sem espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Casos preexistentes não são renomeados.
    - `update-org-unit-space.test.tsx`: `updateOrgUnitSpace sends PATCH to the unit space with the access body`; `useUpdateOrgUnitSpace invalidates org-units and spaces before onSuccess`.
    - `space-access-control.test.tsx`: `checks the option of the current access mode and shows its sentence`; `choosing Herda da unidade-pai sends inherit`; `disables the options and shows Salvando while sending`; `a failure restores the previous option and shows the alert`; `arrow keys move between the options`; `choosing the checked option sends nothing`.
    - `org-units-tree.test.tsx`: `the root has no space access button`; `each child unit has the Acesso ao espaço button`; `the space access button opens the Acesso ao espaço dialog`; `Escape closes the space access dialog and returns focus to the button`.
    - `structure.test.tsx`: `switching a child to inherit shows its space in the sidebar of the person assigned to the parent` (sessão lotada na mãe no banco falso; o item aparece na `navigation` "Unidades").
    - Rodar `pnpm test:e2e` com **todos** os e2e existentes; se algum quebrar, o conserto é no código de produção, nunca no spec.
  - Skills: unit-testing, component-testing, integration-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` (todos os e2e existentes) sai com 0.
- [x] CA2.2 — `apps/web/src/features/org-units/api/update-org-unit-space.ts` exporta `updateOrgUnitSpace` (chama `api.patch` em `` `/org-units/${orgUnitId}/space` `` com `{ access }` e `silentError: true`) e `useUpdateOrgUnitSpace`, cujo `onSuccess` faz `await` da invalidação de `['org-units']` e de `['spaces']` antes do `onSuccess` do chamador. `rg -n "from '@/features/(?!org-units)" -P apps/web/src/features/org-units` é vazio.
- [x] CA2.3 — `apps/web/src/features/org-units/components/space-access-control.tsx` exporta `SpaceAccessControl` com retorno `React.JSX.Element`; tem `<fieldset>`, `<legend>`, dois `type="radio"`, `aria-live="polite"` e `role="alert"`, e contém literalmente `Modo de acesso`, `Permissões próprias`, `Herda da unidade-pai`, `vê este espaço.`, `Salvando…`, `Acesso ao espaço atualizado` e `Não foi possível mudar o acesso ao espaço. Tente de novo em instantes.`; o valor marcado deriva de `isPending`/`variables` e de `unit.spaceAccess`.
- [x] CA2.4 — `apps/web/src/features/org-units/components/org-units-tree.tsx` contém `'space-access'`, `Acesso ao espaço de`, `Acesso ao espaço`, `Quem vê o espaço de` e `Fechar`; o botão novo é `Button` com `aria-label`, `title` e `type="button"`, desenhado só quando a unidade tem `parentId`.
- [x] CA2.5 — Acabamento (piso de `interface-design`, lendo o código): o diálogo usa `DialogTitle` e `DialogDescription`; cada opção é um `<label>` com borda, respiro interno, destaque quando marcada (`has-[:checked]`) e foco visível (`has-[:focus-visible]`), com estilo de desabilitado; o alerta usa a receita "Alerta dentro de formulário" (fundo ou borda de destaque); textos com `break-words`; rodapé com `flex-wrap`. `rg -n "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/org-units/components/space-access-control.tsx apps/web/src/features/org-units/components/org-units-tree.tsx` é vazio; nenhuma largura fixa em px nesses arquivos.
- [x] CA2.6 — API simulada: `apps/web/src/testing/mocks/db.ts` exporta `setOrgUnitSpaceAccess(id: string, access: 'own' | 'inherit')` e a unidade simulada tem `spaceAccess`; `listSpacesOf` considera `spaceAccess === 'inherit'` subindo pelos pais. `apps/web/src/testing/mocks/handlers/org-units.ts` tem `http.patch` em `${env.API_URL}/org-units/:orgUnitId/space` com `networkDelay()`, `devOverride('org-units')` e as respostas 400, 401, 403, 404, 409 (`A unidade raiz não tem unidade-pai.`) e 200.
- [x] CA2.7 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/org-units apps/web/src/app/routes/app/admin/__tests__/structure.test.tsx`: `updateOrgUnitSpace sends PATCH to the unit space with the access body`, `useUpdateOrgUnitSpace invalidates org-units and spaces before onSuccess`, `checks the option of the current access mode and shows its sentence`, `choosing Herda da unidade-pai sends inherit`, `disables the options and shows Salvando while sending`, `a failure restores the previous option and shows the alert`, `arrow keys move between the options`, `choosing the checked option sends nothing`, `the root has no space access button`, `each child unit has the Acesso ao espaço button`, `the space access button opens the Acesso ao espaço dialog`, `Escape closes the space access dialog and returns focus to the button` e `switching a child to inherit shows its space in the sidebar of the person assigned to the parent`.
- [x] CA2.8 — Lendo os testes: `useUpdateOrgUnitSpace invalidates org-units and spaces before onSuccess` assere a ordem (as duas invalidações terminaram antes do `onSuccess`); `a failure restores the previous option and shows the alert` assere o rádio "Permissões próprias" marcado de novo e o texto do alerta; `Escape closes the space access dialog and returns focus to the button` tem `toHaveFocus()` no botão "Acesso ao espaço de …"; `switching a child to inherit shows its space in the sidebar of the person assigned to the parent` assere a ausência do item antes e a presença depois.
- [x] CA2.9 — `rg -n "setTimeout\(|sleep\(|waitForTimeout" apps/web/src/features/org-units apps/web/src/app/routes/app/admin/__tests__/structure.test.tsx` é vazio; `rg -n "eslint-disable" apps/web/src | rg -v -- "--"` é vazio.
- [x] CA2.10 — Cobertura ≥ 80% de linhas para `apps/web/src/features/org-units/api/update-org-unit-space.ts`, `apps/web/src/features/org-units/components/space-access-control.tsx` e `apps/web/src/features/org-units/components/org-units-tree.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e da jornada e documentação: a fatia utilizável de ponta a ponta

- [x] T3.1 — Documentação: receita nova e arquitetura
  - Arquivos: `docs/design.md` (alterar); `docs/architecture.md` (alterar)
  - O que fazer, em pt_BR, só acrescentando linhas:
    - `docs/design.md`, em "Padrões acrescentados pelas entregas": receita **"Escolha entre opções (rádios)"** (fatia 140) com as classes usadas em `space-access-control.tsx`.
    - `docs/architecture.md` §3/§6: parágrafo **"Entrega `unit-space-inherit-parent` (fatia 140)"**: quem vê espaço de unidade = lotação direta + herança de cima para baixo enquanto os espaços herdam, resolvida em memória a cada `GET /spaces`; o modo mora no espaço (`inheritsParent`, restrição só-UNIT na 0014 escrita à mão); `PATCH /org-units/{orgUnitId}/space` sob `AdminGuard`, 409 na raiz; administração não ganha acesso por mudar o modo; espaço continua sem dar acesso a documento.
  - Skills: interface-design
  - Complexidade: baixa

- [x] T3.2 — Testes da fase 3 (e2e: herdar e voltar só pelo teclado)
  - Arquivos: `apps/web/e2e/tests/unit-space-inherit-parent.spec.ts` (criar)
  - O que fazer (D8): API simulada, sessão de administração lotada na mãe (estado inicial por `page.addInitScript`, como os specs existentes). `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo, usado em toda espera após mudança de rota; `toBeFocused()` antes de cada `Enter`/`Space`; nenhum `waitForTimeout`; nenhuma regra do axe desativada; outros specs e `apps/web/e2e/a11y.ts` intocados.
    - `the root unit has no space access button`.
    - `an admin makes a child space inherit using only the keyboard`: alcança "Acesso ao espaço de {filha}", abre o diálogo "Acesso ao espaço", `expectNoSeriousA11yViolations(page)` com o diálogo aberto, escolhe "Herda da unidade-pai" por teclado, vê a frase "Quem está lotado em …", fecha, vê o link da filha na `navigation` "Unidades" e abre a página (`heading` nível 1 com o nome, `ROUTE_TIMEOUT`).
    - `switching back to Permissões próprias removes the space from the sidebar`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [x] CA3.1 — `pnpm test:e2e` na raiz sai com 0 (os e2e antigos e os novos), e `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` continuam saindo com 0 e sem aviso, com o cache do `tsc` limpo.
- [x] CA3.2 — `apps/web/e2e/tests/unit-space-inherit-parent.spec.ts` contém os casos `the root unit has no space access button`, `an admin makes a child space inherit using only the keyboard` e `switching back to Permissões próprias removes the space from the sidebar`, e `pnpm --filter web exec playwright test --list` os lista. `rg -n "test\.skip|test\.only|waitForTimeout|disableRules" apps/web/e2e/tests/unit-space-inherit-parent.spec.ts` é vazio.
- [x] CA3.3 — Lendo o spec: `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo, passado em toda asserção após mudança de rota; `toBeFocused()` antes de cada tecla de ação; `expectNoSeriousA11yViolations(page)` com o diálogo aberto; o segundo caso assere o link na `navigation` "Unidades" e o `heading` de nível 1; o terceiro assere que o link sumiu.
- [x] CA3.4 — `docs/design.md` tem a receita "Escolha entre opções (rádios)" com `has-[:checked]`; `docs/architecture.md` tem o parágrafo "Entrega `unit-space-inherit-parent` (fatia 140)" citando `inheritsParent`, `PATCH /org-units/{orgUnitId}/space` e a resolução a cada `GET /spaces`.
- [x] CA3.5 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `a person assigned to the parent sees the inheriting child space`; `pnpm exec vitest run --project web` (0) inclui `switching a child to inherit shows its space in the sidebar of the person assigned to the parent`; `pnpm test:e2e` (0) inclui os três casos de `unit-space-inherit-parent.spec.ts`.

## DoD da entrega

- [x] DoD1 — Todas as tarefas e critérios do plano marcados
- [x] DoD2 — Suíte de testes inteira passa
- [x] DoD3 — Lint do projeto inteiro sem erros nem avisos
- [x] DoD4 — Tipos de todos os `tsconfig` sem erros
- [x] DoD5 — Console dos testes sem erro nem aviso
- [x] DoD6 — `build` passa
- [x] DoD7 — Nenhum import entre features nem contra o fluxo compartilhado → features → app
- [x] DoD8 — Nenhum `console.log`, `TODO`, `// @debug`, `.only(` ou `.skip(` no diff da branch
- [x] DoD9 — Nenhuma worktree ou branch temporária sobrando
