# PLAN 006 — favorites

Branch: `feature/006-favorites` (sai de `feature/005-block-editor`, que é a base real; toda comparação de "arquivo intocado" é contra ela, nunca contra `develop`).

Fonte: `docs/features/006-favorites/spec.md` (as siglas D1…D12 são as decisões técnicas da SPEC e R1…R10 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11, Vite 8, Vitest com os projetos `api` e `web`, Playwright.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os cinco. O aviso de desempenho que o próprio Vitest imprime sobre o ambiente jsdom é da ferramenta e **não conta**. O aviso de tamanho de chunk do Vite (`Some chunks are larger than…`) **conta**.

## Regras que valem para todas as tarefas

- Nenhuma dependência nova nesta fatia (nem biblioteca de ícones). Nomes de API de biblioteca (Prisma, TanStack Query, MSW, Playwright) vêm dos tipos do pacote instalado; os critérios medem comportamento e estrutura.
- Todo componente devolve `React.JSX.Element` (nunca o `JSX` global); `ref` é prop comum (sem `forwardRef`); **todo botão nosso é o componente `Button`** de `apps/web/src/components/ui/button/button.tsx`; navegação interna é `<Link>`/`<NavLink>`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case. Textos de tela em pt_BR; código, comentários e nomes de teste em en_US.
- Banco: a migration desta fatia é **escrita à mão** e aplicada por `prisma migrate deploy` (o `global-setup` dos testes da API já faz isso). Ninguém — agente, teste ou critério — roda `prisma migrate diff`, `prisma migrate reset` nem `prisma migrate dev`. Conferência permitida: `pnpm --filter api exec prisma validate`. A limpeza entre testes é `resetDatabase(prisma)`.
- Nenhum literal com cara de senha, token ou hash em arquivo versionado. Sessões de teste vêm de `createPersonWithSession` (`apps/api/test/create-person.ts`) ou dos ajudantes já existentes; valor inválido é `randomUUID()`.
- Cobertura ≥ 80% de linhas **por arquivo** novo ou alterado. Não contam arquivos só de tipos nem os já excluídos pelo `vitest.config.ts` da raiz (`**/types/**`, `**/generated/**`, `**/src/testing/**`, `**/test/**`, `**/*.config.*` e os três arquivos do editor excluídos na fatia 005). Nenhuma exclusão nova.
- Testes que atravessam rota `lazy` ou `React.lazy` esperam por condição com **timeout explícito** (`findBy…(…, {}, { timeout })`, `waitFor(…, { timeout })`, `toBeVisible({ timeout })`). Nunca `setTimeout`/sleep fixo nem `waitForTimeout`.
- Toda decisão de acesso é do servidor: favorito **não dá acesso** a documento algum. A web não ramifica por `accessLevel`.
- Nenhuma tarefa acrescenta escopo: sem favorito em pasta, sem reordenar favoritos, sem contador, sem botão de favorito nas listas.

Desvios em relação à tabela de arquivos da SPEC, sem mudar escopo:

1. `docs/design.md` sai da fase 3 e entra na fase 2 (T2.4): a skill `interface-design` manda a receita nova entrar na mesma entrega da tela que a usa.
2. Na fase 1, se o `pnpm typecheck` acusar objeto de teste da web tipado como `Document` sem `isFavorite`, acrescenta-se `isFavorite: false` naquele objeto, e nada mais (a SPEC previa só o handler; os testes da web são reescritos na fase 2).

## Fase 1 — API: favoritar, desfavoritar e listar favoritos, sempre pelo caminho único de acesso

Caminhos relativos à raiz do repositório.

- [x] T1.1 — Contrato primeiro: dois verbos novos, escopo `favorites` e `isFavorite` no documento
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, **só** pelo script); `apps/web/src/testing/mocks/handlers/documents.ts` (alterar)
  - O que fazer (D3, D4):
    - `openapi.yaml`: caminho `/documents/{documentId}/favorite` com `put` (`operationId: addFavorite`) e `delete` (`operationId: removeFavorite`): sem corpo de requisição; respostas `204` (sem conteúdo), `401`, `403` e `404`, reaproveitando os componentes de resposta de erro que as outras rotas de documento já usam. O parâmetro de query `scope` de `GET /documents` passa a `enum: [mine, favorites]`; a resposta continua `DocumentsResponse` e `DocumentSummary` **não** ganha campo. O schema `Document` ganha `isFavorite` (`type: boolean`), listado em `required`, com descrição em pt_BR ("se a pessoa da sessão marcou o documento como favorito").
    - Regenerar com `pnpm --filter @folioteca/api-contract generate`. O `.d.ts` nunca é editado à mão.
    - `handlers/documents.ts` (**só** o necessário para o typecheck da raiz fechar; o resto do mock é da fase 2): ajudante local `toDocumentBody(document: MockDocument): Document` que devolve `{ ...document, isFavorite: false }`; `POST`, `GET :documentId` e `PATCH` montam `data` com ele. O objeto guardado em `getDb().documents` é um `MockDocument` (sem `isFavorite`).
  - Skills: api-mocking
  - Complexidade: baixa

- [x] T1.2 — Tabela `Favorite`: modelo, migration à mão e limpeza dos testes
  - Arquivos: `apps/api/prisma/schema.prisma` (alterar); `apps/api/prisma/migrations/0005_favorite/migration.sql` (criar); `apps/api/test/reset-database.ts` (alterar)
  - O que fazer (D1):
    - `model Favorite { personId String; documentId String; createdAt DateTime @default(now()); person Person @relation(fields: [personId], references: [id], onDelete: Cascade); document Document @relation(fields: [documentId], references: [id], onDelete: Cascade); @@id([personId, documentId]); @@index([personId, createdAt(sort: Desc)]); @@index([documentId]) }`. `Person` e `Document` ganham só o lado inverso `favorites Favorite[]`; nenhuma coluna nova neles.
    - `0005_favorite/migration.sql`, **à mão**, no formato de `0004_document_content`: `CREATE TABLE "Favorite"` com `"personId" TEXT NOT NULL`, `"documentId" TEXT NOT NULL`, `"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` e `CONSTRAINT "Favorite_pkey" PRIMARY KEY ("personId","documentId")`; `CREATE INDEX "Favorite_personId_createdAt_idx"` em `("personId", "createdAt" DESC)`; `CREATE INDEX "Favorite_documentId_idx"`; `ADD CONSTRAINT "Favorite_personId_fkey"` e `"Favorite_documentId_fkey"`, ambas `ON DELETE CASCADE ON UPDATE CASCADE`. As migrations `0001`–`0004` não são tocadas.
    - `reset-database.ts`: `"Favorite"` entra no `TRUNCATE`.
  - Skills: security
  - Complexidade: baixa

