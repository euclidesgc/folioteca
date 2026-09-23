# SPEC 136 — free-space-documents

O dono e os membros de um espaço livre veem a lista de documentos do espaço,
criam documentos ali e editam qualquer um deles juntos. PRD aprovado em
`prd.md`, nesta pasta, com 14 requisitos. Espelho da SPEC 127
(`unit-space-documents`) para o espaço `FREE`. A branch
`feature/136-free-space-documents` está empilhada sobre 135 → 134 → 159 → 128 →
127. Sem migration, sem rota nova.

Parte de `docs/architecture.md` §3 "access": ordem dono → lixeira → maior
(compartilhamento, participação) → `none`; nada materializado (participação
relida a cada pedido); 404 opaco; assinaturas públicas de `AccessService`
definitivas.

Lições vigentes para toda tarefa do PLAN: `React.JSX.Element`; `ref` é prop
comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo;
nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`; typecheck e
lint finais com cache limpo; arquivo gerado do contrato só pelo script;
**sem Prettier reformatando arquivo existente**; o agente derruba tudo o que
subir.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `AccessService.findDecision` lê share e lotação na mesma consulta;
  `levelOf` = dono → lixeira → `isUnitMember ? 'edit'` → share → `none`;
  `readableDocumentsWhere` com o ramo `UNIT`.
- `DocumentsService.create(person, body)` com `spaceId` opcional (hoje só
  `UNIT` com lotação direta; senão `spaceNotFound()`); `listInSpace(personId,
  spaceId)` filtrado pela porta; `requireOwner` faz de `edit` um 404 em
  lixeira/restauração/exclusão (R5 sem mudança); `listMine` com `AND ownerId`
  (R6 sem mudança).
- `SpacesController` `GET :spaceId/documents`: `isUuid` → `reachOf` `'none'`
  → 404, `'inherited'` → 403, `'direct'` → `listInSpace`. `SpacesService.reachOf`
  delega a `reachOfUnit` (só `UNIT`); `getDetail` já resolve `FREE` para dono
  e membro.
- `CollabService.onConnect` decide por `resolveAccess`/`canWrite` a cada
  conexão.
- Web: `SpaceDocuments` (quatro estados, 403 → aviso, `NewDocumentButton
  spaceId` só com 200), `useSpaceDocuments`, `createDocument({ spaceId })`
  com invalidação das listas; `SpaceView` com prop `unitContent` só no ramo
  `unit` e o aviso `SPACE_TEXTS.free.empty` no `free`; `DocumentView` já
  esconde lixeira e compartilhar para não-dono.
- Mocks: `spaceReachOf`, `listSpaceDocuments`, `createDocumentIn`,
  `isSpaceMember`, semente `mock-space-members=free-member`
  (`seedFreeSpaceMembership`).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `SpaceView` renderiza `documentsContent` (= `SpaceDocuments`) também no ramo `free`, acima de "Pessoas neste espaço" (D4); `GET /spaces/{id}/documents` passa a responder 200 a dono/membro (D3). |
| R2 | Estados de `SpaceDocuments` inalterados: carregando, erro com "Tentar novamente", vazio com convite (D4). |
| R3 | `POST /documents` com `spaceId` de espaço livre de dono/membro (D2); `NewDocumentButton` já montado por `SpaceDocuments` quando a lista respondeu 200. |
| R4 | `ownerId` = quem chama (inalterado); `levelOf` dá `edit` a dono do espaço e membro (D1); colaboração já decide por `resolveAccess`. |
| R5 | `requireOwner` inalterado; `DocumentView` já esconde a lixeira; provado para o dono do espaço (D6). |
| R6 | `listMine` inalterado (D6 prova). |
| R7 | Ramo da lixeira antes do de participação; `readableDocumentsWhere` mantém `trashedAt: null` (D1). |
| R8 | Participação relida em cada `findDecision` e em cada `reachOf`; próxima conexão de colaboração recusada (D1, D3; limite em Riscos). |
| R9 | Ramo do dono primeiro em `levelOf`; `listInSpace` usa a porta, então o documento do removido segue no espaço para os demais (D1). |
| R10 | `reachOf` `'none'` para quem não é dono nem membro, outra organização, id inválido → 404 opaco em lista; `create` → 404; `levelOf` → `none` → 404 no documento; `isAdmin` não é lido (D1–D3). |
| R11 | Share continua no `levelOf` e no OR de `readableDocumentsWhere`; quem só tem share recebe 404 na lista (D1, D3). |
| R12 | Tudo por `AccessService`; regra 11 nova no teste de fronteira (D5). |
| R13 | Acabamento e anúncios de `SpaceDocuments` reaproveitados; axe no e2e (D6). |
| R14 | Textos literais em Interface. |

## Decisões técnicas

### D1 — `AccessService`: dono ou membro de espaço `FREE` = `edit`

- `findDecision` amplia o `select` de `space` na **mesma** consulta:
  `space: { select: { type, ownerId, orgUnit: { select: { assignments: {
  where: { personId }, select: { personId } } } }, members: { where: {
  personId }, select: { personId: true } } } }`.
- `DocumentDecision.isUnitMember` vira `isSpaceMember: boolean` =
  `(type === 'UNIT' && assignments.length > 0) || (type === 'FREE' &&
  (space.ownerId === personId || members.length > 0))`. `levelOf` troca o
  nome do campo no ramo `edit`; ordem inalterada (dono → lixeira → membro →
  share → `none`).
- `readableDocumentsWhere(personId)` ganha no `OR`: `{ space: { type: 'FREE',
  OR: [{ ownerId: personId }, { members: { some: { personId } } }] } }`.
  Literal `trashedAt: null` preservado.
- Assinaturas públicas e `canWrite` intocados.
- Organização não é filtrada: espaço livre só recebe membro da mesma
  organização (garantido por `addMember`, não pelo banco). Registrado em
  Riscos.
- Alternativa descartada: segunda consulta à participação depois do documento
  — duas idas ao banco em toda decisão, inclusive a do dono.
- Alternativa descartada: campo `isFreeSpaceMember` separado — dois
  booleanos para o mesmo nível; um só nome cobre os dois tipos e prepara os
  papéis da 142.

### D2 — `DocumentsService.create` aceita espaço `FREE`

- O `findFirst` do ramo com `spaceId` vira `where: { id: spaceId, OR: [{
  type: 'UNIT', orgUnit: { organizationId, assignments: { some: { personId }
  } } }, { type: 'FREE', organizationId, OR: [{ ownerId: personId }, {
  members: { some: { personId } } }] }] }`. Ausente → `spaceNotFound()`.
- `listInSpace` inalterado. Contrato: só o `summary`/`description` de `POST
  /documents` passa a citar o espaço livre de que a pessoa é dona ou membro.
- Alternativa descartada: rota `POST /spaces/{id}/documents` — segunda rota
  de criação; o corpo `{ spaceId }` já existe.

### D3 — `SpacesService.reachOf` responde `FREE`

- `reachOf` primeiro procura `space.findFirst({ where: { id, type: 'FREE',
  organizationId, OR: [{ ownerId }, { members: { some: { personId } } }] },
  select: { id } })` → `'direct'`; senão delega a `reachOfUnit` como hoje
  (que devolve `'none'` para `FREE` alheio). `reachOfUnit`, `getDetail` e
  `listMembers` intocados.
- Controller de `GET :spaceId/documents` inalterado; `'inherited'` nunca
  ocorre em `FREE`. Contrato: descrição da operação `listSpaceDocuments` passa
  a dizer "dono ou membro do espaço livre"; o 403 continua só de unidade.
- Alternativa descartada: novo valor `'member'` no retorno — o controller
  teria de mudar sem ganho; `'direct'` já significa "vê a lista".
- Alternativa descartada: usar `getDetail` no controller — o `FREE` sairia
  certo, mas a unidade perderia a distinção 403/404 já testada.

### D4 — Web: `SpaceView` com `documentsContent`

- Prop `unitContent` renomeada para `documentsContent: ReactNode`, renderizada
  nos dois ramos. No `free`: botão "Adicionar pessoa" (só dono) →
  `documentsContent` → `SpaceMembers`. `SPACE_TEXTS.free.empty` e o `<p>`
  tracejado saem; o tipo de `SPACE_TEXTS` perde `empty`. Comentários do
  arquivo atualizados.
- `app/routes/app/space.tsx` passa `documentsContent={<SpaceDocuments
  spaceId={spaceId} />}`.
- `SpaceDocuments`, `NewDocumentButton` e as chamadas de API **não mudam**
  (o 403 não ocorre em `FREE`).
- Alternativa descartada: segunda prop `freeContent` — o mesmo nó em duas
  props para o mesmo papel.

### D5 — Teste de fronteira: regra 11

- Com exemplo infrator/conforme como as demais: fora de
  `access/access.service.ts`, nenhuma leitura de `Document` filtra por
  `members` nem pelo dono do espaço (`space: { ownerId … }`). Participação no
  espaço só vira acesso pela porta. Nenhuma regra existente afrouxa.
  O filtro de `create` (D2) é leitura de `Space`, não de `Document`.

### D6 — MSW e testes

- **MSW** (`api-mocking`): `spaceReachOf` devolve `'direct'` para `free`
  quando dono ou `isSpaceMember` (os chamadores de `spaceDetailOf` e
  `listSpaceMembers` já tratam `free` antes, sem mudança de comportamento);
  handler `POST /documents` passa a aceitar esse `'direct'` (já compara com
  `'direct'`); `GET /spaces/:spaceId/documents` herda. `createDocumentIn`
  inalterado (`owner` para quem cria). `seedFreeSpaceMembership` ganha um
  documento do dono do espaço nesse espaço com `accessLevel: 'edit'`.
  Comentários de `spaceReachOf` e da chave em `utils.ts` atualizados.
- **API, integração (Postgres real, serviço real)**:
  - `access.integration.test.ts`: membro → `edit` e `canWrite`; dono do
    espaço sobre documento de membro → `edit`; membro removido → `none` na
    chamada seguinte, e `owner` sobre o próprio documento; lixeira → `none`
    para dono do espaço/membro, restaurar → `edit`; share `VIEW` de não
    membro → `view`; `readableDocumentsWhere` inclui e exclui como D1.
  - `documents.integration.test.ts`: membro cria no espaço (201, dono =
    membro, em "Meus documentos" dele e não no do dono do espaço); dono do
    espaço `GET` 200 `edit`, `PATCH` 200, `trash`/`restore`/`delete` → 404;
    terceiro, administração não membro, `randomUUID()`, removido → 404.
  - `spaces.integration.test.ts`: `GET /spaces/{id}/documents` dono e membro
    → 200 ordenado sem lixeira; removido, terceiro, administração → 404
    idêntico; `reachOf(randomUUID(), …)` → `'none'` (outra organização).
  - `collab` (integração existente): membro conecta e grava; removido →
    próxima conexão recusada.
  - Unitários: `levelOf` com `isSpaceMember`; regra 11; contratos dos dois
    caminhos seguem verdes.
- **Web (Vitest + MSW)**: `space-view.test.tsx` (free com `documentsContent`
  acima de "Pessoas neste espaço", sem o aviso antigo; unit inalterado);
  `space.test.tsx` da rota (espaço livre mostra a lista e "Novo documento").
- **e2e** `apps/web/e2e/tests/free-space-documents.spec.ts`, só teclado,
  axe: (1) dono cria espaço livre, vê o vazio, "Novo documento" → abre o
  documento → volta ao espaço e o vê no topo; (2) segundo contexto com
  `mock-space-members=free-member`: membro abre o espaço, vê o documento do
  dono na lista e o abre.

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Nenhuma receita nova:
reaproveita as usadas por `SpaceDocuments` na 127 ("Ação de página acima da
lista", "Lista", "Data em lista", "Carregando", "Vazio", "Erro", "Botão
principal").

### Página do espaço livre — o que muda

Título (nome), descrição ("Um espaço livre, de que você é dona." / "Um espaço
livre de que você é membro.") e "Adicionar pessoa" (só dono) ficam. O aviso
"Os documentos deste espaço ainda não chegaram…" sai; no lugar dele, antes de
"Pessoas neste espaço":

- **Carregando**: `role="status"` "Carregando documentos do espaço…".
- **Erro**: alerta "Não foi possível carregar os documentos do espaço." +
  "Tentar novamente".
- **Vazio**: "Novo documento" à direita e "Nenhum documento neste espaço
  ainda. Crie o primeiro em “Novo documento”.".
- **Com dados**: "Novo documento" e a lista (título-link `truncate`, data à
  direita), igual à do espaço de unidade.
- Botão enquanto cria: "Criando…", desabilitado.

Espaço de unidade: inalterado. A 360px nada rola na horizontal (layout já
existente).

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| carregando | "Carregando documentos do espaço…" | `role="status"` |
| vazio | "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”." | vazio |
| erro | "Não foi possível carregar os documentos do espaço." + "Tentar novamente" | `role="alert"` |
| ação | "Novo documento" / "Criando…" | botão principal |
| servidor 404 | "Espaço não encontrado." | corpo da API (lista e criação) |

## Arquivos

Fase 1 — API

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | só descrições de `POST /documents` e `listSpaceDocuments` (D2, D3) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script (comentários) | — |
| alterar | `apps/api/src/access/access.service.ts` | `findDecision`, `isSpaceMember`, `readableDocumentsWhere` (D1) | `authorization` |
| alterar | `apps/api/src/documents/documents.service.ts` | `create` aceita `FREE` (D2) | `authorization`, `security` |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `reachOf` com ramo `FREE` (D3) | `authorization` |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 11 (D5) | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access-level.test.ts` | `levelOf` com `isSpaceMember` (D6) | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | D6 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | D6 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | D6 | `integration-testing` |
| alterar | `apps/api/src/collab/__tests__/` (integração existente) | membro grava; removido recusado (D6) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/features/spaces/components/space-view.tsx` | `documentsContent` nos dois ramos; sai `SPACE_TEXTS.free.empty` (D4) | `interface-design`, `project-structure` |
| alterar | `apps/web/src/app/routes/app/space.tsx` | passa `documentsContent` (D4) | `routing`, `project-structure` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `spaceReachOf` com `free`; semente com documento (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | comentário/aceite de `FREE` no `POST` (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `GET /spaces/:spaceId/documents` em `free` (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | documentação da chave `free-member` | `api-mocking` |
| alterar | `apps/web/src/features/spaces/components/__tests__/space-view.test.tsx` | D6 | `component-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/space.test.tsx` | D6 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/free-space-documents.spec.ts` | D6 | `e2e-testing` |
| alterar | e2e existentes que esperam o aviso do espaço livre (`free-space*.spec.ts`), se houver | tiram a asserção do aviso | `e2e-testing` |
| alterar | `docs/architecture.md` | §3: participação em espaço (`UNIT` direto, `FREE` dono/membro) = `edit`; regra 11; §6/spaces: `reachOf` cobre `FREE` | — |

