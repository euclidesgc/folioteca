# PLAN 195 — share-with-space

Branch: `feature/195-share-with-space`

Fonte: `docs/features/195-share-with-space/spec.md` (D1…D8 são as decisões técnicas da SPEC e R1…R9 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O proprietário de um documento passa a compartilhá-lo com um **espaço livre** de que é dono ou membro, em "Pode ver" ou "Pode editar", pelo diálogo "Compartilhar documento": o grupo de rádios "Compartilhar com" ganha a terceira opção "Um espaço", que mostra um `<select>` "Espaço" (só espaços `free` de `GET /spaces`), o grupo "Nível de acesso" e o botão "Compartilhar". O compartilhamento é **uma linha por (documento, espaço)** na tabela nova `DocumentSpaceShare`, gravada por `PUT /documents/{documentId}/space-shares/{spaceId}`. Nada é gravado por pessoa: a decisão de acesso relê a cada pedido se a pessoa é dona ou membro do espaço livre. A lista "Quem tem acesso" (`GET /documents/{documentId}/shares`) passa a trazer `spaces: { spaceId, name, level }[]` em ordem pt-BR, e a web mostra uma linha por espaço entre "Todos da organização" e as pessoas. Espaços de unidade (198), trocar e remover pela linha (196) e o efeito ao vivo no `/collab` (197) **não** entram aqui.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos criados ou alterados na própria fase, listados no próprio critério, procura no arquivo onde o texto mora e usa padrão que não casa com comentário (linhas que começam com `//` ou `*` são excluídas por `-P` com `^(?!\s*(//|\*))`) nem com atributo de nome parecido (lookbehind `(?<![-\w])`, para que `disabled` não case `aria-disabled`). Quando o `rg` percorre uma pasta de `apps/web/src`, exclui a API simulada com `--glob '!**/testing/**'`. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` ou `pnpm test:e2e` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Migration escrita à mão**: a única migration nova é `apps/api/prisma/migrations/0022_document_space_share/migration.sql`; migrations anteriores não mudam. Nenhum subcomando de Prisma além de `prisma generate` e de `prisma migrate deploy` (a aplicação já usada pelos testes); **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- **Caminho único de decisão de acesso**: dono → lixeira → maior(espaço do documento, pessoa, instância, espaço compartilhado) → `none`. O espaço compartilhado nunca dá `owner`. `documentSpaceShare` (Prisma) e `"DocumentSpaceShare"` (SQL cru) só aparecem em `apps/api/src/access/access.service.ts` e `apps/api/src/documents/shares.service.ts`. Assinaturas de `resolveAccess`, `canWrite` e `readableDocumentsWhere` intocadas.
- Escopo de outra organização é testado **pelo serviço real** (Nest + Postgres), com ids gerados por `randomUUID()` de `node:crypto` ou criados pelos ajudantes existentes; nunca por mock do Prisma nem do `AccessService` nos testes de integração.
- Intocados de propósito: `apps/api/src/collab/**` (197), `apps/api/src/access/unit-reach.ts` e `apps/api/src/spaces/**` (198), `apps/api/src/documents/documents.service.ts`, `apps/api/src/documents/favorites.service.ts`, `apps/web/src/features/documents/components/document-view.tsx`, `apps/web/src/components/person-picker/**`, `apps/web/src/components/ui/**`, `docs/design.md` (nenhuma receita nova), migrations anteriores.
- Arquivo gerado do contrato (`packages/api-contract/src/generated/openapi.d.ts`) só pelo script de geração do pacote, nunca à mão. OpenAPI 3.1: valores possíveis por `enum`, **nunca** `nullable`.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum; botão nosso é sempre `Button`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case; feature não importa de outra feature. Textos de tela em pt_BR; código, comentários, caminhos e nomes de teste em en_US. A web não deriva regra de acesso: mostra o que o servidor diz (o filtro `type === 'free'` é pelo tipo devolvido, não regra de acesso).
- Rádios e selects nativos, **nunca** com `disabled` nativo: durante o envio ficam com `aria-disabled="true"`.
- Nenhum `style={{…}}` para aparência; nenhum `!important`.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada nem teste pulado para fazer passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Nenhuma exclusão nova.
- Testes de API de integração rodam contra o Postgres real e o servidor Nest real. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`. Esperas com `vi.waitFor`/`findBy…`/`waitFor`, nunca espera fixa (`setTimeout`/sleep).
- Testes existentes afetados são ajustados **sem trocar o nome** (se o nome continuar verdadeiro) e registrados na seção "Desvios" (DVn).
- O agente derruba tudo o que subir (servidores, watchers, navegadores) ao fim da tarefa.

## Fase 1 — API: compartilhar com um espaço livre e decidir acesso por ele

Caminhos relativos à raiz do repositório. A ordem importa: contrato e banco, depois a decisão em `access`, depois a rota. Ao fim da fase, pela API, o dono grava o compartilhamento com um espaço livre, a lista o mostra, e donos e membros do espaço abrem, listam e (em `edit`) editam o documento.

- [ ] T1.1 — Contrato e tabela do compartilhamento com espaço (D1, D2, D3, R2, R3)
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, regenerado pelo script); `apps/api/prisma/schema.prisma` (alterar); `apps/api/prisma/migrations/0022_document_space_share/migration.sql` (criar)
  - O que fazer:
    - `openapi.yaml`: operação `PUT /documents/{documentId}/space-shares/{spaceId}`, `operationId: shareDocumentWithSpace`, parâmetros de caminho `documentId` e `spaceId`, corpo `ShareDocumentInput` (existente), respostas 200 `DocumentSpaceShareResponse` (`data: DocumentSpaceAccess`), 400, 401, 403, 404 e 409 com `Error`, descrições em pt_BR na ordem 401 → 404 → 403 → 409 → 400. Schema `DocumentSpaceAccess` = `{ spaceId, name, level }`, todos obrigatórios, `level` com `enum: [view, edit]`. `DocumentAccessListResponse` passa a exigir `data`, `instance` e `spaces` (array de `DocumentSpaceAccess`). Sem `nullable`. Regenerar os tipos pelo script do pacote.
    - `schema.prisma`: `model DocumentSpaceShare` com `documentId String`, `spaceId String`, `level ShareLevel` (enum existente), `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, relações com `Document` e `Space` ambas `onDelete: Cascade, onUpdate: Cascade`, `@@id([documentId, spaceId])`, `@@index([spaceId])`; em `Document`, `spaceShares DocumentSpaceShare[]`; em `Space`, `documentShares DocumentSpaceShare[]`.
    - `migration.sql` escrita à mão, no estilo da `0015`/`0021`: `CREATE TABLE "DocumentSpaceShare"` com `CONSTRAINT "DocumentSpaceShare_pkey" PRIMARY KEY ("documentId", "spaceId")`, `CREATE INDEX "DocumentSpaceShare_spaceId_idx"` e duas chaves estrangeiras (para `"Document"("id")` e `"Space"("id")`) com `ON DELETE CASCADE ON UPDATE CASCADE`. Aplicada só por `prisma migrate deploy`.
  - Skills: api-requests
  - Complexidade: média

- [ ] T1.2 — O espaço compartilhado entra no caminho único de acesso (D4, R4, R5, R6, R7)
  - Arquivos: `apps/api/src/access/access.service.ts` (alterar)
  - O que fazer:
    - Função local `freeSpaceReachedBy(personId)` que devolve `{ type: 'FREE', OR: [{ ownerId: personId }, { members: { some: { personId } } }] }`; passa a ser usada também no ramo de espaço livre já existente de `readableDocumentsWhere`.
    - `findDecision`: acrescentar ao `select` do documento `spaceShares: { where: { space: freeSpaceReachedBy(personId) }, select: { level: true } }` — continua uma consulta. `spaceShareLevel` = `'edit'` se alguma linha for `EDIT`, `'view'` se houver alguma, senão `null`.
    - `DocumentDecision` ganha `spaceShareLevel: 'view' | 'edit' | null`. `levelOf`: dono → lixeira (`none`) → `'edit'` se qualquer de espaço do documento, pessoa, instância ou espaço compartilhado for `'edit'` → senão o primeiro não nulo → `'none'`. Nunca `owner` pelo espaço compartilhado.
    - A condição que dispara a leitura da herança de unidade ganha também `spaceShareLevel !== 'edit'`.
    - `readableDocumentsWhere`: novo ramo no `OR` `{ spaceShares: { some: { space: freeSpaceReachedBy(personId) } } }`; `trashedAt: null` continua no topo.
  - Skills: authorization, security
  - Complexidade: alta

- [ ] T1.3 — Rota e serviço do compartilhamento com espaço; lista com `spaces` (D2, D3, R1, R2, R3, R6, R7)
  - Arquivos: `apps/api/src/documents/shares.service.ts` (alterar); `apps/api/src/documents/documents.controller.ts` (alterar)
  - O que fazer:
    - `SharesService.shareSpace(requester, documentId, spaceId, body)`: `resolveAccess` → `none` lança `documentNotFound()` (404 "Documento não encontrado."); diferente de `owner` → 403 `OWNER_ONLY_MESSAGE` ("Só o proprietário pode compartilhar este documento."); `canWrite` falso → 409 `TRASHED_DOCUMENT_MESSAGE` ("Este documento está na lixeira. Restaure-o para editar."); `parseBody(shareDocumentSchema)` (400); então `isUuid(spaceId)` e `space.findFirst({ where: { id: spaceId, type: 'FREE', organizationId: requester.organizationId, OR: [{ ownerId: requester.id }, { members: { some: { personId: requester.id } } }] }, select: { id: true, name: true } })`; malformado ou ausente → 400 "Espaço não encontrado entre os seus espaços livres." (constante nova, mesma mensagem para inexistente, pessoal, de unidade, de outra organização e livre alheio); `documentSpaceShare.upsert` pela chave composta. Devolve `{ data: { spaceId, name, level } }` com `level` em minúsculas. Não chama `notifyShareChanged`.
    - `SharesService.list`: depois da decisão de acesso, `documentSpaceShare.findMany({ where: { documentId }, select: { level, space: { select: { id, name } } } })`, descarta linhas com `name` nulo, ordena por `ptBrCollator` no nome e depois `spaceId`, e devolve `{ data, instance, spaces }` (`spaces: []` sem linhas). Não filtra pelo alcance atual do dono.
    - `documents.controller.ts`: `@Put(':documentId/space-shares/:spaceId')` com `@Param('documentId')` e `@Param('spaceId')`, sessão obrigatória (401), 200, delegando a `shareSpace`.
  - Skills: authorization, security
  - Complexidade: média

- [ ] T1.4 — Testes da fase 1
  - Arquivos: `apps/api/src/access/__tests__/document-access-boundary.test.ts` (alterar); `apps/api/src/access/__tests__/access.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/shares.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/shares.service.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/favorites.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.contract.test.ts` (alterar)
  - O que fazer (D7, D8): `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, espaço e documento. Dublês afetados (registrar em Desvios, nomes mantidos): Prisma dublê de `shares.service.test.ts` ganha `documentSpaceShare` e `space`; se `access-level.test.ts` quebrar pelo `select` novo, o dublê ganha `spaceShares: []`. Fronteira: regras 1–8 e 10–13 com o mesmo texto; regra 9 estendida a `documentSpaceShare` e `"DocumentSpaceShare"` (exemplos infrator e conforme); regra 14 nova. Casos novos com os nomes literais:
    - `document-access-boundary.test.ts` (`unit-testing`):
      - `rule 9 flags documentSpaceShare outside access and shares service`
      - `rule 9 accepts documentSpaceShare in access service and shares service`
      - `rule 14: readableDocumentsWhere reaches documents shared with free spaces`
      - `rule 14: no Document read outside access filters by spaceShares`
      - `rule 14 flags the offending example and accepts the conforming one`
    - `access.integration.test.ts` (`integration-testing`):
      - `a view member of a space shared with edit gets edit`
      - `a space view share gives view and canWrite false to a member`
      - `the owner of a shared free space gets access`
      - `a member added after the space share gets access`
      - `a member removed from the space gets none and no readable documents`
      - `a random person id gets none and no readable documents from a space share`
      - `a personal view share plus a space edit share gives edit`
      - `an instance view share plus a space edit share gives edit`
      - `a trashed document with a space share gives none to a member and owner to the owner`
      - `deleting the space removes its document shares`
    - `shares.integration.test.ts` (`integration-testing`):
      - `PUT space-shares on an owned free space answers 200 and the list shows it`
      - `PUT space-shares on a free space the owner is a view member of answers 200`
      - `PUT space-shares switches view to edit and back on a single row`
      - `two space shares make two rows in pt-BR order`
      - `PUT space-shares on a unit space answers 400 with the message`
      - `PUT space-shares on a personal space answers 400 with the message`
      - `PUT space-shares on a free space of someone else answers 400 with the message`
      - `PUT space-shares on a random space id answers 400 with the message`
      - `PUT space-shares on a malformed space id answers 400 with the message`
      - `PUT space-shares with an invalid body answers 400 after the access checks`
      - `PUT space-shares by a person reached only through the space answers 403`
      - `PUT space-shares by a view share answers 403`
      - `PUT space-shares on a document without access answers 404`
      - `PUT space-shares on a missing document answers 404`
      - `PUT space-shares on a trashed document answers 409 and keeps the level`
      - `a restored document keeps its space share level`
      - `PUT space-shares answers 401 without session`
      - `GET shares answers an empty spaces list without space shares`
    - `shares.service.test.ts` (`unit-testing`):
      - `shareSpace checks 404 then 403 then 409 then body 400 then space 400`
    - `documents.integration.test.ts` (`integration-testing`):
      - `a space member opens a shared document with the right accessLevel`
      - `a document shared with a space appears in the member lists`
      - `a member through a space share gets 403 on trash and delete`
    - `favorites.integration.test.ts` (`integration-testing`):
      - `a favorite reached only through a space share is listed`
    - `documents.contract.test.ts` (`integration-testing`):
      - `PUT space-shares has the same path and parameters in the controller and the contract`
      - `PUT space-shares matches the 200 contract`
      - `GET shares matches the contract with spaces`
  - Skills: unit-testing, integration-testing, authorization
  - Complexidade: alta

### Critérios de aceite da fase 1

- [ ] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [ ] CA1.2 — Existe `apps/api/prisma/migrations/0022_document_space_share/migration.sql` com `CREATE TABLE "DocumentSpaceShare"`, `"DocumentSpaceShare_pkey" PRIMARY KEY ("documentId", "spaceId")`, `"DocumentSpaceShare_spaceId_idx"` e duas chaves estrangeiras (para `"Document"` e `"Space"`) com `ON DELETE CASCADE`; é a única pasta de migration começando por `0022`, e nenhuma migration anterior aparece em `git status --porcelain apps/api/prisma/migrations`. `schema.prisma` tem `model DocumentSpaceShare` com `@@id([documentId, spaceId])`, `@@index([spaceId])` e `level ShareLevel`; `Document` tem `spaceShares DocumentSpaceShare[]` e `Space` tem `documentShares DocumentSpaceShare[]`.
- [ ] CA1.3 — Sem migration gerada nem restrição mexida: `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/access/__tests__ apps/api/src/documents/__tests__` é vazio.
- [ ] CA1.4 — `packages/api-contract/openapi.yaml` tem a operação `shareDocumentWithSpace` no caminho `/documents/{documentId}/space-shares/{spaceId}` (método `put`) com parâmetros `documentId` e `spaceId` e respostas 200, 400, 401, 403, 404 e 409; `DocumentSpaceAccess` exige `spaceId`, `name` e `level` (`enum` `view`, `edit`); `DocumentAccessListResponse` exige `spaces`; `rg -n "nullable" packages/api-contract/openapi.yaml` é vazio. `apps/api/src/documents/documents.controller.ts` tem `@Put(':documentId/space-shares/:spaceId')` com `@Param('documentId')` e `@Param('spaceId')`, e o caso `PUT space-shares has the same path and parameters in the controller and the contract` prova a identidade lendo os dois.
- [ ] CA1.5 — Lendo `apps/api/src/access/access.service.ts`: existe a função local `freeSpaceReachedBy` usada em `findDecision` e nos dois ramos de espaço livre de `readableDocumentsWhere`; `DocumentDecision` tem `spaceShareLevel: 'view' | 'edit' | null`; `findDecision` continua com uma consulta no caminho comum; `levelOf` segue dono → lixeira → `edit` se algum dos quatro for `edit` → primeiro não nulo → `none`, e nenhum ramo do espaço compartilhado devolve `owner`; a condição da herança inclui `spaceShareLevel !== 'edit'`; a definição de `readableDocumentsWhere` contém `spaceShares:` e `trashedAt: null` no topo.
- [ ] CA1.6 — Só a porta toca a tabela: `rg -n -P "^(?!\s*(//|\*)).*(documentSpaceShare|\"DocumentSpaceShare\")" apps/api/src --glob '!**/__tests__/**'` só casa `apps/api/src/access/access.service.ts` e `apps/api/src/documents/shares.service.ts`. `git status --porcelain apps/api/src/collab apps/api/src/spaces apps/api/src/documents/documents.service.ts apps/api/src/documents/favorites.service.ts apps/api/src/access/unit-reach.ts` é vazio.
- [ ] CA1.7 — Lendo `apps/api/src/documents/shares.service.ts`: `shareSpace` faz, nesta ordem, 404 opaco para `none`, 403 com `OWNER_ONLY_MESSAGE` para quem não é dono, 409 com `TRASHED_DOCUMENT_MESSAGE`, 400 do corpo, e só então procura o espaço com `type: 'FREE'`, `organizationId` do pedinte e dono-ou-membro, respondendo 400 "Espaço não encontrado entre os seus espaços livres." quando malformado ou ausente; grava por `upsert` na chave composta; não chama `notifyShareChanged`. `list` devolve `spaces` ordenado com `ptBrCollator` e descarta nome nulo.
- [ ] CA1.8 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\("` nos arquivos de T1.4, os 41 casos nomeados em T1.4 com os nomes literais (`document-access-boundary.test.ts`: 5; `access.integration.test.ts`: 10; `shares.integration.test.ts`: 18; `shares.service.test.ts`: 1; `documents.integration.test.ts`: 3; `favorites.integration.test.ts`: 1; `documents.contract.test.ts`: 3). As regras 10 a 13 de `document-access-boundary.test.ts` estão com o mesmo texto de antes; a regra 14 tem exemplo infrator e conforme e o código real respondendo.
- [ ] CA1.9 — Lendo os testes: `a random person id gets none and no readable documents from a space share` e `PUT space-shares on a random space id answers 400 with the message` usam `randomUUID()` de `node:crypto` e passam pelo serviço real; `a member added after the space share gets access` cria a pertença depois do `PUT`; `PUT space-shares on a trashed document answers 409 and keeps the level` confere o nível guardado depois do 409; `PUT space-shares switches view to edit and back on a single row` conta uma linha só em `DocumentSpaceShare`. `rg -n "vi\.mock\(" apps/api/src/access/__tests__/access.integration.test.ts apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/documents/__tests__/documents.integration.test.ts apps/api/src/documents/__tests__/favorites.integration.test.ts` não traz mock de Prisma nem de `AccessService`.
- [ ] CA1.10 — Cobertura ≥ 80% de linhas para `apps/api/src/access/access.service.ts`, `apps/api/src/documents/shares.service.ts` e `apps/api/src/documents/documents.controller.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: "Um espaço" no diálogo e as linhas de espaço

Caminhos relativos à raiz do repositório. A ordem importa: mover `use-spaces` para o compartilhado, depois chamada e API simulada, depois a tela. Ao fim da fase, na web com a API simulada, o dono escolhe "Um espaço", escolhe o espaço, compartilha e vê a linha na lista.

- [ ] T2.1 — Mover a consulta de espaços para o compartilhado (D5)
  - Arquivos: `apps/web/src/hooks/use-spaces.ts` (criar); `apps/web/src/features/spaces/api/get-spaces.ts` (excluir); `apps/web/src/hooks/__tests__/use-spaces.test.tsx` (criar, movido de `apps/web/src/features/spaces/api/__tests__/get-spaces.test.tsx`); `apps/web/src/features/spaces/api/__tests__/get-spaces.test.tsx` (excluir); `apps/web/src/features/spaces/api/create-space.ts` (alterar); `apps/web/src/features/spaces/components/space-view.tsx` (alterar); `apps/web/src/features/spaces/components/create-space-form.tsx` (alterar); `apps/web/src/features/spaces/components/sidebar-free-spaces.tsx` (alterar); `apps/web/src/features/spaces/components/sidebar-unit-spaces.tsx` (alterar); `apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx` (alterar); `apps/web/src/features/spaces/components/__tests__/sidebar-unit-spaces.test.tsx` (alterar)
  - O que fazer: conteúdo de `get-spaces.ts` passa a `@/hooks/use-spaces` sem mudar comportamento (`useSpaces`, chave `['spaces']`, `staleTime: 0`, tipos `Space` e `SpacesResponse`); `SpaceResponse` passa a ser declarado em `create-space.ts`, único consumidor. O teste é movido com os mesmos casos e nomes, mudando só o import. Os demais arquivos da feature `spaces` e seus testes mudam **só a linha de import** (nomes de teste mantidos; registrar em Desvios).
  - Skills: project-structure, api-requests, unit-testing
  - Complexidade: baixa

- [ ] T2.2 — Chamada, tipo da lista e API simulada do compartilhamento com espaço (D2, D3, D5)
  - Arquivos: `apps/web/src/features/documents/api/share-document-with-space.ts` (criar); `apps/web/src/features/documents/api/get-document-shares.ts` (alterar); `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar)
  - O que fazer:
    - `share-document-with-space.ts`: `shareDocumentWithSpace({ documentId, spaceId, level }: { documentId: string; spaceId: string; level: 'view' | 'edit' })` faz `PUT /documents/${documentId}/space-shares/${spaceId}` com `{ level }` e `silentError: true`; `useShareDocumentWithSpace` faz `await queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })` antes do `onSuccess` do chamador. Tipos a partir do contrato gerado.
    - `get-document-shares.ts`: tipo da resposta com `spaces: { spaceId: string; name: string; level: 'view' | 'edit' }[]`.
    - `db.ts`: compartilhamentos com espaço por documento e `spaces` na lista de acesso, em ordem pt-BR.
    - `handlers/documents.ts`: `http.put` de `…/documents/:documentId/space-shares/:spaceId` com a ordem 404 → 403 → 409 → 400 de corpo → 400 de espaço ("Espaço não encontrado entre os seus espaços livres.") e as mesmas mensagens do servidor; o `GET …/shares` devolve `spaces`.
  - Skills: api-requests, api-mocking
  - Complexidade: baixa

- [ ] T2.3 — "Um espaço" no painel e linhas de espaço na lista (D5, D6, R1, R3, R8, R9)
  - Arquivos: `apps/web/src/features/documents/components/share-document-dialog.tsx` (alterar)
  - O que fazer (receitas "Escolha entre opções (rádios)", "Campo de formulário", "Lista", "Selo de status", "Botão principal", "Aviso de erro" do `docs/design.md`; o `<select>` segue o `LevelSelect` existente; nenhuma receita nova):
    - `ShareTarget` ganha `'space'`; `ShareTargetGroup` ganha a terceira opção "Um espaço", com a dica "Todos que participam do espaço, inclusive quem entrar depois.".
    - Com `space`: `useSpaces` (de `@/hooks/use-spaces`) habilitado só então; opções = espaços com `type === 'free'`. Um `<select>` nativo com `<label>` "Espaço", primeira opção vazia "Escolha um espaço", largura toda a 360px; abaixo o `ShareLevelGroup` ("Nível de acesso", "Pode ver" padrão) e o `Button` "Compartilhar" / "Compartilhando…" com a trava por ref existente. Sem espaço escolhido o botão fica `aria-disabled` e o clique não envia. Durante o envio, rádios e o `<select>` ficam `aria-disabled="true"`, sem `disabled` nativo.
    - Estados do seletor, no lugar do `<select>`: carregando "Carregando seus espaços…" em `role="status"`; vazio "Você não participa de nenhum espaço livre." em tom suave; erro "Não foi possível carregar seus espaços." com `Button` "Tentar de novo" em `role="alert"`, com destaque de erro.
    - Sucesso: "Documento compartilhado com <nome do espaço>." no mesmo `<p aria-live="polite">`; nível volta a "Pode ver"; o espaço continua escolhido; o diálogo não fecha. Erro: `getShareErrorMessage` existente (400 com a mensagem do servidor, 409 "Este documento está na lixeira. Restaure-o para editar.", genérico "Não foi possível compartilhar o documento. Tente de novo.") em `role="alert"`.
    - `AccessListStates` recebe `spaces`; depois da linha "Todos da organização" (se houver) e antes das pessoas, uma linha por espaço pelo componente `SpaceAccessRow` (mesmo arquivo): nome à esquerda com `min-w-0 truncate`, selo "Espaço" e selo "Pode ver"/"Pode editar" à direita (`BADGE_CLASS_NAME`). Sem controle nem foco nessa linha; a linha de cima da remoção de pessoa continua a instância ou o dono.
  - Skills: interface-design, forms, component-robustness
  - Complexidade: média

- [ ] T2.4 — Testes da fase 2
  - Arquivos: `apps/web/src/features/documents/api/__tests__/share-document-with-space.test.tsx` (criar); `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` (alterar)
  - O que fazer: API simulada por MSW com o banco falso; localizar por papel e nome acessível em pt_BR; esperas com `findBy…`/`waitFor`, nunca espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Respostas simuladas antigas de `GET …/shares` passam a incluir `spaces: []` (registrar em Desvios, nomes mantidos). Casos novos com os nomes literais:
    - `share-document-with-space.test.tsx` (`unit-testing`):
      - `shareDocumentWithSpace sends PUT to the space-shares path with the level`
      - `useShareDocumentWithSpace awaits the shares invalidation before onSuccess`
      - `useShareDocumentWithSpace surfaces a 400 as an error`
    - `share-document-dialog.test.tsx` (`component-testing`):
      - `choosing Um espaço shows the space select with only free spaces`
      - `the space select shows the loading state`
      - `the space select shows the empty state`
      - `the space select shows the error state and retries`
      - `without a chosen space the share is not sent`
      - `while sharing with a space the radios and the select are aria-disabled and not disabled`
      - `a double click shares with the space only once`
      - `sharing with a space shows the success message and the row between the instance and the people`
      - `sharing with the same space again switches the badge without duplicating the row`
      - `a space out of reach shows the server message`
      - `a trashed document shows the trash message when sharing with a space`
  - Skills: unit-testing, component-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [ ] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`.
- [ ] CA2.2 — `apps/web/src/hooks/use-spaces.ts` exporta `useSpaces` com a chave `['spaces']`; `apps/web/src/features/spaces/api/get-spaces.ts` e `apps/web/src/features/spaces/api/__tests__/get-spaces.test.tsx` não existem; `rg -n "get-spaces" apps/web/src` é vazio; `SpaceResponse` é declarado em `apps/web/src/features/spaces/api/create-space.ts`. `apps/web/src/hooks/__tests__/use-spaces.test.tsx` tem os mesmos nomes de caso do arquivo antigo, e nos testes de `features/spaces` alterados em T2.1 só a linha de import mudou (conferido nos Desvios).
- [ ] CA2.3 — `apps/web/src/features/documents/api/share-document-with-space.ts` exporta `shareDocumentWithSpace` e `useShareDocumentWithSpace`; o fetcher usa o caminho `/space-shares/` e `silentError: true`; o hook faz `await` de `invalidateQueries` com a chave `['document-shares', documentId]` antes do `onSuccess` do chamador. `get-document-shares.ts` tipa `spaces` com `spaceId`, `name` e `level: 'view' | 'edit'`.
- [ ] CA2.4 — `apps/web/src/features/documents/components/share-document-dialog.tsx` contém os literais "Um espaço", "Todos que participam do espaço, inclusive quem entrar depois.", "Espaço", "Escolha um espaço", "Carregando seus espaços…", "Você não participa de nenhum espaço livre.", "Não foi possível carregar seus espaços.", "Tentar de novo", "Documento compartilhado com " e o componente `SpaceAccessRow`, e importa `useSpaces` de `@/hooks/use-spaces`. Sem `disabled` nativo em rádio ou select: `rg -n -P "^(?!\s*(//|\*)).*(?<![-\w])disabled[=:{]" apps/web/src/features/documents/components/share-document-dialog.tsx` não casa `<input type="radio">` nem `<select>` (só `Button`, se houver).
- [ ] CA2.5 — Acabamento (piso de `interface-design`, lendo `share-document-dialog.tsx`): o `<select>` tem `<label>` "Espaço" e ocupa a largura toda; o estado de carregando tem `role="status"`, o de erro `role="alert"` com borda ou fundo de destaque e `Button` "Tentar de novo", o vazio em tom suave; `SpaceAccessRow` separa o nome (com `truncate`) à esquerda dos selos "Espaço" e do nível à direita, ambos com `BADGE_CLASS_NAME`; o sucesso fica no `<p aria-live="polite">`. `rg -n -P "^(?!\s*(//|\*)).*(style=\{\{|!important|forwardRef|: JSX\.|<a href|<button)" apps/web/src/features/documents/components/share-document-dialog.tsx apps/web/src/features/documents/api/share-document-with-space.ts apps/web/src/hooks/use-spaces.ts` é vazio. `git status --porcelain apps/web/src/components apps/web/src/features/documents/components/document-view.tsx docs/design.md` é vazio.
- [ ] CA2.6 — Nenhum import entre features: `rg -n -P "@/features/(?!documents)" apps/web/src/features/documents --glob '!**/testing/**'` e `rg -n -P "@/features/(?!spaces)" apps/web/src/features/spaces --glob '!**/testing/**'` são vazios.
- [ ] CA2.7 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\("` nos dois arquivos de T2.4, os 14 casos nomeados com os nomes literais (`share-document-with-space.test.tsx`: 3; `share-document-dialog.test.tsx`: 11). Lendo: `choosing Um espaço shows the space select with only free spaces` tem um espaço de unidade na resposta e assere que ele não aparece; `while sharing with a space the radios and the select are aria-disabled and not disabled` assere `aria-disabled="true"` e `not.toBeDisabled()`; `a double click shares with the space only once` e `without a chosen space the share is not sent` contam os `PUT`; `sharing with a space shows the success message and the row between the instance and the people` assere "Documento compartilhado com <nome>.", a ordem dono → "Todos da organização" → espaço → pessoas e o diálogo aberto. `rg -n "sleep\(|waitForTimeout|setTimeout|\.only\(|\.skip\(" ` nos dois arquivos é vazio.
- [ ] CA2.8 — Cobertura ≥ 80% de linhas para `apps/web/src/hooks/use-spaces.ts`, `apps/web/src/features/documents/api/share-document-with-space.ts`, `apps/web/src/features/documents/api/get-document-shares.ts` e `apps/web/src/features/documents/components/share-document-dialog.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e e documentação

Caminhos relativos à raiz do repositório. Ao fim da fase, a fatia está utilizável de ponta a ponta e documentada.

- [ ] T3.1 — Documentação do espaço compartilhado no caminho único
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer: §3 "access": a decisão passa a dono → lixeira → maior(espaço do documento, pessoa, instância, espaço compartilhado) → `none`; o compartilhamento com espaço é a tabela `DocumentSpaceShare` (uma linha por documento e espaço), vale só para espaço livre de que a pessoa é dona ou membro, relido a cada pedido em `findDecision` e em `readableDocumentsWhere` por `freeSpaceReachedBy`; regra 9 estendida a `DocumentSpaceShare` e regra 14 do teste de fronteira; rota `PUT /documents/{documentId}/space-shares/{spaceId}` e o campo `spaces` de `GET …/shares`; `useSpaces` em `@/hooks/use-spaces`.
  - Skills: —
  - Complexidade: baixa

- [ ] T3.2 — e2e: o dono compartilha com um espaço livre (D7, R1, R3, R8)
  - Arquivos: `apps/web/e2e/tests/share-with-space.spec.ts` (criar)
  - O que fazer: com a API simulada (não persiste entre recargas; sem `page.reload()` e sem `/collab`), o dono abre um documento, abre "Compartilhar documento", escolhe "Um espaço", escolhe um espaço livre em "Espaço", marca "Pode editar", clica em "Compartilhar", vê "Documento compartilhado com <nome>." e a linha do espaço com os selos "Espaço" e "Pode editar". `localStorage` só para montar o estado inicial, antes da primeira navegação; esperas por `expect(...)` com `ROUTE_TIMEOUT`; `expectNoSeriousA11yViolations` com o diálogo aberto. Sem `waitForTimeout`, `.skip(` nem `.only(`. Teste: `the owner shares a document with a free space and sees the row`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [ ] CA3.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm test:e2e` (a suíte inteira) saem com 0 e sem aviso.
- [ ] CA3.2 — `apps/web/e2e/tests/share-with-space.spec.ts` tem o teste `the owner shares a document with a free space and sees the row`, que usa `ROUTE_TIMEOUT` e `expectNoSeriousA11yViolations(` (chamado depois de abrir o diálogo e antes de fechá-lo); `rg -n "waitForTimeout|\.skip\(|\.only\(|reload\(|/collab" apps/web/e2e/tests/share-with-space.spec.ts` é vazio; toda ocorrência de `localStorage` no arquivo está antes do primeiro `goto` do teste.
- [ ] CA3.3 — `docs/architecture.md` cita `DocumentSpaceShare`, `space-shares`, "espaço livre" como condição do compartilhamento com espaço e a regra 14.
- [ ] CA3.4 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `PUT space-shares on an owned free space answers 200 and the list shows it` e `a view member of a space shared with edit gets edit`; `pnpm exec vitest run --project web` (0) inclui `sharing with a space shows the success message and the row between the instance and the people`; `pnpm test:e2e` (0) inclui `the owner shares a document with a free space and sees the row`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste ou um critério precisar de literal diferente com o mesmo comportamento.

- DV1 (T2.1, previsto) — `apps/web/src/features/spaces/components/__tests__/create-space-form.test.tsx` e `sidebar-unit-spaces.test.tsx`: só o import de `get-spaces` passa a `@/hooks/use-spaces`; o teste de `get-spaces.test.tsx` vai para `apps/web/src/hooks/__tests__/use-spaces.test.tsx` com o import ajustado. Nomes mantidos.

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