- [x] T1.3 — `FavoritesService`: gravar, apagar e listar, começando sempre pelo acesso
  - Arquivos: `apps/api/src/documents/favorites.service.ts` (criar); `apps/api/src/documents/documents.schema.ts` (alterar); `apps/api/src/documents/documents.module.ts` (alterar)
  - O que fazer (D2, D3, R3, R4, R8):
    - `@Injectable() class FavoritesService`, construtor `(prisma: PrismaService, access: AccessService)`. É o **único** arquivo de produção da API que toca `.favorite.`.
    - `add(personId: string, documentId: string): Promise<void>` — `resolveAccess(personId, documentId)`; `'none'` → `throw documentNotFound()` (de `./document-not-found`; mensagem "Documento não encontrado.", a mesma para inexistente, alheio e id malformado). Depois `favorite.upsert` pela chave composta, com `create: { personId, documentId }` e `update: {}` (repetir **não** renova `createdAt`). Erro conhecido do Prisma `P2002` (dois `PUT` em corrida) é sucesso; `P2003` (documento apagado entre o acesso e a gravação) vira `documentNotFound()`; qualquer outro erro é relançado.
    - `remove(personId: string, documentId: string): Promise<void>` — mesmo começo (`'none'` → 404: ninguém desfavorita o que não enxerga); depois `favorite.deleteMany({ where: { personId, documentId } })`, sucesso mesmo com zero linhas.
    - `list(personId: string): Promise<DocumentSummary[]>` — `favorite.findMany({ where: { personId, document: this.access.readableDocumentsWhere(personId) }, orderBy: [{ createdAt: 'desc' }, { documentId: 'desc' }], take: 100, select: { document: { select: { id: true, title: true, updatedAt: true } } } })`, mapeado para `{ id, title, updatedAt: ISO }`. O título é lido na hora (nada é copiado para `Favorite`). `favorite.findUnique(` é proibido no arquivo. Favorito de documento que a pessoa deixou de enxergar não é apagado nem avisado: só não aparece (e volta se o acesso voltar) — registrar em comentário curto.
    - `documents.schema.ts`: `scope: z.enum(['mine', 'favorites'])` em `listDocumentsQuerySchema`, mantendo a mensagem de erro de `scope` que já existe; comentário atualizado.
    - `DocumentsModule` registra `FavoritesService` em `providers`.
  - Skills: security
  - Complexidade: alta

- [x] T1.4 — `isFavorite` no corpo do documento, sem que `DocumentsService` toque a tabela `Favorite`
  - Arquivos: `apps/api/src/documents/documents.service.ts` (alterar)
  - O que fazer (D4):
    - `get` e `rename` acrescentam à consulta que já fazem (`document.findFirst` e `document.update`) `include: { favorites: { where: { personId }, select: { personId: true } } }`. `toDocument` passa a receber o registro com `favorites`, devolve `isFavorite: favorites.length > 0` e **não** vaza o array `favorites` no corpo. `create` devolve `isFavorite: false` (sem consulta extra).
    - O construtor continua com dois argumentos (`PrismaService`, `AccessService`): `DocumentsService` **não** depende de `FavoritesService` e o arquivo não contém `.favorite.`. `listMine`, `loadContent` e `saveContent` ficam como estão (mesma assinatura e mesmo comportamento).
  - Skills: security
  - Complexidade: média

- [x] T1.5 — Rotas no `DocumentsController`: `PUT`/`DELETE …/favorite` e o despacho da lista por escopo
  - Arquivos: `apps/api/src/documents/documents.controller.ts` (alterar)
  - O que fazer (D3):
    - Construtor ganha `FavoritesService`. `@Put(':documentId/favorite')` e `@Delete(':documentId/favorite')`, ambos com `@HttpCode(204)`, devolvendo `Promise<void>` e chamando `favorites.add(person.id, documentId)` / `favorites.remove(person.id, documentId)`. O id chega cru, sem validação de formato: id malformado é 404, nunca 400. A ordem CSRF (403, guard global) → sessão (401, `SessionGuard` da classe) → acesso (404) → gravação vem da estrutura que já existe; nada novo de guard.
    - `getDocuments`: valida a query com `parseBody(listDocumentsQuerySchema, query)` e despacha — `favorites` → `this.favorites.list(person.id)`; `mine` → `this.documents.listMine(person.id, query)` (assinatura de `listMine` intocada). Escopo inválido continua 400 com o erro no campo `scope`.
  - Skills: security
  - Complexidade: média