Intocados de propósito: `spaces.controller.ts`, `documents.controller.ts`,
`documents.schema.ts`, `collab.service.ts`, `access-level.ts`,
`space-documents.tsx`, `new-document-button.tsx`, chamadas de API da web,
`DocumentView`, `docs/design.md`, migrations.

## Estimativa de tamanho

Jornadas: 1 (dono e membros trabalham nos documentos do espaço livre) · Telas
novas: 0 · Fases: 3 · Linhas de produção alteradas (sem testes, sem gerado):
~130 (`access` ~25, `documents` ~10, `spaces` ~20, YAML ~6, `SpaceView` +
rota ~20, mocks ~35, docs ~15). Sinais de "grande demais": nenhum dispara.

## Riscos

- **R8 e conexão aberta**: removido o membro, o editor aberto grava até a
  próxima conexão (o Hocuspocus decide só no `onConnect`). O PRD aceita "a
  próxima conexão"; o teste força reconexão.
- `readableDocumentsWhere` passa a incluir documentos de espaços livres:
  `listMine` (por `ownerId`), `listInSpace` (por `spaceId`) e favoritos
  aceitam; leitor novo da porta precisa aceitar isso.
- Decisão sem filtro de organização (D1): depende de `addMember` só aceitar
  pessoa da mesma organização; o banco não garante.
- `findDecision` ganha join com `SpaceMember` em toda decisão; custo pequeno
  (chave `spaceId, personId`).
- A semente `free-member` ganha um documento: e2e/testes que esperavam o
  aviso ou a lista vazia nesse espaço precisam de ajuste.
- PRD R2 diz "Tentar de novo"; o botão existente de `SpaceDocuments` diz
  "Tentar novamente". Mantido o existente por coerência com a 127.

## Dívida encontrada

- **Derrubar conexão ao remover membro**: `removeMember` (135) não avisa o
  `collab`; mesma dívida da lotação na 127 (`closeConnections` é por
  documento, não por pessoa).
- **Organização na decisão de acesso** não conferida para `FREE`: nenhuma
  restrição de banco impede `SpaceMember` de outra organização.
- **Texto de "Meus documentos"** ("visíveis só para você até serem
  compartilhados") fica mais falso: agora também documento de espaço livre é
  visível aos membros (já registrado na 127).
- Três lugares repetem o filtro "dono ou membro de espaço livre"
  (`getDetail`/`listMembers`/`removeMember` em `spaces`, `create` em
  `documents`, `access`); sem helper comum.
