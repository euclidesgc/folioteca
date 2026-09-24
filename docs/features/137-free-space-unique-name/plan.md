# PLAN 137 — free-space-unique-name

Branch: `feature/137-free-space-unique-name`

Fonte: `docs/features/137-free-space-unique-name/spec.md` (D1…D5 são as decisões técnicas da SPEC e R1…R10 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

A mesma pessoa não pode ser dona de dois espaços livres (`type = 'FREE'`) com o mesmo nome, comparado sem diferenciar maiúsculas de minúsculas depois de aparar as pontas. Acento e espaço interno contam como diferença. Outra pessoa pode usar o mesmo nome; espaços pessoais e de unidade não entram na regra. A recusa é `409` com a mensagem `Você já tem um espaço com esse nome.`, mostrada no campo "Nome" do diálogo "Novo espaço".

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase, inclusive de quem só escreve testes, rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`. Se a suíte inteira (`pnpm test` ou `pnpm test:e2e`) falhar num teste **antigo** e alheio a esta fatia, o critério permite repetir o comando **uma** vez; a segunda execução tem de sair com 0.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Onde um critério prova **ausência**, o `rg` fica restrito aos arquivos criados ou alterados pela fase e o padrão casa código, não comentário. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Uma única migration nova**, `apps/api/prisma/migrations/0017_free_space_owner_name_uniqueness/migration.sql`, **escrita à mão** com o SQL exato de T1.1. Os únicos subcomandos de Prisma permitidos são `prisma validate`, `prisma generate`, `prisma migrate status` e `prisma migrate deploy`, sempre contra `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test`; **nunca** `migrate diff`, `migrate dev` ou `migrate reset` (o índice por expressão apareceria como "drift", como o da `0007`).
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP INDEX`, `DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `session_replication_role`).
- O arquivo `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam; nada de `prettier --write` em arquivo inteiro.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; imports absolutos com `@/` na web; sem barrel files; nenhum import entre features. Textos de tela em pt_BR; código, comentários, caminhos e nomes de teste em en_US.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, sem `--project` e sem filtro de caminho. Nenhuma exclusão nova.
- Testes de integração e contrato da API rodam contra o Postgres real (sem mock do Prisma); só os `*.service.test.ts` usam Prisma falso. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`.
- **Escopo por sessão**: `organizationId` e `ownerId` vêm de `@CurrentPerson()`, nunca do corpo. "Outro dono" é provado com uma segunda pessoa real no banco, pela API e pelo serviço real.
- No e2e, a **primeira** asserção após mudança de rota usa `const ROUTE_TIMEOUT = { timeout: 10_000 }` declarada no topo do spec; asserção seguinte com timeout maior é aceita. `toBeFocused()` antes de **cada** tecla de ação (`Enter`, `Space`, `Escape`). Nunca `setTimeout`/sleep fixo nem `waitForTimeout`.
- Teste existente que afirma a regra antiga é **substituído** por um caso novo com nome novo e registrado em "Desvios previstos" no fim do plano; nenhum outro teste existente é renomeado ou apagado. Os testes da fatia 065 (`apps/api/src/org-units/__tests__/**`) passam **sem edição**.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: `POST /spaces` recusa nome repetido do mesmo dono com 409

Ao fim da fase, pela API, a mesma pessoa que cria "Projeto Alfa" e depois "projeto alfa " recebe `201` e depois `409` `Você já tem um espaço com esse nome.`; outra pessoa cria "Projeto Alfa" com `201`; o banco garante a regra mesmo em corrida.

- [ ] T1.1 — Índice único parcial no banco e `isUniqueViolation` compartilhado
  - Arquivos: `apps/api/prisma/migrations/0017_free_space_owner_name_uniqueness/migration.sql` (criar); `apps/api/prisma/schema.prisma` (alterar); `apps/api/src/common/is-unique-violation.ts` (criar); `apps/api/src/org-units/org-units.service.ts` (alterar)
  - O que fazer (D1, D3, R2, R3, R6, R7):
    - `migration.sql`, à mão, com um comentário SQL em en_US explicando a regra e exatamente este comando, sem limpeza de dados:
      `CREATE UNIQUE INDEX "Space_free_owner_name_key" ON "Space" ("ownerId", lower("name")) WHERE "type" = 'FREE';`
    - `schema.prisma`: só um comentário `///` no `model Space` dizendo que a unicidade `(ownerId, lower(name))` dos espaços `FREE` vive só na migration `0017` (índice `Space_free_owner_name_key`). Nenhum campo, `@@unique` ou `@@index` muda.
    - `common/is-unique-violation.ts`: exporta `UNIQUE_VIOLATION = 'P2002'` e `isUniqueViolation(error: unknown): boolean`, com o mesmo corpo da função local de `org-units.service.ts`.
    - `org-units.service.ts`: importa `isUniqueViolation` de `common/is-unique-violation`, remove a função e a constante locais; comportamento idêntico. `unit-assignments`, `invitations` e `favorites` ficam como estão (dívida).
  - Skills: —
  - Complexidade: média

- [ ] T1.2 — `SpacesService.create` recusa com 409 e contrato documenta
  - Arquivos: `apps/api/src/spaces/spaces.service.ts` (alterar); `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script)
  - O que fazer (D2, D4, R1, R4, R8):
    - `spaces.service.ts`: constante `DUPLICATE_NAME_MESSAGE = 'Você já tem um espaço com esse nome.'`. Em `create`, antes de gravar: `this.prisma.space.findFirst({ where: { type: 'FREE', ownerId, name: { equals: name, mode: 'insensitive' } }, select: { id: true } })`; achou → `throw new ConflictException(DUPLICATE_NAME_MESSAGE)`. O `create` do Prisma fica em `try/catch`: `isUniqueViolation(error)` → o mesmo `ConflictException(DUPLICATE_NAME_MESSAGE)`; outro erro é relançado. O nome já chega aparado por `createSpaceSchema`; nada de normalizar acento ou espaço interno. Assinatura de `create` e o formato do `201` não mudam.
    - `openapi.yaml`, em `POST /spaces`: resposta `"409"` com o schema `Error` e descrição "Você já tem um espaço livre com esse nome."; a `description` da operação deixa de dizer que o nome "não precisa ser único" e passa a dizer que o nome é único por dono entre os espaços livres, sem diferenciar maiúsculas de minúsculas. Regenerar com `pnpm --filter @folioteca/api-contract generate`.
  - Skills: error-handling
  - Complexidade: alta

- [ ] T1.3 — Testes da fase 1
  - Arquivos: `apps/api/src/spaces/__tests__/spaces.service.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.contract.test.ts` (alterar)
  - O que fazer: integração contra o Postgres real com os ajudantes existentes (`postSpace`, `createMember`, `adminCookie`); serviço com Prisma falso.
    - `spaces.service.test.ts`: `create throws ConflictException when the owner already has a FREE space with the name` (o `findFirst` recebe `type: 'FREE'`, `ownerId` e `name: { equals, mode: 'insensitive' }`; `create` não é chamado); `create turns a P2002 from the database into the same ConflictException` (falso `create` lança erro com `code: 'P2002'`); `create rethrows an error that is not a unique violation`.
    - `spaces.integration.test.ts`: **substitui** `POST spaces accepts two spaces with the same name from the same owner` (DV1) por `POST spaces answers 409 to a second space with the same name from the same owner` (corpo com `message` `Você já tem um espaço com esse nome.`, contagem continua 1). Acrescenta: `POST spaces answers 409 when the name differs only in case and outer spaces` ("Projeto Alfa" e depois " PROJETO alfa "); `POST spaces accepts a name that differs only by an accent` ("Projeto Alfa" e "Projeto Álfa" → dois 201); `POST spaces accepts a name that differs only by inner spaces` ("Projeto Alfa" e "Projeto  Alfa" → dois 201); `POST spaces accepts the same name from a different owner` (admin e um membro criado por `createMember`, ambos 201); `POST spaces accepts a free space with the name of an existing unit space of the owner` (espaço `UNIT` com o nome já no banco → 201); `two parallel POST spaces with the same name give one 201 and one 409` (`Promise.all` de dois `postSpace`; exatamente um 201 e um 409; contagem 1); `the database rejects a duplicate free space name through Space_free_owner_name_key` (`prisma.space.create` direto, sem passar pelo serviço, com o mesmo `ownerId`, `type: 'FREE'` e o nome em outra caixa; espera `Prisma.PrismaClientKnownRequestError` com `code` `P2002` e `meta.target` ou a mensagem citando `Space_free_owner_name_key`); `the database accepts the same name for another owner` (`prisma.space.create` direto com outro `ownerId` sucede).
    - `spaces.contract.test.ts`: `POST spaces documents a 409 response with the Error schema`.
    - Nenhum outro teste da API cria dois espaços livres com o mesmo nome para o mesmo dono (conferido na escrita do plano); se aparecer algum, o conserto é pontual e vira desvio.
  - Skills: unit-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [ ] CA1.2 — `apps/api/prisma/migrations/0017_free_space_owner_name_uniqueness/migration.sql` existe e contém literalmente `CREATE UNIQUE INDEX "Space_free_owner_name_key" ON "Space" ("ownerId", lower("name")) WHERE "type" = 'FREE';`, sem `DELETE`, `UPDATE` nem `DROP` (`rg -n "^\s*(DELETE|UPDATE|DROP)" <arquivo>` vazio). `ls apps/api/prisma/migrations` mostra só essa pasta nova. `apps/api/prisma/schema.prisma` tem, no `model Space`, um comentário `///` citando `0017` ou `Space_free_owner_name_key`; o bloco não ganhou `@@unique`. `pnpm --filter api exec prisma validate` sai com 0 e `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test pnpm --filter api exec prisma migrate status` reporta o banco em dia.
- [ ] CA1.3 — `apps/api/src/common/is-unique-violation.ts` exporta `UNIQUE_VIOLATION` (`'P2002'`) e `isUniqueViolation(error: unknown): boolean`; `apps/api/src/org-units/org-units.service.ts` importa `isUniqueViolation` desse arquivo e `rg -n "const (UNIQUE_VIOLATION|isUniqueViolation)|function isUniqueViolation" apps/api/src/org-units/org-units.service.ts` é vazio. Os arquivos de `apps/api/src/org-units/__tests__/` não foram editados e passam.
- [ ] CA1.4 — `apps/api/src/spaces/spaces.service.ts`, lido: contém `'Você já tem um espaço com esse nome.'`; em `create` há `findFirst` com `type: 'FREE'`, `ownerId` e `mode: 'insensitive'` antes da gravação, que lança `ConflictException`; a gravação está em `try/catch` que chama `isUniqueViolation` (importado de `common/is-unique-violation`) e lança o mesmo `ConflictException`, relançando qualquer outro erro.
- [ ] CA1.5 — `packages/api-contract/openapi.yaml`: `POST /spaces` tem a resposta `"409"` com `$ref` para o schema `Error`; `rg -n "não precisa ser único" packages/api-contract/openapi.yaml packages/api-contract/src/generated/openapi.d.ts` é vazio; `rg -n "409" packages/api-contract/src/generated/openapi.d.ts` casa dentro da operação de `POST /spaces`.
- [ ] CA1.6 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/spaces/__tests__`, todos os casos nomeados em T1.3 com os nomes literais (`spaces.service.test.ts`: 3; `spaces.integration.test.ts`: 9; `spaces.contract.test.ts`: 1). `rg -n "accepts two spaces with the same name from the same owner" apps/api/src` é vazio.
- [ ] CA1.7 — Lendo os testes: `two parallel POST spaces with the same name give one 201 and one 409` dispara as duas requisições com `Promise.all` e confere a contagem final 1; `the database rejects a duplicate free space name through Space_free_owner_name_key` chama `prisma.space.create` direto e assere `code` `P2002` citando o índice; `POST spaces accepts the same name from a different owner` usa duas pessoas reais do banco. `rg -n "DROP INDEX|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|vi\.mock\(.*prisma" apps/api/src/spaces/__tests__/spaces.integration.test.ts apps/api/src/spaces/__tests__/spaces.contract.test.ts` é vazio.
- [ ] CA1.8 — `rg -n "setTimeout\(|sleep\(" apps/api/src/spaces/__tests__/spaces.integration.test.ts` é vazio; `rg -n "eslint-disable" apps/api/src | rg -v -- "--"` é vazio.
- [ ] CA1.9 — Cobertura ≥ 80% de linhas para `apps/api/src/spaces/spaces.service.ts`, `apps/api/src/common/is-unique-violation.ts` e `apps/api/src/org-units/org-units.service.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: o diálogo "Novo espaço" mostra o nome repetido no campo, e a jornada ponta a ponta

A ordem importa: API simulada antes do formulário. Ao fim da fase, no app com API simulada, criar "Projeto X" e depois "PROJETO X" mantém o diálogo aberto com `Você já tem um espaço com esse nome.` no campo "Nome", com foco nele; trocar para "Projeto Y" cria o espaço.

- [ ] T2.1 — API simulada recusa nome repetido do mesmo dono
  - Arquivos: `apps/web/src/testing/mocks/handlers/spaces.ts` (alterar); `apps/web/src/testing/mocks/db.ts` (alterar)
  - O que fazer (D5):
    - `handlers/spaces.ts`: no `POST ${env.API_URL}/spaces`, depois do `parse` e antes de `addFreeSpace`, se `state.spaces` já tem espaço com `type: 'free'`, o mesmo `ownerId` da pessoa e `name.toLowerCase()` igual ao `parsed.data.toLowerCase()`, responde `409` com `{ message: 'Você já tem um espaço com esse nome.' }` e não grava.
    - `db.ts`: o comentário acima de `addFreeSpace` deixa de dizer que a API real aceita nomes iguais (en_US). `addFreeSpace` continua sem checar (é semente de teste).
  - Skills: api-mocking
  - Complexidade: baixa

- [ ] T2.2 — Formulário trata o 409 como erro do campo "Nome"
  - Arquivos: `apps/web/src/features/spaces/components/create-space-form.tsx` (alterar)
  - O que fazer (D4, R4, R5, R9, R10): `getNameErrorMessage` passa a aceitar `status` `400` **ou** `409`, lendo `errors[0].message` ou `message` como hoje. Com isso o `onError` existente faz `setError('name', { message }, { shouldFocus: true })` (confirmar que é assim; se faltar `shouldFocus: true`, acrescentar) e `hasServerFailure` fica falso. Estado de recusa, usando o erro de campo já existente do `Input` (sem receita nova no `docs/design.md`): o campo "Nome" mantém o texto digitado e mostra abaixo "Você já tem um espaço com esse nome."; o foco vai para "Nome"; o botão volta a "Criar espaço"; o diálogo não fecha; a seção "Espaços" da barra lateral não muda (a lista não é invalidada); o aviso "Não foi possível criar o espaço. Tente de novo em instantes." **não** aparece.
  - Skills: forms, error-handling, interface-design
  - Complexidade: baixa

- [ ] T2.3 — Documentação da arquitetura
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer, em pt_BR: junto da nota da migration `0007`, parágrafo **"Entrega `free-space-unique-name` (fatia 137)"**: índice `Space_free_owner_name_key` em `("ownerId", lower("name")) WHERE "type" = 'FREE'` escrito à mão na `0017`, invisível ao `schema.prisma` (não rodar `migrate diff` nessa tabela); `SpacesService.create` checa antes e converte `P2002` no mesmo `409`; `isUniqueViolation` em `apps/api/src/common/`.
  - Skills: —
  - Complexidade: baixa

- [ ] T2.4 — Testes da fase 2
  - Arquivos: `apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx` (alterar); `apps/web/e2e/tests/free-spaces.spec.ts` (alterar)
  - O que fazer: banco falso pelos ajudantes; `userEvent`; papel e nome acessível em pt_BR; sem `console.error`/`console.warn`/aviso de `act(...)`.
    - `create-space-form.test.tsx`: `a 409 from the server shows its message on the Nome field` (texto "Você já tem um espaço com esse nome." visível, campo "Nome" com o foco e o valor digitado, diálogo aberto, botão "Criar espaço" habilitado); `a 409 does not show the form alert` (sem "Não foi possível criar o espaço. Tente de novo em instantes."); `after a 409 a different name creates the space` (nome corrigido → sucesso pelo caminho já existente). Os casos existentes `a 400 from the server shows its message on the Nome field`, `a 500 shows the form alert and keeps the dialog open` e `a double Enter sends a single request` continuam sem edição.
    - `free-spaces.spec.ts`: novo caso `a repeated name is refused on the Nome field and a new name creates the space using only the keyboard`: cria "Projeto X" pelo teclado (reusa `openHome`/`openDialog`), volta a abrir o diálogo pelo teclado, digita "PROJETO X", `Enter`; vê "Você já tem um espaço com esse nome." no diálogo, o diálogo visível e `toBeFocused()` no campo "Nome"; `expectNoSeriousA11yViolations(page)`; apaga o texto, digita "Projeto Y", `Enter`; a primeira asserção após a mudança de rota (`toHaveURL(SPACE_URL, ROUTE_TIMEOUT)`) usa `ROUTE_TIMEOUT`; vê o `<h1>` "Projeto Y". `toBeFocused()` antes de cada `Enter`; se, com um espaço já criado, `focusNewSpaceButton` não chegar ao botão, o ajuste é local ao novo caso (os casos existentes não mudam). Os e2e `free-space-documents.spec.ts`, `free-space-invite.spec.ts` e `free-space-members.spec.ts` criam um único espaço por teste (conferido) e não mudam.
    - Rodar `pnpm test:e2e` com **todos** os e2e existentes.
  - Skills: component-testing, e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 2

- [ ] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` (todos os e2e) sai com 0.
- [ ] CA2.2 — `apps/web/src/features/spaces/components/create-space-form.tsx`, lido: `getNameErrorMessage` aceita `status` `400` e `409`; o `onError` chama `setError('name', …, { shouldFocus: true })` com a mensagem do servidor; `hasServerFailure` depende de `getNameErrorMessage(...) === null`. `rg -n "style=\{\{|!important|forwardRef|: JSX\.|<button" apps/web/src/features/spaces/components/create-space-form.tsx` é vazio; os textos "Criar espaço" e "Não foi possível criar o espaço. Tente de novo em instantes." continuam no arquivo; nenhuma receita nova em `docs/design.md`.
- [ ] CA2.3 — `apps/web/src/testing/mocks/handlers/spaces.ts`, lido: o `POST` de `${env.API_URL}/spaces` responde `409` com `message` `Você já tem um espaço com esse nome.` quando há espaço `type: 'free'` do mesmo `ownerId` com `toLowerCase()` igual, antes de `addFreeSpace`. `rg -n "as the real API accepts" apps/web/src/testing/mocks/db.ts` é vazio.
- [ ] CA2.4 — `pnpm exec vitest run --project web` sai com 0 e `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx` lista `a 409 from the server shows its message on the Nome field`, `a 409 does not show the form alert`, `after a 409 a different name creates the space` e os três casos antigos com os mesmos nomes.
- [ ] CA2.5 — `apps/web/e2e/tests/free-spaces.spec.ts` contém `a repeated name is refused on the Nome field and a new name creates the space using only the keyboard`, e `pnpm --filter web exec playwright test --list` o lista. Lendo o caso: usa "Projeto X", "PROJETO X" e "Projeto Y"; assere "Você já tem um espaço com esse nome."; `toBeFocused()` antes de cada `Enter`; `expectNoSeriousA11yViolations(page)` no estado de recusa; a primeira asserção após a mudança de rota usa `ROUTE_TIMEOUT` (asserção seguinte com timeout maior é aceita). `rg -n "test\.skip|test\.only|waitForTimeout|disableRules" apps/web/e2e/tests/free-spaces.spec.ts` é vazio.
- [ ] CA2.6 — `docs/architecture.md` tem o parágrafo "Entrega `free-space-unique-name` (fatia 137)" citando `Space_free_owner_name_key`, `0017`, `P2002` e `isUniqueViolation`.
- [ ] CA2.7 — `rg -n "sleep\(|setTimeout\(" apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx apps/web/e2e/tests/free-spaces.spec.ts` é vazio; `rg -n "eslint-disable" apps/web/src apps/web/e2e | rg -v -- "--"` é vazio.
- [ ] CA2.8 — Cobertura ≥ 80% de linhas para `apps/web/src/features/spaces/components/create-space-form.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.
- [ ] CA2.9 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `POST spaces answers 409 to a second space with the same name from the same owner` e `POST spaces accepts the same name from a different owner`; `pnpm exec vitest run --project web` (0) inclui `a 409 from the server shows its message on the Nome field`; `pnpm test:e2e` (0) inclui o novo caso de `free-spaces.spec.ts`.

## Desvios previstos

- DV1 — `apps/api/src/spaces/__tests__/spaces.integration.test.ts`: `POST spaces accepts two spaces with the same name from the same owner` (herdado da fatia 013) afirmava a regra antiga (dois `201`) e é substituído por `POST spaces answers 409 to a second space with the same name from the same owner`. Conferido na escrita do plano: nenhum outro teste afirma a regra antiga. Os testes da web chamam `addFreeSpace` (semente, sem passar pelo handler) com um espaço por nome e por dono em cada teste; os e2e `free-spaces.spec.ts`, `free-space-documents.spec.ts`, `free-space-invite.spec.ts` e `free-space-members.spec.ts` criam um único espaço por teste. Só o comentário de `addFreeSpace` em `apps/web/src/testing/mocks/db.ts` muda.

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