- [x] T1.6 — Testes da fase 1
  - Arquivos: `apps/api/src/documents/__tests__/favorites.integration.test.ts` (criar); `apps/api/src/documents/__tests__/favorites.service.test.ts` (criar); `apps/api/src/access/__tests__/document-access-boundary.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.contract.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.service.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.schema.test.ts` (alterar); `apps/api/src/documents/__tests__/documents.integration.test.ts` (alterar)
  - O que fazer: integração contra o Postgres real, sem mock do Prisma; `resetDatabase(prisma)` em `beforeEach`. Pessoa A como nos testes de documentos já existentes; pessoa B por `createPersonWithSession`. Documentos nascem por `POST /api/documents` com o cookie da dona. Nenhuma espera fixa.
    - `favorites.integration.test.ts`:
      - `PUT marks the document as favorite, lists it and reports isFavorite true` (204 sem corpo; aparece em `GET /api/documents?scope=favorites`; `GET /api/documents/{id}` traz `isFavorite: true`);
      - `a second PUT keeps a single row and the same createdAt`;
      - `DELETE removes the favorite, empties the list and reports isFavorite false`;
      - `a second DELETE still answers 204`;
      - `lists favorites from the most recently favorited to the oldest` (três documentos; `createdAt` ajustado direto no banco, sem depender do relógio);
      - `another person gets 404 on PUT and DELETE, identical to unknown and malformed ids, and no row changes` (corpos comparados entre si com `toEqual`; mensagem "Documento não encontrado."; `favorite.count()` igual antes e depois);
      - `the favorites list of another person is empty and their own favorite is independent` (B vê lista vazia com A tendo favoritos; B favorita documento de B e o `isFavorite` dele não muda com o que A faz);
      - `losing read access hides the favorite, DELETE answers 404, the row stays and it reappears when access returns` (o teste troca `ownerId` para B com `prisma.document.update` direto no banco e depois devolve);
      - `deleting the document deletes its favorites` (apaga pelo Prisma no teste, com o `DocumentContent` junto se houver);
      - `deleting the person deletes their favorites` (pessoa B, sem documentos próprios, favoritando nada que impeça apagar — se B não enxerga documento de A, o teste insere a linha de `Favorite` de B direto no banco);
      - `answers 403 without the X-Requested-With header`;
      - `answers 401 without a session cookie`;
      - `answers 400 with the scope error for an unknown scope`.
    - `favorites.service.test.ts` (Prisma e `AccessService` substituídos): `add upserts by the composite key with an empty update`; `add treats P2002 as success`; `add turns P2003 into document not found`; `add rethrows an unknown error`; `add and remove throw document not found when access is none and write nothing`; `remove deletes by person and document and succeeds with zero rows`; `list filters by person and readable documents, orders by createdAt desc then documentId desc and takes 100`; `list maps the related documents to summaries with ISO dates`.
    - `document-access-boundary.test.ts` (acrescentar; as seis regras e os casos existentes ficam): **regra 7**, função `checkFavoriteTable`, no mesmo formato das outras (lê os arquivos de `apps/api/src` do disco, fora `__tests__/`; a falha aponta arquivo e linha): (1) `.favorite.` ou consulta crua citando `"Favorite"` só em `src/documents/favorites.service.ts`; (2) nesse arquivo, toda leitura (`findMany`, `findFirst`, `count`, `aggregate`, `groupBy`) traz `readableDocumentsWhere(` dentro da chamada, e `favorite.findUnique(` reprova; (3) o arquivo contém `resolveAccess(`. Casos: `only favorites.service.ts touches the favorite table`; `every favorite read goes through readableDocumentsWhere and findUnique is forbidden`; `favorites.service.ts calls resolveAccess`; `rule 7 flags a sample offender and accepts a sample compliant snippet`.
    - `documents.contract.test.ts` (acrescentar): `PUT favorite answers 204 as documented`; `DELETE favorite answers 204 as documented`; `favorite on an unknown document answers the documented 404`; `GET documents with scope favorites matches DocumentsResponse`; `POST, GET and PATCH bodies carry isFavorite`.
    - `documents.service.test.ts` (acrescentar; os existentes ficam, ajustando os registros simulados para trazer `favorites`): `get reports isFavorite true when the favorites relation has a row`; `get reports isFavorite false when the relation is empty`; `rename reports isFavorite from the include`; `create reports isFavorite false`; `the favorites array never leaks into the body`.
    - `documents.schema.test.ts` (acrescentar): `accepts the favorites scope`; `rejects a scope outside mine and favorites`.
    - `documents.integration.test.ts`: o tipo e os corpos esperados ganham `isFavorite: false`; acrescentar `a new document is not a favorite`.
  - Skills: unit-testing, integration-testing, security
  - Complexidade: alta

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d` rodando, na raiz: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passam **sem erro nem aviso** (sem aviso de peer no install; sem aviso de chunk grande no build; o aviso de desempenho do Vitest sobre jsdom é da ferramenta e não conta). A saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso do Nest ou do Prisma. `git diff feature/005-block-editor... -- package.json apps/api/package.json apps/web/package.json` não mostra dependência nova.
- [x] CA1.2 — `packages/api-contract/openapi.yaml` descreve `PUT` e `DELETE` em `/documents/{documentId}/favorite` (`addFavorite`, `removeFavorite`), sem corpo de requisição, com respostas `204`, `401`, `403` e `404`; o `scope` de `GET /documents` aceita `mine` e `favorites`; `Document` tem `isFavorite` booleano **obrigatório**; `DocumentSummary` não mudou. `packages/api-contract/src/generated/openapi.d.ts` reflete o YAML (o teste `test/generated-types.test.ts` do pacote passa).
- [x] CA1.3 — `apps/api/prisma/schema.prisma` tem `Favorite` com `personId`, `documentId`, `createdAt` (`@default(now())`), chave `@@id([personId, documentId])`, relações para `Person` e `Document` com `onDelete: Cascade`, índice por `(personId, createdAt desc)` e índice por `documentId`; `Person` e `Document` ganharam só `favorites Favorite[]`. Existe **uma** migration nova, em SQL escrito à mão, que cria `"Favorite"` com chave primária composta, `createdAt` com `DEFAULT CURRENT_TIMESTAMP`, os dois índices e as duas FKs `ON DELETE CASCADE`. `pnpm --filter api exec prisma validate` passa. `git diff --stat feature/005-block-editor... -- apps/api/prisma/migrations` lista só o arquivo novo. `apps/api/test/reset-database.ts` cita `"Favorite"` no `TRUNCATE`.
- [x] CA1.4 — `apps/api/src/documents/favorites.service.ts` exporta `FavoritesService` com `add(personId: string, documentId: string): Promise<void>`, `remove(personId: string, documentId: string): Promise<void>` e `list(personId: string): Promise<DocumentSummary[]>`. Lendo o código: `add` e `remove` chamam `resolveAccess` **antes** de qualquer gravação e lançam `documentNotFound()` para `'none'`; `add` grava por `upsert` na chave composta com `update` vazio, trata `P2002` como sucesso, `P2003` como 404 e relança o resto; `remove` usa `deleteMany` e não falha com zero linhas; `list` parte de `favorite`, filtra por `personId` **e** por `document: readableDocumentsWhere(personId)`, ordena por `createdAt` desc com desempate por `documentId` desc e limita a 100. `DocumentsModule` registra o serviço.
- [x] CA1.5 — Fronteira da tabela: `rg -n "\.favorite\s*\." apps/api/src --glob '!**/__tests__/**'` só acha `apps/api/src/documents/favorites.service.ts`; `rg -n "favorite\.findUnique\(" apps/api/src --glob '!**/__tests__/**'` é vazio. O teste estrutural reprova de verdade: `document-access-boundary.test.ts` tem a função `checkFavoriteTable`, aplicada ao código real lido do disco e a uma amostra infratora × amostra correta.
- [x] CA1.6 — `apps/api/src/documents/documents.service.ts`: `get` e `rename` trazem `favorites` filtrado pela pessoa da chamada via `include` na consulta que já faziam; o corpo devolvido tem `isFavorite` booleano e **não** tem a chave `favorites`; `create` devolve `isFavorite: false`. O construtor continua recebendo só `PrismaService` e `AccessService`, e `listMine(personId: string, query: unknown)`, `loadContent` e `saveContent` mantêm a assinatura.
- [x] CA1.7 — `apps/api/src/documents/documents.controller.ts` tem as rotas `PUT :documentId/favorite` e `DELETE :documentId/favorite`, ambas respondendo `204` sem corpo, sob o mesmo `SessionGuard` da classe e sem validação de formato do id. `getDocuments` valida a query com o schema de escopo e despacha: `favorites` para `FavoritesService.list`, `mine` para `DocumentsService.listMine`. `apps/api/src/documents/documents.schema.ts` aceita exatamente `mine` e `favorites`.
- [x] CA1.8 — Existem e passam, pelos nomes listados em T1.6: `favorites.integration.test.ts` (13 casos, entre eles `a second PUT keeps a single row and the same createdAt`, `another person gets 404 on PUT and DELETE, identical to unknown and malformed ids, and no row changes`, `losing read access hides the favorite, DELETE answers 404, the row stays and it reappears when access returns`, `deleting the document deletes its favorites` e os de 403, 401 e 400), `favorites.service.test.ts` (8), os 4 novos de `document-access-boundary.test.ts`, os 5 novos de `documents.contract.test.ts`, os 5 novos de `documents.service.test.ts`, os 2 novos de `documents.schema.test.ts` e o novo de `documents.integration.test.ts`. A integração usa o Postgres real (`rg -n "vi\.mock\(.*prisma" apps/api/src/documents/__tests__/favorites.integration.test.ts` é vazio). Os testes das fatias anteriores continuam passando. Conferir com `npx vitest run --project api --reporter=verbose`.
- [x] CA1.9 — Nenhuma espera fixa nem credencial literal nos testes novos: `rg -n "setTimeout\(|sleep\(" apps/api/src/documents/__tests__/favorites.integration.test.ts apps/api/src/documents/__tests__/favorites.service.test.ts` é vazio, e `rg -n "folioteca_session=[A-Za-z0-9]" apps/api/src/documents/__tests__` é vazio.
- [x] CA1.10 — O relatório de cobertura de `pnpm test` lista com ≥ 80% de linhas cada: `apps/api/src/documents/favorites.service.ts`, `documents/documents.service.ts`, `documents/documents.controller.ts`, `documents/documents.module.ts` e `documents/documents.schema.ts`; arquivo ausente do relatório conta como reprovado.
- [x] CA1.11 — Web só o mínimo: em `apps/web/src/testing/mocks/handlers/documents.ts` existe `toDocumentBody`, usado por `POST`, `GET :documentId` e `PATCH`, e os corpos levam `isFavorite`. Intocados nesta fase: `git diff --stat feature/005-block-editor... -- apps/api/src/access/access.service.ts apps/api/src/access/access-level.ts apps/api/src/collab apps/web/src/features apps/web/src/app apps/web/src/components apps/web/src/types/api.ts` só mostra, no máximo, arquivos dentro de `__tests__/` (o desvio 2 do topo do plano).

## Fase 2 — Web: botão de favorito na página do documento, seção "Favoritos" na barra lateral e página "Favoritos" com a lista

Caminhos relativos a `apps/web/`, salvo os que começam por `docs/`.

- [x] T2.1 — API simulada: favoritos no banco em memória, os dois verbos, o escopo novo e a chave de desenvolvimento
  - Arquivos: `src/testing/mocks/db.ts` (alterar); `src/testing/mocks/handlers/documents.ts` (alterar); `src/testing/mocks/index.ts` (alterar); `src/testing/mocks/utils.ts` (alterar)
  - O que fazer (D10):
    - `db.ts`: `export type MockFavorite = { documentId: string; createdAt: string }`; o estado ganha `favorites: MockFavorite[]`, zerado em `initialState` (a API simulada tem uma pessoa só). `MockDocument` **não** ganha `isFavorite`. `export const seedSampleFavorites = (): void` — favorita os 9 primeiros documentos do estado, com `createdAt` decrescentes espaçados; sem documentos, não faz nada.
    - `handlers/documents.ts`: `toDocumentBody` passa a calcular `isFavorite` de verdade (existe favorito com aquele `documentId`). `http.put` e `http.delete` em `${env.API_URL}/documents/:documentId/favorite`, com o mesmo começo dos outros handlers (`networkDelay`, `devOverride('documents')`, sem cookie → 401 "Sessão não encontrada.", documento inexistente → 404 "Documento não encontrado."), respondendo `204` sem corpo; `PUT` repetido não duplica nem renova a data; `DELETE` de quem não é favorito responde 204. `GET /documents` aceita `scope=favorites`: favoritos por `createdAt` desc, cruzados com os documentos existentes, limite 100, no formato de resumo (`id`, `title`, `updatedAt`); escopo fora de `mine`/`favorites` continua 400 com o erro de `scope`.
    - `mocks/index.ts`: chave de `localStorage` `mock-favorites`; valor `sample` chama `seedSampleFavorites()` **depois** do seed dos documentos. `utils.ts`: documentar a chave nova no mesmo bloco de comentário das outras.
  - Skills: api-mocking
  - Complexidade: média

- [x] T2.2 — Lista de documentos por escopo e invalidação de todas as listas
  - Arquivos: `src/features/documents/api/get-documents.ts` (alterar); `src/features/documents/api/update-document.ts` (alterar); `src/features/documents/hooks/use-document-collaboration.ts` (alterar)
  - O que fazer (D5, D7, R9):
    - `get-documents.ts`: `export type DocumentsScope = 'mine' | 'favorites'`; `getDocuments(scope: DocumentsScope): Promise<DocumentsResponse>` (`api.get('/documents', { params: { scope } })`); `getDocumentsQueryOptions(scope: DocumentsScope = 'mine')` com chave `['documents', { scope }]`; `useDocuments({ scope, queryConfig }: { scope?: DocumentsScope; queryConfig?: … } = {})`; `invalidateDocumentLists(queryClient: QueryClient): void` — invalida a chave de **cada** escopo e **não** toca `['documents', <id>]` (o documento aberto acabou de ser gravado com `setQueryData`; invalidar pelo prefixo `['documents']` causaria refetch inútil). O padrão `'mine'` mantém quem chama sem argumento.
    - `update-document.ts` (no `onSuccess`) e `use-document-collaboration.ts` (ao receber a mensagem `stored`) trocam a invalidação de `getDocumentsQueryOptions().queryKey` por `invalidateDocumentLists(queryClient)`: título e data atualizam também em favoritos. O resto dos dois arquivos não muda.
  - Skills: api-requests
  - Complexidade: baixa

- [x] T2.3 — `useUpdateFavorite`: mutação otimista com rollback
  - Arquivos: `src/features/documents/api/update-favorite.ts` (criar)
  - O que fazer (D7, R2). **Um** arquivo para o par `PUT`/`DELETE` (desvio consciente da regra "um arquivo por operação": o ciclo otimista seria escrito duas vezes; registrar em comentário curto):
    - `updateFavorite({ documentId, isFavorite }: { documentId: string; isFavorite: boolean }): Promise<void>` — `isFavorite ? api.put(`/documents/${documentId}/favorite`) : api.delete(…)`.
    - `useUpdateFavorite({ mutationConfig }: { mutationConfig?: MutationConfig<typeof updateFavorite> } = {})`:
      - `onMutate`: `cancelQueries` na chave de `getDocumentQueryOptions(documentId)`, guarda o valor anterior, `setQueryData` trocando **só** `data.isFavorite`; devolve `{ previous }`. Sem documento no cache, não grava nada;
      - `onError`: repõe `previous` (se havia) e repassa o `onError` de quem chamou;
      - `onSettled`: invalida `getDocumentsQueryOptions('favorites').queryKey` e a chave do documento; repassa o `onSettled`. A lista "mine" **não** é invalidada (o resumo não tem `isFavorite`).
    - A falha é avisada pela notificação do interceptor do cliente HTTP, que já existe: o hook não cria notificação própria. Com 404 (perdeu o acesso), o rollback acontece e o refetch do documento leva a página ao estado "Documento não encontrado" que já existe.
  - Skills: api-requests, error-handling
  - Complexidade: alta

- [x] T2.4 — Botão de favorito na página do documento (variante `ghost`, estrela inline, receitas novas)
  - Arquivos: `src/components/ui/button/button.tsx` (alterar); `src/features/documents/components/favorite-button.tsx` (criar); `src/features/documents/components/document-view.tsx` (alterar); `docs/design.md` (alterar)
  - O que fazer (D8, D9, R1, R2, R10):
    - `button.tsx`: variante `ghost` = base do botão + `text-gray-700 hover:bg-gray-100 focus-visible:outline-blue-600`. As variantes `primary` e `secondary` e o padrão não mudam.
    - `FavoriteButton({ document }: { document: Document }): React.JSX.Element` — `Button` `variant="ghost"` com ícone + **texto visível** (o nome acessível é o próprio texto; sem `aria-label`):

      | Estado | Texto visível | `aria-pressed` | Estrela |
      |---|---|---|---|
      | Não favoritado | "Adicionar aos favoritos" | `false` | contorno |
      | Favoritado | "Remover dos favoritos" | `true` | preenchida |
      | Falha ao gravar | volta ao estado anterior; a notificação "Algo deu errado" é a do cliente HTTP, já existente | — | — |

      O clique chama `useUpdateFavorite` com o estado-alvo `!document.isFavorite` (lido da prop, que vem do cache). Clique repetido: retorno antecipado no manipulador enquanto `mutation.isPending`, **sem** o atributo `disabled` (desvio consciente de `component-robustness` §9: `disabled` aplicaria opacidade a cada clique, contradizendo "muda na hora", e tiraria o foco do teclado; registrar em comentário curto).
    - Estrela: `<svg>` inline dentro de `favorite-button.tsx` (uma ocorrência só; não vira componente compartilhado nem entra biblioteca de ícones), `viewBox="0 0 24 24"`, `aria-hidden="true"`, `focusable="false"`, tamanho da receita, traço `currentColor`. Favoritada: preenchida com `currentColor` em `text-amber-600` (contraste ≥ 3:1 sobre branco; `amber-500` não chega); não favoritada: sem preenchimento, na cor do texto do botão.
    - `document-view.tsx`: **só** o estado com dados (`LoadedDocument`) muda. De cima para baixo: `h1` só para leitor de tela (já existe) → **linha de ações**, alinhada à direita, com `FavoriteButton` → título editável → indicador de salvamento → editor. Nos estados carregando, não encontrado e erro o botão não aparece.
    - `docs/design.md`, tabela "Padrões acrescentados pelas entregas", Fatia = 006, três receitas: "Botão discreto (`ghost`)" — base do botão + `text-gray-700 hover:bg-gray-100 focus-visible:outline-blue-600`; "Linha de ações do documento" — `<div className="flex justify-end">` acima do título editável; "Estrela de favorito" — `<svg aria-hidden="true" focusable="false" className="size-5">`, traço `currentColor`; favoritado: preenchida, `text-amber-600`.
  - Skills: ui-components, interface-design, component-robustness
  - Complexidade: média

- [x] T2.5 — Lista e seção da barra lateral parametrizadas por escopo; página "Favoritos" e as duas seções na raiz
  - Arquivos: `src/features/documents/components/documents-list.tsx` (alterar); `src/features/documents/components/sidebar-documents.tsx` (alterar); `src/app/routes/app/favorites.tsx` (alterar); `src/app/routes/app/root.tsx` (alterar)
  - O que fazer (D6, R5, R6, R7). `DocumentsList` e `SidebarDocuments` recebem `scope?: DocumentsScope` (padrão `'mine'`), chamam `useDocuments({ scope })` e tiram de um **mapa interno por escopo** só o que muda (textos, rótulo do `<nav>`, destino do "Ver todos"). Marcação, estados e classes **não** são duplicados; os textos de `mine` não mudam.
    - `DocumentsList` com `scope="favorites"` (receitas "Carregando", "Vazio", "Erro", "Lista", "Data em lista"):

      | Estado | O que aparece |
      |---|---|
      | Carregando (`role="status"`) | "Carregando favoritos…" |
      | Vazio | "Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui." |
      | Erro (`role="alert"`) | "Não foi possível carregar seus favoritos." + botão vermelho "Tentar novamente" |
      | Com dados | título como link para o documento à esquerda (truncado, com `title`), data de atualização à direita; na ordem da API |

    - `SidebarDocuments` com `scope="favorites"` (receitas "Seção da barra lateral", "Item da barra lateral", "Botão secundário"): `<nav aria-label="Documentos favoritos">`:

      | Estado | O que aparece |
      |---|---|
      | Cabeçalho (`h2`) | "Favoritos" |
      | Carregando (`role="status"`) | "Carregando favoritos…" |
      | Vazio | "Nenhum favorito ainda." |
      | Erro (`role="alert"`) | "Não foi possível carregar seus favoritos." + botão secundário "Tentar novamente" |
      | Com dados | até 8 itens (título truncado com `title`, data de atualização abaixo), na ordem da API; com mais de 8, link "Ver todos" → `/favorites` (`paths.favorites.getHref()`) |

    - `favorites.tsx`: mantém o `ContentLayout` com `h1` "Favoritos" e o apoio "Os documentos que você marca como favoritos ficam à mão aqui." e troca o texto fixo de vazio por `<DocumentsList scope="favorites" />`.
    - `root.tsx`: o slot `sidebarSection`, que já existe, recebe `<><SidebarDocuments scope="favorites" /><SidebarDocuments /></>` — "Favoritos" **acima** de "Meus documentos". `app-layout.tsx` não é tocado.
  - Skills: interface-design, component-robustness, routing, project-structure
  - Complexidade: média

- [x] T2.6 — Testes da fase 2
  - Arquivos: `src/features/documents/api/__tests__/update-favorite.test.tsx` (criar); `src/features/documents/components/__tests__/favorite-button.test.tsx` (criar); `src/app/routes/app/__tests__/favorites.test.tsx` (criar); `src/app/routes/app/__tests__/empty-areas.test.tsx` (alterar); `src/app/routes/app/__tests__/root.test.tsx` (alterar); `src/features/documents/api/__tests__/get-documents.test.tsx` (alterar); `src/features/documents/api/__tests__/update-document.test.tsx` (alterar); `src/features/documents/hooks/__tests__/use-document-collaboration.test.tsx` (alterar); `src/features/documents/components/__tests__/documents-list.test.tsx` (alterar); `src/features/documents/components/__tests__/sidebar-documents.test.tsx` (alterar); `src/features/documents/components/__tests__/document-view.test.tsx` (alterar); `src/components/ui/button/__tests__/button.test.tsx` (alterar)
  - O que fazer: MSW + Testing Library, com o banco simulado semeado por `seedDb`/`getDb`. Corpos simulados e objetos tipados como `Document` levam `isFavorite`. Esperas em rota `lazy` com timeout explícito; nenhuma espera fixa. Nenhum erro nem aviso no console (inclusive `act`). Os casos existentes ficam, salvo o dito abaixo.
    - `update-favorite.test.tsx`: `sends PUT when isFavorite is true and DELETE when it is false`; `flips isFavorite in the document cache before the server answers` (handler com `delay('infinite')`); `rolls the cache back on a 500`; `leaves the cache alone when the document was never loaded`; `invalidates the favorites list and the document when settled, not the mine list`; `forwards onError and onSettled to the caller`.
    - `favorite-button.test.tsx`: `shows Adicionar aos favoritos with aria-pressed false`; `shows Remover dos favoritos with aria-pressed true`; `the star is hidden from assistive technology and filled only when favorite`; `toggles with Enter`; `toggles with Space`; `a second click while pending sends a single request`; `is never disabled while pending`; `rolls back and shows the notification when the server fails`.
    - `documents-list.test.tsx` (acrescentar): `favorites scope requests scope=favorites`; `favorites scope shows Carregando favoritos…`; `favorites scope shows the empty text`; `favorites scope shows the error and retries`; `favorites scope lists in the API order with link and date`; `favorites scope truncates a 200 character title and keeps it in title`.
    - `sidebar-documents.test.tsx` (acrescentar): `favorites scope names the nav Documentos favoritos and the heading Favoritos`; `favorites scope shows Carregando favoritos…`; `favorites scope shows Nenhum favorito ainda.`; `favorites scope shows the error with a secondary retry button`; `favorites scope shows 8 of 9 favorites and Ver todos pointing to /favorites`; `favorites scope truncates a 200 character title and keeps it in title`; `mine scope keeps its texts and Ver todos pointing to /my-documents`.
    - `favorites.test.tsx` (integração, rotas reais): `shows a single h1 Favoritos and the support text`; `lists the favorite documents`; `shows the empty state`; `shows the error and retries`; `marks the Favoritos link as current`.
    - `empty-areas.test.tsx`: "Favoritos" sai do conjunto de áreas vazias (o vazio agora vem da API); as demais áreas ficam.
    - `root.test.tsx` (acrescentar): `renders the favorites section above the my documents section`.
    - `get-documents.test.tsx` (acrescentar): `uses one key per scope and defaults to mine`; `requests the given scope`; `invalidateDocumentLists invalidates both lists and leaves the open document alone`.
    - `update-document.test.tsx` (acrescentar): `invalidates the favorites list too`. `use-document-collaboration.test.tsx` (acrescentar): `invalidates the favorites list on a stored message`.
    - `document-view.test.tsx` (acrescentar): `shows the favorite button before the title field when the document is loaded`; `shows no favorite button while loading, when not found and on error`.
    - `button.test.tsx` (acrescentar): `renders the ghost variant`.
  - Skills: unit-testing, component-testing, integration-testing, api-mocking
  - Complexidade: alta

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d` rodando, na raiz: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passam **sem erro nem aviso** (sem aviso de peer no install). A saída de `pnpm test` não tem `Warning:`, `act(`, `console.error` nem `console.warn` (o aviso de desempenho do Vitest sobre jsdom não conta). A saída de `pnpm build` **não** tem o aviso de chunk grande (`larger than`), e `rg -n "chunkSizeWarningLimit" apps/web` é vazio. `git diff feature/005-block-editor... -- apps/web/package.json` é vazio (nenhuma biblioteca de ícones).
- [x] CA2.2 — `apps/web/src/features/documents/api/get-documents.ts` exporta `DocumentsScope` (`'mine' | 'favorites'`), `getDocuments(scope)`, `getDocumentsQueryOptions(scope = 'mine')` com chave `['documents', { scope }]`, `useDocuments({ scope, queryConfig })` e `invalidateDocumentLists(queryClient)`, que invalida a chave de cada escopo e não a de um documento por id. `update-document.ts` e `hooks/use-document-collaboration.ts` invalidam as listas por `invalidateDocumentLists` — `rg -n "invalidateDocumentLists\(" apps/web/src/features/documents --glob '!**/__tests__/**'` acha os dois e a definição.
- [x] CA2.3 — `apps/web/src/features/documents/api/update-favorite.ts` exporta `updateFavorite({ documentId, isFavorite }): Promise<void>` (envia `PUT` ou `DELETE` para `/documents/{documentId}/favorite`) e `useUpdateFavorite({ mutationConfig })`. Lendo o código: antes da resposta, cancela as consultas do documento, guarda o valor anterior e troca só `isFavorite` no cache do documento; em erro, repõe o valor anterior; ao terminar, invalida a lista de favoritos e o documento, e **não** a lista `mine`; `onError` e `onSettled` de quem chamou são repassados. O hook não cria notificação própria.
- [x] CA2.4 — `apps/web/src/features/documents/components/favorite-button.tsx` exporta `FavoriteButton({ document })`, devolve `React.JSX.Element` e renderiza o componente `Button` na variante `ghost` com os textos literais "Adicionar aos favoritos" e "Remover dos favoritos", `aria-pressed` igual a `document.isFavorite`, sem `aria-label` e **sem** `disabled`; o manipulador de clique retorna cedo enquanto a mutação está pendente. A estrela é um `<svg>` inline com `aria-hidden="true"` e `focusable="false"`, traço `currentColor`, preenchida e em `text-amber-600` só quando favoritado. `apps/web/src/components/ui/button/button.tsx` tem a variante `ghost` com `text-gray-700 hover:bg-gray-100 focus-visible:outline-blue-600`, e `primary`/`secondary` não mudaram.
- [x] CA2.5 — `document-view.tsx`: no estado com dados a ordem é `<h1 className="sr-only">` → linha de ações (contêiner `flex justify-end`) com `FavoriteButton` → `DocumentTitleForm` → `SaveIndicator` → área do editor. `FavoriteButton` só aparece em `LoadedDocument`; os estados carregando, não encontrado e erro mantêm os textos "Carregando documento…", "Documento não encontrado", "Este documento não existe ou você não tem acesso a ele.", "Ir para Meus documentos" e "Não foi possível carregar o documento.".
- [x] CA2.6 — `documents-list.tsx` e `sidebar-documents.tsx` recebem `scope?: DocumentsScope` com padrão `'mine'` e guardam os textos num mapa por escopo; cada arquivo continua com **uma** marcação por estado (um só `role="status"`, um só `role="alert"`, uma só lista). Textos literais de favoritos: na lista, "Carregando favoritos…", "Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.", "Não foi possível carregar seus favoritos." e "Tentar novamente"; na barra lateral, `aria-label="Documentos favoritos"`, `h2` "Favoritos", "Carregando favoritos…", "Nenhum favorito ainda.", "Não foi possível carregar seus favoritos.", "Tentar novamente" e "Ver todos" apontando para a rota de favoritos por `paths`. Os textos de `mine` continuam: "Carregando documentos…", "Nenhum documento ainda. Os documentos que você criar aparecem aqui.", "Não foi possível carregar seus documentos.", `aria-label="Meus documentos recentes"`, `h2` "Meus documentos".
- [x] CA2.7 — `apps/web/src/app/routes/app/favorites.tsx` mostra o `h1` "Favoritos", o apoio "Os documentos que você marca como favoritos ficam à mão aqui." e `<DocumentsList scope="favorites" />` (sem texto fixo de vazio). `apps/web/src/app/routes/app/root.tsx` passa no slot `sidebarSection` a seção de favoritos **antes** da seção de meus documentos.
- [x] CA2.8 — API simulada: `apps/web/src/testing/mocks/db.ts` tem `favorites` no estado (zerado no estado inicial), o tipo `MockFavorite` e `seedSampleFavorites`; `MockDocument` não tem `isFavorite`. `handlers/documents.ts` tem handlers `PUT` e `DELETE` em `…/documents/:documentId/favorite` (401 sem cookie, 404 sem documento, 204 sem corpo, `PUT` repetido não duplica), `GET /documents` responde a `scope=favorites` na ordem do favoritado mais recente, e `toDocumentBody` calcula `isFavorite` a partir do estado. `mocks/index.ts` lê a chave `mock-favorites`, e `mocks/utils.ts` a documenta.
- [x] CA2.9 — Piso de acabamento, conferível lendo o código: a página "Favoritos" usa o contêiner e o título de página do `docs/design.md` e tem um único `<h1>`; os quatro estados da lista e da seção ocupam o mesmo lugar, com `role="status"` no carregando e `role="alert"` no erro; o erro da lista tem borda e fundo de destaque e `Button` com `bg-red-600 hover:bg-red-700 focus-visible:outline-red-600`; o erro da seção usa `Button` `variant="secondary"`; o vazio é em tom suave; cada item separa título (à esquerda ou acima, truncado, com `title`) da data (tom suave); a linha de ações do documento tem espaço vertical até o título. **Todo botão nosso é `Button`**: `rg -n "<button" apps/web/src/features apps/web/src/app --glob '!**/__tests__/**'` é vazio. `rg -n "style=\{\{|!important|forwardRef|: JSX\.Element" apps/web/src --glob '!**/__tests__/**'` não acha nada. Navegação interna só por `<Link>`/`<NavLink>`. `docs/design.md` tem, com Fatia 006, as receitas "Botão discreto (`ghost`)", "Linha de ações do documento" e "Estrela de favorito".
- [x] CA2.10 — Existem e passam, pelos nomes listados em T2.6: `update-favorite.test.tsx` (6, entre eles `flips isFavorite in the document cache before the server answers`, `rolls the cache back on a 500` e `invalidates the favorites list and the document when settled, not the mine list`), `favorite-button.test.tsx` (8, entre eles `toggles with Enter`, `toggles with Space`, `a second click while pending sends a single request` e `rolls back and shows the notification when the server fails`), os 6 novos de `documents-list.test.tsx`, os 7 novos de `sidebar-documents.test.tsx` (entre eles `favorites scope shows 8 of 9 favorites and Ver todos pointing to /favorites`), `favorites.test.tsx` (5), o novo de `root.test.tsx`, os 3 novos de `get-documents.test.tsx`, o novo de `update-document.test.tsx`, o novo de `use-document-collaboration.test.tsx`, os 2 novos de `document-view.test.tsx` e o novo de `button.test.tsx`. `empty-areas.test.tsx` não cobre mais "Favoritos". Os testes das fatias anteriores continuam passando. Conferir com `npx vitest run --project web --reporter=verbose`.
- [x] CA2.11 — Esperas: nos arquivos de teste novos ou alterados da fase, toda espera por rota lazy passa timeout explícito, e `rg -n "new Promise\(.*setTimeout|sleep\(" apps/web/src/features/documents apps/web/src/app/routes/app/__tests__` é vazio.
- [x] CA2.12 — O relatório de cobertura de `pnpm test` lista com ≥ 80% de linhas cada: `apps/web/src/features/documents/api/get-documents.ts`, `api/update-favorite.ts`, `api/update-document.ts`, `hooks/use-document-collaboration.ts`, `components/favorite-button.tsx`, `components/document-view.tsx`, `components/documents-list.tsx`, `components/sidebar-documents.tsx`, `apps/web/src/components/ui/button/button.tsx`, `apps/web/src/app/routes/app/favorites.tsx` e `app/routes/app/root.tsx`; arquivo ausente do relatório conta como reprovado (`src/testing/**` não conta). `git diff feature/005-block-editor... -- vitest.config.ts` é vazio.
- [x] CA2.13 — Fronteiras e intocados: nenhum arquivo de `apps/web/src/components`, `lib`, `config`, `types` ou `utils` importa de `@/features` ou `@/app`; `features/documents` não importa de outra feature, de `@/app` nem de `@/testing`; não há barrel novo. `git diff --stat feature/005-block-editor... -- apps/web/src/components/layouts/app-layout.tsx apps/web/src/features/documents/api/create-document.ts apps/web/src/features/documents/api/get-document.ts apps/web/src/config/paths.ts apps/web/src/app/router.tsx apps/web/src/types/api.ts` é vazio.

