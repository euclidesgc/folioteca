# PLAN 190 — share-with-instance

Branch: `feature/190-share-with-instance`

Fonte: `docs/features/190-share-with-instance/spec.md` (D1…D8 são as decisões técnicas da SPEC e R1…R9 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Hocuspocus (canal `/collab`), Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

O proprietário de um documento passa a compartilhá-lo com **todos da organização** (a instância), em "Pode ver" ou "Pode editar", pelo diálogo "Compartilhar documento": um grupo de rádios "Compartilhar com" ("Uma pessoa" / "Todos da organização") troca a busca de pessoa pelo grupo "Nível de acesso" e o botão "Compartilhar". O compartilhamento é **uma linha por documento** na tabela nova `DocumentInstanceShare` (chave primária `documentId`), gravada por `PUT /documents/{documentId}/instance-share`. Nada é gravado por pessoa: a decisão de acesso relê a cada pedido se a pessoa pertence à organização do dono, e quem entra depois também alcança. A lista "Quem tem acesso" (`GET /documents/{documentId}/shares`) passa a trazer `instance: { level: 'none' | 'view' | 'edit' }`, e a web mostra a linha "Todos da organização" logo depois do dono. Trocar e remover pela linha (fatia 191) e o efeito ao vivo no `/collab` (fatia 192) **não** entram aqui.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos criados ou alterados na própria fase, listados no próprio critério, procura no arquivo onde o texto mora e usa padrão que não casa com comentário (linhas que começam com `//` ou `*` são excluídas por `-P` com `^(?!\s*(//|\*))`). Quando o `rg` percorre uma pasta de `apps/web/src`, exclui a API simulada com `--glob '!**/testing/**'`. O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` ou `pnpm test:e2e` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Migration escrita à mão**: a única migration nova é `apps/api/prisma/migrations/0021_document_instance_share/migration.sql`; migrations anteriores não mudam. Nenhum subcomando de Prisma além de `prisma generate` e de `prisma migrate deploy` (a aplicação já usada pelos testes); **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- **Caminho único de decisão de acesso**: dono → lixeira → maior(pessoa, instância, espaço) → `none`. A instância nunca dá `owner`. `documentInstanceShare` (Prisma) e `"DocumentInstanceShare"` (SQL cru) só aparecem em `apps/api/src/access/access.service.ts` e `apps/api/src/documents/shares.service.ts`. Assinaturas de `resolveAccess`, `canWrite` e `readableDocumentsWhere` intocadas.
- Escopo de outra organização é testado **pelo serviço real** (Nest + Postgres), com ids gerados por `randomUUID()` de `node:crypto` ou criados pelos ajudantes existentes; nunca por mock do Prisma nem do `AccessService` nos testes de integração.
- Intocados de propósito: `apps/api/src/collab/**` (192), `apps/api/src/documents/documents.service.ts`, `apps/api/src/documents/favorites.service.ts`, `apps/api/src/access/unit-reach.ts`, `apps/web/src/features/documents/components/document-view.tsx`, `apps/web/src/features/documents/api/share-document.ts`, `apps/web/src/features/documents/api/remove-document-share.ts`, `apps/web/src/components/person-picker/**`, `apps/web/src/components/ui/**`, `apps/web/src/features/spaces/**`, `docs/design.md` (nenhuma receita nova).
- Arquivo gerado do contrato (`packages/api-contract/src/generated/openapi.d.ts`) só pelo script de geração do pacote, nunca à mão. OpenAPI 3.1: valores possíveis por `enum`, **nunca** `nullable`.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum; botão nosso é sempre `Button`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case; feature não importa de outra feature. Textos de tela em pt_BR; código, comentários, caminhos e nomes de teste em en_US. A web não deriva regra de acesso: mostra o que o servidor diz.
- Rádios nativos, **nunca** com `disabled` nativo: durante o envio ficam com `aria-disabled="true"` e o foco continua no rádio marcado.
- Nenhum `style={{…}}` para aparência; nenhum `!important`.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada nem teste pulado para fazer passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Nenhuma exclusão nova.
- Testes de API de integração rodam contra o Postgres real e o servidor Nest real. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`. Esperas com `vi.waitFor`/`findBy…`/`waitFor`, nunca espera fixa (`setTimeout`/sleep).
- Testes existentes afetados são ajustados **sem trocar o nome** (se o nome continuar verdadeiro) e registrados na seção "Desvios" (DVn).
- O agente derruba tudo o que subir (servidores, watchers, navegadores) ao fim da tarefa.

## Fase 1 — API: compartilhar com a instância e decidir acesso por ela

Caminhos relativos à raiz do repositório. A ordem importa: contrato e banco, depois a decisão em `access`, depois a rota. Ao fim da fase, pela API, o dono grava o compartilhamento com a instância, a lista o mostra, e qualquer pessoa da organização do dono abre, lista e (em `edit`) edita o documento.

- [x] T1.1 — Contrato e tabela do compartilhamento com a instância (D1, D2, D3, R2, R3)
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, regenerado pelo script); `apps/api/prisma/schema.prisma` (alterar); `apps/api/prisma/migrations/0021_document_instance_share/migration.sql` (criar)
  - O que fazer:
    - `openapi.yaml`: operação `PUT /documents/{documentId}/instance-share`, `operationId: shareDocumentWithInstance`, parâmetro de caminho `documentId`, corpo `ShareDocumentInput` (o existente, `level` `view`/`edit`), respostas 200 `DocumentInstanceShareResponse` (`data: { level }` com `enum: [view, edit]`), 400, 401, 403, 404 e 409 com `Error`, descrições em pt_BR na ordem 401 → 404 → 403 → 409 → 400. Schema `DocumentInstanceAccess` = `{ level }` obrigatório com `enum: [none, view, edit]`; `DocumentAccessListResponse` passa a exigir `data` e `instance` (`DocumentInstanceAccess`). Sem `nullable`. Regenerar os tipos pelo script do pacote.
    - `schema.prisma`: `model DocumentInstanceShare` com `documentId String @id`, `level ShareLevel` (enum existente), `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, relação com `Document` `onDelete: Cascade, onUpdate: Cascade`; em `Document`, `instanceShare DocumentInstanceShare?`. Sem coluna de organização.
    - `migration.sql` escrita à mão, no estilo da `0015`: `CREATE TABLE "DocumentInstanceShare"` com `CONSTRAINT "DocumentInstanceShare_pkey" PRIMARY KEY ("documentId")` e a chave estrangeira para `"Document"("id")` com `ON DELETE CASCADE ON UPDATE CASCADE`. Sem índice extra. Aplicada só por `prisma migrate deploy`.
  - Skills: api-requests
  - Complexidade: média

- [x] T1.2 — A instância entra no caminho único de acesso (D4, R4, R5, R6, R7)
  - Arquivos: `apps/api/src/access/access.service.ts` (alterar)
  - O que fazer:
    - `findDecision`: acrescentar ao `select` do documento `instanceShare: { select: { level: true } }` e, pelo dono, as pessoas da organização do dono filtradas por `id: personId` (`owner → organization → people where id = personId`). Continua uma consulta no caminho comum. `instanceLevel` = nível gravado **só** se a pessoa está entre as pessoas da organização do dono; senão `null`.
    - `DocumentDecision` ganha `instanceLevel: 'view' | 'edit' | null`. `levelOf` (puro): dono → lixeira (`none`) → `'edit'` se espaço, pessoa ou instância for `'edit'` → senão o primeiro não nulo entre espaço, pessoa e instância → `'none'`. A instância nunca dá `owner`.
    - A condição que dispara a leitura da herança (fatia 152) ganha também "instância diferente de `'edit'`".
    - `readableDocumentsWhere`: novo ramo no `OR` com `instanceShare: { isNot: null }` e a organização do dono contendo a pessoa (`organization: { people: { some: { id: personId } } } }` sob `owner`); `trashedAt: null` continua no topo.
  - Skills: authorization, security
  - Complexidade: alta

- [x] T1.3 — Rota e serviço do compartilhamento com a instância; lista com `instance` (D2, D3, R1, R2, R3, R6, R7)
  - Arquivos: `apps/api/src/documents/shares.service.ts` (alterar); `apps/api/src/documents/documents.controller.ts` (alterar)
  - O que fazer:
    - `SharesService.shareInstance(requester, documentId, body)`: `resolveAccess` → `none` lança `documentNotFound()` (404 "Documento não encontrado."); diferente de `owner` → `ForbiddenException` com a constante existente "Só o proprietário pode compartilhar este documento."; `canWrite` falso (lixeira) → `ConflictException(TRASHED_DOCUMENT_MESSAGE)` ("Este documento está na lixeira. Restaure-o para editar."); só então `parseBody(shareDocumentSchema)` (400) e `documentInstanceShare.upsert({ where: { documentId }, create, update })`. Devolve `{ data: { level } }` em minúsculas. Não chama `notifyShareChanged`.
    - `SharesService.list`: depois da decisão de acesso, lê `documentInstanceShare` pelo `documentId` (só `level`) e devolve `{ data, instance: { level } }`, com `level: 'none'` quando não há linha. `data` inalterado. Na lixeira a linha é preservada.
    - `documents.controller.ts`: `@Put(':documentId/instance-share')` com `@Param('documentId')`, sessão obrigatória (401), 200, delegando a `shareInstance`.
  - Skills: authorization, security
  - Complexidade: média

- [x] T1.4 — Testes da fase 1
  - Arquivos: `apps/api/src/access/__tests__/document-access-boundary.test.ts` (alterar); `apps/api/src/access/__tests__/access.integration.test.ts` (alterar); `apps/api/src/access/__tests__/access-level.test.ts` (alterar); `apps/api/src/documents/__tests__/shares.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/shares.service.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/favorites.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.contract.test.ts` (alterar)
  - O que fazer (D7, D8): `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, espaço e documento. Quebras já esperadas (registrar em Desvios): o dublê `accessWith` de `access-level.test.ts` passa a devolver `instanceShare: null` e o dono com a organização (casos `levelOf …` mantêm o nome); casos de `GET shares …` em `shares.integration.test.ts` e o contrato da lista em `documents.contract.test.ts` que comparam o corpo inteiro passam a esperar `instance: { level: 'none' }`; os dublês de `shares.service.test.ts` ganham `documentInstanceShare`. Fronteira: regras 1–8 e 10–12 com o mesmo texto; regra 9 estendida a `documentInstanceShare` e `"DocumentInstanceShare"` (exemplos infrator e conforme acrescentados); regra 13 nova. Casos novos com os nomes literais:
    - `document-access-boundary.test.ts` (`unit-testing`):
      - `rule 9 flags documentInstanceShare outside access and shares service`
      - `rule 9 accepts documentInstanceShare in access service and shares service`
      - `rule 13: readableDocumentsWhere reaches instance shares through the owner organization`
      - `rule 13: no Document read outside access filters by instanceShare`
      - `rule 13 flags the offending example and accepts the conforming one`
    - `access-level.test.ts` (`unit-testing`):
      - `levelOf returns view for an instance view share`
      - `levelOf returns edit when the instance gives edit over a view share`
      - `levelOf never returns owner from an instance share`
      - `levelOf returns none for an instance share on a trashed document`
    - `access.integration.test.ts` (`integration-testing`):
      - `an instance view share gives view and canWrite false to a colleague`
      - `an instance edit share gives edit to a colleague`
      - `a person created after the instance share gets access`
      - `a deleted person gets none from an instance share`
      - `a random person id gets none and no readable documents from an instance share`
      - `a personal view share plus an instance edit share gives edit`
      - `a personal edit share plus an instance view share gives edit`
      - `a space edit member plus an instance view share gives edit`
      - `a trashed document with an instance share gives none to a colleague and owner to the owner`
    - `shares.integration.test.ts` (`integration-testing`):
      - `PUT instance-share answers 200 with the level and the list shows it`
      - `PUT instance-share switches view to edit and back on a single row`
      - `PUT instance-share with an invalid body answers 400 after the access checks`
      - `PUT instance-share by a view share answers 403`
      - `PUT instance-share by an edit share answers 403`
      - `PUT instance-share by a person reached only through the instance answers 403`
      - `PUT instance-share on a document without access answers 404`
      - `PUT instance-share on a missing document answers 404`
      - `PUT instance-share with a malformed document id answers 404`
      - `PUT instance-share on a trashed document answers 409 and keeps the level`
      - `a restored document keeps its instance share level`
      - `PUT instance-share answers 401 without session`
      - `GET shares answers instance level none without an instance share`
    - `shares.service.test.ts` (`unit-testing`):
      - `shareInstance checks 404 then 403 then 409 then 400`
    - `documents.integration.test.ts` (`integration-testing`):
      - `a colleague opens a document shared with the instance with the right accessLevel`
      - `a document shared with the instance appears in the colleague lists`
      - `a colleague through the instance gets 403 on trash and delete`
    - `favorites.integration.test.ts` (`integration-testing`):
      - `a favorite reached only through the instance is listed`
    - `documents.contract.test.ts` (`integration-testing`):
      - `PUT instance-share has the same path and parameter in the controller and the contract`
      - `PUT instance-share matches the 200 contract`
      - `GET shares matches the contract with instance`
  - Skills: unit-testing, integration-testing, authorization
  - Complexidade: alta

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [x] CA1.2 — Existe `apps/api/prisma/migrations/0021_document_instance_share/migration.sql` com `CREATE TABLE "DocumentInstanceShare"`, a chave primária `"DocumentInstanceShare_pkey"` em `"documentId"` e a chave estrangeira para `"Document"` com `ON DELETE CASCADE`; é a única pasta de migration começando por `0021`, e nenhuma migration anterior aparece em `git status --porcelain apps/api/prisma/migrations`. `schema.prisma` tem `model DocumentInstanceShare` com `documentId String @id` e `level ShareLevel`, e `Document` tem `instanceShare DocumentInstanceShare?`.
- [x] CA1.3 — `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/access/__tests__ apps/api/src/documents/__tests__` é vazio.
- [x] CA1.4 — `packages/api-contract/openapi.yaml` tem a operação `shareDocumentWithInstance` no caminho `/documents/{documentId}/instance-share` (método `put`) com respostas 200, 400, 401, 403, 404 e 409; `DocumentInstanceAccess.level` é obrigatório com `enum` `none`, `view`, `edit`; `DocumentAccessListResponse` exige `instance`; `rg -n "nullable" packages/api-contract/openapi.yaml` é vazio. `apps/api/src/documents/documents.controller.ts` tem `@Put(':documentId/instance-share')` com `@Param('documentId')`, e o caso `PUT instance-share has the same path and parameter in the controller and the contract` prova a identidade lendo os dois.
- [x] CA1.5 — Lendo `apps/api/src/access/access.service.ts`: `DocumentDecision` tem `instanceLevel: 'view' | 'edit' | null`; `findDecision` continua com uma consulta no caminho comum e só atribui `instanceLevel` quando a pessoa está entre as pessoas da organização do dono; `levelOf` segue dono → lixeira → `edit` se algum de espaço, pessoa ou instância for `edit` → primeiro não nulo → `none`, e nenhum ramo da instância devolve `owner`; a condição da herança inclui instância diferente de `'edit'`; a definição de `readableDocumentsWhere` contém `instanceShare:` e `trashedAt: null` no topo.
- [x] CA1.6 — Só a porta toca a tabela: `rg -n -P "^(?!\s*(//|\*)).*(documentInstanceShare|\"DocumentInstanceShare\")" apps/api/src --glob '!**/__tests__/**'` só casa `apps/api/src/access/access.service.ts` e `apps/api/src/documents/shares.service.ts`. `git status --porcelain apps/api/src/collab apps/api/src/documents/documents.service.ts apps/api/src/documents/favorites.service.ts apps/api/src/access/unit-reach.ts` é vazio.
- [x] CA1.7 — Lendo `apps/api/src/documents/shares.service.ts`: `shareInstance` faz, nesta ordem, `resolveAccess` com 404 opaco para `none`, 403 "Só o proprietário pode compartilhar este documento." para quem não é dono, 409 com `TRASHED_DOCUMENT_MESSAGE` quando `canWrite` é falso, e só depois valida o corpo (400) e faz `upsert` por `documentId`; não chama `notifyShareChanged`. `list` devolve `instance: { level }` com `'none'` quando não há linha.
- [x] CA1.8 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\("` nos arquivos de T1.4, os 39 casos nomeados em T1.4 com os nomes literais (`document-access-boundary.test.ts`: 5; `access-level.test.ts`: 4; `access.integration.test.ts`: 9; `shares.integration.test.ts`: 13; `shares.service.test.ts`: 1; `documents.integration.test.ts`: 3; `favorites.integration.test.ts`: 1; `documents.contract.test.ts`: 3). As regras 10, 11 e 12 de `document-access-boundary.test.ts` estão com o mesmo texto de antes; a regra 13 tem exemplo infrator e conforme e o código real respondendo.
- [x] CA1.9 — Lendo os testes: `a random person id gets none and no readable documents from an instance share` usa `randomUUID()` de `node:crypto` e passa pelo `AccessService` real; `a person created after the instance share gets access` cria a pessoa depois do `PUT`; `PUT instance-share on a trashed document answers 409 and keeps the level` confere o nível guardado depois do 409; `PUT instance-share switches view to edit and back on a single row` conta uma linha só em `DocumentInstanceShare`. `rg -n "vi\.mock\(" apps/api/src/access/__tests__/access.integration.test.ts apps/api/src/documents/__tests__/shares.integration.test.ts apps/api/src/documents/__tests__/documents.integration.test.ts apps/api/src/documents/__tests__/favorites.integration.test.ts` não traz mock de Prisma nem de `AccessService`.
- [x] CA1.10 — Cobertura ≥ 80% de linhas para `apps/api/src/access/access.service.ts`, `apps/api/src/documents/shares.service.ts` e `apps/api/src/documents/documents.controller.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: "Compartilhar com" e a linha "Todos da organização"

Caminhos relativos à raiz do repositório. A ordem importa: chamada e API simulada, depois a tela. Ao fim da fase, na web com a API simulada, o dono escolhe "Todos da organização", compartilha e vê a linha na lista.

- [x] T2.1 — Chamada, tipo da lista e API simulada da instância (D2, D3, D5)
  - Arquivos: `apps/web/src/features/documents/api/share-document-with-instance.ts` (criar); `apps/web/src/features/documents/api/get-document-shares.ts` (alterar); `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar)
  - O que fazer:
    - `share-document-with-instance.ts`: `shareDocumentWithInstance({ documentId, level }: { documentId: string; level: 'view' | 'edit' })` faz `PUT /documents/${documentId}/instance-share` com `{ level }` e `silentError: true`; `useShareDocumentWithInstance` (mutation) faz `await queryClient.invalidateQueries({ queryKey: ['document-shares', documentId] })` antes do `onSuccess` do chamador. Tipos a partir do contrato gerado.
    - `get-document-shares.ts`: tipo da resposta com `instance: { level: 'none' | 'view' | 'edit' }`.
    - `db.ts`: nível da instância por documento (padrão `none`) e `instance` na lista de acesso.
    - `handlers/documents.ts`: `http.put` de `…/documents/:documentId/instance-share` com a ordem 404 → 403 → 409 → 400 e as mesmas mensagens do servidor; o `GET …/shares` devolve `instance`.
  - Skills: api-requests, api-mocking
  - Complexidade: baixa

- [x] T2.2 — Grupo "Compartilhar com" no painel e linha "Todos da organização" na lista (D5, D6, R1, R3, R8, R9)
  - Arquivos: `apps/web/src/features/documents/components/share-document-dialog.tsx` (alterar)
  - O que fazer (receitas "Escolha entre opções (rádios)", "Lista", "Selo de status", "Botão principal" do `docs/design.md`; nenhuma receita nova):
    - `SharePanel` ganha o estado `target: 'person' | 'instance'` (padrão `person`) e, no topo, um `<fieldset>` de rádios nativos com `<legend>` "Compartilhar com" e as opções "Uma pessoa" (marcada) e "Todos da organização", esta com a dica "Qualquer pessoa da organização, inclusive quem entrar depois.". A 360px os rádios ocupam a largura toda.
    - `person`: exatamente o fluxo atual (busca, nível, "Compartilhar"). `instance`: no lugar do `PersonPicker`, o `ShareLevelGroup` existente ("Nível de acesso", "Pode ver" marcado) e o `Button` "Compartilhar" / "Compartilhando…", com `aria-disabled` e trava por ref (o mesmo `isSharingRef`) contra duplo clique. Durante qualquer envio, os rádios "Compartilhar com" ficam com `aria-disabled="true"`, sem `disabled` nativo, e o foco fica no rádio marcado (escolher "Todos da organização" não move o foco).
    - Sucesso: "Documento compartilhado com Todos da organização." no mesmo `<p aria-live="polite">` do painel; o nível volta a "Pode ver"; `target` continua `instance`; o diálogo não fecha. Erro: `getShareErrorMessage` existente ("Não foi possível compartilhar o documento. Tente de novo." e, no 409, "Este documento está na lixeira. Restaure-o para editar.") em `role="alert"`.
    - `AccessListStates` recebe `instance` da lista; com `level` diferente de `'none'`, renderiza logo depois da linha do dono o componente `InstanceAccessRow` (mesmo arquivo): nome "Todos da organização", texto secundário "Qualquer pessoa da organização" em tom suave, selo "Pode ver"/"Pode editar" à direita (`BADGE_CLASS_NAME`). Sem controle nessa linha. A remoção de pessoa continua calculando a linha de cima só entre pessoas. Estados da lista inalterados.
  - Skills: interface-design, forms, component-robustness
  - Complexidade: média

- [x] T2.3 — Testes da fase 2
  - Arquivos: `apps/web/src/features/documents/api/__tests__/share-document-with-instance.test.tsx` (criar); `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` (alterar)
  - O que fazer: API simulada por MSW com o banco falso; localizar por papel e nome acessível em pt_BR; esperas com `findBy…`/`waitFor`, nunca espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. Testes existentes que comparam a resposta de `GET …/shares` inteira passam a incluir `instance` (registrar em Desvios). Casos novos com os nomes literais:
    - `share-document-with-instance.test.tsx` (`unit-testing`):
      - `shareDocumentWithInstance sends PUT to the instance-share path with the level`
      - `useShareDocumentWithInstance awaits the shares invalidation before onSuccess`
      - `useShareDocumentWithInstance surfaces a 409 as an error`
    - `share-document-dialog.test.tsx` (`component-testing`):
      - `the Compartilhar com group starts with Uma pessoa checked`
      - `choosing Todos da organização hides the search and shows the level and the button`
      - `choosing Todos da organização keeps the focus on the radio`
      - `while sharing with the instance the radios are aria-disabled and not disabled`
      - `a double click shares with the instance only once`
      - `sharing with the instance shows the success message and the row between the owner and the people`
      - `sharing with the instance again switches the badge without duplicating the row`
      - `a trashed document shows the trash message when sharing with the instance`
      - `the Todos da organização row is absent when the instance level is none`
  - Skills: unit-testing, component-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`.
- [x] CA2.2 — `apps/web/src/features/documents/api/share-document-with-instance.ts` exporta `shareDocumentWithInstance` e `useShareDocumentWithInstance`; o fetcher usa o caminho `/instance-share` e `silentError: true`; o hook faz `await` de `invalidateQueries` com a chave `['document-shares', documentId]` antes de chamar o `onSuccess` do chamador. `get-document-shares.ts` tipa `instance.level` como `'none' | 'view' | 'edit'`.
- [x] CA2.3 — `apps/web/src/features/documents/components/share-document-dialog.tsx` contém os literais "Compartilhar com", "Uma pessoa", "Todos da organização", "Qualquer pessoa da organização, inclusive quem entrar depois.", "Documento compartilhado com Todos da organização.", "Qualquer pessoa da organização", "Compartilhando…" e o componente `InstanceAccessRow`. Rádios sem `disabled` nativo: `rg -n -P "^(?!\s*(//|\*)).*(?<![-\w])disabled[=:{]" apps/web/src/features/documents/components/share-document-dialog.tsx` não casa nenhum `<input type="radio">` (só `Button`, se houver).
- [x] CA2.4 — Acabamento (piso de `interface-design`, lendo `share-document-dialog.tsx`): o grupo "Compartilhar com" é `<fieldset>` com `<legend>` na receita "Escolha entre opções (rádios)"; a linha "Todos da organização" separa o nome à esquerda do selo à direita, com o texto secundário em tom mais suave, e o selo usa `BADGE_CLASS_NAME`; "Compartilhar" é `Button` com `type` explícito; o sucesso fica no `<p aria-live="polite">` e o erro em `role="alert"`. `rg -n -P "^(?!\s*(//|\*)).*(style=\{\{|!important|forwardRef|: JSX\.|<a href|<button)" apps/web/src/features/documents/components/share-document-dialog.tsx apps/web/src/features/documents/api/share-document-with-instance.ts` é vazio. `git status --porcelain apps/web/src/components apps/web/src/features/spaces apps/web/src/features/documents/components/document-view.tsx apps/web/src/features/documents/api/share-document.ts apps/web/src/features/documents/api/remove-document-share.ts docs/design.md` é vazio.
- [x] CA2.5 — A web não importa de outra feature: `rg -n "@/features/(?!documents)" -P apps/web/src/features/documents --glob '!**/testing/**'` é vazio.
- [x] CA2.6 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\("` nos dois arquivos de T2.3, os 12 casos nomeados com os nomes literais (`share-document-with-instance.test.tsx`: 3; `share-document-dialog.test.tsx`: 9). Lendo: `choosing Todos da organização keeps the focus on the radio` assere o foco no rádio "Todos da organização"; `while sharing with the instance the radios are aria-disabled and not disabled` assere `aria-disabled="true"` e `not.toBeDisabled()`; `a double click shares with the instance only once` conta um só `PUT`; `sharing with the instance shows the success message and the row between the owner and the people` assere a ordem dono → "Todos da organização" → pessoas e o diálogo aberto. `rg -n "sleep\(|waitForTimeout|setTimeout|\.only\(|\.skip\(" ` nos dois arquivos é vazio.
- [x] CA2.7 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/api/share-document-with-instance.ts`, `apps/web/src/features/documents/api/get-document-shares.ts` e `apps/web/src/features/documents/components/share-document-dialog.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e e documentação

Caminhos relativos à raiz do repositório. Ao fim da fase, a fatia está utilizável de ponta a ponta e documentada.

- [ ] T3.1 — Documentação da instância no caminho único
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer: §3 "access": a decisão passa a dono → lixeira → maior(pessoa, instância, espaço) → `none`; a instância é a tabela `DocumentInstanceShare` (uma linha por documento) e só vale para quem pertence à organização do dono, relido a cada pedido em `findDecision` e em `readableDocumentsWhere`; regra 9 estendida a `DocumentInstanceShare` e regra 13 do teste de fronteira; rota `PUT /documents/{documentId}/instance-share` e o campo `instance` de `GET …/shares`.
  - Skills: —
  - Complexidade: baixa

- [ ] T3.2 — e2e: o dono compartilha com todos da organização (D7, R1, R3, R8)
  - Arquivos: `apps/web/e2e/tests/share-with-instance.spec.ts` (criar)
  - O que fazer: com a API simulada, o dono abre um documento, abre "Compartilhar documento", escolhe "Todos da organização" (o foco fica no rádio), marca "Pode editar", clica em "Compartilhar", vê "Documento compartilhado com Todos da organização." e a linha "Todos da organização" com "Pode editar" logo depois do dono. Sem `page.reload()`; `localStorage` só para montar o estado inicial, antes da primeira navegação; esperas por `expect(...)` com `ROUTE_TIMEOUT`; foco conferido com `toBeFocused()`; `expectNoSeriousA11yViolations` com o diálogo aberto. Sem `waitForTimeout`, `.skip(` nem `.only(`. Teste: `the owner shares a document with Todos da organização and sees the row`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [ ] CA3.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm test:e2e` (a suíte inteira) saem com 0 e sem aviso.
- [ ] CA3.2 — `apps/web/e2e/tests/share-with-instance.spec.ts` tem o teste `the owner shares a document with Todos da organização and sees the row`, que usa `ROUTE_TIMEOUT`, `toBeFocused(` e `expectNoSeriousA11yViolations(` (chamado depois de abrir o diálogo e antes de fechá-lo); `rg -n "waitForTimeout|\.skip\(|\.only\(|reload\(" apps/web/e2e/tests/share-with-instance.spec.ts` é vazio; toda ocorrência de `localStorage` no arquivo está antes do primeiro `goto` do teste.
- [ ] CA3.3 — `docs/architecture.md` cita `DocumentInstanceShare`, `instance-share`, a organização do dono como condição da instância e a regra 13.
- [ ] CA3.4 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `PUT instance-share answers 200 with the level and the list shows it` e `an instance edit share gives edit to a colleague`; `pnpm exec vitest run --project web` (0) inclui `sharing with the instance shows the success message and the row between the owner and the people`; `pnpm test:e2e` (0) inclui `the owner shares a document with Todos da organização and sees the row`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste ou um critério precisar de literal diferente com o mesmo comportamento.

- DV1 (T1.4, previsto) — `access-level.test.ts`: o dublê `accessWith` passa a devolver `instanceShare: null` (ou o informado pelo caso, parâmetro opcional novo) e `owner.organization.people` com a pessoa que pede o acesso, lida do `select` do próprio `findFirst`. Sem isso os casos `levelOf …` antigos quebravam ao ler `owner.organization`. Nomes mantidos.
- DV2 (T1.4, previsto) — `shares.service.test.ts`: o Prisma dublê ganha `documentInstanceShare` (`findFirst` devolvendo `null` e `upsert`). Quebravam sem ele `list does not check canWrite`, `list maps VIEW to view and EDIT to edit` e `list puts the owner first with isCurrentPerson true`. Nomes mantidos.
- DV3 (T1.4, previsto e não ocorrido) — Nenhum caso antigo de `GET shares …` em `shares.integration.test.ts` nem o contrato da lista em `documents.contract.test.ts` quebrou: os primeiros comparam só `data` e o segundo valida o corpo contra o schema, que o servidor já cumpre com `instance`. Nada alterado neles; a comparação do corpo inteiro com `instance: { level: 'none' }` está no caso novo `GET shares answers instance level none without an instance share`.
- DV4 (T1.4, antecipa T2.1) — `apps/web/src/testing/mocks/handlers/documents.ts`: o `GET …/shares` da API simulada devolve `instance: { level: 'none' }`, só o mínimo que o tipo gerado exige para `pnpm typecheck` passar nesta fase. O nível por documento no `db.ts` e o `PUT …/instance-share` simulado continuam em T2.1.
- DV5 (T1.4) — `a document shared with the instance appears in the colleague lists`: das listas do colega, a única que o compartilhamento com a instância alarga é a de favoritos (`?scope=mine` é por dono, e a lista de um espaço exige alcançar o espaço). O caso confere o documento em `?scope=favorites` e "Meus documentos" vazio.
- DV6 (T2.3, previsto) — `share-document-dialog.test.tsx`: a resposta simulada de `GET …/shares` do caso `lists shared people with Pode ver and Pode editar in server order` passa a trazer `instance: { level: 'none' }`. Sem isso o caso quebrava ao ler `instance.level` da lista. Nome mantido.

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
