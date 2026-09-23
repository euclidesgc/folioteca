# PLAN 134 — free-space-invite

Branch: `feature/134-free-space-invite`, empilhada sobre a 159 (`person-picker-shared`: `PersonPicker` e `usePersonLookup` já estão no compartilhado).

Fonte: `docs/features/134-free-space-invite/spec.md` (D1…D7 são as decisões técnicas da SPEC e R1…R10 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O dono de um espaço livre adiciona pessoas da instância ao espaço pelo botão "Adicionar pessoa" da página do espaço; quem foi adicionado passa a ver o espaço na barra lateral (seção "Espaços") e a abrir a página dele como membro, sem o botão. Fora desta fatia: papéis de membro (142), listar/remover membros de espaço livre (135), documentos no espaço livre.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. Se a suíte inteira (`pnpm test` ou `pnpm test:e2e`) falhar num teste **antigo** e alheio a esta fatia, o critério permite repetir o comando **uma** vez; a segunda execução tem de sair com 0.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Onde um critério prova **ausência**, o padrão fica restrito aos arquivos criados ou alterados na fase e exige código (não casa com comentário nem com atributo parecido); onde isso não é possível, o critério exige a presença do que é certo ou manda ler o arquivo. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Uma migration nova, escrita à mão**: `apps/api/prisma/migrations/0016_space_member/migration.sql`, com o SQL exato de T1.1. Os únicos subcomandos de Prisma permitidos são `prisma validate`, `prisma generate`, `prisma migrate status` e `prisma migrate deploy`, sempre contra `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test`; **nunca** `migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `session_replication_role`).
- O arquivo `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam; nada de `prettier --write` em arquivo inteiro.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); **todo botão nosso é o componente `Button`** de `apps/web/src/components/ui/button/button.tsx`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case; **nenhum import entre features** (`features/spaces` não importa de `features/documents` nem de outra feature: `PersonPicker` e `usePersonLookup` vêm do compartilhado). Textos de tela em pt_BR; código, comentários, caminhos de URL e nomes de teste em en_US.
- Botão de envio que precisa manter o foco durante o envio usa `aria-disabled`, **nunca** o `disabled` nativo.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** novo ou alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Não contam arquivos só de tipos nem os já excluídos pelo `vitest.config.ts` da raiz. Nenhuma exclusão nova.
- **Toda** espera logo após mudança de rota ou chunk `lazy` tem timeout explícito: nos testes da web pela constante `LAZY_TIMEOUT` declarada no arquivo; no e2e por `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo do spec. Nunca `setTimeout`/sleep fixo nos testes nem `waitForTimeout`.
- Testes de API de integração e contrato rodam contra o Postgres real (sem mock do Prisma). "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`.
- **Escopo por sessão**: `organizationId` e `personId` de quem pede vêm sempre de `@CurrentPerson()`. Escopo de outra organização é provado chamando o **serviço real** com `randomUUID()` como `organizationId` (`Organization.singleton` impede uma segunda organização no banco).
- Intocados de propósito: `SpacesService.listMembers` e `reachOf` (mesma assinatura e comportamento; `GET /spaces/{spaceId}/members` continua só para espaço de unidade), `apps/web/src/components/ui/**`, `apps/web/src/components/person-picker/**` (ou onde a 159 pôs o `PersonPicker`), `apps/web/src/hooks/**`, `apps/web/src/features/documents/**`, os testes da 145.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: o dono adiciona membro ao espaço livre e o membro enxerga o espaço

Caminhos relativos à raiz do repositório. Ao fim da fase, pela API, o dono de um espaço livre adiciona uma pessoa da organização com `PUT /spaces/{spaceId}/members/{personId}` (idempotente), e essa pessoa passa a receber o espaço em `GET /spaces` e a lê-lo em `GET /spaces/{spaceId}` com `reach: 'member'`.