## Fase 3 — Jornada "favoritar um documento e reencontrá-lo" provada de ponta a ponta e documentada

- [x] T3.1 — Documentação: a entrega `favorites` na arquitetura
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer, em pt_BR, sem reescrever o resto: na §3 (decisão de acesso), parágrafo novo "Entrega `favorites` (fatia 006)": favorito é marcação pessoal e **não dá acesso** a documento; a tabela `Favorite` tem chave `(personId, documentId)` e some por cascade com o documento ou a pessoa; a lista de favoritos parte de `Favorite` e passa por `readableDocumentsWhere` — quem perde o acesso deixa de ver o favorito, sem apagar nem avisar, e ele volta se o acesso voltar; `PUT` e `DELETE /documents/{documentId}/favorite` são idempotentes e começam por `resolveAccess`, com 404 único "Documento não encontrado." para inexistente, alheio e id malformado; `isFavorite` vem no corpo do documento; regra 7 do teste estrutural `document-access-boundary.test.ts` (só `documents/favorites.service.ts` toca a tabela, toda leitura com `readableDocumentsWhere`, `findUnique` proibido, `resolveAccess` obrigatório). O status da fatia no roadmap **não** é desta tarefa (é mudado pela orquestração no encerramento).
  - Skills: —
  - Complexidade: baixa

