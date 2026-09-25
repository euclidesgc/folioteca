# PLAN 152 — unit-space-documents-inherit

Branch: `feature/152-unit-space-documents-inherit`

Fonte: `docs/features/152-unit-space-documents-inherit/spec.md` (D1…D8 são as decisões técnicas da SPEC e R1…R12 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Hocuspocus (canal `/collab`), Vite 8, React 19, Vitest com os projetos `api` e `web`, Playwright.

Quem alcança o espaço de uma unidade pela herança da unidade-pai (o espaço da unidade "herda da unidade-pai" e a pessoa alcança a mãe, fatia 140) passa a ver, abrir, editar e criar documentos nesse espaço como quem está lotado diretamente na unidade (fatia 127). A página do espaço deixa de mostrar o aviso "Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade." e passa a mostrar a lista e o botão "Novo documento". A regra de alcance (lotação direta, ou espaço que herda e mãe alcançada) passa a ter **uma só definição**, em `apps/api/src/access/unit-reach.ts`, e é relida a cada pedido: quem perde a herança perde o acesso na próxima leitura. "Pessoas nesta unidade" continua mostrando só a lotação direta. **Nenhum endpoint novo, nenhuma migration, nenhuma dependência nova.**

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local; banco de teste `folioteca_test`, porta 5433, usuário `folioteca`, sem senha). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho do próprio Vitest sobre o ambiente jsdom **não conta**; o aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**. O typecheck e o lint finais de cada fase — inclusive de quem só escreve testes — rodam com o cache do `tsc` limpo: `pnpm exec tsc -b --clean`, conferir que não sobrou `*.tsbuildinfo` fora de `node_modules`, e só então `pnpm typecheck`.

**Critérios sobre o disco.** Os critérios são conferidos **antes** do commit da fase, sobre os arquivos em disco (commitados ou não). Nenhum critério depende de `git diff` contra a base. Critério de ausência (`rg` vazio) vale só para os arquivos criados ou alterados na própria fase, listados no próprio critério, e usa padrão que não casa com comentário (linhas que começam com `//` ou `*` são excluídas por `-P` com `^(?!\s*(//|\*))`). O commit de cada fase é feito pela orquestração depois da revisão; nenhum agente de fase commita. Se `pnpm test` ou `pnpm test:e2e` falhar num teste **antigo** e sem relação com a fase, o comando pode ser repetido **uma** vez; a segunda execução vale.

## Regras que valem para todas as tarefas