- [ ] T1.1 — Tabela `SpaceMember` (migration à mão e schema)
  - Arquivos: `apps/api/prisma/migrations/0016_space_member/migration.sql` (criar); `apps/api/prisma/schema.prisma` (alterar)
  - O que fazer (D1):
    - `migration.sql`, com comentários em pt_BR no estilo da `0015_document_share`, contendo exatamente estes comandos:
      ```sql
      CREATE TABLE "SpaceMember" (
          "spaceId" TEXT NOT NULL,
          "personId" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("spaceId", "personId")
      );

      CREATE INDEX "SpaceMember_personId_idx" ON "SpaceMember"("personId");

      ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE CASCADE ON UPDATE CASCADE;

      ALTER TABLE "SpaceMember" ADD CONSTRAINT "SpaceMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      ```
    - `schema.prisma`: `model SpaceMember { spaceId String; personId String; createdAt DateTime @default(now()); space Space @relation(fields: [spaceId], references: [id], onDelete: Cascade); person Person @relation(fields: [personId], references: [id], onDelete: Cascade); @@id([spaceId, personId]); @@index([personId]) }`; relação `members SpaceMember[]` em `Space` e `spaceMemberships SpaceMember[]` em `Person`. Sem coluna de papel. Depois: `pnpm --filter api exec prisma validate`, `prisma generate` e `prisma migrate deploy` no banco de teste.
  - Skills: —
  - Complexidade: baixa

- [ ] T1.2 — Contrato: o PUT de membro e `reach: member`
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script)
  - O que fazer (D2, D3):
    - Chave nova `/spaces/{spaceId}/members/{personId}` com `put`, `operationId: addSpaceMember`, tag `spaces`, parâmetros de caminho `spaceId` e `personId` (string, obrigatórios), **sem** `requestBody`; respostas **200** `SpaceMemberResponse`, **400**, **401**, **403** e **404** com `Error`. `description` em pt_BR: só o dono do espaço livre adiciona; idempotente (repetir devolve o mesmo 200 sem duplicar); 400 "Você já é o dono deste espaço." ou "Pessoa não encontrada nesta instância."; 403 "Só o dono do espaço pode adicionar pessoas." para membro; 404 "Espaço não encontrado." para inexistente, id malformado, espaço de unidade ou espaço que quem pede não alcança.
    - Schema `SpaceMemberResponse` = `{ data: PersonSummary }` (`data` obrigatório, `additionalProperties: false`); nenhum outro schema novo; `SpaceMember` (membro de unidade) não muda.
    - `SpaceDetail.reach`: enum passa a `direct`, `inherited`, `owner`, `member`. `Space` da lista não muda.
    - Regenerar com `pnpm --filter @folioteca/api-contract generate`.
  - Skills: api-requests
  - Complexidade: baixa

- [ ] T1.3 — `SpacesService` e `SpacesController`: `addMember`, `list` e `getDetail` com membro
  - Arquivos: `apps/api/src/spaces/spaces.service.ts` (alterar); `apps/api/src/spaces/spaces.controller.ts` (alterar)
  - O que fazer (D2, D3, R4–R8):
    - `list`: o filtro do espaço FREE passa de `ownerId: personId` para `OR: [{ ownerId: personId }, { members: { some: { personId } } }]`, sempre com `organizationId`. Nada mais muda na lista.
    - `getDetail(organizationId, personId, spaceId)`: o ramo FREE do `findFirst` passa a aceitar `OR: [{ ownerId: personId }, { members: { some: { personId } } }]`; lê `ownerId`; devolve `reach: ownerId === personId ? 'owner' : 'member'`. Quem não é dono nem membro continua recebendo `null` (404).
    - `addMember(requester: { organizationId: string; id: string }, spaceId: string, personId: string): Promise<SpaceMemberResponse>` (tipo do contrato), nesta ordem: `!isUuid(spaceId)` → `spaceNotFound()`; `space.findFirst({ where: { id: spaceId, type: 'FREE', organizationId, OR: [{ ownerId: requester.id }, { members: { some: { personId: requester.id } } }] } })` ausente → `spaceNotFound()`; `ownerId !== requester.id` → `ForbiddenException` com `Só o dono do espaço pode adicionar pessoas.`; `personId === ownerId` → `BadRequestException` com `Você já é o dono deste espaço.`; `!isUuid(personId)` ou `person.findFirst({ where: { id: personId, organizationId } })` ausente → `BadRequestException` com `Pessoa não encontrada nesta instância.`; `spaceMember.upsert({ where: { spaceId_personId: { spaceId, personId } }, create: { spaceId, personId }, update: {} })`; retorna `{ data: { id, name, email } }` da pessoa. Mesmo formato de erro do `SharesService.share` da 145.
    - `spaces.controller.ts`: `@Put(':spaceId/members/:personId')` com `@HttpCode(200)`, `@CurrentPerson() person`, `@Param('spaceId') spaceId: string`, `@Param('personId') personId: string`, delegando a `addMember`. Identidade conferida à mão: `@Controller('spaces')` + `':spaceId/members/:personId'` ↔ YAML `/spaces/{spaceId}/members/{personId}`. `listMembers` e `reachOf` intocados.
  - Skills: security, authorization
  - Complexidade: alta