- [x] T3.2 — Testes da fase 3 (e2e da jornada de favoritos)
  - Arquivos: `apps/web/e2e/tests/favorites.spec.ts` (criar)
  - O que fazer: contra a API simulada; localizar por papel e texto em pt_BR. Estado inicial por `page.addInitScript` gravando `mock-installation` = `signed-in` no `localStorage`. Depois de criar o documento, **navegar só por links** (o banco simulado vive na página): nenhum `page.goto` nem `page.reload` entre a criação e o fim do caso. Toda espera após navegar para rota `lazy` e a da região do editor usam `timeout` explícito (`20_000`, como em `create-document.spec.ts`); nenhum `waitForTimeout`. Se algum passo usar tecla de movimento seguida de tecla de edição dentro de um campo ou do editor, espera-se a seleção colapsar (condição com timeout) antes da tecla de edição; a jornada não precisa escrever no editor.
    - Um caso, `marks a document as favorite from the keyboard, finds it in the sidebar and in Favoritos, sees the rename there and removes it`:
      1. abre `/`, cria o documento pelo botão "Novo documento", espera a região "Conteúdo do documento" (`timeout`), renomeia pelo campo "Título" (`fill` + `Enter`);
      2. leva o foco ao botão "Adicionar aos favoritos" **só pelo teclado** (`Tab`/`Shift+Tab` a partir do campo "Título"; confere com `toBeFocused`) e aciona com `Enter`: o botão passa a "Remover dos favoritos" com `aria-pressed="true"`. Nenhum `.click()` nem `.focus()` nesse botão;
      3. o título aparece dentro do `<nav>` de nome "Documentos favoritos";
      4. vai a "Favoritos" pelo link da "Navegação principal" (URL `/favorites`), vê o `h1` "Favoritos" e a linha com o link do título e o `<time>`; roda `expectNoSeriousA11yViolations(page)`;
      5. volta ao documento pelo link da linha, espera a região do editor (`timeout`), renomeia de novo e confere o título **novo** dentro do `<nav>` "Documentos favoritos";
      6. leva o foco ao botão pelo teclado e aciona com `Space`: volta a "Adicionar aos favoritos" com `aria-pressed="false"`; vai a "Favoritos" pela navegação principal e vê o vazio "Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.".
    - axe na página do documento, se rodado, usa a **mesma** exceção já existente (`disableRulesWithin` com `.bn-container` e `aria-input-field-name`); nenhuma regra é desativada para a página inteira. `apps/web/e2e/a11y.ts` e os outros specs não são tocados.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [x] CA3.1 — `pnpm test:e2e` na raiz passa (o Playwright sobe o próprio servidor; não precisa de API nem de Postgres), e continuam passando **sem erro nem aviso** `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` (com `docker compose up -d` rodando; o aviso do Vitest sobre jsdom não conta; o aviso de chunk grande do Vite conta e não pode aparecer).
