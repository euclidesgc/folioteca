# PLAN 141 — free-space-restrict-invite

Branch: `feature/141-free-space-restrict-invite`, empilhada sobre 137/136/135/134.

Fonte: `docs/features/141-free-space-restrict-invite/spec.md` (D1…D8 são as decisões técnicas da SPEC e R1…R14 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O dono de um espaço livre escolhe, na página do espaço, entre "Só eu adiciono pessoas" e "Qualquer membro adiciona pessoas". Aberto, cada membro vê "Adicionar pessoa" e usa o diálogo da 134; fechado, só o dono. Remover continua só do dono. Fora desta fatia: papéis por membro (142), espaço de unidade.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Onde um critério prova **ausência**, o padrão exige código (não casa com comentário nem com atributo parecido) e é restrito aos arquivos criados ou alterados na fase. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita.

**Suíte instável.** Se `pnpm test` ou `pnpm test:e2e` inteiro falhar num teste **antigo** (não criado nem alterado nesta fatia), o critério permite repetir o comando **uma vez**; passa se a repetição sair com 0. Falha em teste desta fatia não tem repetição.

## Desvios registrados

- **DV1** — Testes existentes que montam `SpaceDetail` literal (resposta simulada de `GET /spaces/:spaceId` em `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx`, dados de `apps/web/src/testing/mocks/db.ts` e as asserções `toEqual` do corpo de `GET /spaces/{spaceId}` em `apps/api/src/spaces/__tests__/spaces.integration.test.ts` e `spaces.contract.test.ts`) ganham `membersCanInvite: false`, **sem renomear** o teste nem mudar outra asserção. Vale para qualquer outro que `pnpm typecheck` ou a suíte apontar.
- **DV2** — `apps/api/src/spaces/__tests__/spaces.integration.test.ts`: o caso `PUT space member answers 403 to a member` (afirma que membro nunca adiciona) é **substituído** por `PUT space member answers 403 to a member of a closed space`, com o mesmo corpo e asserções (espaço com `membersCanInvite` no padrão `false`, 403 `Só o dono do espaço pode adicionar pessoas.`, uma linha em `SpaceMember`).
- **DV3** — `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx`: o caso `a FREE space shows the member description without Adicionar pessoa` é **substituído** por `a FREE space shows the member description without Adicionar pessoa when closed`, mesmas asserções com `membersCanInvite: false`.
- Conferidos e **mantidos** (continuam verdadeiros com o padrão fechado): `PUT space member answers the documented 403` (contrato), `DELETE space member answers 403 to a member`, e o e2e `the added person sees the space in the sidebar and opens it without Adicionar pessoa` (`apps/web/e2e/tests/free-space-invite.spec.ts`).

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Uma migration só, escrita à mão** (`apps/api/prisma/migrations/0018_space_members_can_invite/migration.sql`). Os únicos subcomandos de Prisma permitidos são `prisma validate`, `prisma generate`, `prisma migrate status` e `prisma migrate deploy`, sempre contra `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test`; **nunca** `migrate diff`, `migrate dev` ou `migrate reset`. As migrations `0001…0017` não mudam.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `session_replication_role`).
- `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam; nada de `prettier --write` em arquivo inteiro. Correções depois de revisão são **edições pontuais**, nunca regravação do arquivo inteiro.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); **todo botão nosso é `Button`** de `apps/web/src/components/ui/button/button.tsx`; imports absolutos com `@/`; sem barrel files; kebab-case; **nenhum import entre features** (nada de `features/org-units` em `features/spaces`). Textos de tela em pt_BR; código, comentários, URLs e nomes de teste em en_US.
- **Rádios sem `disabled` nativo**: durante o envio usam `aria-disabled="true"`, para o foco ficar no rádio escolhido.
- Nenhum `eslint-disable` sem `-- <motivo>`; nenhuma regra desativada; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** novo ou alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, sem `--project` e sem filtro de caminho. Não contam arquivos só de tipos nem os já excluídos pelo `vitest.config.ts`. Nenhuma exclusão nova.
- Espera após mudança de rota ou `lazy`: nos testes da web pela constante `LAZY_TIMEOUT` do arquivo; no e2e pela constante `ROUTE_TIMEOUT = { timeout: 10_000 }` no topo do spec. A **primeira** asserção após mudança de rota usa `ROUTE_TIMEOUT`; asserção seguinte com timeout maior é aceita. Nunca `setTimeout`/sleep fixo nem `waitForTimeout`.
- Integração e contrato de API contra o Postgres real (sem mock do Prisma); só `*.service.test.ts` usa Prisma falso. "Teste passa" = exit code 0.
- **Escopo por sessão**: `organizationId` e `personId` vêm de `@CurrentPerson()`, nunca do corpo; `isAdmin` não é lido em `apps/api/src/spaces`. Outra organização é provada chamando o **serviço real** com `randomUUID()` como `organizationId`.
- Intocados de propósito: `removeMember`, `apps/web/src/features/spaces/components/space-members.tsx`, `apps/api/src/people/**`, `apps/web/src/features/people/**`, `share-document-dialog.tsx`, `apps/web/src/features/org-units/**`, `apps/web/src/components/ui/**`, `docs/design.md`.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: `membersCanInvite`, `PATCH /spaces/{spaceId}` e membro adicionando com o espaço aberto

Caminhos relativos à raiz do repositório.

- [x] T1.1 — Contrato primeiro: `SpaceDetail.membersCanInvite` e `updateSpaceSettings`
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script)
  - O que fazer (D1, R1–R5):
    - `SpaceDetail` ganha `membersCanInvite: { type: boolean }` em `required`, com descrição pt_BR "Se qualquer membro pode adicionar pessoas ao espaço livre; sempre false em espaço de unidade".
    - No item `/spaces/{spaceId}` (o mesmo do `get`), `patch` com `operationId: updateSpaceSettings`, tag `spaces`, parâmetro `spaceId`, `requestBody` obrigatório com `$ref` `UpdateSpaceInput`, respostas **200** (`SpaceDetailResponse`), **400**, **401**, **403**, **404** (`Error`). `description` pt_BR: só o dono do espaço livre muda quem adiciona pessoas.
    - Schema `UpdateSpaceInput`: `type: object`, `required: [membersCanInvite]`, `additionalProperties: false`, `membersCanInvite: { type: boolean }`.
    - Regenerar com `pnpm --filter @folioteca/api-contract generate`.
  - Skills: security
  - Complexidade: baixa

- [x] T1.2 — Banco: coluna `membersCanInvite` com migration 0018 escrita à mão
  - Arquivos: `apps/api/prisma/migrations/0018_space_members_can_invite/migration.sql` (criar); `apps/api/prisma/schema.prisma` (alterar)
  - O que fazer (D2, R1, R3):
    - `migration.sql`, à mão, comentários em pt_BR, exatamente este SQL:
      ```sql
      ALTER TABLE "Space" ADD COLUMN "membersCanInvite" BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE "Space" ADD CONSTRAINT "Space_members_can_invite_free_check" CHECK ("type" = 'FREE' OR "membersCanInvite" = false);
      ```
    - `schema.prisma`: `Space` ganha `membersCanInvite Boolean @default(false)` com `///` dizendo que `true` deixa qualquer membro do espaço livre adicionar pessoas e que a restrição "só FREE" vive só na migration.
    - Conferência: `pnpm --filter api exec prisma validate`, `prisma generate`, `migrate deploy` + `migrate status` no banco de teste. Se `validate` apontar diferença que exigiria outro SQL, o agente para e relata.
  - Skills: security
  - Complexidade: média

- [x] T1.3 — Serviço e rota: `updateSettings`, `getDetail` com o flag e `addMember` aceitando membro no espaço aberto
  - Arquivos: `apps/api/src/spaces/spaces.schema.ts` (alterar); `apps/api/src/spaces/spaces.service.ts` (alterar); `apps/api/src/spaces/spaces.controller.ts` (alterar)
  - O que fazer (D1, D3, D4, R3, R5–R10):
    - `spaces.schema.ts`: `updateSpaceSchema = z.strictObject({ membersCanInvite: z.boolean({ error: 'Escolha quem adiciona pessoas.' }) }, { error: 'Campo não permitido.' })`.
    - `getDetail` seleciona `membersCanInvite` e o devolve (UNIT: `false`).
    - Método novo `updateSettings(requester, spaceId: string, body: unknown)`, nesta ordem: `isUuid(spaceId)` senão 404 (`spaceNotFound`) → `space.findFirst({ where: { id: spaceId, type: 'FREE', organizationId: requester.organizationId, OR: [dono, membro] }, select: { ownerId: true } })` senão o mesmo 404 (UNIT, pessoal, alheio, outra organização) → não dono → `ForbiddenException('Só o dono do espaço pode mudar quem adiciona pessoas.')` → `parseBody(updateSpaceSchema, body)` (400) → `space.update({ where: { id: spaceId }, data: { membersCanInvite } })` → devolve o `getDetail` como `{ data }`. Idempotente.
    - `addMember`: `select { ownerId, membersCanInvite }`; 403 `OWNER_ONLY_MESSAGE` ("Só o dono do espaço pode adicionar pessoas.") só se `ownerId !== requester.id && !membersCanInvite`. Quando quem pede é membro (não dono), **antes** da busca da pessoa: alvo = o dono → `BadRequestException('Esta pessoa é a dona deste espaço.')`; alvo = a si → `BadRequestException('Você já é membro deste espaço.')`. A mensagem "Você já é o dono deste espaço." continua para o dono adicionando a si. `upsert` e `removeMember` não mudam.
    - `spaces.controller.ts`: `@Patch(':spaceId')` + `@HttpCode(200)`, logo após `getSpace`, com `@CurrentPerson() person`, `@Param('spaceId') spaceId: string`, `@Body() body: unknown`, chamando `updateSettings(person, spaceId, body)`. `SessionGuard` só na classe (intocado).
  - Skills: authorization, security
  - Complexidade: alta

- [x] T1.4 — Testes da fase 1
  - Arquivos: `apps/api/src/spaces/__tests__/spaces.service.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.contract.test.ts` (alterar)
  - O que fazer (D8): `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes; `apps/api/test/**` não muda. Aplicar DV1 e DV2. Casos preexistentes não são renomeados (exceto DV2).
    - `spaces.service.test.ts`: `updateSpaceSchema accepts true and false`; `updateSpaceSchema rejects a missing value with Escolha quem adiciona pessoas.`; `updateSpaceSchema rejects extra fields with Campo não permitido.`; `updateSettings throws not found for a malformed id`; `updateSettings throws forbidden to a member`; `updateSettings updates membersCanInvite by id`; `getDetail returns membersCanInvite false for a unit space`; `addMember accepts a member when membersCanInvite is true`; `addMember throws forbidden to a member when membersCanInvite is false`.
    - `spaces.integration.test.ts`: `PUT space member answers 403 to a member of a closed space` (DV2); `PUT space member answers 200 to a member of an open space and the person sees the space in GET spaces`; `PUT space member answers 200 to the owner of an open space`; `PUT space member answers 404 to a stranger of an open space`; `PUT space member answers 400 when a member adds himself with Você já é membro deste espaço.`; `PUT space member answers 400 when a member adds the owner with Esta pessoa é a dona deste espaço.`; `PATCH space answers 200 to the owner and GET space reflects membersCanInvite`; `PATCH space is idempotent`; `PATCH space answers 403 to a member with Só o dono do espaço pode mudar quem adiciona pessoas.`; `PATCH space answers 404 to a stranger`; `PATCH space answers 404 for a malformed id`; `PATCH space answers 404 for a UNIT space`; `PATCH space rejects an empty body with 400`; `PATCH space rejects a non boolean value with 400`; `PATCH space rejects extra fields with 400`; `PATCH space answers 401 without session`; `updateSettings with another organization id answers 404` (serviço real, `randomUUID()`); `closing the space keeps the members who joined`; `the database rejects membersCanInvite on a UNIT space` (`prisma.space.update` direto em espaço UNIT com `membersCanInvite: true`, esperando a rejeição de `Space_members_can_invite_free_check`).
    - `spaces.contract.test.ts`: `PATCH space answers the documented 200`; `PATCH space answers the documented 400`; `PATCH space answers the documented 403`; `PATCH space answers the documented 404`; `GET space answers the documented 200 with membersCanInvite`.
  - Skills: unit-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso (repetição única permitida só para teste antigo instável).
- [x] CA1.2 — `packages/api-contract/openapi.yaml`: o item `/spaces/{spaceId}:` tem `patch` com `operationId: updateSpaceSettings`, parâmetro `spaceId`, `requestBody` com `$ref` para `UpdateSpaceInput` e respostas exatamente `200` (`SpaceDetailResponse`), `400`, `401`, `403`, `404`; `UpdateSpaceInput` tem `required: [membersCanInvite]`, `additionalProperties: false` e `membersCanInvite` `type: boolean`; `SpaceDetail` tem `membersCanInvite` em `required`. `rg -n "updateSpaceSettings|UpdateSpaceInput|membersCanInvite" packages/api-contract/src/generated/openapi.d.ts` encontra os três.
- [x] CA1.3 — Existe `apps/api/prisma/migrations/0018_space_members_can_invite/migration.sql` com `ADD COLUMN "membersCanInvite" BOOLEAN NOT NULL DEFAULT false` e `ADD CONSTRAINT "Space_members_can_invite_free_check" CHECK ("type" = 'FREE' OR "membersCanInvite" = false)`; `ls apps/api/prisma/migrations` lista só `0001…0018` e `migration_lock.toml`. `apps/api/prisma/schema.prisma` tem `membersCanInvite Boolean @default(false)` em `Space` com `///`. `pnpm --filter api exec prisma validate` sai com 0 e `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test pnpm --filter api exec prisma migrate status` reporta o banco em dia.
- [x] CA1.4 — `apps/api/src/spaces/spaces.schema.ts` exporta `updateSpaceSchema` (`z.strictObject`) com `Escolha quem adiciona pessoas.` e `Campo não permitido.`. `apps/api/src/spaces/spaces.service.ts` tem o método `updateSettings(` com `type: 'FREE'` e `organizationId` no `where`, o texto `Só o dono do espaço pode mudar quem adiciona pessoas.` numa `ForbiddenException`, `membersCanInvite` no `select` de `getDetail` e de `addMember`, e os textos `Esta pessoa é a dona deste espaço.` e `Você já é membro deste espaço.` em `BadRequestException`. `rg -n "^\s*[^/*].*\bisAdmin\b" apps/api/src/spaces/spaces.service.ts apps/api/src/spaces/spaces.controller.ts` é vazio.
- [x] CA1.5 — `apps/api/src/spaces/spaces.controller.ts` tem `@Patch(':spaceId')` com `@HttpCode(200)` e `@Param('spaceId')` chamando `updateSettings(`; `rg -n "@UseGuards" apps/api/src/spaces/spaces.controller.ts` devolve uma ocorrência, acima da classe, com `SessionGuard`.
- [x] CA1.6 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/spaces/__tests__`, todos os casos nomeados em T1.4 com os nomes literais (`spaces.service.test.ts`: 9; `spaces.integration.test.ts`: 19; `spaces.contract.test.ts`: 5). `rg -n "'PUT space member answers 403 to a member'" apps/api/src/spaces/__tests__/spaces.integration.test.ts` é vazio (DV2). `rg -n "vi\.mock\(.*prisma" apps/api/src/spaces/__tests__/spaces.integration.test.ts apps/api/src/spaces/__tests__/spaces.contract.test.ts` é vazio.
- [x] CA1.7 — Lendo os testes: `updateSettings with another organization id answers 404` chama o serviço real (ligado ao Prisma de teste) com `randomUUID()` como `organizationId` sobre um espaço existente; `the database rejects membersCanInvite on a UNIT space` escreve pelo Prisma direto e espera a rejeição; `PUT space member answers 200 to a member of an open space and the person sees the space in GET spaces` assere o item em `GET /spaces` da pessoa adicionada; `closing the space keeps the members who joined` assere a contagem de `SpaceMember` depois do `PATCH` com `false`. `rg -n "DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role" apps/api/src apps/api/test` é vazio.
- [x] CA1.8 — Cobertura ≥ 80% de linhas para `apps/api/src/spaces/spaces.schema.ts`, `apps/api/src/spaces/spaces.service.ts` e `apps/api/src/spaces/spaces.controller.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: controle "Quem adiciona pessoas" na página do espaço e "Adicionar pessoa" para o membro

Caminhos relativos à raiz do repositório. A ordem importa: API simulada e mutação antes da tela.

- [x] T2.1 — API simulada com o flag e a mutação `useUpdateSpaceSettings`
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/spaces.ts` (alterar); `apps/web/src/features/spaces/api/update-space-settings.ts` (criar)
  - O que fazer (D5, D8, R4, R6, R7, R10):
    - `db.ts`: espaço livre simulado ganha `membersCanInvite` (padrão `false`; espaços de unidade devolvem `false`); `setSpaceMembersCanInvite(spaceId: string, value: boolean)`; semente `mock-space-members=free-open`: espaço livre de outra dona, a pessoa da sessão é membro, `membersCanInvite: true`, e ao menos uma terceira pessoa que não é membro.
    - `handlers/spaces.ts`: `GET /spaces/:spaceId` devolve `membersCanInvite`; `http.patch(\`${env.API_URL}/spaces/:spaceId\`)` com o mesmo preâmbulo dos outros handlers (`networkDelay()`, `devOverride`, 401) e 404 (não alcança ou UNIT), 403 `Só o dono do espaço pode mudar quem adiciona pessoas.`, 400 (corpo inválido) e 200 `{ data }`; `PUT …/members/:personId` aceita membro com o flag e aplica as recusas de D4 (`Esta pessoa é a dona deste espaço.`, `Você já é membro deste espaço.`, 403 `Só o dono do espaço pode adicionar pessoas.` no fechado).
    - `update-space-settings.ts`: `updateSpaceSettings({ spaceId, membersCanInvite }: { spaceId: string; membersCanInvite: boolean })` → `api.patch(\`/spaces/${spaceId}\`, { membersCanInvite }, { silentError: true })`; `useUpdateSpaceSettings({ mutationConfig })` cujo `onSuccess` **aguarda** `invalidateQueries({ queryKey: ['space', spaceId] })` (chave de `get-space.ts`, importada da própria feature) e só então chama o `onSuccess` do chamador.
  - Skills: api-mocking, api-requests
  - Complexidade: média

- [x] T2.2 — Busca sem o dono: `hiddenIds` no `PersonPicker` e `ownerId` no diálogo
  - Arquivos: `apps/web/src/components/person-picker/person-picker.tsx` (alterar); `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` (alterar)
  - O que fazer (D7, R7): `PersonPicker` ganha `hiddenIds?: readonly string[]`; resultados com esses ids não são listados (filtro no cliente, depois da busca); sem a prop nada muda (`share-document-dialog.tsx` intocado). `AddSpaceMemberDialog` recebe `ownerId?: string` e passa `hiddenIds={ownerId ? [ownerId] : []}` (ou equivalente). O 403 continua mostrado pelo `getAddMemberErrorMessage` existente.
  - Skills: ui-components, component-robustness
  - Complexidade: baixa

- [x] T2.3 — Controle `SpaceInviteModeControl` e `SpaceView` decidindo quem vê "Adicionar pessoa"
  - Arquivos: `apps/web/src/features/spaces/components/space-invite-mode-control.tsx` (criar); `apps/web/src/features/spaces/components/space-view.tsx` (alterar)
  - O que fazer (D6, D7, Interface, R2–R6, R13, R14). Aparência pelo `docs/design.md` e pelo piso de `interface-design`, com as receitas "Escolha entre opções (rádios)", "Alerta dentro de formulário", "Notificação" e "Botão secundário" (nenhuma receita nova); padrão de referência (sem importar): `features/org-units/components/space-access-control.tsx`.
    - `SpaceInviteModeControl({ spaceId, membersCanInvite }: { spaceId: string; membersCanInvite: boolean }): React.JSX.Element`. `<fieldset>` com `<legend>` **"Quem adiciona pessoas"** e dois `<input type="radio">` nativos com o mesmo `name`, rótulos **"Só eu adiciono pessoas"** e **"Qualquer membro adiciona pessoas"**. Marcado = `isPending ? variables.membersCanInvite : membersCanInvite` (volta sozinho no erro). Durante o envio os rádios têm `aria-disabled="true"` (sem `disabled` nativo) e `onChange` é ignorado; também ignorado se o valor não muda. Frase fixa em `<p aria-live="polite">`: **"Quando aberto, qualquer membro pode adicionar pessoas; só você remove."**, com **" Salvando…"** no fim durante o envio. Sucesso: notificação **"Modo de convite atualizado"**. Falha: `role="alert"` **"Não foi possível mudar quem adiciona pessoas. Tente de novo em instantes."**. A 360px as opções empilham, texto com `break-words`. Sem carregando/vazio próprios (o dado vem do `GET /spaces/{spaceId}` da página).
    - `space-view.tsx`, ramo `free`: com `reach === 'owner'`, o controle aparece depois de título e descrição e antes do bloco do botão; o botão "Adicionar pessoa" aparece com `canAddPeople = reach === 'owner' || (reach === 'member' && space.membersCanInvite)`, no mesmo lugar para os dois. `ownerId` sai de `useSpaceMembers` (linha `role === 'owner'`) e vai para `AddSpaceMemberDialog`. Ramo `unit` intocado.
  - Skills: interface-design, component-robustness, error-handling, authorization
  - Complexidade: alta

- [x] T2.4 — Testes da fase 2 e os e2e antigos
  - Arquivos: `apps/web/src/features/spaces/api/__tests__/update-space-settings.test.tsx` (criar); `apps/web/src/features/spaces/components/__tests__/space-invite-mode-control.test.tsx` (criar); `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` (alterar); `apps/web/src/features/spaces/components/__tests__/add-space-member-dialog.test.tsx` (alterar); `apps/web/src/components/person-picker/__tests__/person-picker.test.tsx` (alterar); testes que montam `SpaceDetail` literal (DV1)
  - O que fazer (D8): banco falso pelos ajudantes; `userEvent`; papel e nome acessível em pt_BR; `LAZY_TIMEOUT` onde houver espera após rota ou `lazy`; sem espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Aplicar DV1 e DV3; demais casos preexistentes não são renomeados.
    - `update-space-settings.test.tsx`: `updateSpaceSettings sends PATCH to the space with the membersCanInvite body`; `useUpdateSpaceSettings invalidates the space query before onSuccess`.
    - `space-invite-mode-control.test.tsx`: `checks Só eu adiciono pessoas when closed and shows the sentence`; `choosing Qualquer membro adiciona pessoas sends true`; `marks the options aria-disabled and shows Salvando while sending`; `keeps focus on the chosen option while sending`; `a failure restores the previous option and shows the alert`; `a success shows Modo de convite atualizado`; `arrow keys move between the options`; `choosing the checked option sends nothing`.
    - `space-view.test.tsx`: `a FREE space shows the invite mode control to its owner`; `a FREE space does not show the invite mode control to a member`; `a FREE space shows Adicionar pessoa to a member when open`; `a FREE space shows the member description without Adicionar pessoa when closed` (DV3); `a unit space shows neither the invite mode control nor Adicionar pessoa`.
    - `add-space-member-dialog.test.tsx`: `hides the owner from the search results`; `shows the server message when the space was closed`.
    - `person-picker.test.tsx`: `hiddenIds removes those people from the results`; `without hiddenIds every result is listed`.
    - Rodar `pnpm test:e2e` com **todos** os e2e existentes; se algum quebrar, o conserto é no código de produção, nunca no spec.
  - Skills: unit-testing, component-testing, integration-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` (todos os e2e) sai com 0. Repetição única permitida só para teste antigo instável.
- [x] CA2.2 — `apps/web/src/features/spaces/api/update-space-settings.ts` exporta `updateSpaceSettings` (chama `api.patch` em `` `/spaces/${spaceId}` `` com `{ membersCanInvite }` e `silentError: true`) e `useUpdateSpaceSettings`, cujo `onSuccess` faz `await` da invalidação de `['space', spaceId]` antes do `onSuccess` do chamador. `rg -nP "from '@/features/(?!spaces/)" apps/web/src/features/spaces` é vazio.
- [x] CA2.3 — `apps/web/src/features/spaces/components/space-invite-mode-control.tsx` exporta `SpaceInviteModeControl` com retorno `React.JSX.Element`; tem `<fieldset>`, `<legend>`, dois `type="radio"`, `aria-disabled`, `aria-live="polite"` e `role="alert"`, e contém literalmente `Quem adiciona pessoas`, `Só eu adiciono pessoas`, `Qualquer membro adiciona pessoas`, `Quando aberto, qualquer membro pode adicionar pessoas; só você remove.`, `Salvando…`, `Modo de convite atualizado` e `Não foi possível mudar quem adiciona pessoas. Tente de novo em instantes.`; o valor marcado deriva de `isPending`/`variables` e da prop `membersCanInvite`. `rg -nP "(?<![-\w])disabled=\{" apps/web/src/features/spaces/components/space-invite-mode-control.tsx` é vazio.
- [x] CA2.4 — `apps/web/src/features/spaces/components/space-view.tsx` usa `SpaceInviteModeControl` só no ramo do espaço livre sob `reach === 'owner'` e define a condição do botão com `reach === 'owner'` ou (`reach === 'member'` e `membersCanInvite`); passa `ownerId` para `AddSpaceMemberDialog`. `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` aceita `ownerId?: string` e passa `hiddenIds` ao `PersonPicker`; `apps/web/src/components/person-picker/person-picker.tsx` declara `hiddenIds?: readonly string[]`.
- [x] CA2.5 — Acabamento (piso de `interface-design`, lendo o código): cada opção é um `<label>` com borda, respiro interno, destaque quando marcada (`has-[:checked]`) e foco visível (`has-[:focus-visible]`), com estilo esmaecido quando `aria-disabled`; o alerta usa a receita "Alerta dentro de formulário" (fundo ou borda de destaque); textos com `break-words`. `rg -n "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/spaces/components/space-invite-mode-control.tsx apps/web/src/features/spaces/components/space-view.tsx` é vazio; nenhuma largura fixa em px nesses arquivos.
- [x] CA2.6 — API simulada: `apps/web/src/testing/mocks/db.ts` exporta `setSpaceMembersCanInvite(spaceId: string, value: boolean)`, o espaço simulado tem `membersCanInvite` e existe a semente `free-open`. `apps/web/src/testing/mocks/handlers/spaces.ts` tem `http.patch` em `${env.API_URL}/spaces/:spaceId` com `networkDelay()` e as respostas 400, 401, 403 (`Só o dono do espaço pode mudar quem adiciona pessoas.`), 404 e 200, e o handler de `PUT` contém `Esta pessoa é a dona deste espaço.` e `Você já é membro deste espaço.`.
- [x] CA2.7 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/spaces apps/web/src/components/person-picker`, todos os casos nomeados em T2.4 com os nomes literais (19 casos). `rg -n "'a FREE space shows the member description without Adicionar pessoa'" apps/web/src/features/spaces` é vazio (DV3).
- [x] CA2.8 — Lendo os testes: `useUpdateSpaceSettings invalidates the space query before onSuccess` assere a ordem; `a failure restores the previous option and shows the alert` assere "Só eu adiciono pessoas" marcado de novo e o texto do alerta; `keeps focus on the chosen option while sending` tem `toHaveFocus()` no rádio escolhido durante o envio; `hides the owner from the search results` assere que o nome da dona não aparece entre as opções da busca.
- [x] CA2.9 — `rg -n "setTimeout\(|sleep\(|waitForTimeout" apps/web/src/features/spaces apps/web/src/components/person-picker/__tests__/person-picker.test.tsx` é vazio; `rg -n "eslint-disable" apps/web/src | rg -v -- "--"` é vazio. (`person-picker.tsx` fica de fora: o debounce da busca já usava `setTimeout(` antes desta fatia)
- [x] CA2.10 — Cobertura ≥ 80% de linhas para `apps/web/src/features/spaces/api/update-space-settings.ts`, `apps/web/src/features/spaces/components/space-invite-mode-control.tsx`, `apps/web/src/features/spaces/components/space-view.tsx`, `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` e `apps/web/src/components/person-picker/person-picker.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e da jornada e documentação: a fatia utilizável de ponta a ponta

- [ ] T3.1 — Documentação de arquitetura
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer, em pt_BR, só acrescentando linhas: em §3, parágrafo **"Entrega `free-space-restrict-invite` (fatia 141)"**: quem adiciona pessoas a espaço livre é o dono e, com `membersCanInvite`, qualquer membro; remoção continua só do dono; o flag mora em `Space` (restrição só-FREE na 0018 escrita à mão); `PATCH /spaces/{spaceId}` só para o dono; `addMember` relê o flag a cada pedido.
  - Skills: —
  - Complexidade: baixa

- [ ] T3.2 — Testes da fase 3 (e2e: abrir o espaço pelo teclado e o membro adicionar)
  - Arquivos: `apps/web/e2e/tests/free-space-restrict-invite.spec.ts` (criar)
  - O que fazer (D8): API simulada, estado inicial por `page.addInitScript` como os specs existentes. `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; a primeira asserção após cada mudança de rota o usa; `toBeFocused()` antes de cada `Enter`/`Space`/`Escape`/seta; nenhum `waitForTimeout`; nenhuma regra do axe desativada; outros specs e `apps/web/e2e/a11y.ts` intocados.
    - `the owner opens the free space to members using only the keyboard`: dono abre a página do espaço livre, alcança o grupo "Quem adiciona pessoas", escolhe "Qualquer membro adiciona pessoas" com seta, vê "Salvando…", o rádio continua focado e marcado, vê "Modo de convite atualizado"; `expectNoSeriousA11yViolations(page)`.
    - `a member of an open space adds a third person and cannot find the owner`: segundo contexto com a semente `mock-space-members=free-open`; membro vê "Adicionar pessoa", não vê "Quem adiciona pessoas", busca o nome da dona sem resultado, adiciona a terceira pessoa e vê "<nome> agora é membro deste espaço.".
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [ ] CA3.1 — `pnpm test:e2e` na raiz sai com 0 (antigos e novos), e `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` continuam saindo com 0 e sem aviso, com o cache do `tsc` limpo. Repetição única permitida só para teste antigo instável.
- [ ] CA3.2 — `apps/web/e2e/tests/free-space-restrict-invite.spec.ts` contém `the owner opens the free space to members using only the keyboard` e `a member of an open space adds a third person and cannot find the owner`, e `pnpm --filter web exec playwright test --list` os lista. `rg -n "test\.skip|test\.only|waitForTimeout|disableRules" apps/web/e2e/tests/free-space-restrict-invite.spec.ts` é vazio.
- [ ] CA3.3 — Lendo o spec: `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo, usado na primeira asserção após cada mudança de rota (asserção seguinte com timeout maior é aceita); `toBeFocused()` antes de cada tecla de ação; `expectNoSeriousA11yViolations(page)` no primeiro caso; o primeiro caso assere `Salvando…` e o rádio "Qualquer membro adiciona pessoas" focado e marcado; o segundo usa `free-open`, assere a ausência de "Quem adiciona pessoas" e o texto `agora é membro deste espaço.`.
- [ ] CA3.4 — `docs/architecture.md` tem o parágrafo "Entrega `free-space-restrict-invite` (fatia 141)" citando `membersCanInvite`, `PATCH /spaces/{spaceId}` e que remover continua só do dono.
- [ ] CA3.5 — Utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `PUT space member answers 200 to a member of an open space and the person sees the space in GET spaces`; `pnpm exec vitest run --project web` (0) inclui `a FREE space shows Adicionar pessoa to a member when open`; `pnpm test:e2e` (0) inclui os dois casos de `free-space-restrict-invite.spec.ts`.

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