- [ ] T1.4 — Testes da fase 1
  - Arquivos: `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.service.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.contract.test.ts` (alterar)
  - O que fazer (D7): Postgres real, `resetDatabase(prisma)` em `beforeEach`, ajudantes existentes; casos existentes não são renomeados; `apps/api/test/**` não muda.
    - `spaces.integration.test.ts`, PUT: `PUT space member answers 200 with the person summary to the owner`; `PUT space member repeated answers the same 200 without a second row` (conta `spaceMember.count` = 1); `PUT space member answers 404 for a malformed space id`; `PUT space member answers 404 for a random space id`; `PUT space member answers 404 for a FREE space of another person`; `PUT space member answers 404 for a UNIT space` (quem pede está lotado diretamente na unidade; nenhuma linha em `SpaceMember`); `PUT space member answers 403 to a member`; `PUT space member answers 400 when adding the owner`; `PUT space member answers 400 for a random person id`; `PUT space member answers 400 for a malformed person id`; `PUT space member answers 401 without session`.
    - `spaces.integration.test.ts`, leitura: `GET spaces lists a FREE space to its member`; `GET spaces does not list a FREE space to a person who is not a member`; `GET space answers reach member to a member of a FREE space`; `GET space answers 404 for a FREE space to a person who is not a member`; `GET space members still answers 404 for a FREE space to its member`.
    - `spaces.service.test.ts`: `addMember with another organization id throws not found` (serviço real ligado ao Prisma de teste, `randomUUID()` como `organizationId`, sobre espaço livre e dono existentes; nenhuma linha criada).
    - `spaces.contract.test.ts`: `PUT space member answers the documented 200`; `PUT space member answers the documented 400`; `PUT space member answers the documented 401`; `PUT space member answers the documented 403`; `PUT space member answers the documented 404`; `GET space answers the documented 200 with reach member`. Os casos do PUT validam contra a chave literal do YAML `/spaces/{spaceId}/members/{personId}` e o último contra `/spaces/{spaceId}`.
  - Skills: unit-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [ ] CA1.2 — `apps/api/prisma/migrations/0016_space_member/migration.sql` existe e contém literalmente `CREATE TABLE "SpaceMember"`, `CONSTRAINT "SpaceMember_pkey" PRIMARY KEY ("spaceId", "personId")`, `CREATE INDEX "SpaceMember_personId_idx" ON "SpaceMember"("personId")`, `REFERENCES "Space"("id") ON DELETE CASCADE` e `REFERENCES "Person"("id") ON DELETE CASCADE`; não tem coluna `role`. `apps/api/prisma/schema.prisma` tem `model SpaceMember` com `@@id([spaceId, personId])` e `@@index([personId])`. `pnpm --filter api exec prisma validate` sai com 0 e `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test pnpm --filter api exec prisma migrate status` diz que o banco está em dia.