- [x] CA3.2 — `apps/web/e2e/tests/favorites.spec.ts` contém o caso `marks a document as favorite from the keyboard, finds it in the sidebar and in Favoritos, sees the rename there and removes it`, e `pnpm --filter web exec playwright test --list` o lista junto com os casos já existentes de `open-app.spec.ts`, `install.spec.ts`, `login-logout.spec.ts`, `create-document.spec.ts` e `block-editor.spec.ts` (nenhum removido nem renomeado). Não há `test.skip`, `test.only` nem `waitForTimeout` em `apps/web/e2e`.
- [x] CA3.3 — Lendo o caso: o botão de favorito é acionado só pelo teclado (o foco é conferido com `toBeFocused` e as teclas são `Enter` e `Space`; nenhum `.click()` nem `.focus()` no localizador do botão); ele confere "Remover dos favoritos" com `aria-pressed="true"`, o título dentro da navegação "Documentos favoritos", a linha na página `/favorites` com link e `<time>`, o título **novo** na navegação "Documentos favoritos" depois de renomear, e o texto de vazio da página depois de remover. `expectNoSeriousA11yViolations` é chamado na página "Favoritos". Entre a criação do documento e o fim do caso não há `page.goto` nem `page.reload`. Toda espera logo após mudar de rota e a da região "Conteúdo do documento" passam `timeout` explícito.
- [x] CA3.4 — Acessibilidade sem atalho novo: `git diff --stat feature/005-block-editor... -- apps/web/e2e/a11y.ts apps/web/e2e/tests/install.spec.ts apps/web/e2e/tests/login-logout.spec.ts apps/web/e2e/tests/open-app.spec.ts apps/web/e2e/tests/create-document.spec.ts apps/web/e2e/tests/block-editor.spec.ts apps/web/e2e/mock-credentials.ts` é vazio; em `favorites.spec.ts`, qualquer desativação de regra do axe é restrita ao seletor `.bn-container`. Os arquivos de `apps/web/e2e/**` passam no `pnpm lint` e no `pnpm typecheck`. Nenhuma senha, token ou hash literal em `apps/web/e2e/tests/favorites.spec.ts`.
- [x] CA3.5 — `docs/architecture.md` §3 tem o parágrafo "Entrega `favorites` (fatia 006)" dizendo: favorito não dá acesso; chave `(personId, documentId)` e cascade; a lista passa por `readableDocumentsWhere` e o favorito de documento inacessível só deixa de aparecer; `PUT`/`DELETE` idempotentes, começando por `resolveAccess`, com 404 único; `isFavorite` no corpo do documento; regra 7 do teste estrutural.
- [x] CA3.6 — A fatia está utilizável de ponta a ponta sem navegador aberto por pessoa: existem e passam `apps/api/src/documents/__tests__/favorites.integration.test.ts` (`npx vitest run --project api`), `apps/web/src/app/routes/app/__tests__/favorites.test.tsx` com o caso `lists the favorite documents` (`npx vitest run --project web`) e a jornada e2e de `favorites.spec.ts` (`pnpm test:e2e`).

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
