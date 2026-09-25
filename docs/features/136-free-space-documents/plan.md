# PLAN 136 — free-space-documents

Branch: `feature/136-free-space-documents`, empilhada sobre 135 → 134 → 159 → 128 → 127.

Fonte: `docs/features/136-free-space-documents/spec.md` (D1…D6 são as decisões técnicas da SPEC e R1…R14 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O dono e os membros de um espaço livre (`FREE`) veem a lista de documentos do espaço, criam documentos ali e editam qualquer um deles (nível `edit`); só o dono do documento manda para a lixeira. Espelho da fatia 127 (espaço de unidade). Fora desta fatia: derrubar a conexão de colaboração aberta ao remover o membro (dívida), filtro de organização na decisão de acesso de `FREE` (dívida), papéis de membro (142).

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`. Se a suíte inteira (`pnpm test` ou `pnpm test:e2e`) falhar num teste **antigo** e alheio a esta fatia, o critério permite repetir o comando **uma** vez; a segunda execução tem de sair com 0.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Onde um critério prova **ausência**, o `rg` fica restrito aos arquivos criados ou alterados pela fase e o padrão casa código, não comentário. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Nenhuma migration nova**; `apps/api/prisma/schema.prisma` não muda. Os únicos subcomandos de Prisma permitidos são `prisma validate`, `prisma generate`, `prisma migrate status` e `prisma migrate deploy`, sempre contra `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test`; **nunca** `migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `session_replication_role`).
- O arquivo `packages/api-contract/src/generated/openapi.d.ts` só muda por `pnpm --filter @folioteca/api-contract generate`; nunca editado à mão.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam; nada de `prettier --write` em arquivo inteiro.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum (sem `forwardRef`); todo botão nosso é o componente `Button` de `apps/web/src/components/ui/button/button.tsx`; imports absolutos com `@/`; sem barrel files; **nenhum import entre features** (`features/spaces` não importa de `features/documents`; quem junta é a rota). Textos de tela em pt_BR; código, comentários, caminhos e nomes de teste em en_US.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada para fazer teste passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, sem `--project` e sem filtro de caminho. Nenhuma exclusão nova.
- Espera após mudança de rota ou chunk `lazy`: nos testes da web pela constante `LAZY_TIMEOUT` do arquivo; no e2e, a **primeira** asserção após mudança de rota usa `const ROUTE_TIMEOUT = { timeout: 10_000 }` declarada no topo do spec, e asserção seguinte com timeout maior é aceita. Nunca `setTimeout`/sleep fixo nos testes nem `waitForTimeout`. No e2e, `toBeFocused()` antes de **cada** tecla de ação (`Enter`, `Space`, `Escape`).
- Testes de integração e contrato da API rodam contra o Postgres real (sem mock do Prisma); só `access-level.test.ts` e os `*.service.test.ts` usam Prisma falso. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`.
- **Escopo por sessão**: `organizationId` e `personId` vêm de `@CurrentPerson()`. Outra organização é provada chamando o **serviço real** com `randomUUID()` como `organizationId` (`Organization.singleton` impede uma segunda organização no banco).
- Assinaturas públicas de `AccessService` (`resolveAccess`, `canWrite`, `readableDocumentsWhere`, `trashedDocumentsWhere`) não mudam; `canWrite` não muda nem de corpo.
- Intocados de propósito: `apps/api/src/spaces/spaces.controller.ts`, `apps/api/src/documents/documents.controller.ts`, `apps/api/src/documents/documents.schema.ts`, `apps/api/src/collab/collab.service.ts`, `apps/api/src/access/access-level.ts`, `apps/web/src/features/documents/components/space-documents.tsx`, `apps/web/src/features/documents/components/new-document-button.tsx`, `apps/web/src/features/documents/api/**`, `apps/web/src/features/documents/components/document-view.tsx`, `docs/design.md`, migrations.
- Teste existente que afirma a regra antiga é **substituído** por um caso novo com nome novo e registrado em "Desvios" no fim do plano (lista abaixo, já prevista); nenhum outro teste existente é renomeado ou apagado.
- O agente derruba tudo o que subir (servidores, watchers) ao fim da tarefa.

## Fase 1 — API: dono e membro de espaço livre editam, listam e criam documentos no espaço

Ao fim da fase, pela API, o membro de um espaço livre cria um documento com `POST /documents` `{ spaceId }`, o dono do espaço o vê em `GET /spaces/{spaceId}/documents` e o abre com `accessLevel: 'edit'`; quem não é dono nem membro recebe 404.

- [x] T1.1 — Contrato: descrições que citam o espaço livre
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script)
  - O que fazer (D2, D3): só textos. `summary` de `POST /documents`: "Cria um documento sem título no espaço pessoal de quem chama, no espaço de unidade informado ou no espaço livre de que a pessoa é dona ou membro". `description` de `listSpaceDocuments`: acrescentar que dono ou membro do espaço livre recebe 200; o 403 continua só para alcance por herança em espaço de unidade. Nenhum schema, parâmetro ou resposta muda. Regenerar com `pnpm --filter @folioteca/api-contract generate`.
  - Skills: —
  - Complexidade: baixa

- [x] T1.2 — `AccessService`: dono ou membro de espaço `FREE` = `edit`, na mesma consulta
  - Arquivos: `apps/api/src/access/access.service.ts` (alterar)
  - O que fazer (D1, R4, R7, R8, R9, R10, R11, R12):
    - `findDecision(documentId, personId)` amplia o `select` de `space` na **mesma** consulta: `space: { select: { type: true, ownerId: true, orgUnit: { select: { assignments: { where: { personId }, select: { personId: true } } } }, members: { where: { personId }, select: { personId: true } } } }`.
    - `DocumentDecision.isUnitMember` passa a se chamar `isSpaceMember: boolean` = `(type === 'UNIT' && assignments.length > 0) || (type === 'FREE' && (space.ownerId === personId || members.length > 0))`. `levelOf` usa o novo nome; ordem inalterada: dono do documento → lixeira → maior(share, membro `edit`) → `none`.
    - `readableDocumentsWhere(personId)` ganha no `OR` o ramo `{ space: { type: 'FREE', OR: [{ ownerId: personId }, { members: { some: { personId } } }] } }`; literal `trashedAt: null` preservado; ramos de dono, share e `UNIT` intocados.
    - Organização não é filtrada aqui (garantida por `addMember`).
  - Skills: authorization
  - Complexidade: alta

- [x] T1.3 — `POST /documents` e `reachOf` aceitam o espaço `FREE` de dono ou membro
  - Arquivos: `apps/api/src/documents/documents.service.ts` (alterar); `apps/api/src/spaces/spaces.service.ts` (alterar)
  - O que fazer (D2, D3, R3, R10):
    - `documents.service.ts`, em `create(person, body)` com `spaceId`: o `where` do `tx.space.findFirst` vira `{ id: spaceId, OR: [{ type: 'UNIT', orgUnit: { organizationId: person.organizationId, assignments: { some: { personId: person.id } } } }, { type: 'FREE', organizationId: person.organizationId, OR: [{ ownerId: person.id }, { members: { some: { personId: person.id } } }] }] }`. Ausente → `spaceNotFound()` ("Espaço não encontrado."). `ownerId`/`authorId` = `person.id` como hoje; `listInSpace` e `listMine` inalterados.
    - `spaces.service.ts`, `reachOf(organizationId, personId, spaceId)` (mesma assinatura, `Promise<'direct' | 'inherited' | 'none'>`): primeiro `this.prisma.space.findFirst({ where: { id: spaceId, type: 'FREE', organizationId, OR: [{ ownerId: personId }, { members: { some: { personId } } }] }, select: { id: true } })` → achou, `'direct'`; senão delega a `reachOfUnit` como hoje. `reachOfUnit`, `getDetail`, `listMembers` intocados.
  - Skills: authorization, security
  - Complexidade: média

- [x] T1.4 — Testes da fase 1
  - Arquivos: `apps/api/src/access/__tests__/access-level.test.ts` (alterar); `apps/api/src/access/__tests__/access.integration.test.ts` (alterar); `apps/api/src/access/__tests__/document-access-boundary.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (alterar); `apps/api/src/collab/__tests__/collab.integration.test.ts` (alterar)
  - O que fazer (D5, D6): integração contra o Postgres real com `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes. Casos preexistentes cujo Prisma falso muda por T1.2 (ex.: `levelOf ignores membership outside a UNIT space`, que passa a ter `ownerId` e `members: []` no `space` falso) são ajustados **sem trocar o nome nem a asserção**. Nenhuma regra existente do teste de fronteira afrouxa. Substituições (DV1):
    - `access-level.test.ts`: `levelOf returns edit for a member of a FREE space`; `levelOf returns edit for the owner of a FREE space on a document of a member`; `levelOf returns none for a FREE space member on a trashed document`; `levelOf returns none for a FREE space when the person is neither owner nor member`.
    - `access.integration.test.ts`: `resolveAccess returns edit for a member of the free space`; `canWrite is true for a member of the free space`; `the free space owner gets edit on a document created by a member`; `removing the member makes the next resolveAccess none and the member keeps owner on their own document`; `a trashed free space document is none for the space owner and members and edit again after restore`; `a view share to a non member of the free space resolves to view`; `readableDocumentsWhere includes the free space document for owner and member and excludes it in the trash and for a third person`.
    - `document-access-boundary.test.ts`: regra 11 com `rule 11 flags a Document read filtered by space members outside access service` (exemplo infrator: `document.findMany` com `space: { members: { some: … } } }` ou `space: { ownerId … }`) e `rule 11 accepts space members in the access service` (exemplo conforme), mais a verificação sobre o código real: fora de `apps/api/src/access/access.service.ts`, nenhuma leitura de `Document` (`findMany`, `findFirst`, `findUnique`, `count`) filtra por `members` nem por `space: { ownerId`.
    - `documents.integration.test.ts`: `POST documents with a free spaceId answers 201 to a member in that space owned by the caller`; `a document created by a member in the free space appears in my documents of the member and not of the space owner`; `the free space owner GETs the member document with accessLevel edit`; `the free space owner renames the member document with 200`; `the free space owner gets 404 on trash, restore and delete of the member document`; `POST documents with a free spaceId answers 404 to a third person`; `POST documents with a free spaceId answers 404 to an admin who is not a member`; `POST documents with a free spaceId answers 404 to a removed member`; `POST documents with a random spaceId answers 404 for a free space caller`; `create in a free space with another organization id answers 404` (serviço real, `{ ...person, organizationId: randomUUID() }`, espaço livre existente de que a pessoa é dona).
    - `spaces.integration.test.ts`: remove `GET space documents answers 404 for a FREE space` (DV1) e acrescenta `GET space documents answers 200 to the owner of a FREE space ordered by updatedAt desc`; `GET space documents answers 200 to a member of a FREE space`; `GET space documents of a FREE space omits trashed documents`; `GET space documents answers 404 for a FREE space to a removed member`; `GET space documents answers 404 for a FREE space to a third person`; `GET space documents answers 404 for a FREE space to an admin who is not a member`; `reachOf a FREE space with another organization id returns none` (serviço real, `randomUUID()`). Os 404 comparam o corpo com o de um id aleatório (`Espaço não encontrado.`).
    - `collab.integration.test.ts`: `a free space member connects and an update is stored`; `after removing the free space member the next connection is refused`.
  - Skills: unit-testing, integration-testing
  - Complexidade: média

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [x] CA1.2 — `packages/api-contract/openapi.yaml`: o `summary` de `POST /documents` contém `espaço livre de que a pessoa é dona ou membro`; a `description` de `listSpaceDocuments` cita dono ou membro do espaço livre; as respostas de ambos são as mesmas de antes (`POST /documents`: inclui `201`, `400`, `401`, `404`; `listSpaceDocuments`: exatamente `200`, `401`, `403`, `404`). `rg -n "espaço livre de que a pessoa é dona ou membro" packages/api-contract/src/generated/openapi.d.ts` encontra o texto.
- [x] CA1.3 — `apps/api/src/access/access.service.ts`, lido: `findDecision` seleciona em `space` os campos `type`, `ownerId`, `orgUnit.assignments` e `members`, ambos filtrados por `personId`, na mesma consulta do documento; `DocumentDecision` tem `isSpaceMember: boolean`; `rg -n "isUnitMember" apps/api/src` é vazio; em `levelOf` o dono vem primeiro e a lixeira antes do membro e da share; `readableDocumentsWhere` contém `trashedAt: null`, o ramo `type: 'UNIT'` com `assignments` e o ramo `type: 'FREE'` com `ownerId: personId` e `members: { some: { personId } }`. As assinaturas públicas `resolveAccess`, `canWrite`, `readableDocumentsWhere` e `trashedDocumentsWhere` são as mesmas de antes.
- [x] CA1.4 — `apps/api/src/documents/documents.service.ts`, lido: em `create`, o `space.findFirst` tem `OR` com o ramo `type: 'UNIT'` (lotação direta e `organizationId: person.organizationId`) e o ramo `type: 'FREE'` com `organizationId: person.organizationId`, `ownerId: person.id` e `members: { some: { personId: person.id } }`; ausente → `spaceNotFound()`. `apps/api/src/spaces/spaces.service.ts`, lido: `reachOf(organizationId: string, personId: string, spaceId: string): Promise<'direct' | 'inherited' | 'none'>` consulta primeiro `type: 'FREE'` com `organizationId`, `ownerId` ou `members` e devolve `'direct'`, depois chama `reachOfUnit`.
- [x] CA1.5 — `ls apps/api/prisma/migrations` lista as mesmas migrations de antes da fase (nenhuma pasta nova); `pnpm --filter api exec prisma validate` sai com 0 e `DATABASE_URL=postgresql://folioteca@localhost:5433/folioteca_test pnpm --filter api exec prisma migrate status` reporta o banco em dia.
- [x] CA1.6 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/api/src/access/__tests__ apps/api/src/documents/__tests__ apps/api/src/spaces/__tests__ apps/api/src/collab/__tests__`, todos os casos nomeados em T1.4 com os nomes literais (`access-level.test.ts`: 4; `access.integration.test.ts`: 7; `document-access-boundary.test.ts`: 2; `documents.integration.test.ts`: 10; `spaces.integration.test.ts`: 7; `collab.integration.test.ts`: 2); `rg -n "answers 404 for a FREE space'" apps/api/src/spaces/__tests__/spaces.integration.test.ts` é vazio; `levelOf ignores membership outside a UNIT space` continua existindo. `rg -n "vi\.mock\(.*prisma" apps/api/src/access/__tests__/access.integration.test.ts apps/api/src/documents/__tests__/documents.integration.test.ts apps/api/src/spaces/__tests__/spaces.integration.test.ts` é vazio.
- [x] CA1.7 — Lendo os testes: `create in a free space with another organization id answers 404` e `reachOf a FREE space with another organization id returns none` chamam o serviço real (instância ligada ao Prisma de teste) com `randomUUID()` como `organizationId`, sobre espaço livre que existe e de que a pessoa é dona; `removing the member makes the next resolveAccess none and the member keeps owner on their own document` apaga a linha de `SpaceMember` e chama `resolveAccess` de novo; `after removing the free space member the next connection is refused` abre nova conexão depois de apagar a participação. `rg -n "DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role" apps/api/src/access/__tests__ apps/api/src/documents/__tests__ apps/api/src/spaces/__tests__ apps/api/src/collab/__tests__` é vazio.
- [x] CA1.8 — `rg -n "setTimeout\(|sleep\(" apps/api/src/access/__tests__/access.integration.test.ts apps/api/src/documents/__tests__/documents.integration.test.ts apps/api/src/spaces/__tests__/spaces.integration.test.ts` é vazio; `rg -n "eslint-disable" apps/api/src | rg -v -- "--"` é vazio.
- [x] CA1.9 — Cobertura ≥ 80% de linhas para `apps/api/src/access/access.service.ts`, `apps/api/src/documents/documents.service.ts` e `apps/api/src/spaces/spaces.service.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: a lista de documentos na página do espaço livre, com "Novo documento"

A ordem importa: API simulada antes da tela. Ao fim da fase, no app com API simulada, o dono de um espaço livre vê a lista (vazia) com "Novo documento" acima de "Pessoas neste espaço" e cria um documento; o membro (`mock-space-members=free-member`) vê o documento do dono.

- [x] T2.1 — API simulada: espaço livre alcançável por dono e membro, com documento na semente
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar); `apps/web/src/testing/mocks/handlers/spaces.ts` (alterar); `apps/web/src/testing/mocks/utils.ts` (alterar)
  - O que fazer (D6):
    - `db.ts`: `spaceReachOf(personId, spaceId)` devolve `'direct'` para espaço `free` quando a pessoa é dona ou `isSpaceMember` é verdadeiro; `'none'` para `free` alheio. `seedFreeSpaceMembership` passa a criar também um documento do dono do espaço dentro dele, com `accessLevel: 'edit'` e título "Ata da primeira reunião". Comentário de `spaceReachOf` atualizado (en_US).
    - `handlers/documents.ts`: o `POST /documents` com `spaceId` aceita o `'direct'` de espaço `free` (já compara com `'direct'`; ajustar só o comentário se for o caso); cria com `createDocumentIn`.
    - `handlers/spaces.ts`: `GET /spaces/:spaceId/documents` responde 200 `{ data }` para `free` de dono/membro (via `spaceReachOf`) e 404 `Espaço não encontrado.` para `free` alheio; 403 continua só de unidade.
    - `utils.ts`: a documentação da chave `mock-space-members=free-member` cita o documento do dono.
  - Skills: api-mocking
  - Complexidade: média

- [x] T2.2 — `SpaceView` mostra os documentos também no espaço livre e a rota compõe
  - Arquivos: `apps/web/src/features/spaces/components/space-view.tsx` (alterar); `apps/web/src/app/routes/app/space.tsx` (alterar)
  - O que fazer (D4, R1, R2, R3, R13, R14):
    - `space-view.tsx`: a prop `unitContent: ReactNode` passa a se chamar `documentsContent: ReactNode`, renderizada nos dois ramos. Espaço de unidade: inalterado (título, "O espaço de documentos da sua unidade.", `documentsContent`). Espaço livre, nesta ordem: título (nome), descrição ("Um espaço livre, de que você é dona." ou "Um espaço livre de que você é membro."), botão "Adicionar pessoa" (só dono), `documentsContent`, depois "Pessoas neste espaço" (`SpaceMembers`). O aviso "Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui." e o `<p>` tracejado saem; `SPACE_TEXTS.free.empty` sai do objeto e do tipo. Comentários do arquivo atualizados. Não importa de `@/features/documents`.
    - `space.tsx`: passa `documentsContent={<SpaceDocuments spaceId={spaceId} />}`.
    - Os estados vêm de `SpaceDocuments` (inalterado): carregando `role="status"` "Carregando documentos do espaço…"; erro `role="alert"` "Não foi possível carregar os documentos do espaço." com "Tentar novamente"; vazio "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”." com "Novo documento" à direita; lista com título-link e data à direita; "Criando…" durante o envio. Nenhuma receita nova no `docs/design.md`.
  - Skills: interface-design, project-structure, routing
  - Complexidade: baixa

- [x] T2.3 — Testes da fase 2 e os e2e antigos
  - Arquivos: `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` (alterar); `apps/web/src/app/routes/app/__tests__/space.test.tsx` (alterar)
  - O que fazer (D6): banco falso pelos ajudantes; `userEvent`; papel e nome acessível em pt_BR; `LAZY_TIMEOUT` após rota ou `lazy`; sem `console.error`/`console.warn`/aviso de `act(...)`.
    - `space-view.test.tsx`: substituir `renders unitContent for a unit space` por `renders documentsContent for a unit space` e `a free space keeps the notice and ignores unitContent` por `renders documentsContent for a free space above Pessoas neste espaço` (DV2); acrescentar `a free space no longer shows the documents notice`. Nos casos existentes `shows the free space texts when the space is free`, `a FREE space shows Adicionar pessoa to its owner`, `a FREE space shows the member description without Adicionar pessoa` e `a FREE space shows Pessoas neste espaço with Remover to its owner`, a asserção do aviso antigo passa a afirmar a ausência dele, sem trocar o nome (DV3).
    - `space.test.tsx`: `the free space page shows the space documents list and Novo documento to its owner`; `the free space page shows the owner document to a member`; `creating a document in a free space sends the spaceId and navigates to it`.
    - Rodar `pnpm test:e2e` com **todos** os e2e existentes. `apps/web/e2e/tests/free-spaces.spec.ts`, `free-space-invite.spec.ts` e `free-space-members.spec.ts` não afirmam o aviso antigo (conferido na escrita do plano); se algum quebrar por busca ambígua ou pelo documento novo da semente, o conserto é pontual e vira desvio no fim do plano.
  - Skills: component-testing, integration-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`. `pnpm test:e2e` (todos os e2e existentes) sai com 0.
- [x] CA2.2 — `apps/web/src/features/spaces/components/space-view.tsx` tem a prop `documentsContent: ReactNode`; `rg -n "unitContent|ainda não chegaram" apps/web/src/features/spaces/components/space-view.tsx apps/web/src/app/routes/app/space.tsx` é vazio; lido, `documentsContent` é renderizado no ramo de unidade e no ramo livre, e no livre fica depois de "Adicionar pessoa" e antes de `SpaceMembers`. `rg -n "features/documents" apps/web/src/features/spaces/components/space-view.tsx` é vazio. `apps/web/src/app/routes/app/space.tsx` contém `documentsContent={<SpaceDocuments spaceId={spaceId} />}`.
- [x] CA2.3 — Acabamento (piso de `interface-design`, lendo o código): o `<h1>` de `space-view.tsx` continua com as classes de título de página do `docs/design.md`; `rg -n "<button|<a href|style=\{\{|!important|forwardRef|: JSX\." apps/web/src/features/spaces/components/space-view.tsx` é vazio; os textos "Carregando documentos do espaço…", "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”." e "Não foi possível carregar os documentos do espaço." seguem em `apps/web/src/features/documents/components/space-documents.tsx`.
- [x] CA2.4 — API simulada: `apps/web/src/testing/mocks/db.ts`, lido, faz `spaceReachOf` devolver `'direct'` para espaço `free` do dono ou com `isSpaceMember`, e `seedFreeSpaceMembership` cria um documento com `accessLevel: 'edit'` e título `Ata da primeira reunião` no espaço livre; `apps/web/src/testing/mocks/handlers/spaces.ts` responde ao `GET` de `${env.API_URL}/spaces/:spaceId/documents` com 200 para esse `'direct'`; `apps/web/src/testing/mocks/utils.ts` contém `free-member`.
- [x] CA2.5 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/spaces/components/__tests__/space-view.test.tsx apps/web/src/app/routes/app/__tests__/space.test.tsx`, os casos nomeados em T2.3 (`space-view.test.tsx`: `renders documentsContent for a unit space`, `renders documentsContent for a free space above Pessoas neste espaço`, `a free space no longer shows the documents notice`; `space.test.tsx`: os 3); `rg -n "ainda não chegaram" apps/web/src` casa só em linhas com `queryByText` seguidas de `not.toBeInTheDocument` (lido) ou é vazio.
- [x] CA2.6 — Lendo os testes: `renders documentsContent for a free space above Pessoas neste espaço` confere que o conteúdo passado aparece antes do título "Pessoas neste espaço" na ordem do documento; `the free space page shows the owner document to a member` usa a semente `free-member` e assere o link `Ata da primeira reunião`; `creating a document in a free space sends the spaceId and navigates to it` confere o `spaceId` no corpo do `POST` e a rota do documento.
- [x] CA2.7 — `rg -n "sleep\(|waitForTimeout|setTimeout\(" apps/web/src/features/spaces/components/space-view.tsx apps/web/src/app/routes/app/space.tsx apps/web/src/features/spaces/components/__tests__/space-view.test.tsx apps/web/src/app/routes/app/__tests__/space.test.tsx` é vazio; `rg -n "eslint-disable" apps/web/src | rg -v -- "--"` é vazio.
- [x] CA2.8 — Cobertura ≥ 80% de linhas para `apps/web/src/features/spaces/components/space-view.tsx` e `apps/web/src/app/routes/app/space.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e da jornada e documentação: a fatia utilizável de ponta a ponta

- [x] T3.1 — Documentação da arquitetura
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer, em pt_BR: §3 "access": parágrafo **"Entrega `free-space-documents` (fatia 136)"**: participação em espaço (`UNIT` com lotação direta; `FREE` dono ou membro) = `edit`, relida a cada pedido na mesma consulta; ordem dono → lixeira → maior(compartilhamento, participação) → `none`; `readableDocumentsWhere` inclui o espaço livre; regra 11 da fronteira (só `access.service.ts` filtra `Document` por `members` ou pelo dono do espaço). §spaces: `reachOf` cobre `FREE` (dono ou membro → `'direct'`); `POST /documents` aceita `spaceId` de espaço livre.
  - Skills: —
  - Complexidade: baixa

- [x] T3.2 — Testes da fase 3 (e2e: dono cria no espaço livre, membro abre o documento do dono, só pelo teclado)
  - Arquivos: `apps/web/e2e/tests/free-space-documents.spec.ts` (criar)
  - O que fazer (D6): API simulada, estado inicial por `page.addInitScript`, como os specs existentes. `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo; a primeira asserção após cada mudança de rota usa `ROUTE_TIMEOUT`; `toBeFocused()` antes de cada `Enter`/`Space`/`Escape`; nenhum `waitForTimeout`; nenhuma regra do axe desativada; outros specs e `apps/web/e2e/a11y.ts` intocados.
    - `the owner creates a document in a free space using only the keyboard`: cria um espaço livre pelo teclado, vê "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”.", `expectNoSeriousA11yViolations(page)`, alcança "Novo documento" por `Tab`, aciona, chega ao documento, volta ao espaço e vê o documento como primeiro item da lista.
    - `a member opens the owner document of a free space`: novo contexto com `mock-space-members=free-member`; abre o espaço livre, vê o link "Ata da primeira reunião" na lista, `expectNoSeriousA11yViolations(page)`, alcança o link por `Tab` e o abre com `Enter`, chegando ao documento.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [x] CA3.1 — `pnpm test:e2e` na raiz sai com 0 (antigos e novos), e `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` continuam saindo com 0 e sem aviso, com o cache do `tsc` limpo.
- [x] CA3.2 — `apps/web/e2e/tests/free-space-documents.spec.ts` contém os casos `the owner creates a document in a free space using only the keyboard` e `a member opens the owner document of a free space`, e `pnpm --filter web exec playwright test --list` os lista. `rg -n "test\.skip|test\.only|waitForTimeout|disableRules" apps/web/e2e/tests/free-space-documents.spec.ts` é vazio.
- [x] CA3.3 — Lendo o spec: `const ROUTE_TIMEOUT = { timeout: 10_000 }` no topo e usado na primeira asserção após cada mudança de rota (asserção seguinte com timeout maior é aceita); `toBeFocused()` antes de cada tecla de ação; `expectNoSeriousA11yViolations(page)` nos dois casos; o primeiro assere o texto do vazio e o documento criado como primeiro item ao voltar; o segundo usa `mock-space-members` com `free-member` e assere o link `Ata da primeira reunião`.
- [x] CA3.4 — `docs/architecture.md` tem o parágrafo "Entrega `free-space-documents` (fatia 136)" citando `isSpaceMember` ou "participação", `readableDocumentsWhere`, a regra 11 e `reachOf` cobrindo `FREE`.
- [x] CA3.5 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `POST documents with a free spaceId answers 201 to a member in that space owned by the caller`, `the free space owner renames the member document with 200` e `GET space documents answers 200 to a member of a FREE space`; `pnpm exec vitest run --project web` (0) inclui `the free space page shows the owner document to a member`; `pnpm test:e2e` (0) inclui os dois casos de `free-space-documents.spec.ts`.

## Desvios previstos

- DV1 — `apps/api/src/spaces/__tests__/spaces.integration.test.ts`: `GET space documents answers 404 for a FREE space` afirmava a regra antiga (espaço livre sem lista) e é substituído pelos casos 200/404 de `FREE` em T1.4. Nenhum teste de `apps/api/src/documents/__tests__` afirma 404 para `spaceId` de espaço livre (conferido); `levelOf ignores membership outside a UNIT space` continua válido (lotação em espaço `FREE` sem ser dono nem membro segue `none`) e só tem o `space` falso completado.
- DV2 — `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx`: `renders unitContent for a unit space` vira `renders documentsContent for a unit space` (prop renomeada) e `a free space keeps the notice and ignores unitContent` vira `renders documentsContent for a free space above Pessoas neste espaço` (regra antiga).
- DV3 — O mesmo arquivo: em `shows the free space texts when the space is free`, `a FREE space shows Adicionar pessoa to its owner`, `a FREE space shows the member description without Adicionar pessoa` e `a FREE space shows Pessoas neste espaço with Remover to its owner`, a asserção do aviso "Os documentos deste espaço ainda não chegaram…" passa a afirmar a ausência dele; nomes mantidos. `apps/web/src/app/routes/app/__tests__/space.test.tsx` e os e2e `free-spaces.spec.ts` e `free-space-invite.spec.ts` não afirmam o aviso antigo e não mudam.

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
