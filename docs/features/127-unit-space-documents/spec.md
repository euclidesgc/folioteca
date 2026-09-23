# SPEC 127 — unit-space-documents

Quem está lotado diretamente numa unidade vê a lista de documentos do espaço
dela, cria documentos ali e edita qualquer um deles junto com os colegas.
PRD aprovado em `prd.md`, nesta pasta, com 15 requisitos. A branch
`feature/127-unit-space-documents` está empilhada sobre a 145
(`share-with-person-view`) e a 140 (`unit-space-inherit-parent`).

Parte de `docs/architecture.md` §3 "access": ordem proprietário →
compartilhamento direto → alvos → `none`; nada materializado (lotação lida a
cada pedido); 404 opaco; assinaturas `resolveAccess`/`canWrite`/
`readableDocumentsWhere` definitivas; `access` com integração contra Postgres
real. Esta fatia é a primeira em que **lotação dá acesso a documento** — a
frase "Lotação não dá acesso a documento" (architecture §unit-assignments) e o
comentário de `OrgUnitAssignment` no `schema.prisma` deixam de valer e são
reescritos.

Lições vigentes para toda tarefa do PLAN: `React.JSX.Element`; `ref` é prop
comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo, medida com
`pnpm exec vitest run --coverage --coverage.reporter=json-summary` na raiz, sem
`--project`; nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`;
typecheck e lint finais com cache limpo (`pnpm exec tsc -b --clean`); arquivo
gerado do contrato só pelo script; nunca remover restrição do banco num teste;
**sem Prettier reformatando arquivo existente**; o agente derruba tudo o que
subir.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `Document.spaceId` obrigatório, `@@index([spaceId])` e relação
  `Space.documents`. `Space.orgUnitId` único; espaço `UNIT` tem
  `organizationId` **nulo** (migration 0013): a organização vem de
  `orgUnit.organizationId`.
- `AccessService.findDecision(documentId, personId)` já lê a share da pessoa na
  mesma consulta; `levelOf` já tem dono → lixeira → share → `none`.
- `DocumentsService.get/rename/trash/restore/delete` decidem por
  `resolveAccess`; `requireOwner` já faz de qualquer nível ≠ `owner` um 404
  (R5 no servidor sem mudança). `listMine` já faz `AND ownerId: personId` (R6
  sem mudança).
- `CollabService.onConnect` decide por `resolveAccess`/`canWrite` a cada
  conexão; `closeConnections(documentId)` só é chamado por
  `onDocumentClosed` (lixeira e exclusão).
- `SpacesService` tem `resolveReach` (lotação direta + herança da 140) usado
  só por `list`; `GET /spaces` e `POST /spaces` no mesmo controller, com
  `SessionGuard` na classe.
- Web: `DocumentsList` (quatro estados + lista com título e data) e
  `NewDocumentButton` (mutation → navega; montado só por
  `app/routes/app/root.tsx`) em `features/documents`; `DocumentView` já
  esconde lixeira e compartilhar para não-dono; `SpaceView` em
  `features/spaces` mostra o aviso "Os documentos deste espaço ainda não
  chegaram…"; a rota `app/routes/app/space.tsx` monta `SpaceView`.
- `isUuid` em `common/is-uuid.ts`; `silentError` no cliente HTTP.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `GET /spaces/{spaceId}/documents` (D2) + `SpaceDocuments` no lugar do aviso, com a mesma apresentação de `DocumentsList` (D6, D7). |
| R2 | Quatro estados de `DocumentsListStates`, vazio com convite, erro com "Tentar novamente" (D6, D7). |
| R3 | `POST /documents` com `{ spaceId }` (D3); `NewDocumentButton` com `spaceId`, navega ao documento (D6). |
| R4 | `ownerId`/`authorId` = quem chama (D3); `levelOf` dá `edit` ao membro direto de espaço `UNIT` (D1); colaboração já decide por `resolveAccess` (D5). |
| R5 | `requireOwner` já dá 404 a `edit`; `DocumentView` já esconde a lixeira para não-dono (nada a mudar; provado em teste, D9). |
| R6 | `listMine` com `AND ownerId` inalterado (D9 prova). |
| R7 | Ramo da lixeira antes do de membro em `levelOf`; `readableDocumentsWhere` mantém `trashedAt: null` (D1). |
| R8 | Lotação relida em cada `findDecision` e em cada `GET /spaces/{id}/documents`; colaboração recusa na **próxima conexão** (D5; limite registrado em Riscos e Dívida). |
| R9 | Ramo do dono primeiro em `levelOf`; `listMine` por `ownerId` (D1). |
| R10 | Alcance só por herança → **403** com a mensagem do PRD; web mostra o aviso e não monta o botão; `levelOf` não lê herança → `none` → 404 no documento (D1, D2, D7). |
| R11 | Sem alcance, id malformado, espaço de outra organização, espaço `FREE`/`PERSONAL` → 404 opaco em lista e criação; `isAdmin` não é lido (D2, D3). |
| R12 | Share lida junto no `levelOf` (maior nível entre share e membro); lista do espaço exige lotação direta (D1, D2). |
| R13 | Tudo por `AccessService`; nenhuma decisão materializada (D1). |
| R14 | `role="status"`/`role="alert"`, `<Link>` por item, `Button` com nome; axe no e2e (D7, D9). |
| R15 | Textos literais em Interface. |

## Decisões técnicas

### D1 — `AccessService`: membro direto de espaço `UNIT` = `edit`

- `findDecision` acrescenta ao mesmo `select`:
  `space: { select: { type: true, orgUnit: { select: { assignments: { where:
  { personId }, select: { personId: true } } } } } }`. Continua **uma** ida ao
  banco. `DocumentDecision` ganha `isUnitMember: boolean` (`space.type ===
  'UNIT' && (space.orgUnit?.assignments.length ?? 0) > 0`).
- `levelOf`: dono → `'owner'`; lixeira → `'none'`; maior nível entre
  `shareLevel` e `isUnitMember ? 'edit' : null` (ordem `edit > view`); senão
  `'none'`. A herança da 140 **não** entra (R10; fatia 152).
- `readableDocumentsWhere(personId)` → `{ trashedAt: null, OR: [{ ownerId:
  personId }, { shares: { some: { personId } } }, { space: { type: 'UNIT',
  orgUnit: { assignments: { some: { personId } } } } }] }`. Literal
  `trashedAt: null` preservado (regra 8).
- Assinaturas públicas intocadas; `canWrite` intocado (`canEdit('edit')` é
  verdadeiro e o ramo da lixeira continua valendo).
- Organização: não é filtrada na decisão — o documento só pode estar num espaço
  cuja unidade é da organização da pessoa lotada (lotação e unidade são da mesma
  organização por construção). Registrado em Riscos.
- Alternativa descartada: consulta separada à lotação depois do documento — duas
  idas ao banco em todo `resolveAccess`, inclusive no do dono.
- Alternativa descartada: reusar `resolveReach` na decisão — traria a herança,
  que o PRD adia para a 152, e carregaria a árvore inteira por decisão.

### D2 — `GET /spaces/{spaceId}/documents`

- Contrato: tag `spaces`, operação `listSpaceDocuments`, parâmetro de caminho
  `spaceId` (string). **200** `DocumentsResponse` (reaproveitado); **401**,
  **403**, **404** com `Error`. Nenhum segmento literal novo sob `/spaces/`
  (regra da 012): `{spaceId}/documents` não colide com nada.
- Identidade de caminho conferida à mão: YAML `/spaces/{spaceId}/documents` ↔
  `@Get(':spaceId/documents')` no `SpacesController` (`@Controller('spaces')`)
  com `@Param('spaceId')`. O teste de contrato chama exatamente esse caminho.
- Ordem fixa: sessão (**401**, guard) → `isUuid` falso → **404** → alcance
  (`SpacesService.reachOf`) `'none'` → **404** "Espaço não encontrado." →
  `'inherited'` → **403** "Os documentos deste espaço estão disponíveis para
  quem está lotado diretamente na unidade." → `'direct'` → 200.
- `SpacesService.reachOf(organizationId, personId, spaceId): Promise<'direct' |
  'inherited' | 'none'>`: acha o espaço `UNIT` com `orgUnit.organizationId =
  organizationId` (senão `'none'`); lotação direta → `'direct'`; senão lê as
  unidades da organização (mesmo `findMany` de `list`) e aplica `resolveReach`
  → `'inherited'` ou `'none'`. `FREE` e `PERSONAL` → `'none'` (documentos no
  espaço livre são a 136). O `findMany` das unidades é extraído para um método
  privado usado por `list` e `reachOf` (sem duplicar a consulta).
- A lista em si é lida por `DocumentsService.listInSpace(personId, spaceId)`:
  `findMany({ where: { AND: [readableDocumentsWhere(personId), { spaceId }]
  }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 100, select: { id,
  title, updatedAt } })`, mesmo mapeamento de `listMine`. Fica em `documents/`
  porque a regra 1 do teste de fronteira proíbe tocar `Document` fora de
  `access/` e `documents/`. `SpacesModule` passa a importar `DocumentsModule`
  (que já exporta `DocumentsService`; `DocumentsModule` não importa
  `SpacesModule` — sem ciclo).
- 403 em vez de 404 para o herdado: a pessoa **já vê** a página do espaço (a
  existência não é segredo para ela), e a web precisa distinguir para mostrar o
  aviso (R10). Mesma lógica da 145: 404 só para quem não alcança.
- Índice: **nenhuma migration**. `@@index([spaceId])` já existe, e a lista é
  limitada a 100 e filtrada pela porta; `[spaceId, updatedAt]` só com medição.
- Alternativa descartada: `GET /documents?scope=space&spaceId=` — o escopo é do
  espaço, e a decisão 403/404 depende do alcance, que é de `spaces`.

### D3 — `POST /documents` com corpo opcional `{ spaceId }`

- Contrato: `requestBody` **opcional** `CreateDocumentInput = { spaceId?:
  string }`, `additionalProperties: false`. Respostas ganham **400**
  (`ValidationError`) e **404** (`Error`). Sumário: "Cria um documento sem
  título no espaço pessoal de quem chama ou no espaço de unidade informado".
- `documents.schema.ts`: `createDocumentSchema = z.strictObject({ spaceId:
  z.string().optional() }, { error: 'Campo não permitido.' })`; corpo ausente
  (`undefined`) é tratado como `{}`.
- `DocumentsService.create(person, body)`:
  1. `parseBody` → **400** (campo extra, `spaceId` não string).
  2. Sem `spaceId`: exatamente o comportamento de hoje (upsert do pessoal).
  3. Com `spaceId`: `isUuid` falso → **404** "Espaço não encontrado.";
     `tx.space.findFirst({ where: { id: spaceId, type: 'UNIT', orgUnit: {
     organizationId: person.organizationId, assignments: { some: { personId:
     person.id } } } }, select: { id } })` ausente → **404** (mesma mensagem;
     herdado também cai aqui — criar exige lotação direta e não há tela que o
     ofereça ao herdado).
  4. `document.create` com `ownerId`/`authorId = person.id` e o `spaceId`.
- A mensagem "Espaço não encontrado." vive num helper `spaceNotFound()` em
  `common/space-not-found.ts`, usado por `spaces` e `documents` (os dois
  módulos respondem o mesmo 404 opaco).
- O controller passa `@Body() body: unknown`.
- Alternativa descartada: `POST /spaces/{spaceId}/documents` — criaria uma
  segunda rota de criação; o corpo opcional mantém uma só e não quebra quem
  chama sem corpo (o `NewDocumentButton` da barra lateral).

### D4 — Teste de fronteira

- Nenhuma regra existente afrouxa. A regra 1 é justamente o que obriga a lista
  do espaço a morar em `documents/` (D2).
- **Regra 10 nova**, com exemplo infrator/conforme como as demais: fora de
  `access/access.service.ts`, nenhuma leitura de `Document` (`findMany`,
  `findFirst`, `count`…) filtra por `assignments` — a lotação só vira acesso
  pela porta. Aperta a fronteira: sem ela, `listInSpace` poderia filtrar por
  lotação por fora de `readableDocumentsWhere`.

### D5 — Colaboração: nada muda no servidor

- `onConnect` já chama `resolveAccess`, que agora lê a lotação: removida a
  lotação, a **próxima conexão** (reconexão do provider, recarga) é recusada.
  Provado na integração do `collab`.
- **Não** se derruba a conexão aberta ao remover a lotação nesta fatia: exigiria
  `OrgUnitAssignmentsService` avisar quem acompanha (padrão
  `onDocumentClosed`), o `collab` fechar **por pessoa** e documento (hoje
  `closeConnections(documentId)` fecha todos os participantes) e uma consulta
  dos documentos do espaço — três módulos tocados por uma borda. Registrado em
  Dívida e Riscos (R8 fica atendido na verificação seguinte, que hoje é a
  próxima conexão).

### D6 — Chamadas da web (`api-requests`)

- `features/documents/api/get-space-documents.ts`: `getSpaceDocuments(spaceId)`
  → `api.get(`/spaces/${spaceId}/documents`, { silentError: true })`;
  `queryKey: ['space-documents', spaceId]`; `useSpaceDocuments({ spaceId })`.
  `silentError`: todos os estados (inclusive o 403) aparecem no lugar da
  lista, sem notificação duplicada.
- `get-documents.ts`: `invalidateDocumentLists` também invalida o prefixo
  `['space-documents']` (trash/restore/delete do dono tiram e devolvem o
  documento à lista do espaço — R7). Chave própria em vez de `['documents',
  …]` pelo mesmo motivo do comentário existente: o prefixo `['documents']`
  pegaria o documento aberto.
- `create-document.ts`: `createDocument(input?: { spaceId?: string })` →
  `api.post('/documents', input)` (sem corpo quando ausente); `onSuccess`
  invalida as listas por `invalidateDocumentLists` (troca a invalidação de só
  `mine`) — cobre "Meus documentos" e a lista do espaço.
- `NewDocumentButton` ganha props opcionais `spaceId` e `className`, com
  `className` padrão `'w-full'` (o de hoje): `root.tsx` não muda. Mesmo texto e
  mesmo "Criando…".

### D7 — Onde mora a lista e quem compõe a página

- `features/spaces` **não** importa de `features/documents` (regra do
  projeto). A **rota** `app/routes/app/space.tsx` compõe: passa a `SpaceView`
  a prop nova `unitContent: ReactNode` = `<SpaceDocuments spaceId={spaceId}
  />`. `SpaceView` a renderiza no lugar do aviso **só** quando o espaço achado
  é `unit`; o espaço `free` continua com o aviso de hoje (136). O texto
  `SPACE_TEXTS.unit.empty` sai.
- `DocumentsList` é refatorado sem mudar comportamento: os quatro estados e o
  `<ul>` passam para `DocumentsListStates({ query, texts })`, exportado do
  mesmo arquivo; `DocumentsList` continua chamando `useDocuments` e o usa.
  Fica em `features/documents` (só essa feature o usa; a rota é quem junta).
- `features/documents/components/space-documents.tsx`: `useSpaceDocuments`;
  403 → aviso de lotação direta (sem botão, sem lista); qualquer outro estado →
  linha com `NewDocumentButton spaceId` (só quando a resposta foi 200, para
  nunca mostrar o botão a quem vai receber 403) + `DocumentsListStates`.
  Detecção do 403 por `isAxiosError(error) && error.response?.status === 403`
  num utilitário da própria feature.
- Alternativa descartada: mover `DocumentsList` para `src/components` — só uma
  feature a usa; a composição pela rota resolve sem compartilhar.
- Alternativa descartada: `SpaceView` com render-prop recebendo o `Space` — a
  rota já tem o `spaceId`, e o `ReactNode` é mais simples.

### D8 — API simulada (`api-mocking`)

- `db.ts`: `createDocumentIn(personId, spaceId)` reaproveitado pelo handler;
  `spaceReachOf(personId, spaceId): 'direct' | 'inherited' | 'none'` com a
  mesma regra de `listSpacesOf`; `listSpaceDocuments(spaceId)` (fora da
  lixeira, `updatedAt` desc); semente `seedUnitSpaceDocuments()` com um
  documento de colega no espaço da unidade de lotação direta da amostra
  `mock-org-units=sample` (`accessLevel: 'edit'`).
- `handlers/documents.ts`: `POST /documents` lê o corpo opcional e responde
  404 para espaço não direto; `handlers/spaces.ts`: `GET
  ${env.API_URL}/spaces/:spaceId/documents` com o preâmbulo de sempre
  (`networkDelay`, `devOverride('spaces')`, 401) e 404/403/200 como D2.
- Chave `mock-documents=unit-space` em `mocks/index.ts` (documentada em
  `utils.ts`) para a semente.

### D9 — Testes

- **API, integração (Postgres real, serviço real)**:
  - `access.integration.test.ts`: membro direto → `edit`, `canWrite`
    verdadeiro; lotação removida → `none` na chamada seguinte; herdado (espaço
    filho com `inheritsParent`, pessoa lotada no pai) → `none`; lixeira →
    `none` para o membro e `owner` para o dono, restaurar → `edit`; dono
    removido da unidade → `owner`; share `VIEW` + membro → `edit` (maior);
    `readableDocumentsWhere` inclui o do espaço e exclui na lixeira.
  - `spaces.integration.test.ts`: `GET /spaces/{id}/documents` — direto → 200
    ordenado, sem lixeira; herdado → 403 com a mensagem; sem lotação,
    administração não lotada, `randomUUID()`, id malformado, espaço `FREE`
    alheio → 404 idêntico; sem sessão → 401; outra organização:
    `reachOf(randomUUID(), …)` → `'none'`.
  - `documents.integration.test.ts`: `POST` sem corpo → pessoal (inalterado);
    com `spaceId` direto → 201 no espaço, dono = quem chama, aparece em "Meus
    documentos" dele e não no do colega; herdado, não lotado, `randomUUID()`,
    malformado → 404; campo extra → 400; colega: `GET` 200 `edit`, `PATCH`
    200, `trash`/`restore`/`delete` → 404.
  - `collab` (integração existente ampliada): membro conecta e grava;
    lotação removida → próxima conexão recusada.
- **API, unitários/contrato**: `levelOf` com os ramos novos;
  `documents.schema.test.ts` (`createDocumentSchema`);
  `documents.contract.test.ts` e `spaces.contract.test.ts` com os caminhos
  exatos; regra 10 da fronteira.
- **Web**: `get-space-documents.test.tsx` (caminho, chave);
  `create-document.test.tsx` (corpo com `spaceId`, invalidação das listas);
  `space-documents.test.tsx` (carregando, vazio, erro + tentar de novo, lista,
  403 → aviso sem botão, criar navega); `space-view.test.tsx` (`unitContent`
  só no `unit`, `free` mantém o aviso); `documents-list.test.tsx` segue verde
  sem mudança de asserção; `space.test.tsx` da rota (compõe as duas).
- **e2e** — `apps/web/e2e/tests/unit-space-documents.spec.ts`, API simulada,
  só teclado: (1) lotado abre o espaço, vê o vazio, "Novo documento" → abre o
  documento → volta ao espaço e o vê no topo; axe; (2) espaço herdado da
  amostra → vê o aviso, sem "Novo documento"; axe.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas:
"Contêiner de página" (via `ContentLayout`), "Lista", "Data em lista", "Link de
navegação", "Botão principal", "Carregando", "Vazio", "Erro", "Aviso
informativo". Receita **nova**, acrescentada a "Padrões acrescentados pelas
entregas" com a fatia 127:

| Padrão | Classes |
|---|---|
| Ação de página acima da lista | `<div className="mt-6 flex justify-end">` com o botão principal; a lista abaixo mantém o próprio `mt-6` |

### Página do espaço de unidade — o que muda

Título (nome da unidade) e "O espaço de documentos da sua unidade." ficam. No
lugar do aviso "Os documentos deste espaço ainda não chegaram…":

- **Carregando**: `role="status"` "Carregando documentos do espaço…". Sem
  botão.
- **Erro**: alerta "Não foi possível carregar os documentos do espaço." com
  "Tentar novamente" (mesmo texto do botão de `DocumentsList`). Sem botão de
  criar.
- **Lotação só por herança (403)**: "Aviso informativo" com "Os documentos
  deste espaço estão disponíveis para quem está lotado diretamente na
  unidade.". Sem botão, sem lista.
- **Vazio** (200 sem itens): linha com "Novo documento" à direita e, abaixo, o
  vazio "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo
  documento”.".
- **Com dados**: a mesma linha com "Novo documento" e, abaixo, a lista igual à
  de "Meus documentos" (título-link `truncate` à esquerda, data à direita).
- Botão enquanto cria: "Criando…", desabilitado. Falha ao criar: notificação
  do cliente HTTP (comportamento de hoje), a página fica como está.

Espaço livre: inalterado. A 360px a linha do botão e os itens com `flex-wrap`
já existentes não rolam na horizontal.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| carregando | "Carregando documentos do espaço…" | `role="status"` |
| vazio | "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”." | vazio |
| erro | "Não foi possível carregar os documentos do espaço." + "Tentar novamente" | `role="alert"` |
| herdado | "Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade." | aviso informativo (e corpo do 403) |
| ação | "Novo documento" / "Criando…" | botão principal |
| servidor 404 | "Espaço não encontrado." | corpo da API (lista e criação) |
| servidor 400 | "Dados inválidos." + "Campo não permitido." | corpo da API |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `POST /documents` com corpo opcional, 400/404; `GET /spaces/{spaceId}/documents`; `CreateDocumentInput` (D2, D3) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| alterar | `apps/api/prisma/schema.prisma` | só o comentário de `OrgUnitAssignment` (lotação direta passa a dar acesso pela porta) | — |
| alterar | `apps/api/src/access/access.service.ts` | `findDecision`, `levelOf`, `readableDocumentsWhere` (D1) | `authorization` |
| criar | `apps/api/src/common/space-not-found.ts` | 404 opaco do espaço (D3) | `security` |
| alterar | `apps/api/src/documents/documents.schema.ts` | `createDocumentSchema` (D3) | — |
| alterar | `apps/api/src/documents/documents.service.ts` | `create(person, body)`, `listInSpace` (D2, D3) | `authorization`, `security` |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Body()` no `POST` (D3) | — |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `reachOf`, consulta das unidades extraída (D2) | `authorization` |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | `@Get(':spaceId/documents')`, ordem 404→403 (D2) | `security` |
| alterar | `apps/api/src/spaces/spaces.module.ts` | importa `DocumentsModule` | — |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 10 (D4) | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | D9 | `integration-testing` |
| alterar | `apps/api/src/access/__tests__/access-level.test.ts` | D9 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | D9 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.schema.test.ts` | D9 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D9 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | D9 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | D9 | `integration-testing` |
| alterar | `apps/api/src/collab/__tests__/` (integração existente) | membro grava; lotação removida → próxima conexão recusada (D5) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/documents/api/get-space-documents.ts` | D6 | `api-requests`, `error-handling` |
| alterar | `apps/web/src/features/documents/api/get-documents.ts` | `invalidateDocumentLists` cobre `['space-documents']` (D6) | `api-requests` |
| alterar | `apps/web/src/features/documents/api/create-document.ts` | `spaceId` opcional, invalidação (D6) | `api-requests` |
| alterar | `apps/web/src/features/documents/components/new-document-button.tsx` | `spaceId`, `className` com padrão `w-full` (D6) | `component-robustness` |
| alterar | `apps/web/src/features/documents/components/documents-list.tsx` | extrai `DocumentsListStates` (D7) | `interface-design` |
| criar | `apps/web/src/features/documents/components/space-documents.tsx` | D7 | `interface-design`, `error-handling`, `authorization` |
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | prop `unitContent` no lugar do aviso do `unit` (D7) | `interface-design`, `project-structure` |
| alterar | `apps/web/src/app/routes/app/space.tsx` | compõe `SpaceView` + `SpaceDocuments` (D7) | `project-structure`, `routing` |
| alterar | `apps/web/src/testing/mocks/db.ts` | D8 | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `POST` com `spaceId` (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `GET /spaces/:spaceId/documents` (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/index.ts` e `utils.ts` | chave `mock-documents=unit-space` (D8) | `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/get-space-documents.test.tsx` | D9 | `unit-testing`, `api-mocking` |
| alterar | `apps/web/src/features/documents/api/__tests__/create-document.test.tsx` | D9 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/documents/components/__tests__/space-documents.test.tsx` | D9 | `component-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/new-document-button.test.tsx` | D9 | `component-testing` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` | D9 | `component-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/space.test.tsx` | D9 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/unit-space-documents.spec.ts` | D9 | `e2e-testing` |
| alterar | `docs/design.md` | receita "Ação de página acima da lista" | `interface-design` |
| alterar | `docs/architecture.md` | §3: membro direto de espaço `UNIT` = `edit`, ordem dono → lixeira → maior(share, membro) → `none`; regra 10; reescreve "Lotação não dá acesso a documento"; §spaces: `GET /spaces/{spaceId}/documents` com 401→404→403 e `reachOf` | — |

Intocados de propósito: `collab.service.ts`, `access-level.ts`,
`shares.service.ts`, `favorites.service.ts`, `trashedDocumentsWhere`,
`DocumentView`, `app/routes/app/root.tsx`, `components/ui/**`, migrations
`0001`–`0015` (nenhuma nova).

## Estimativa de tamanho

Jornadas: 1 (o membro direto cria e trabalha nos documentos do espaço; o aviso
do herdado é um estado da mesma página) · Telas novas: 0 (a página do espaço
existe) · Fases: 3 · Linhas alteradas sem testes e sem gerado: ~470 (YAML ~70,
`access` ~25, `documents` service/schema/controller ~55, `spaces`
service/controller/módulo/helper ~60; web: chamadas ~45, `SpaceDocuments` ~80,
refatoração de `DocumentsList` ~30, `NewDocumentButton`/`SpaceView`/rota ~30;
mocks ~70; docs ~25). Sem YAML, mocks e docs: **~325 de código de produção**.

Sinais de "grande demais": nenhum dispara. Linhas no mesmo patamar da 145
(~430 com YAML e mocks). Se estourar, o corte é a criação (`POST` com
`spaceId` + botão) numa fatia seguinte — não recomendado: sem criar, a lista
nasce vazia para sempre e a fatia não tem valor sozinha.

## Riscos

- **R8 e conexão aberta**: removida a lotação, o editor já aberto continua
  gravando até a próxima conexão (o Hocuspocus só decide no `onConnect`). O
  PRD pede recusa "na verificação seguinte"; hoje a verificação seguinte **é**
  a próxima conexão. A métrica de pronto "deixa de gravar na verificação
  seguinte" passa só se o e2e/integração forçar reconexão. Ver Dívida.
- `readableDocumentsWhere` passa a incluir documentos do espaço da unidade:
  todo leitor da porta precisa aceitar isso. Conferido: `listMine` filtra por
  `ownerId`; `get` e `favorites` devem aceitar; `listInSpace` filtra por
  `spaceId`. Leitor novo fora dessa lista é bug.
- Decisão sem filtro de organização (D1): depende de lotação e unidade serem
  sempre da mesma organização. Hoje é garantido pelos serviços, não pelo banco.
- `findDecision` passa a fazer join com `Space`/`OrgUnit`/`OrgUnitAssignment`
  em toda decisão, inclusive a do dono. Custo pequeno (chaves únicas e índice
  `personId` da lotação); medir se a colaboração reclamar.
- Mudar `createDocument` para invalidar todas as listas troca uma invalidação
  hoje restrita a `mine`: a barra lateral e favoritos rebuscam também. Aceito.

## Dívida encontrada

- **Derrubar conexão ao remover lotação**: `closeConnections` só é disparado
  por lixeira e exclusão; remover lotação (fatia 108) não avisa o `collab`.
  Exige ouvinte em `OrgUnitAssignmentsService` e fechamento por pessoa no
  `collab`.
- **Texto de "Meus documentos"** diz "visíveis só para você até serem
  compartilhados"; com esta fatia, documento criado no espaço da unidade
  aparece ali e é visível aos colegas. O PRD não pede a troca; ajustar o texto
  numa entrega de acabamento.
- **Organização na decisão de acesso** não é conferida (D1): nenhuma restrição
  de banco impede lotação em unidade de outra organização.
- `SpaceView` só acha o espaço pela lista `GET /spaces` (sem rota por id,
  architecture §012); com `GET /spaces/{id}/documents` agora existe uma rota
  por id que resolve alcance sozinha — duas fontes de "alcança o espaço" na
  web e na API (`list` e `reachOf`, mesma `resolveReach`).