- **Nenhuma dependência nova** em nenhum `package.json`; `pnpm-lock.yaml` não muda.
- **Sem migration**: `apps/api/prisma/**` não muda (nem `schema.prisma`, nem migrations). Nenhum subcomando de Prisma além de `prisma generate` e da aplicação das migrations já usada pelos testes; **nunca** `prisma migrate diff`, `migrate dev` ou `migrate reset`.
- **Nenhum teste remove, desativa ou recria restrição do banco** (`DROP CONSTRAINT`, `ALTER TABLE … DISABLE`, `DISABLE TRIGGER`, `session_replication_role`).
- **Uma só regra de alcance**: a declaração de `resolveReach` existe só em `apps/api/src/access/unit-reach.ts`; nenhum arquivo fora de `apps/api/src/access/` chama `resolveReach(`. Nada materializado: nenhuma tabela, coluna ou cache de alcance; a cadeia de unidades é relida em todo pedido que decide acesso.
- Caminho único de decisão de acesso a documento: dono → lixeira → maior(compartilhamento, espaço) → `none`. `levelOf` e `spaceLevelOf` em `apps/api/src/access/access.service.ts` continuam puros e com a mesma ordem; a herança só entra no cálculo de `spaceLevel`. Assinaturas de `resolveAccess` e `canWrite` intocadas.
- Escopo de outra organização é testado **pelo serviço real** (Nest + Postgres), com ids de outra organização gerados por `randomUUID()` de `node:crypto` ou criados pelos ajudantes existentes; nunca por mock do Prisma nem do `AccessService` nos testes de integração.
- Intocados de propósito: `apps/api/src/access/access-level.ts`, `trashedDocumentsWhere`, `apps/api/src/documents/shares.service.ts`, `apps/api/src/collab/collab.service.ts`, `apps/api/src/org-units/**`, `apps/api/src/unit-assignments/**`, `listMembers` em `apps/api/src/spaces/spaces.service.ts` (R10: "Pessoas nesta unidade" só com lotação direta), `apps/web/src/features/spaces/**`, `apps/web/src/features/documents/components/space-view.tsx`, `apps/web/src/app/routes/app/space.tsx`, `apps/web/src/components/ui/**`.
- Arquivo gerado do contrato (`packages/api-contract/src/generated/openapi.d.ts`) só pelo script de geração do pacote, nunca à mão.
- **Sem Prettier reformatando arquivo existente**: só as linhas necessárias mudam.
- Todo componente devolve `React.JSX.Element` (ou `React.JSX.Element | null`), nunca o `JSX` global; `ref` é prop comum; botão nosso é sempre `Button`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Textos de tela em pt_BR; código, comentários, caminhos e nomes de teste em en_US.
- Nenhum `style={{…}}` para aparência; nenhum `!important`.
- Nenhum `eslint-disable` sem `-- <motivo>` na própria linha; nenhuma regra desativada nem teste pulado para fazer passar; nenhum `any` sem comentário.
- Cobertura ≥ 80% de linhas **por arquivo** de produção alterado, medida **só** por `coverage/coverage-summary.json`, gerado **na raiz** com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`, **sem `--project`** e **sem filtro de caminho**. Nenhuma exclusão nova.
- Testes de API de integração rodam contra o Postgres real e o servidor Nest real. "Teste passa" é medido pelo **exit code** (zero), nunca pela saída `--verbose`. Esperas por evento com `vi.waitFor`/promessa resolvida no evento, nunca espera fixa (`setTimeout`/sleep).
- Testes existentes afetados são ajustados **sem trocar o nome** (se o nome continuar verdadeiro) e registrados na seção "Desvios" (DVn); caso cujo nome deixou de ser verdade (ex.: o herdado que recebia 403) é substituído pelo caso novo nomeado neste plano.
- O agente derruba tudo o que subir (servidores, watchers, navegadores, provedores `HocuspocusProvider`) ao fim da tarefa.

## Fase 1 — API: a herança dá acesso aos documentos do espaço de unidade

Caminhos relativos à raiz do repositório. A ordem importa: contrato, depois a regra em `access`, depois quem a usa. Ao fim da fase, pela API, quem alcança o espaço pela herança lista, cria, abre e edita (inclusive pelo `/collab`) os documentos do espaço, e perde isso na próxima leitura quando a herança ou a lotação na mãe acaba.

- [x] T1.1 — Contrato sem o 403 do herdado (D4, R1, R2, R11)
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, regenerado pelo script)
  - O que fazer: em `listSpaceDocuments` (`GET /spaces/{spaceId}/documents`), remover a resposta `403` e mudar a descrição para dizer que a lista é de "quem alcança o espaço de unidade (lotação direta ou herança)"; em `POST /documents`, a descrição do `404` que diz "não está lotado diretamente" passa a "não alcança o espaço"; `canCreateDocuments` descrito como verdadeiro para todo alcance de espaço de unidade (direto ou herdado). `reach` continua `'direct' | 'inherited'`. Regenerar os tipos pelo script do pacote.
  - Skills: —
  - Complexidade: baixa

- [x] T1.2 — A regra de alcance mora em `access` e amplia a decisão de documento (D1, D2, D3, R3–R7)
  - Arquivos: `apps/api/src/access/unit-reach.ts` (criar); `apps/api/src/access/access.service.ts` (alterar)
  - O que fazer:
    - `unit-reach.ts` (puro, sem Nest nem Prisma): mover de `spaces.service.ts` o tipo `ReachUnit` e `resolveReach` **sem mudar o algoritmo** (lotação direta, ou espaço que herda e mãe alcançada; iterativo, memorizado; ciclo conta como não alcançado). Exportar `type ReachedUnitSpace = { orgUnitId: string; spaceId: string; name: string; reach: 'direct' | 'inherited' }` e `reachedUnitSpaces(units: ReachUnit[]): ReachedUnitSpace[]` — uma entrada por unidade com espaço alcançado, `'direct'` quando há lotação na própria unidade.
    - `access.service.ts`: método público `unitSpacesReachedBy(organizationId: string, personId: string): Promise<ReachedUnitSpace[]>`, com a leitura única das unidades (o `select` da antiga `findReachUnits`: `id, parentId, name, space { id, inheritsParent }, assignments where personId`). Leitura privada equivalente pela organização da pessoa, com `where: { organization: { people: { some: { id: personId } } } }` (mesma consulta, outro filtro).
    - `findDecision`: acrescentar ao `select` do espaço `inheritsParent` e, em `orgUnit`, `id` e `organizationId`; continua uma consulta no caminho comum. Segunda consulta **só** quando: não é dono, não está na lixeira, compartilhamento não é `'edit'`, espaço `UNIT` sem lotação direta da pessoa e `inheritsParent === true`; então `unitSpacesReachedBy(orgUnit.organizationId, personId)` e, se o `spaceId` do documento está no resultado, `spaceLevel = 'edit'`.
    - `readableDocumentsWhere` passa a `async readableDocumentsWhere(personId: string): Promise<Prisma.DocumentWhereInput>`; o ramo `UNIT` com `assignments: { some: { personId } }` vira `{ spaceId: { in: reachedIds } }` (ids de `unitSpacesReachedBy` pela organização da pessoa, direto e herdado); ramos de dono, compartilhamento, espaço livre e o literal `trashedAt: null` inalterados.
    - Reescrever o comentário "a herança entre unidades não entra aqui" para dizer que a herança entra só pelo `spaceLevel`.
  - Skills: authorization, security
  - Complexidade: alta

- [x] T1.3 — `spaces` e `documents` usam a regra única (D1, D3, D4, D5, R1, R2, R4, R8, R10, R11)
  - Arquivos: `apps/api/src/spaces/spaces.service.ts` (alterar); `apps/api/src/spaces/spaces.module.ts` (alterar); `apps/api/src/spaces/spaces.controller.ts` (alterar); `apps/api/src/documents/documents.service.ts` (alterar); `apps/api/src/documents/favorites.service.ts` (alterar)
  - O que fazer:
    - `spaces.module.ts`: importar `AccessModule`. `spaces.service.ts`: injetar `AccessService`; remover `findReachUnits`, `resolveReach` e `ReachUnit`; `list` e `reachOfUnit` (e por ele `reachOf`, `getDetail`, `listMembers`) usam `unitSpacesReachedBy`. `getDetail` devolve `canCreateDocuments: true` para espaço de unidade alcançado (direto ou herdado). `listMembers` continua lendo só `orgUnitAssignment` direto.
    - `spaces.controller.ts`: `listSpaceDocuments` perde o ramo `'inherited'` e a constante `INHERITED_REACH_MESSAGE`; `'none'` → 404 "Espaço não encontrado.", qualquer outro alcance → 200. Não existe mais 403 nesta rota.
    - `documents.service.ts`: `create` com `spaceId` — o `tx.space.findFirst` confere só o espaço livre (sai o ramo `type: 'UNIT'` com `assignments: { some }`); para espaço de unidade, **antes** da transação, `unitSpacesReachedBy(person.organizationId, person.id)` contém o `spaceId` → segue; senão → 404 "Espaço não encontrado." pelo mesmo `spaceNotFound`. Dono = quem chama. As três chamadas a `readableDocumentsWhere(` (inclusive em `listMine` e `listInSpace`) passam a `await this.access.readableDocumentsWhere(…)`.
    - `favorites.service.ts`: a chamada passa a `await this.access.readableDocumentsWhere(…)`.
  - Skills: authorization, security
  - Complexidade: média

- [x] T1.4 — Testes da fase 1
  - Arquivos: `apps/api/src/access/__tests__/unit-reach.test.ts` (criar); `apps/api/src/access/__tests__/document-access-boundary.test.ts` (alterar); `apps/api/src/access/__tests__/access.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.service.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.integration.test.ts` (alterar); `apps/api/src/spaces/__tests__/spaces.contract.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.contract.test.ts` (alterar); `apps/api/src/documents/__tests__/favorites.integration.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.service.test.ts` (alterar); `apps/api/src/collab/__tests__/collab.integration.test.ts` (alterar)
  - O que fazer (D7, D8): `resetDatabase(prisma)` em `beforeEach` e os ajudantes existentes de sessão, organização, pessoa, unidade, lotação, espaço e documento. Os casos de `resolveReach` de `spaces.service.test.ts` são **movidos** para `unit-reach.test.ts`; `spaces.service.test.ts` passa a montar um `AccessService` falso; os falsos de `AccessService` em `documents.service.test.ts` devolvem `Promise` em `readableDocumentsWhere`. O caso "herdado → none" da 127 em `access.integration.test.ts` e os casos que esperavam 403 são substituídos pelos novos abaixo. Fronteira: regras 1–9 e 11 sem alteração; regra 10 deixa de exigir `assignments: { some: { personId } }` e passa a exigir que `access.service.ts` contenha `unitSpacesReachedBy(` e que a definição de `readableDocumentsWhere` contenha `spaceId: { in:` (exemplo infrator/conforme igual); regra 12 nova, com exemplo infrator e conforme e o código real respondendo. Casos novos com os nomes literais:
    - `unit-reach.test.ts` (`unit-testing`):
      - `reachedUnitSpaces marks a unit with a direct assignment as direct`
      - `reachedUnitSpaces marks an inheriting child of a reached parent as inherited`
      - `reachedUnitSpaces stops at a unit whose space does not inherit`
      - `reachedUnitSpaces ignores units without a space`
      - `reachedUnitSpaces returns an empty list without assignments`
      - `resolveReach treats a cycle as not reached`
    - `document-access-boundary.test.ts` (`unit-testing`):
      - `rule 10: readableDocumentsWhere filters unit spaces by reached ids`
      - `rule 12: resolveReach is declared only in access/unit-reach.ts`
      - `rule 12: no file outside access calls resolveReach`
      - `rule 12 flags the offending example and accepts the conforming one`
    - `access.integration.test.ts` (`integration-testing`):
      - `a person assigned only to the parent edits a document of an inheriting child space`
      - `readableDocumentsWhere includes documents of an inherited unit space`
      - `a space that stops inheriting gives none on the next read`
      - `removing the assignment from the parent gives none on the next read`
      - `a grandparent assignment does not cross a child with its own permissions`
      - `an inherited document in the trash gives none to the heir and owner to the owner`
      - `a document created by inheritance stays owned after losing inheritance`
      - `a view share plus inheritance gives edit`
      - `unitSpacesReachedBy of another organization returns nothing`
    - `spaces.integration.test.ts` (`integration-testing`):
      - `GET /spaces/{id}/documents returns 200 to an inherited reach`
      - `GET /spaces/{id} returns canCreateDocuments true to an inherited reach`
      - `a space that stops inheriting returns 404 on the next GET /spaces/{id}/documents`
      - `a person removed from the parent unit gets 404 on the next GET /spaces/{id}/documents`
      - `a space of another organization returns 404`
      - `GET /spaces keeps listing inherited unit spaces`
      - `listMembers keeps only direct assignments`
    - `spaces.contract.test.ts` (`integration-testing`):
      - `GET /spaces/{id}/documents answers only 200 401 and 404`
    - `documents.integration.test.ts` (`integration-testing`):
      - `POST /documents in an inherited unit space returns 201 owned by the caller`
      - `a document created by inheritance appears in Meus documentos and in the space list`
      - `a directly assigned person opens with edit a document created by an heir`
      - `POST /documents in a unit space with a broken chain returns 404`
      - `POST /documents in a unit space of another organization returns 404`
      - `an heir cannot trash a document of someone else`
    - `documents.contract.test.ts` (`integration-testing`):
      - `POST /documents with an inherited unit space matches the 201 contract`
    - `favorites.integration.test.ts` (`integration-testing`):
      - `a favorite reached only by inheritance is listed and disappears when inheritance ends`
    - `collab.integration.test.ts` (`integration-testing`):
      - `an heir connects and writes to an inherited unit space document`
      - `after losing inheritance a new connection is refused`
  - Skills: unit-testing, integration-testing
  - Complexidade: alta

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo (`pnpm exec tsc -b --clean`; nenhum `*.tsbuildinfo` fora de `node_modules`): `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` terminam com exit code 0 e sem aviso.
- [x] CA1.2 — `apps/api/src/access/unit-reach.ts` existe, exporta `reachedUnitSpaces` com a assinatura `(units: ReachUnit[]): ReachedUnitSpace[]`, o tipo `ReachedUnitSpace` com `orgUnitId`, `spaceId`, `name` e `reach: 'direct' | 'inherited'`, e declara `resolveReach`; não importa de `@nestjs` nem de `@prisma` (`rg -n "@nestjs|@prisma" apps/api/src/access/unit-reach.ts` é vazio).
- [x] CA1.3 — Uma só definição da regra: `rg -n -P "^(?!\s*(//|\*)).*(function resolveReach|const resolveReach)" apps/api/src` só casa `apps/api/src/access/unit-reach.ts`; `rg -n -P "^(?!\s*(//|\*)).*(resolveReach\(|findReachUnits)" apps/api/src/spaces/spaces.service.ts apps/api/src/spaces/spaces.controller.ts apps/api/src/documents/documents.service.ts apps/api/src/documents/favorites.service.ts` é vazio.
- [x] CA1.4 — `apps/api/src/access/access.service.ts` tem `unitSpacesReachedBy(organizationId: string, personId: string): Promise<ReachedUnitSpace[]>` e `async readableDocumentsWhere(personId: string): Promise<Prisma.DocumentWhereInput>`, cuja definição contém `spaceId: { in:` e `trashedAt: null`; `rg -n -P "^(?!\s*(//|\*)).*assignments: \{ some: \{ personId \} \}" apps/api/src/access/access.service.ts` é vazio. Lendo `findDecision`, a chamada a `unitSpacesReachedBy` está atrás das condições não dono, fora da lixeira, compartilhamento diferente de `'edit'`, espaço `UNIT` sem lotação direta e `inheritsParent`; `levelOf` mantém a ordem dono → lixeira → maior(compartilhamento, espaço) → `none`.
- [x] CA1.5 — `apps/api/src/spaces/spaces.module.ts` importa `AccessModule`; `rg -n -P "^(?!\s*(//|\*)).*(INHERITED_REACH_MESSAGE|ForbiddenException|lotado diretamente)" apps/api/src/spaces/spaces.controller.ts apps/api/src/spaces/spaces.service.ts` é vazio; `getDetail` devolve `canCreateDocuments: true` para espaço de unidade sem condicionar a `reach === 'direct'`. `rg -n "403" packages/api-contract/openapi.yaml` não casa a operação `listSpaceDocuments`, e `rg -n "lotado diretamente" packages/api-contract/openapi.yaml` é vazio.
- [x] CA1.6 — Em `apps/api/src/documents/documents.service.ts` e `apps/api/src/documents/favorites.service.ts`, toda chamada a `readableDocumentsWhere(` é precedida de `await` (`rg -n -P "(?<!await this\.access\.)readableDocumentsWhere\(" apps/api/src/documents/documents.service.ts apps/api/src/documents/favorites.service.ts` é vazio); `create` chama `unitSpacesReachedBy(` fora do `$transaction` e responde pelo `spaceNotFound` quando o `spaceId` não está no resultado.
- [x] CA1.7 — Nada fora do escopo mudou: `git status --porcelain apps/api/prisma apps/api/src/access/access-level.ts apps/api/src/documents/shares.service.ts apps/api/src/collab/collab.service.ts apps/api/src/org-units apps/api/src/unit-assignments` é vazio (sem migration). `rg -n "migrate (diff|dev|reset)|DROP CONSTRAINT|DISABLE TRIGGER|session_replication_role|ALTER TABLE" apps/api/src/access/__tests__ apps/api/src/spaces/__tests__ apps/api/src/documents/__tests__ apps/api/src/collab/__tests__` é vazio.
- [x] CA1.8 — `pnpm exec vitest run --project api` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" ` nos arquivos de T1.4, os 38 casos nomeados em T1.4 com os nomes literais (`unit-reach.test.ts`: 6; `document-access-boundary.test.ts`: 4; `access.integration.test.ts`: 9; `spaces.integration.test.ts`: 7; `spaces.contract.test.ts`: 1; `documents.integration.test.ts`: 6; `documents.contract.test.ts`: 1; `favorites.integration.test.ts`: 1; `collab.integration.test.ts`: 2). As regras 9 e 11 de `document-access-boundary.test.ts` estão com o mesmo texto de antes; a regra 12 tem exemplo infrator e conforme.
- [x] CA1.9 — Lendo os testes: `a space that stops inheriting returns 404 on the next GET /spaces/{id}/documents` e `a person removed from the parent unit gets 404 on the next GET /spaces/{id}/documents` fazem um `GET` com 200, mudam `inheritsParent` para falso ou apagam a lotação na mãe, e o `GET` seguinte responde 404 "Espaço não encontrado."; `after losing inheritance a new connection is refused` conecta por `HocuspocusProvider`, tira a herança e assere a recusa da conexão nova; `listMembers keeps only direct assignments` assere que o herdeiro não aparece; os casos "of another organization" criam a outra organização pelos ajudantes ou usam `randomUUID()` e passam pelo serviço real. `rg -n "vi\.mock\(" apps/api/src/access/__tests__/access.integration.test.ts apps/api/src/spaces/__tests__/spaces.integration.test.ts apps/api/src/documents/__tests__/documents.integration.test.ts apps/api/src/documents/__tests__/favorites.integration.test.ts apps/api/src/collab/__tests__/collab.integration.test.ts` não traz mock de Prisma, Hocuspocus nem `AccessService`.
- [x] CA1.10 — Cobertura ≥ 80% de linhas para `apps/api/src/access/unit-reach.ts`, `apps/api/src/access/access.service.ts`, `apps/api/src/spaces/spaces.service.ts`, `apps/api/src/spaces/spaces.controller.ts`, `apps/api/src/documents/documents.service.ts` e `apps/api/src/documents/favorites.service.ts`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 2 — Web: a página do espaço herdado mostra a lista e o botão

Caminhos relativos à raiz do repositório. A ordem importa: API simulada, depois a tela. Ao fim da fase, na web com a API simulada, quem alcança o espaço pela herança vê a lista e cria pelo "Novo documento".

- [x] T2.1 — API simulada trata o herdado como o direto (D6)
  - Arquivos: `apps/web/src/testing/mocks/db.ts` (alterar); `apps/web/src/testing/mocks/handlers/spaces.ts` (alterar); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar); `apps/web/src/testing/mocks/utils.ts` (alterar)
  - O que fazer: `db.ts` devolve `canCreateDocuments: true` para espaço de unidade alcançado (direto ou herdado, por `spaceReachOf`); `handlers/spaces.ts` — o `GET /spaces/:spaceId/documents` perde o ramo `'inherited'`/403 (`'none'` → 404 "Espaço não encontrado.", senão 200); `handlers/documents.ts` — `POST /documents` aceita espaço de unidade com alcance `'inherited'`; `utils.ts` — o comentário da amostra herdada deixa de citar o aviso.
  - Skills: api-mocking
  - Complexidade: baixa

- [x] T2.2 — Some o aviso de lotação direta da lista do espaço (D6, R1, R12)
  - Arquivos: `apps/web/src/features/documents/components/space-documents.tsx` (alterar)
  - O que fazer: remover `isForbidden`, a constante `DIRECT_ASSIGNMENT_NOTICE`, o ramo do 403 e o import de `isAxiosError` que só ele usava. Os quatro estados continuam com as receitas "Carregando", "Vazio", "Erro", "Lista", "Ação de página acima da lista" e "Botão principal" do `docs/design.md` e os textos existentes: "Carregando documentos do espaço…" (`role="status"`), "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”.", "Não foi possível carregar os documentos do espaço." + "Tentar novamente" (`role="alert"`), "Novo documento"/"Criando…". O botão depende só de `canCreate`. Nenhum texto nem receita nova.
  - Skills: interface-design, error-handling
  - Complexidade: baixa

- [x] T2.3 — Testes da fase 2
  - Arquivos: `apps/web/src/features/documents/components/__tests__/space-documents.test.tsx` (alterar); `apps/web/src/app/routes/app/__tests__/space.test.tsx` (alterar)
  - O que fazer: API simulada por MSW com o banco falso; localizar por papel e nome acessível em pt_BR; esperas com `findBy…`/`waitFor`, nunca espera fixa; sem `console.error`/`console.warn`/aviso de `act(...)`. O caso antigo "403 → aviso" é substituído. Os testes de handler que esperavam 403 passam a esperar 200 (registrar em Desvios se o nome continuar). Casos novos com os nomes literais:
    - `space-documents.test.tsx` (`component-testing`):
      - `an inherited reach sees the list and the Novo documento button`
      - `the direct assignment notice is never shown`
      - `a 404 still shows the error state with Tentar novamente`
    - `space.test.tsx` (`integration-testing`, `api-mocking`):
      - `an heir creates a document from Novo documento and it opens`
      - `an heir sees the documents of the inherited unit space`
  - Skills: component-testing, integration-testing, api-mocking
  - Complexidade: média

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` saem com 0 e sem aviso; a saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso de `act(...)`.
- [x] CA2.2 — `rg -n -P "^(?!\s*(//|\*)).*(isForbidden|DIRECT_ASSIGNMENT_NOTICE|isAxiosError|lotado diretamente)" apps/web/src/features/documents/components/space-documents.tsx` é vazio; o arquivo continua com os literais "Carregando documentos do espaço…", "Não foi possível carregar os documentos do espaço.", "Tentar novamente" e "Novo documento".
- [x] CA2.3 — `rg -n -P "^(?!\s*(//|\*)).*(403|inherited.*forbidden)" apps/web/src/testing/mocks/handlers/spaces.ts apps/web/src/testing/mocks/handlers/documents.ts` é vazio; `apps/web/src/testing/mocks/db.ts` devolve `canCreateDocuments: true` para alcance `'inherited'`; `rg -n "lotado diretamente|aviso" apps/web/src/testing/mocks/utils.ts` é vazio.
- [x] CA2.4 — Acabamento (piso de `interface-design`, lendo `space-documents.tsx`): o carregando tem `role="status"`, o erro `role="alert"` com borda ou fundo de destaque e o botão "Tentar novamente" é `Button`; "Novo documento" é `Button` com `type` explícito; `rg -n -P "style=\{\{|!important|forwardRef|: JSX\.|<a href|<button" apps/web/src/features/documents/components/space-documents.tsx` é vazio. `git status --porcelain apps/web/src/features/spaces apps/web/src/features/documents/components/space-view.tsx apps/web/src/app/routes/app/space.tsx apps/web/src/components/ui docs/design.md` é vazio.
- [x] CA2.5 — `pnpm exec vitest run --project web` sai com 0 e existem, conferidos com `rg -n "^\s*(it|test)(\.each)?\(" apps/web/src/features/documents/components/__tests__/space-documents.test.tsx apps/web/src/app/routes/app/__tests__/space.test.tsx`, os 5 casos nomeados em T2.3 com os nomes literais (`space-documents.test.tsx`: 3; `space.test.tsx`: 2). Lendo, `an heir creates a document from Novo documento and it opens` clica no botão "Novo documento" da amostra herdada e assere a navegação para a página do documento criado; `the direct assignment notice is never shown` assere a ausência de "Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.". `rg -n "sleep\(|waitForTimeout|setTimeout|\.only\(|\.skip\(" ` nos dois arquivos é vazio.
- [x] CA2.6 — Cobertura ≥ 80% de linhas para `apps/web/src/features/documents/components/space-documents.tsx`, lida em `coverage/coverage-summary.json` gerado na raiz com `pnpm exec vitest run --coverage --coverage.reporter=json-summary`.

## Fase 3 — e2e e documentação

Caminhos relativos à raiz do repositório. Ao fim da fase, a fatia está utilizável de ponta a ponta e documentada.

- [x] T3.1 — Documentação da regra única e da herança
  - Arquivos: `docs/architecture.md` (alterar); `docs/features/152-unit-space-documents-inherit/spec.md` (alterar); `docs/features/127-unit-space-documents/prd.md` (alterar, conferir); `docs/features/128-unit-space-members/prd.md` (alterar, conferir)
  - O que fazer:
    - `docs/architecture.md` §3 "access": a regra de alcance mora em `apps/api/src/access/unit-reach.ts` (`resolveReach`, `reachedUnitSpaces`) e é lida por `AccessService.unitSpacesReachedBy`; `readableDocumentsWhere` passa a assíncrono (todo leitor usa `await`); a herança da unidade-pai dá `edit` pelo `spaceLevel`; regra 12 do teste de fronteira; substituir o trecho "espaço não dá acesso a documento" pelo comportamento atual. §spaces: `SpacesService` usa `AccessService` para o alcance; `GET /spaces/{id}/documents` sem 403 (200 para alcance direto ou herdado, 404 sem alcance); retirar a descrição de `resolveReach` em `spaces`.
    - `spec.md` da 152: na lista "O que já existe", trocar "fatia 146" por "fatia 180 share-change-live" (a 146 foi fatiada em 179 e 180).
    - `prd.md` da 127 e da 128: conferir que as marcações "substituído pela 152" já feitas junto com a SPEC estão presentes; completar só se faltar.
  - Skills: —
  - Complexidade: baixa

- [x] T3.2 — e2e: o herdado trabalha nos documentos (D8, R12)
  - Arquivos: `apps/web/e2e/tests/unit-space-documents.spec.ts` (alterar)
  - O que fazer: o cenário "espaço herdado → aviso sem botão" vira `an heir sees the list of the inherited unit space and creates a document`: com a API simulada, abre o espaço herdado da amostra, vê a lista, clica em "Novo documento", o documento abre. Sem `page.reload()`; `localStorage` só para montar o estado inicial, antes da navegação; esperas por `expect(...)` com `ROUTE_TIMEOUT`; foco conferido com `toBeFocused()` onde o cenário move o foco; `expectNoSeriousA11yViolations` na página do espaço herdado. Sem `waitForTimeout`, `.skip(` nem `.only(`.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [x] CA3.1 — Com `docker compose up -d`, na raiz e com o cache do `tsc` limpo: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm test:e2e` (a suíte inteira) saem com 0 e sem aviso.
- [x] CA3.2 — `apps/web/e2e/tests/unit-space-documents.spec.ts` tem o teste `an heir sees the list of the inherited unit space and creates a document`, que usa `ROUTE_TIMEOUT`, `toBeFocused(` e `expectNoSeriousA11yViolations(`; `rg -n "lotado diretamente" apps/web/e2e/tests/unit-space-documents.spec.ts` é vazio; `rg -n "waitForTimeout|\.skip\(|\.only\(|reload\(" apps/web/e2e/tests/unit-space-documents.spec.ts` é vazio; toda ocorrência de `localStorage` no arquivo está antes do primeiro `goto` do teste (estado inicial).
- [x] CA3.3 — `docs/architecture.md` cita `access/unit-reach.ts`, `unitSpacesReachedBy`, `readableDocumentsWhere` assíncrono, a regra 12 e que `GET /spaces/{id}/documents` não tem 403; `rg -n "espaço não dá acesso a documento" docs/architecture.md` é vazio.
- [x] CA3.4 — `rg -n "fatia 146" docs/features/152-unit-space-documents-inherit/spec.md` é vazio e `rg -n "fatia 180 share-change-live" docs/features/152-unit-space-documents-inherit/spec.md` casa. `docs/features/127-unit-space-documents/prd.md` e `docs/features/128-unit-space-members/prd.md` citam a 152 como substituta da regra de lotação direta.
- [x] CA3.5 — A fatia está utilizável de ponta a ponta: `pnpm exec vitest run --project api` (0) inclui `a person assigned only to the parent edits a document of an inheriting child space` e `POST /documents in an inherited unit space returns 201 owned by the caller`; `pnpm exec vitest run --project web` (0) inclui `an heir creates a document from Novo documento and it opens`; `pnpm test:e2e` (0) inclui `an heir sees the list of the inherited unit space and creates a document`.

## Desvios

Preenchido pelos agentes de fase quando um teste existente precisar de ajuste ou um critério precisar de literal diferente com o mesmo comportamento.

- DV1 — CA1.5 exige `rg` vazio para `ForbiddenException` também em `apps/api/src/spaces/spaces.service.ts`, mas o serviço usa `ForbiddenException` em regras de espaço livre sem relação com a herança (`updateSettings`, `addMember`, `updateMemberLevel`, `removeMember`: 403 de quem não é dono). Mantidas; o ramo 403 do herdado saiu só de `spaces.controller.ts`, onde `ForbiddenException` deixou de existir. Para `spaces.service.ts`, o critério vale para `INHERITED_REACH_MESSAGE` e "lotado diretamente" (ambos ausentes).
- DV2 — O tipo `ReachUnit` movido para `apps/api/src/access/unit-reach.ts` ganhou `name` e `space.id` (antes só `space.inheritsParent`), porque `reachedUnitSpaces(units: ReachUnit[])` devolve `spaceId` e `name`; os campos já vinham no `select` da antiga `findReachUnits`. O algoritmo de `resolveReach` não mudou; os casos movidos para `unit-reach.test.ts` precisam montar as unidades com esses dois campos.
- DV3 — Os seis casos de árvore de `spaces.service.test.ts` (`list shows a child unit space that inherits to a person assigned to the parent`, `list follows the inheritance chain while spaces inherit`, `list stops the chain at the first own space`, `list ignores inherit on a root unit`, `list treats a parent cycle as not reaching`, `list returns each unit space once when reached twice`) saíram do arquivo e suas árvores viraram asserções dos seis casos nomeados de `unit-reach.test.ts` (cadeia e irmã sem herança em "inherited"; raiz com herança em "stops at a unit whose space does not inherit"; ciclo em `resolveReach`; lotada em mãe e filha em "direct"). Em `spaces.service.test.ts`, `list queries unit spaces scoped by the given organization and person` e `list queries unit and free spaces with the OR scoped by organization and person` passam a asserir a chamada `unitSpacesReachedBy(organizationId, personId)` do `AccessService` falso em vez do `select` de `orgUnit.findMany`; os casos com banco de teste montam o `AccessService` real sobre o mesmo Prisma.
- DV4 — `spaces.integration.test.ts`: `GET space answers reach inherited to an inherited member` continua verdadeiro e passa a esperar `canCreateDocuments: true`; `GET space answers canCreateDocuments false to an inherited unit member` ficou com nome falso e foi substituído por `GET /spaces/{id} returns canCreateDocuments true to an inherited reach`; `GET space documents answers 403 with the direct assignment message to an inherited member` foi substituído por `GET /spaces/{id}/documents returns 200 to an inherited reach`. `spaces.contract.test.ts`: `GET space documents answers the documented 403` foi substituído por `GET /spaces/{id}/documents answers only 200 401 and 404`. `documents.integration.test.ts`: `POST documents with an inherited unit spaceId answers 404 with Espaço não encontrado.` foi substituído por `POST /documents in an inherited unit space returns 201 owned by the caller`. `access.integration.test.ts`: `a person assigned only to the parent unit gets none on an inheriting child space` foi substituído por `a person assigned only to the parent edits a document of an inheriting child space`. `document-access-boundary.test.ts`: `rule 10 accepts assignments in the access service` troca a asserção `assignments: { some: { personId } }` por `unitSpacesReachedBy(` (exemplos infrator e conforme iguais).
- DV5 — O `rg` do CA1.3 (uma só definição de `resolveReach`) casava também as strings de exemplo infrator/conforme da regra 12 em `apps/api/src/access/__tests__/document-access-boundary.test.ts`; a orquestração aprovou o critério excluindo `__tests__`, porque os exemplos são a prova da regra. O CA1.8 dizia 38 casos, mas a lista soma 37 (as contagens por arquivo batem).
- DV6 — CA2.3 exige `rg` vazio para `403` em `apps/web/src/testing/mocks/handlers/spaces.ts` e `apps/web/src/testing/mocks/handlers/documents.ts`, mas os dois arquivos têm 403 de regras sem relação com a herança (em `spaces.ts`: só o dono muda quem adiciona pessoas e o nível de um membro; em `documents.ts`: membro que só lê não cria no espaço livre, e as regras de edição, lixeira e compartilhamento por nível). Mantidos; saiu só o ramo `'inherited'`/403 do `GET /spaces/:spaceId/documents`, e `POST /documents` passou a recusar (404) só o alcance `'none'`. Para esses dois arquivos, o critério vale para `inherited.*forbidden` e para o texto "lotado diretamente" (ambos ausentes).
- DV7 — T2.3 alterou só os casos nomeados, mas em `space.test.tsx` o primeiro caso que abre a página do documento carrega a sessão de colaboração por `import()` depois de a flag `ENABLE_API_MOCKING` voltar ao valor original, e o MSW registrava em stderr "intercepted a WebSocket connection without a matching event handler" (ws://localhost:3000/collab), atribuído ao caso seguinte. Acontecia no caso já existente `creating a document in a free space sends the spaceId and navigates to it` e, depois, no novo `an heir creates a document from Novo documento and it opens`. Os dois ganharam a mesma guarda do caso `a new document in the space appears as documento-sem-titulo-1` (liga `env.ENABLE_API_MOCKING` e restaura com `resetLocalCollaboration()` em `onTestFinished`); o caso novo termina com `await vi.dynamicImportSettled()` para a sessão nascer dentro dele. Nome do caso existente mantido.

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