- [ ] CA1.3 — `packages/api-contract/openapi.yaml` tem a chave `/spaces/{spaceId}/members/{personId}:` com `put`, `operationId: addSpaceMember`, tag `spaces`, parâmetros de caminho `spaceId` e `personId`, sem `requestBody`, e respostas exatamente `200` (`SpaceMemberResponse`), `400`, `401`, `403`, `404`. O schema `SpaceMemberResponse` tem `data` obrigatório referenciando `PersonSummary`. O `enum` de `reach` em `SpaceDetail` é `direct`, `inherited`, `owner`, `member`. `rg -n "addSpaceMember|SpaceMemberResponse" packages/api-contract/src/generated/openapi.d.ts` encontra os dois.
- [ ] CA1.4 — Identidade de caminho conferida à mão: `apps/api/src/spaces/spaces.controller.ts` continua com `@Controller('spaces')` e tem `@Put(':spaceId/members/:personId')` com `@HttpCode(200)`, `@Param('spaceId')` e `@Param('personId')`, formando `/spaces/{spaceId}/members/{personId}`; `@Get(':spaceId/members')` segue presente.
- [ ] CA1.5 — `apps/api/src/spaces/spaces.service.ts` tem `addMember(` e, lido, segue a ordem `isUuid(spaceId)` → `spaceNotFound()` → busca com `type: 'FREE'` e `organizationId` → 403 → 400 dono → `isUuid(personId)`/pessoa da organização → `spaceMember.upsert` com `update: {}`; contém literalmente `Só o dono do espaço pode adicionar pessoas.`, `Você já é o dono deste espaço.` e `Pessoa não encontrada nesta instância.`. `list` e `getDetail` contêm `members: { some: { personId } }`, e `getDetail` devolve `'member'` quando o `ownerId` difere de quem pede. `listMembers` e `reachOf` mantêm as assinaturas.
- [ ] CA1.6 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/spaces/__tests__`, todos os casos nomeados em T1.4 com os nomes literais (`spaces.integration.test.ts`: 16 novos; `spaces.service.test.ts`: 1 novo; `spaces.contract.test.ts`: 6 novos). `rg -n "vi\.mock\(.*prisma" apps/api/src/spaces/__tests__/spaces.integration.test.ts` é vazio; `rg -n "DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role" apps/api/src/spaces/__tests__` é vazio.
- [ ] CA1.7 — Lendo os testes: `PUT space member answers 404 for a UNIT space` usa um espaço de unidade que quem pede alcança (lotação direta) e assere 404 com `Espaço não encontrado.` e zero linhas em `SpaceMember`; `PUT space member repeated answers the same 200 without a second row` faz dois PUTs e assere corpos iguais e uma linha; `addMember with another organization id throws not found` instancia o serviço real com o Prisma de teste e passa `randomUUID()` como `organizationId`; os casos `PUT space member answers the documented …` citam literalmente `/spaces/{spaceId}/members/{personId}`.
- [ ] CA1.8 — Cobertura ≥ 80% de linhas para `apps/api/src/spaces/spaces.service.ts` e `apps/api/src/spaces/spaces.controller.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: o botão "Adicionar pessoa" e a página do espaço para o membro

Caminhos relativos à raiz do repositório. A ordem importa: API simulada e chamadas antes da tela. Ao fim da fase, no app com API simulada, o dono adiciona pessoas pelo diálogo, e quem foi adicionado vê o espaço na barra lateral e abre a página como membro.

