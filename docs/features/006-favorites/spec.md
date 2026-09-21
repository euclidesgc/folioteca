# SPEC 006 — favorites

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Parte de `docs/architecture.md` §2 (contrato primeiro), §3 (decisão
de acesso: caminho único) e §7 (testes). A branch sai de
`feature/005-block-editor` (§9, entregas empilhadas); toda comparação de
"arquivo intocado" é contra ela.

Lições vigentes que valem para toda tarefa do PLAN: `React.JSX.Element` (nunca o
`JSX` global); botão nosso é sempre o componente `Button`; cobertura ≥ 80% por
arquivo; nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`;
espera com `timeout` explícito em tudo que depende de rota ou chunk `lazy`;
nenhum `prisma migrate diff/reset/dev` (a migration é escrita à mão e aplicada
por `prisma migrate deploy`); nenhum literal com cara de senha (senha de teste
é `randomUUID()` ou os ajudantes que já existem).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `FavoriteButton` na página do documento: componente `Button` (variante nova `ghost`) com estrela em SVG inline e texto visível "Adicionar aos favoritos" / "Remover dos favoritos"; `aria-pressed` reflete o estado (D8, D9). O estado vem de `isFavorite` em `GET /api/documents/{documentId}` (D4). |
| R2 | `useUpdateFavorite`: atualização otimista do cache do documento em `onMutate`, rollback em `onError`, invalidação em `onSettled` (D7). A falha é avisada pela notificação do interceptor do cliente HTTP, que já existe. |
| R3 | Tabela `Favorite` com chave `(personId, documentId)`; toda consulta filtra por `personId` da sessão; não existe rota que receba outra pessoa (D1, D3). Integração: B não vê nem altera favorito de A (D11). |
| R4 | `PUT`/`DELETE /api/documents/{documentId}/favorite` começam por `resolveAccess`; `none` → 404 "Documento não encontrado.", idêntico a documento inexistente e a id malformado (D3). |
| R5 | `SidebarDocuments` parametrizado por escopo; a raiz passa as duas seções no slot `sidebarSection` que já existe; limite de 8 e "Ver todos" para `/favorites` já são do componente (D6). |
| R6 | Rota `favorites.tsx` troca o texto fixo por `<DocumentsList scope="favorites" />`; a API ordena por `Favorite.createdAt desc` (D3, D5, D6). |
| R7 | Os quatro estados já existem em `DocumentsList` e `SidebarDocuments`; ganham os textos de favoritos (seção Interface). |
| R8 | A lista é `favorite.findMany` com `document: readableDocumentsWhere(personId)` — a mesma porta das outras listas; nada é apagado nem avisado, o favorito só deixa de aparecer (e volta se o acesso voltar). Integração troca o `ownerId` direto no banco (D3, D11). Teste estrutural estendido (D2). |
| R9 | A lista de favoritos lê `Document.title` na hora (nada é copiado para `Favorite`); na web, renomear e o sinal `stored` invalidam **todas** as listas de documentos, não só a de "mine" (D7). |
| R10 | Textos literais na seção Interface; `<button>` nativo (foco, Enter e Espaço); e2e aciona o botão só pelo teclado e roda o axe (D12). |

## Decisões técnicas

### D1 — Modelo `Favorite` e migration à mão

- Escolha: modelo Prisma `Favorite { personId, documentId, createdAt @default(now()) }`, com `@@id([personId, documentId])`, relações para `Person` e `Document` com `onDelete: Cascade`, `@@index([personId, createdAt(sort: Desc)])` (a lista) e `@@index([documentId])` (o cascade). `Person` e `Document` ganham o lado inverso `favorites Favorite[]`. Migration `0005_favorite/migration.sql` escrita à mão no formato das anteriores (`CREATE TABLE` com `CONSTRAINT "Favorite_pkey" PRIMARY KEY ("personId","documentId")`, `createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`, dois `CREATE INDEX`, duas `ADD CONSTRAINT … FOREIGN KEY … ON DELETE CASCADE ON UPDATE CASCADE`). Nomes de índice e de FK no padrão que o Prisma geraria (`Favorite_personId_createdAt_idx`, `Favorite_documentId_idx`, `Favorite_personId_fkey`, `Favorite_documentId_fkey`). `test/reset-database.ts` cita `"Favorite"` no `TRUNCATE`. O esquema é provado pela integração (que roda sobre `prisma migrate deploy`), não por `migrate diff`.
- Alternativa descartada: `id` próprio + `@@unique([personId, documentId])` — motivo: o favorito não é referenciado por ninguém; a chave composta já dá a idempotência do `PUT`.
- Alternativa descartada: `onDelete: Restrict` como em `Document` — motivo: favorito é marcação descartável; não pode impedir apagar documento (fatia 007) nem pessoa.

### D2 — A lógica mora em `documents/`, num serviço próprio; regra 7 no teste estrutural

- Escolha: `apps/api/src/documents/favorites.service.ts` (`FavoritesService`: `add`, `remove`, `list`), registrado em `DocumentsModule`; as rotas ficam no `DocumentsController` que já existe (o caminho é `/documents/...`). A regra 1 do teste estrutural continua como está ("só `access/` e `documents/` tocam `Document`"). O teste ganha a **regra 7**, com o mesmo formato das outras (função `checkFavoriteTable`, teste sobre o código real e teste "amostra infratora × amostra correta"):
  1. `.favorite.` e consulta crua citando `"Favorite"` só em `documents/favorites.service.ts`;
  2. nesse arquivo, toda leitura (`findMany`, `findFirst`, `count`, `aggregate`, `groupBy`) traz `readableDocumentsWhere(` dentro da chamada, e `favorite.findUnique(` é proibido;
  3. esse arquivo chama `resolveAccess(`.
- `DocumentsService` **não** passa a depender de `FavoritesService` (o construtor de dois argumentos e os testes unitários dele ficam como estão): quem escolhe entre as duas listas é o controller (D3), e `isFavorite` sai do próprio `document.findFirst`/`update` por `include` (D4), sem tocar `.favorite.`.
- Alternativa descartada: módulo `favorites/` próprio passando pelas portas — motivo: a lista precisa de `Document.title`/`updatedAt` pela relação, e o mapeamento (`favorite.document.id`) casaria com o padrão `\.document\s*\.` da regra 1; seria preciso abrir uma terceira pasta na regra 1 ou afrouxar o padrão. Dentro de `documents/` a regra 1 fica intocada e a tabela nova ganha regra própria e estreita (um arquivo só).
- Alternativa descartada: métodos novos em `documents.service.ts` — motivo: o arquivo já tem 206 linhas e seis responsabilidades; a regra 7 fica mais simples apontando para um arquivo dedicado.

### D3 — Contrato e comportamento dos endpoints

- Escolha (contrato primeiro, em `openapi.yaml`; tipos regenerados com `pnpm --filter @folioteca/api-contract generate`):
  - `PUT /documents/{documentId}/favorite` (`addFavorite`) e `DELETE /documents/{documentId}/favorite` (`removeFavorite`): sem corpo, `204` sem conteúdo, `401`, `403` (CSRF), `404`. Ordem fixa: CSRF (403, guard global) → sessão (401) → `resolveAccess` (`none` → `documentNotFound()`) → gravação. Id malformado nunca vira 400.
  - `PUT` é idempotente: `favorite.upsert` pela chave composta com `update: {}` — repetir **não** renova `createdAt` (o favorito não pula para o topo). `P2002` (corrida de dois `PUT`) é tratado como sucesso; `P2003` (documento apagado entre o acesso e a gravação) vira `documentNotFound()`.
  - `DELETE` é idempotente: `favorite.deleteMany({ where: { personId, documentId } })`, `204` mesmo com zero linhas. Sem acesso de leitura → 404 também aqui (a pessoa não desfavorita o que não enxerga; o favorito fica invisível por D3/R8).
  - `GET /documents?scope=favorites`: o `enum` de `scope` vira `[mine, favorites]`; resposta é a mesma `DocumentsResponse` (`DocumentSummary` sem campo novo). Consulta: `favorite.findMany({ where: { personId, document: this.access.readableDocumentsWhere(personId) }, orderBy: [{ createdAt: 'desc' }, { documentId: 'desc' }], take: 100, select: { document: { select: { id, title, updatedAt } } } })`.
  - O controller valida a query com `parseBody(listDocumentsQuerySchema, query)` e despacha: `favorites` → `FavoritesService.list`, `mine` → `DocumentsService.listMine` (assinatura intocada).
- Alternativa descartada: `POST /favorites` + `DELETE /favorites/{id}` — motivo: cria um id de favorito que ninguém precisa e um `POST` não idempotente (duplo clique vira 409).
- Alternativa descartada: consultar pelo lado do documento (`document.findMany({ where: { AND: [readable, { favorites: { some } }] } })`) — motivo: o Prisma não ordena por campo de relação para-muitos; a ordem "favoritado mais recentemente" (R6) exige partir de `Favorite`.
- Alternativa descartada: devolver `favoritedAt` no resumo — motivo: nenhuma tela mostra; as listas seguem exibindo `updatedAt`.

### D4 — `isFavorite` no documento

- Escolha: `Document` no contrato ganha `isFavorite: boolean`, **obrigatório**. Em `documents.service.ts`, `get` e `rename` acrescentam `include: { favorites: { where: { personId }, select: { personId: true } } }` à consulta que já fazem (a de `get` já passa por `readableDocumentsWhere`); `toDocument` recebe o registro com `favorites`, devolve `isFavorite: favorites.length > 0` e **não** vaza o array. `create` devolve `isFavorite: false`.
- Alternativa descartada: endpoint `GET /documents/{id}/favorite` — motivo: uma requisição a mais por página aberta e um segundo cache para manter coerente.
- Alternativa descartada: campo opcional — motivo: a web teria de tratar `undefined` para sempre; `PATCH` e `POST` devolvem o mesmo schema e conseguem preencher.

### D5 — Web: um fetcher de lista, parametrizado por escopo

- Escolha: `get-documents.ts` passa a exportar `DocumentsScope = 'mine' | 'favorites'`, `getDocuments(scope)`, `getDocumentsQueryOptions(scope: DocumentsScope = 'mine')` com chave `['documents', { scope }]`, `useDocuments({ scope, queryConfig })` e `invalidateDocumentLists(queryClient)` (invalida a chave de cada escopo, sem tocar `['documents', id]`). O padrão `'mine'` mantém quem já chama sem argumento (`create-document.ts` fica intocado).
- Alternativa descartada: arquivo `get-favorite-documents.ts` — motivo: mesmo endpoint, mesmo tipo; seria cópia com uma string trocada.
- Alternativa descartada: invalidar pelo prefixo `['documents']` — motivo: pega também o documento aberto, que as mutações acabaram de gravar com `setQueryData`; refetch inútil.

### D6 — Lista, barra lateral e página: os componentes existentes ganham `scope`

- Escolha: `DocumentsList` e `SidebarDocuments` recebem `scope?: DocumentsScope` (padrão `'mine'`) e tiram de um mapa interno por escopo só o que muda: textos (seção Interface), rótulo do `<nav>` e destino do "Ver todos". Marcação, estados e classes não são duplicados. A raiz (`app/routes/app/root.tsx`) passa no slot `sidebarSection` que já existe `<><SidebarDocuments scope="favorites" /><SidebarDocuments /></>` — "Favoritos" acima de "Meus documentos", na mesma ordem da navegação principal. `app-layout.tsx` fica **intocado**.
- A rota `favorites.tsx` mantém título e texto de apoio e renderiza `<DocumentsList scope="favorites" />`. `empty-areas.test.tsx` deixa de cobrir "Favoritos" (o vazio agora vem da API); nasce `favorites.test.tsx`.
- Alternativa descartada: slot novo `sidebarFavorites` no `AppLayout` — motivo: o layout "não sabe o que vai nos slots"; um `ReactNode` já aceita duas seções.
- Alternativa descartada: passar textos por props — motivo: os dois usos são da mesma feature; o mapa por escopo mantém os literais num lugar só e o chamador com uma prop.

### D7 — Mutação otimista e invalidações

- Escolha: `api/update-favorite.ts` — **um** arquivo para o par `PUT`/`DELETE`: fetcher `updateFavorite({ documentId, isFavorite }): Promise<void>` (`isFavorite ? api.put(...) : api.delete(...)`), hook `useUpdateFavorite({ mutationConfig })`:
  - `onMutate`: `cancelQueries` na chave do documento, guarda o valor anterior, `setQueryData` trocando só `data.isFavorite`; devolve `{ previous }`;
  - `onError`: repõe `previous` (se havia) e repassa o `onError` de quem chamou;
  - `onSettled`: invalida `getDocumentsQueryOptions('favorites').queryKey` e a chave do documento; repassa o `onSettled`. A lista "mine" **não** é invalidada (o resumo não tem `isFavorite`).
  - Se o servidor responder 404 (perdeu o acesso), o rollback acontece, o interceptor notifica e o refetch do documento leva a página ao estado "Documento não encontrado" que já existe.
- `update-document.ts` e `use-document-collaboration.ts` trocam a invalidação de `getDocumentsQueryOptions().queryKey` por `invalidateDocumentLists(queryClient)` (R9: título e data atualizam também em favoritos).
- Alternativa descartada: dois arquivos (`create-favorite.ts`, `delete-favorite.ts`), como pede a regra "um arquivo por operação" de `api-requests` — motivo: o ciclo otimista (snapshot, rollback, invalidação) seria escrito duas vezes; para a tela é uma operação só, "definir o estado de favorito". Desvio consciente, registrado aqui.
- Alternativa descartada: otimismo pela interface (`mutation.variables`) — motivo: o estado é lido em outro lugar do cache (`aria-pressed` vem do documento) e precisa sobreviver a remontagem do botão.

### D8 — Botão: `Button` variante `ghost`, texto visível, guarda contra clique repetido

- Escolha: `features/documents/components/favorite-button.tsx`, usado uma vez em `LoadedDocument` (`document-view.tsx`), numa linha própria **acima** do título, alinhada à direita. `Button` ganha a variante `ghost` (`text-gray-700 hover:bg-gray-100 focus-visible:outline-blue-600`), registrada em `docs/design.md`. O botão tem ícone + texto visível, então o nome acessível é o próprio texto (sem `aria-label`) e a altura de 40px do `Button` vale.
- `aria-pressed={document.isFavorite}` **e** o texto muda (R1 do PRD pede os dois). O estado-alvo é `!document.isFavorite`, lido do cache no clique.
- Clique repetido: retorno antecipado no manipulador enquanto `mutation.isPending`; **sem** o atributo `disabled`. Desvio consciente de `component-robustness` §9 (que pede os dois): `disabled` aplicaria `opacity-50` a cada clique, contradizendo "muda na hora" (R2), e tira a ação do teclado de quem está com o foco no botão. A proteção real contra a segunda chamada é a guarda, como a própria skill explica.
- Alternativa descartada: botão só com ícone (variante de tamanho `icon` + `aria-label`) — motivo: menos descobrível, e pediria uma segunda variante nova no `Button`.
- Alternativa descartada: `<button>` cru com classes — motivo: lição vigente, botão nosso é `Button`.

### D9 — Ícone de estrela

- Escolha: `<svg>` inline dentro de `favorite-button.tsx` (uma ocorrência só — `ui-components`: nem componente compartilhado), `viewBox="0 0 24 24"`, `aria-hidden="true"`, `focusable="false"`, `className="size-5"`, traço `currentColor`. Favoritado: `fill="currentColor"` com `text-amber-600` (contraste ≥ 3:1 sobre branco; `amber-500` não chega); não favoritado: `fill="none"`, cor do texto do botão. Nenhuma biblioteca de ícones entra.
- Alternativa descartada: `lucide-react` — motivo: dependência nova para um ícone.

### D10 — API simulada (MSW)

- Escolha: `db.ts` ganha `favorites: MockFavorite[]` (`{ documentId, createdAt }`; a API simulada tem uma pessoa só) no estado, zerado em `initialState`. `MockDocument` **não** ganha `isFavorite`: `handlers/documents.ts` monta o corpo com um ajudante local `toDocumentBody(document)` (usado por `POST`, `GET :id` e `PATCH`). Handlers novos `http.put` e `http.delete` em `*/documents/:documentId/favorite` (mesmo começo dos outros: `networkDelay`, `devOverride('documents')`, cookie → 401, documento inexistente → 404, `204` sem corpo; `PUT` repetido não duplica nem renova a data). `GET /documents` aceita `scope=favorites`: favoritos por `createdAt` desc, cruzados com os documentos existentes, limite 100. Chave de desenvolvimento nova `mock-favorites=sample` (favorita os 9 primeiros de `seedSampleDocuments`, para ver o "Ver todos"), lida em `mocks/index.ts` e documentada em `utils.ts`.
- Alternativa descartada: `isFavorite` dentro de `MockDocument` — motivo: perde a data do favorito, e a lista não teria como ordenar.

### D11 — Testes da API

- Integração contra Postgres real, `documents/__tests__/favorites.integration.test.ts` (pessoa B por `createPersonWithSession`):
  1. `PUT` responde 204 e o documento aparece em `?scope=favorites`; `GET /documents/{id}` traz `isFavorite: true`; segundo `PUT` responde 204, mantém uma linha e o mesmo `createdAt`;
  2. `DELETE` responde 204, some da lista, `isFavorite: false`; segundo `DELETE` responde 204;
  3. ordem: três documentos favoritados em sequência (com `createdAt` ajustado direto no banco para não depender do relógio) voltam do mais recente para o mais antigo; limite de 100 não é exercitado com 101 linhas — é afirmado no teste unitário pelo `take`;
  4. pessoa B: `PUT` e `DELETE` no documento de A → 404 "Documento não encontrado.", corpo idêntico ao de id inexistente e ao de id malformado; nenhuma linha criada nem apagada; `?scope=favorites` de B vem vazio com A tendo favoritos; `GET` do documento de B favoritado por B não é afetado por A;
  5. perda de acesso: A favorita, o teste faz `prisma.document.update({ data: { ownerId: personB.id } })` direto no banco → some da lista de A, `DELETE` de A responde 404, a linha continua no banco; devolvendo o `ownerId`, reaparece;
  6. cascade: apagar o documento (direto no banco, com o `DocumentContent` junto) apaga o favorito; apagar a pessoa B (sem documentos) apaga os favoritos dela;
  7. sem cabeçalho `X-Requested-With` → 403; sem cookie → 401; `?scope=outro` → 400 com o erro de `scope`.
- Unitário `favorites.service.test.ts`: `P2002` vira sucesso, `P2003` vira 404, erro desconhecido propaga, `take: 100` e `orderBy` na chamada. `documents.schema.test.ts` cobre o escopo novo. `documents.service.test.ts` cobre `isFavorite` em `toDocument` (com e sem favorito) e que `favorites` não vaza.
- Contrato: `documents.contract.test.ts` valida `204` dos dois verbos, `404`, `200` de `?scope=favorites` e `isFavorite` em `POST`/`GET`/`PATCH`; `test/generated-types.test.ts` continua provando que o `.d.ts` versionado bate com o YAML.
- Estrutural: regra 7 de D2.

### D12 — Testes da web e e2e

- MSW + Testing Library: `update-favorite.test.tsx` (otimista antes da resposta, com `delay('infinite')`; rollback em 500; invalida favoritos e documento; repassa callbacks), `favorite-button.test.tsx` (textos, `aria-pressed`, Enter/Espaço, segundo clique durante `isPending` faz uma requisição só, rollback visível + notificação), `documents-list.test.tsx` e `sidebar-documents.test.tsx` (quatro estados com os textos de favoritos, 9 favoritos → 8 + "Ver todos" para `/favorites`, título de 200 caracteres truncado com `title`), `favorites.test.tsx` (rota: `h1` único, apoio, lista, link ativo), `root.test.tsx` (as duas seções, na ordem), `get-documents.test.tsx` (chave por escopo, `invalidateDocumentLists`), `update-document.test.tsx` e `use-document-collaboration.test.tsx` (passam a invalidar favoritos), `document-view.test.tsx` (botão presente só com o documento carregado), `button.test.tsx` (variante `ghost`).
- e2e `apps/web/e2e/tests/favorites.spec.ts`, uma jornada, contra a API simulada: cria documento, renomeia, leva o foco ao botão e aciona com o teclado → "Remover dos favoritos" com `aria-pressed="true"`; o título aparece no `<nav>` "Documentos favoritos"; vai a "Favoritos" pela navegação principal, vê a linha, roda `expectNoSeriousA11yViolations`; renomeia de novo e confere o título novo na seção (R9); remove o favorito e confere o vazio na página. Toda espera após navegar para rota `lazy` (e a região do editor) usa `timeout` explícito, como em `create-document.spec.ts` (`20_000`). Navega por links, nunca `page.goto` depois de criar (o banco simulado vive na página). A exceção do axe dentro de `.bn-container` é a mesma já usada.

## Interface

Receitas de `docs/design.md` usadas: "Contêiner de página", "Título de página", "Texto de apoio", "Lista", "Data em lista", "Carregando", "Vazio", "Erro", "Seção da barra lateral", "Item da barra lateral", "Botão secundário" (no erro da seção). Receitas **novas**, acrescentadas à tabela "Padrões acrescentados pelas entregas" com a fatia 006:

| Padrão | Classes |
|---|---|
| Botão discreto (`ghost`) | base do botão + `text-gray-700 hover:bg-gray-100 focus-visible:outline-blue-600` |
| Linha de ações do documento | `<div className="flex justify-end">` acima do título editável |
| Estrela de favorito | `<svg aria-hidden="true" focusable="false" className="size-5">`, traço `currentColor`; favoritado: preenchida, `text-amber-600` |

### Página do documento (`/documents/:documentId`) — só o estado "com dados" muda

De cima para baixo: `h1` só para leitor de tela (já existe) → **linha de ações**, à direita, com o botão de favorito → título editável → indicador de salvamento → editor. Nos estados carregando, não encontrado e erro o botão não aparece.

| Estado do botão | Texto visível | `aria-pressed` | Estrela |
|---|---|---|---|
| Não favoritado | "Adicionar aos favoritos" | `false` | contorno |
| Favoritado | "Remover dos favoritos" | `true` | preenchida |
| Falha ao gravar | volta ao estado anterior; notificação "Algo deu errado" com a mensagem do servidor (4xx) ou "Não foi possível concluir a operação. Tente novamente em instantes." (já existentes no cliente HTTP) | — | — |

### Seção "Favoritos" da barra lateral

`<nav aria-label="Documentos favoritos">`, acima da seção "Meus documentos", mesma receita.

| Estado | O que aparece |
|---|---|
| Cabeçalho (`h2`) | "Favoritos" |
| Carregando (`role="status"`) | "Carregando favoritos…" |
| Vazio | "Nenhum favorito ainda." |
| Erro (`role="alert"`) | "Não foi possível carregar seus favoritos." + botão secundário "Tentar novamente" |
| Com dados | até 8 itens (título truncado com `title`, data de atualização abaixo), na ordem da API; com mais de 8, link "Ver todos" → `/favorites` |

A seção "Meus documentos" não muda de texto.

### Página "Favoritos" (`/favorites`)

`ContentLayout` com `h1` "Favoritos" e apoio "Os documentos que você marca como favoritos ficam à mão aqui." (já existem), e abaixo a lista:

| Estado | O que aparece |
|---|---|
| Carregando (`role="status"`) | "Carregando favoritos…" |
| Vazio | "Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui." |
| Erro (`role="alert"`) | "Não foi possível carregar seus favoritos." + botão vermelho "Tentar novamente" |
| Com dados | receita "Lista": título como link para o documento à esquerda (truncado, com `title`), data de atualização à direita; do favoritado mais recentemente para o mais antigo |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `PUT`/`DELETE /documents/{documentId}/favorite`; `scope` com `favorites`; `Document.isFavorite` obrigatório | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (nunca à mão) | — |
| alterar | `apps/api/prisma/schema.prisma` | modelo `Favorite`; `favorites` em `Person` e `Document` | — |
| criar | `apps/api/prisma/migrations/0005_favorite/migration.sql` | tabela, chave composta, índices, FKs com cascade (à mão) | — |
| alterar | `apps/api/test/reset-database.ts` | `"Favorite"` no `TRUNCATE` | — |
| alterar | `apps/api/src/documents/documents.schema.ts` | `scope: z.enum(['mine', 'favorites'])`; comentário atualizado | — |
| criar | `apps/api/src/documents/favorites.service.ts` | `add`, `remove`, `list` (D2, D3) | `security` |
| alterar | `apps/api/src/documents/documents.service.ts` | `include` de `favorites` em `get` e `rename`; `toDocument` com `isFavorite`; `create` com `false` | — |
| alterar | `apps/api/src/documents/documents.controller.ts` | rotas `@Put`/`@Delete(':documentId/favorite')` com `@HttpCode(204)`; despacho por escopo em `getDocuments` | — |
| alterar | `apps/api/src/documents/documents.module.ts` | provider `FavoritesService` | — |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 7 + teste de amostra | `unit-testing` |
| criar | `apps/api/src/documents/__tests__/favorites.integration.test.ts` | cenários de D11 | `integration-testing` |
| criar | `apps/api/src/documents/__tests__/favorites.service.test.ts` | ramos de erro, `take`, `orderBy` | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | verbos novos, escopo novo, `isFavorite` | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.service.test.ts` | `isFavorite` em `toDocument` | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.schema.test.ts` | escopo `favorites` | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | `isFavorite` no tipo e nos corpos esperados | `integration-testing` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | **só** `toDocumentBody` com `isFavorite: false` fixo, para o typecheck da raiz fechar ao fim da fase 1 | `api-mocking` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/testing/mocks/db.ts` | `favorites` no estado; `seedSampleFavorites` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `PUT`/`DELETE` favorito; `scope=favorites`; `isFavorite` real | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/index.ts` | chave `mock-favorites` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário da chave nova | `api-mocking` |
| alterar | `apps/web/src/features/documents/api/get-documents.ts` | `DocumentsScope`, escopo na chave, `invalidateDocumentLists` | `api-requests` |
| criar | `apps/web/src/features/documents/api/update-favorite.ts` | fetcher + hook otimista (D7) | `api-requests`, `error-handling` |
| alterar | `apps/web/src/features/documents/api/update-document.ts` | invalida todas as listas | `api-requests` |
| alterar | `apps/web/src/features/documents/hooks/use-document-collaboration.ts` | idem, no sinal `stored` | `api-requests` |
| alterar | `apps/web/src/components/ui/button/button.tsx` | variante `ghost` | `ui-components`, `interface-design` |
| criar | `apps/web/src/features/documents/components/favorite-button.tsx` | botão + estrela inline (D8, D9) | `interface-design`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/document-view.tsx` | linha de ações com `FavoriteButton` em `LoadedDocument` | `interface-design` |
| alterar | `apps/web/src/features/documents/components/documents-list.tsx` | prop `scope` + mapa de textos | `interface-design`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/sidebar-documents.tsx` | prop `scope` + mapa (textos, `aria-label`, destino do "Ver todos") | `interface-design`, `component-robustness` |
| alterar | `apps/web/src/app/routes/app/favorites.tsx` | `<DocumentsList scope="favorites" />` no lugar do texto fixo | `routing`, `interface-design` |
| alterar | `apps/web/src/app/routes/app/root.tsx` | duas seções no slot `sidebarSection` | `project-structure` |
| criar | `apps/web/src/features/documents/api/__tests__/update-favorite.test.tsx` | D12 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/documents/components/__tests__/favorite-button.test.tsx` | D12 | `component-testing` |
| criar | `apps/web/src/app/routes/app/__tests__/favorites.test.tsx` | D12 | `integration-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/empty-areas.test.tsx` | "Favoritos" sai do conjunto | `integration-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/root.test.tsx` | as duas seções | `integration-testing` |
| alterar | testes existentes em `features/documents/**/__tests__/` (`get-documents`, `update-document`, `documents-list`, `sidebar-documents`, `document-view`, `use-document-collaboration`) e `components/ui/button/__tests__/button.test.tsx` | D12; corpos simulados com `isFavorite` | `component-testing`, `unit-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/favorites.spec.ts` | jornada de D12, com axe | `e2e-testing` |
| alterar | `docs/design.md` | três receitas novas (fatia 006) | `interface-design` |
| alterar | `docs/architecture.md` | §3: parágrafo "Entrega `favorites` (fatia 006)" — favorito não dá acesso, a lista passa por `readableDocumentsWhere`, 404 único nos dois verbos, regra 7 do teste estrutural | — |

Intocados de propósito (comparar com `feature/005-block-editor`): `apps/api/src/access/access.service.ts`, `apps/api/src/access/access-level.ts`, `apps/api/src/collab/**`, `apps/web/src/components/layouts/app-layout.tsx`, `apps/web/src/features/documents/api/create-document.ts`, `apps/web/src/features/documents/api/get-document.ts`, `apps/web/src/config/paths.ts`, `apps/web/src/app/router.tsx`, `apps/web/src/types/api.ts` (nenhum tipo novo é exportado: `Document` já carrega `isFavorite`).

## Estimativa de tamanho

Jornadas: 1 (favoritar um documento e reencontrá-lo) · Telas novas: 1 (a página "Favoritos", que já existia vazia) · Linhas alteradas (sem testes, sem o `.d.ts` gerado e sem `src/testing/`): ~360 · Fases previstas: 3

Sinais de "grande demais": nenhum disparou. O mais próximo é o de linhas (~360 de ~400); o que o segura é reaproveitar lista e seção por `scope` em vez de componentes novos.

## Dívida encontrada

- `aria-pressed` junto com texto que muda (R1 do PRD + pedido do dono) é redundante: a recomendação da WAI-ARIA para botão de alternância é manter o nome fixo. Foi entregue como pedido; vale rever numa passada de acessibilidade.
- Os dois links "Ver todos" da barra lateral têm o mesmo nome acessível e destinos diferentes; só o `<nav>` em volta os distingue. Um `aria-label` mais específico mexeria em texto já coberto por testes da 004.
- `document-access-boundary.test.ts` passa de 450 para ~550 linhas com sete regras num arquivo só; pede para ser dividido por tabela.
- A regra estrutural não enxerga leitura de `Document` **por relação** (`include`/`select` a partir de outra tabela). Hoje só `favorites.service.ts` faz isso, coberto pela regra 7; a próxima tabela ligada a `Document` (compartilhamento, comentários) precisa de regra equivalente ou de uma regra geral.
- Quem perde o acesso a um documento favoritado fica com uma linha invisível em `Favorite` que não consegue apagar (o `DELETE` responde 404). É inofensiva e reaparece se o acesso voltar; a limpeza pode entrar com a 015 (compartilhamento).
- Herdada da 005: falta o projeto Playwright contra a API real + Postgres; o e2e desta fatia também só prova a web contra a API simulada.