- [x] T2.1 — API simulada espelha o servidor
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/spaces.ts` (alterar)
  - O que fazer (D6):
    - `db.ts`: estado `spaceMembers: { spaceId: string; personId: string }[]` (vazio na semente e no reset); `listSpacesOf` inclui os livres de que a pessoa é membro; `spaceDetailOf` devolve `reach: 'member'` para membro; exporta `addSpaceMember(requesterId: string, spaceId: string, personId: string)` que segue a ordem de T1.3 (404 → 403 → 400 dono → 400 pessoa → grava sem duplicar) e devolve um resultado discriminado com status e mensagem ou a `PersonSummary`.
    - `handlers/spaces.ts`: `http.put(\`${env.API_URL}/spaces/:spaceId/members/:personId\`)` com o preâmbulo de sempre (`networkDelay()`, `devOverride('spaces')`, 401); 404 pelo mesmo `spaceNotFound()` dos outros handlers; 403/400 com `{ message }` literal de T1.3; 200 `{ data }`.
  - Skills: api-mocking
  - Complexidade: média

- [x] T2.2 — Chamadas: `useAddSpaceMember` e a lista de espaços sempre refeita
  - Arquivos: `apps/web/src/features/spaces/api/add-space-member.ts` (criar); `apps/web/src/features/spaces/api/get-spaces.ts` (alterar)
  - O que fazer (D2, D5):
    - `add-space-member.ts`: exporta o tipo `SpaceMemberResponse` (do contrato); `addSpaceMember({ spaceId, personId }: { spaceId: string; personId: string }): Promise<SpaceMemberResponse>` → `api.put(\`/spaces/${spaceId}/members/${personId}\`, undefined, { silentError: true })`; `useAddSpaceMember()` com `useMutation`, **sem** invalidar chave nenhuma.
    - `get-spaces.ts`: `staleTime: 0` explícito em `getSpacesQueryOptions`, com comentário em en_US: o default do `lib/react-query` guarda a lista, e um membro novo só vê o espaço se a lista for refeita ao remontar ou voltar à janela.
  - Skills: api-requests, api-client
  - Complexidade: baixa

- [x] T2.3 — Diálogo `AddSpaceMemberDialog` e `SpaceView` por `reach`
  - Arquivos: `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` (criar); `apps/web/src/features/spaces/components/space-view.tsx` (alterar)
  - O que fazer (D4, Interface, R1–R3, R5, R8–R10). Aparência pelo `docs/design.md` e pelo piso de `interface-design`, seguindo a estrutura de `apps/web/src/features/documents/components/share-document-dialog.tsx` (sem importar dele) e a receita de diálogo da 145; nenhuma receita nova:
    - `add-space-member-dialog.tsx`: `AddSpaceMemberDialog({ spaceId, spaceName }: { spaceId: string; spaceName: string }): React.JSX.Element`. Gatilho: `Button` secundário **"Adicionar pessoa"**. Diálogo `Dialog` do compartilhado (foco preso, volta ao gatilho), painel montado só aberto. Título **"Adicionar pessoa ao espaço"**; descrição **"Quem você escolher verá “<nome do espaço>” na barra lateral."** (aspas curvas). Busca com `PersonPicker` + `usePersonLookup` do compartilhado, estados do picker sem mudança. Pessoa selecionada: selo **"Membro"**, texto **"Esta pessoa verá o espaço na barra lateral."**, `Button` primário **"Adicionar"** / **"Adicionando…"** durante o envio, com `aria-disabled` (nunca `disabled`) e trava por `ref` contra duplo clique. Sucesso: região `aria-live="polite"` com **"<nome> agora é membro deste espaço."** (nome de `response.data.name`), `pickerRef.reset()` (ref como prop), diálogo continua aberto. Erro: `role="alert"` com a mensagem do servidor para 400/403 e **"Não foi possível adicionar a pessoa. Tente de novo."** no resto (404 inclusive); a pessoa escolhida continua selecionada. Rodapé: `Button` **"Fechar"**.
    - `space-view.tsx`: no ramo `free`, a descrição passa a depender de `reach`: `owner` → **"Um espaço livre, de que você é dona."** seguido de `<AddSpaceMemberDialog spaceId={…} spaceName={…} />`; `member` → **"Um espaço livre de que você é membro."** sem botão. O vazio **"Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui."** aparece para os dois. Estados carregando/não encontrado/erro sem mudança.
  - Skills: interface-design, error-handling, component-robustness, authorization
  - Complexidade: alta

- [x] T2.4 — Testes da fase 2 e os e2e antigos
  - Arquivos: `apps/web/src/features/spaces/api/__tests__/add-space-member.test.tsx` (criar); `apps/web/src/features/spaces/api/__tests__/get-spaces.test.tsx` (alterar); `apps/web/src/features/spaces/components/__tests__/add-space-member-dialog.test.tsx` (criar); `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` (alterar)
  - O que fazer (D7): banco falso pelos ajudantes; `userEvent`; localizar por papel e nome acessível em pt_BR; `LAZY_TIMEOUT` em cada arquivo que espera após rota ou `lazy`; sem `console.error`/`console.warn`/aviso de `act(...)`. Casos existentes não são renomeados; testes da 145 intocados continuam verdes.
    - `add-space-member.test.tsx`: `addSpaceMember sends PUT to the space member path`; `useAddSpaceMember returns the person summary`; `useAddSpaceMember exposes the server message on 400`; `useAddSpaceMember does not invalidate the spaces query`.
    - `get-spaces.test.tsx`: `useSpaces refetches when remounted` (conta dois pedidos a `GET /spaces`).
    - `add-space-member-dialog.test.tsx`: `opens with the title and the space name in the description`; `adds the selected person and announces the confirmation`; `resets the picker after success and keeps the dialog open`; `adding the same person again shows the confirmation again`; `adds a second person after the first`; `shows the server message on 400 and keeps the person selected`; `shows the generic message on 500`; `shows the generic message on 404`; `the submit button uses aria-disabled while sending and sends once on double click`; `closing returns focus to the trigger`.
    - `space-view.test.tsx`: `a FREE space shows Adicionar pessoa to its owner`; `a FREE space shows the member description without Adicionar pessoa`.
    - Rodar `pnpm test:e2e` com **todos** os e2e existentes. Se algum quebrar, o conserto é no código de produção; conserto em spec antigo só por mudança intencional desta fatia, registrado como desvio no fim deste plano.
  - Skills: unit-testing, component-testing, integration-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d`, na raiz: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` (todos os e2e existentes) sai com 0; todo spec antigo alterado aparece como desvio no fim deste plano, com o motivo.
- [x] CA2.2 — `apps/web/src/features/spaces/api/add-space-member.ts` exporta `addSpaceMember`, `useAddSpaceMember` e `SpaceMemberResponse`; `addSpaceMember` chama `api.put` em `` `/spaces/${spaceId}/members/${personId}` `` com `silentError: true`; o arquivo não contém `invalidateQueries`. `apps/web/src/features/spaces/api/get-spaces.ts` contém `staleTime: 0` com um comentário na linha anterior.
- [x] CA2.3 — `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` exporta `AddSpaceMemberDialog` com retorno `React.JSX.Element` e contém literalmente `Adicionar pessoa`, `Adicionar pessoa ao espaço`, `Quem você escolher verá “`, `” na barra lateral.`, `Membro`, `Esta pessoa verá o espaço na barra lateral.`, `Adicionar`, `Adicionando…`, `agora é membro deste espaço.`, `Não foi possível adicionar a pessoa. Tente de novo.`, `Fechar`, `aria-live="polite"`, `role="alert"`, `aria-disabled`, `PersonPicker` e `useAddSpaceMember`; importa de `@/components/person-picker/person-picker` e importa `PersonSummary` de `@/hooks/use-person-lookup`. `rg -nP "(?<![-\w])disabled=\{" apps/web/src/features/spaces/components/add-space-member-dialog.tsx` é vazio.
- [x] CA2.4 — `apps/web/src/features/spaces/components/space-view.tsx` contém `Um espaço livre, de que você é dona.`, `Um espaço livre de que você é membro.`, `AddSpaceMemberDialog` e, lido, só renderiza `AddSpaceMemberDialog` quando `reach === 'owner'`; `Os documentos deste espaço ainda não chegaram.` segue presente. `rg -nP "from '@/features/(?!spaces/)" apps/web/src/features/spaces` é vazio.
- [x] CA2.5 — Acabamento (piso de `interface-design`, lendo o código): todo botão de `add-space-member-dialog.tsx` é `Button` (gatilho `variant="secondary"`, "Adicionar" primário) com `type` explícito; o selo "Membro" usa a forma de selo do `docs/design.md`; o erro tem fundo ou borda de destaque; o texto de confirmação fica num elemento com `aria-live="polite"` dentro do diálogo, abaixo do seletor de pessoa, sem notificação flutuante. `rg -n "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/spaces/components/add-space-member-dialog.tsx apps/web/src/features/spaces/components/space-view.tsx` é vazio; nenhuma largura fixa em px nesses arquivos.
- [x] CA2.6 — API simulada: `apps/web/src/testing/mocks/db.ts` exporta `addSpaceMember(requesterId: string, spaceId: string, personId: string)` e tem o estado `spaceMembers`; `apps/web/src/testing/mocks/handlers/spaces.ts` tem `http.put` em `${env.API_URL}/spaces/:spaceId/members/:personId` com `networkDelay()`, `devOverride('spaces')`, 401, 404 `Espaço não encontrado.`, 403, 400 e 200.
- [x] CA2.7 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/spaces`, os 17 casos nomeados em T2.4 com os nomes literais (`add-space-member.test.tsx`: 4; `get-spaces.test.tsx`: 1 novo; `add-space-member-dialog.test.tsx`: 10; `space-view.test.tsx`: 2 novos).
- [x] CA2.8 — Lendo os testes: `shows the server message on 400 and keeps the person selected` assere `role="alert"` com `Pessoa não encontrada nesta instância.` e a pessoa ainda selecionada; `the submit button uses aria-disabled while sending and sends once on double click` assere `aria-disabled="true"` e um único pedido ao handler PUT; `closing returns focus to the trigger` assere o foco no botão "Adicionar pessoa"; `a FREE space shows the member description without Adicionar pessoa` assere a ausência do botão "Adicionar pessoa".
- [x] CA2.9 — `rg -n "sleep\(|waitForTimeout|setTimeout\(" apps/web/src/features/spaces/api/add-space-member.ts apps/web/src/features/spaces/components/add-space-member-dialog.tsx apps/web/src/features/spaces/components/space-view.tsx apps/web/src/features/spaces/api/__tests__/add-space-member.test.tsx apps/web/src/features/spaces/components/__tests__/add-space-member-dialog.test.tsx` é vazio; `rg -n "eslint-disable" apps/web/src | rg -v -- "--"` é vazio.
- [x] CA2.10 — Cobertura ≥ 80% de linhas para `apps/web/src/features/spaces/api/add-space-member.ts`, `apps/web/src/features/spaces/api/get-spaces.ts`, `apps/web/src/features/spaces/components/add-space-member-dialog.tsx` e `apps/web/src/features/spaces/components/space-view.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e da jornada e documentação: a fatia utilizável de ponta a ponta

- [x] T3.1 — Documentação da arquitetura
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer, em pt_BR: §6 (espaços) ganha o parágrafo **"Entrega `free-space-invite` (fatia 134)"**: tabela `SpaceMember` (PK `spaceId`+`personId`, sem papel, cascata); `PUT /spaces/{spaceId}/members/{personId}` idempotente, só o dono, ordem 401 → 404 → 403 → 400; `GET /spaces` e `GET /spaces/{spaceId}` enxergam o membro (`reach: member`); `GET /spaces/{spaceId}/members` continua só de unidade; a lista da barra lateral usa `staleTime: 0`.
  - Skills: —
  - Complexidade: baixa

- [x] T3.2 — Testes da fase 3 (e2e: dono adiciona pelo teclado, membro vê o espaço)
  - Arquivos: `apps/web/e2e/tests/free-space-invite.spec.ts` (criar)
  - O que fazer (D7): API simulada com semente por `page.addInitScript`, segundo contexto como em `apps/web/e2e/tests/share-with-person-view.spec.ts`. `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; `toBeFocused()` antes de cada `Enter`/`Space`; nenhum `waitForTimeout`; nenhuma regra do axe desativada; outros specs e `apps/web/e2e/a11y.ts` intocados.
    - `the owner adds a person to a free space using only the keyboard`: abre o espaço livre, ativa "Adicionar pessoa", busca, seleciona, ativa "Adicionar", vê "<nome> agora é membro deste espaço.", `expectNoSeriousA11yViolations(page)`.
    - `the added person sees the space in the sidebar and opens it without Adicionar pessoa`: segundo contexto como a pessoa adicionada; vê o espaço em "Espaços", abre, vê `Um espaço livre de que você é membro.` e nenhum botão "Adicionar pessoa", `expectNoSeriousA11yViolations(page)`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [x] CA3.1 — `pnpm test:e2e` na raiz sai com 0 (os e2e antigos e os novos), e `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` continuam saindo com 0 e sem aviso.
- [x] CA3.2 — `apps/web/e2e/tests/free-space-invite.spec.ts` contém os casos `the owner adds a person to a free space using only the keyboard` e `the added person sees the space in the sidebar and opens it without Adicionar pessoa`, e `pnpm --filter web exec playwright test --list` os lista. `rg -n "test\.skip|test\.only|waitForTimeout|disableRules" apps/web/e2e/tests/free-space-invite.spec.ts` é vazio.
- [x] CA3.3 — Lendo o spec: `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; a primeira asserção após mudança de rota usa `ROUTE_TIMEOUT`; asserção seguinte com timeout maior é aceita; `toBeFocused()` antes de cada tecla de ação; `expectNoSeriousA11yViolations(page)` nos dois casos; o primeiro assere o texto `agora é membro deste espaço.`; o segundo usa um segundo contexto de navegador e assere `Um espaço livre de que você é membro.` e a ausência do botão "Adicionar pessoa".
- [x] CA3.4 — `docs/architecture.md` tem o parágrafo "Entrega `free-space-invite` (fatia 134)" citando `SpaceMember`, `PUT /spaces/{spaceId}/members/{personId}`, `reach: member` e `staleTime: 0`.
- [x] CA3.5 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `PUT space member answers 200 with the person summary to the owner` e `GET spaces lists a FREE space to its member`; `pnpm exec vitest run --project web` (0) inclui `adds the selected person and announces the confirmation`; `pnpm test:e2e` (0) inclui os dois casos de `free-space-invite.spec.ts`.

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
