# SPEC 152 — unit-space-documents-inherit

Quem alcança o espaço de uma unidade pela herança da unidade-pai (fatia 140)
passa a ver, abrir, editar e criar documentos nele como os lotados diretos
(fatia 127). PRD aprovado em `prd.md`, nesta pasta, com 12 requisitos. A branch
`feature/152-unit-space-documents-inherit` sai de `develop`.

Parte de `docs/architecture.md` §3 "access" (caminho único dono → lixeira →
maior(compartilhamento, espaço) → `none`; nada materializado; 404 opaco;
assinaturas das portas centralizadas) e §4 (árvore de unidades).

Lições vigentes para toda tarefa do PLAN: `React.JSX.Element`; `ref` é prop
comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo, medida com
`pnpm exec vitest run --coverage --coverage.reporter=json-summary` na raiz, sem
`--project`; nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`;
typecheck e lint finais com cache limpo (`pnpm exec tsc -b --clean`); arquivo
gerado do contrato só pelo script; **nenhuma migration nesta fatia** (e nunca
`prisma migrate diff/dev/reset`); nunca remover restrição do banco num teste;
sem Prettier reformatando arquivo existente; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `resolveReach(units)` e `findReachUnits(organizationId, personId)`, privados
  em `apps/api/src/spaces/spaces.service.ts`: a regra de alcance da 140
  (lotação direta, ou espaço que herda e mãe alcançada, iterativo, memorizado,
  ciclo conta como não alcançado). Usados por `list`, `reachOf`,
  `reachOfUnit`, `getDetail` e `listMembers`.
- `AccessService` (`apps/api/src/access/access.service.ts`): `findDecision`
  numa consulta; `spaceLevelOf` dá `'edit'` só à lotação direta (UNIT) e ao
  dono/membro (FREE); `levelOf` puro com a ordem dono → lixeira →
  maior(share, espaço) → `none`; `readableDocumentsWhere` síncrono com o ramo
  `space: { type: 'UNIT', orgUnit: { assignments: { some: { personId } } } }`.
  Chamado por `documents.service.ts` (3×) e `favorites.service.ts` (1×).
- `GET /spaces/{spaceId}/documents` responde **403** "Os documentos deste
  espaço estão disponíveis para quem está lotado diretamente na unidade." ao
  alcance `'inherited'` (`spaces.controller.ts`).
- `DocumentsService.create` com `spaceId` aceita só lotação direta (UNIT) ou
  dono/membro editor (FREE): o herdado cai no 404.
- `SpacesService.getDetail` devolve `canCreateDocuments: reach === 'direct'`
  no espaço de unidade; a rota `space.tsx` passa esse valor a `SpaceDocuments`.
- Web: `SpaceDocuments` tem o ramo do 403 com o aviso de lotação direta; o
  banco simulado tem `spaceReachOf` e o handler do `GET …/documents` com o
  ramo 403; a API simulada de `POST /documents` recusa o herdado.
- `CollabService.onConnect` decide por `resolveAccess`/`canWrite`; a
  reavaliação de conexões abertas ao mudar compartilhamento (fatia 146) não
  cobre mudança de lotação ou de herança (dívida 049, fora de escopo — R9).
- `SpacesModule` importa `DocumentsModule`; `DocumentsModule` importa
  `AccessModule`. `AccessModule` não importa ninguém.
- Índices usados: `OrgUnit @@index([parentId])`, `OrgUnitAssignment
  @@index([personId])`, `Space.orgUnitId @unique`, `Document
  @@index([spaceId])`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `GET /spaces/{id}/documents` deixa de ter o ramo 403: `'inherited'` vai para a lista como `'direct'` (D4); `SpaceDocuments` perde o ramo do aviso (D6). |
| R2 | `DocumentsService.create` decide o espaço de unidade pelo alcance da porta de acesso (D5); `getDetail` devolve `canCreateDocuments: true` para todo alcance de unidade (D4); dono = quem chama (inalterado). |
| R3 | `findDecision` dá `spaceLevel: 'edit'` a quem alcança a unidade pela herança (D2); `collab` já decide por `resolveAccess`/`canWrite` (nada muda). |
| R4 | Uma só função de alcance, movida para `access/unit-reach.ts` e usada por barra lateral, página, lista, criação e decisão de documento (D1); regra 12 do teste de fronteira prende isso (D7). |
| R5 | `levelOf` intocado; a herança só entra no cálculo de `spaceLevel` (D2). |
| R6 | Ramo da lixeira antes do de espaço em `levelOf` (inalterado); `readableDocumentsWhere` mantém `trashedAt: null`; `requireOwner` segue dando 404 a quem não é dono. |
| R7 | Alcance relido a cada `resolveAccess`, `canWrite`, `readableDocumentsWhere` e `GET /spaces…`; nada gravado por pessoa (D1, D2, D3). |
| R8 | Ramo do dono primeiro em `levelOf`; `listMine` por `ownerId` (inalterados). |
| R9 | Nada novo: conexão aberta recusa na próxima conexão, como a 127 (dívida 049). |
| R10 | `listMembers` intocado: só `orgUnitAssignment` direto. |
| R11 | Sem alcance → `'none'` → 404 "Espaço não encontrado." na lista e na criação, `none` → 404 no documento; o 403 do herdado some do contrato (D4). |
| R12 | Tela sem estado novo; o e2e da 127 troca o cenário do aviso pelo de trabalho herdado, com axe (D8). |

## Decisões técnicas

### D1 — A regra de alcance vai para `access`, uma consulta relida por pedido

- `apps/api/src/access/unit-reach.ts` (novo, puro): recebe o `resolveReach` e
  o tipo `ReachUnit` movidos **sem mudança de algoritmo** de
  `spaces.service.ts`, e exporta `reachedUnitSpaces(units): ReachedUnitSpace[]`
  = `{ orgUnitId, spaceId, name, reach: 'direct' | 'inherited' }` para cada
  unidade com espaço alcançado (`'direct'` quando há lotação na própria
  unidade).
- `AccessService` ganha a leitura única das unidades (a antiga
  `findReachUnits`, mesmo `select`: `id, parentId, name, space { id,
  inheritsParent }, assignments where personId`) e o método público
  `unitSpacesReachedBy(organizationId, personId): Promise<ReachedUnitSpace[]>`.
  Quando a organização não vem da sessão (portas de documento), o `where` é
  `{ organization: { people: { some: { id: personId } } } }` — mesma consulta,
  outro filtro, sem ida extra ao banco.
- `SpacesService` injeta `AccessService` (`SpacesModule` importa
  `AccessModule`) e troca `findReachUnits`/`resolveReach` por
  `unitSpacesReachedBy` em `list`, `reachOfUnit` (e por ele `reachOf`,
  `getDetail`, `listMembers`). Nenhuma cópia da regra fica em `spaces/`.
- **Nada materializado**: nenhuma tabela, coluna ou cache; a cadeia é relida em
  todo pedido que decide acesso (R7).
- Alternativa descartada: `AccessService` chamar `SpacesService` — ciclo de
  módulos (`Spaces → Documents → Access → Spaces`), e a decisão de acesso a
  documento passaria a depender de `spaces`.
- Alternativa descartada: duplicar a regra em `access` — o PRD exige uma só
  regra (R4), e duas cópias divergem na primeira mudança (016).
- Alternativa descartada: CTE recursiva em SQL cru — mais rápida só com
  centenas de unidades, tira a consulta do Prisma tipado e dos testes com
  Prisma falso; a 140 já descartou pelo mesmo motivo.

### D2 — `resolveAccess`/`canWrite`: a herança só amplia `spaceLevel`

- `findDecision` acrescenta ao `select` do espaço `inheritsParent` e, em
  `orgUnit`, `id` e `organizationId`. Continua **uma** consulta no caminho
  comum.
- Segunda consulta **só** quando tudo abaixo vale: não é dono, não está na
  lixeira, compartilhamento não é `'edit'`, espaço `UNIT` sem lotação direta
  da pessoa e `inheritsParent === true`. Então chama `unitSpacesReachedBy(
  orgUnit.organizationId, personId)` e, se o `spaceId` do documento está no
  resultado, `spaceLevel = 'edit'`. Dono, lixeira, share `edit`, espaço
  pessoal/livre e espaço que não herda não pagam a árvore.
- `levelOf` e `spaceLevelOf` continuam puros; o comentário "a herança entre
  unidades não entra aqui" é reescrito. Ordem dono → lixeira →
  maior(compartilhamento, espaço) → `none` intocada (R5).
- Assinaturas de `resolveAccess` e `canWrite` intocadas.
- Alternativa descartada: sempre carregar a árvore em `findDecision` — o dono
  e todo documento pessoal pagariam uma consulta à organização inteira.

### D3 — `readableDocumentsWhere` passa a ser assíncrono, com ids

- Assinatura: `async readableDocumentsWhere(personId: string):
  Promise<Prisma.DocumentWhereInput>`. O ramo `UNIT` vira `{ spaceId: { in:
  reachedIds } }`, com `reachedIds` = `spaceId` de `unitSpacesReachedBy` pela
  organização da pessoa (direto **e** herdado — um ramo só, a mesma regra).
  Ramos de dono, compartilhamento e espaço livre e o literal `trashedAt: null`
  (regra 8) inalterados. `in: []` não casa nada.
- Quatro chamadas passam a `await this.access.readableDocumentsWhere(…)`:
  `documents.service.ts` (`listMine`, `listInSpace`, a terceira leitura) e
  `favorites.service.ts`. O texto `readableDocumentsWhere(` continua dentro de
  cada chamada, então as regras 2 e 7 seguem valendo sem mudança.
- Custo: uma consulta a mais por leitura de lista (unidades da organização,
  dezenas de linhas, filtro por `organizationId` via relação), independente
  da profundidade; resolução O(N) em memória. O filtro final usa
  `@@index([spaceId])`. **Sem migration**: nenhum índice novo é necessário
  para dezenas de unidades.
- Alternativa descartada: manter síncrono com relações aninhadas (`orgUnit:
  { OR: [assignments, { space: { inheritsParent: true }, parent: { … } }] }`)
  até uma profundidade fixa — não é exato para cadeias mais fundas e repete a
  regra em forma de Prisma (viola R4).
- Alternativa descartada: passar `organizationId` como parâmetro — muda as
  quatro chamadas e o controlador; a relação `organization.people` resolve na
  mesma consulta.

### D4 — `spaces`: o herdado recebe a lista e pode criar

- `spaces.controller.ts`: `listSpaceDocuments` perde o ramo `'inherited'` e a
  constante `INHERITED_REACH_MESSAGE`; `'none'` → 404, qualquer outro → 200.
  Ordem 401 → 404 → 200; não existe mais 403 nesta rota.
- `getDetail`: `canCreateDocuments: true` para espaço de unidade alcançado
  (direto ou herdado). `reach` continua `'direct' | 'inherited'` no contrato
  (a 018 pode usá-lo).
- Contrato `packages/api-contract/openapi.yaml`: em `listSpaceDocuments`, a
  resposta **403** sai e a descrição passa a "quem alcança o espaço de
  unidade (lotação direta ou herança)"; em `POST /documents`, a descrição do
  404 (linha "não está lotado diretamente") passa a "não alcança o espaço";
  `canCreateDocuments` descrito como verdadeiro para todo alcance de unidade.
  Tipos regenerados pelo script.
- Alternativa descartada: manter o 403 para outra finalidade — nenhum caso
  restante o usa; ficaria código morto e uma mensagem falsa no contrato.

### D5 — `DocumentsService.create` com `spaceId` de unidade

- O ramo `type: 'UNIT'` com `assignments: { some }` sai do `tx.space.findFirst`,
  que passa a conferir só o espaço livre. Para espaço de unidade, antes da
  transação: `unitSpacesReachedBy(person.organizationId, person.id)` contém o
  `spaceId` → segue; senão → 404 "Espaço não encontrado." (mesmo helper
  `spaceNotFound`). Espaço inexistente, pessoal, de outra organização ou sem
  alcance: o mesmo 404 (R11).
- A leitura acontece fora da transação da numeração do título: o alcance é
  decisão de acesso, não parte da escrita; uma perda de herança entre as duas
  leituras cria um documento de que a pessoa é dona (R8 continua valendo).
- Alternativa descartada: `create` perguntar a `SpacesService.reachOf` —
  `DocumentsModule` importaria `SpacesModule`, que já importa
  `DocumentsModule` (ciclo).

### D6 — Web: some o aviso de lotação direta

- `features/documents/components/space-documents.tsx`: sai `isForbidden`,
  `DIRECT_ASSIGNMENT_NOTICE` e o ramo do 403 (e o import de `isAxiosError`).
  Os quatro estados e o botão dependem só de `canCreate`, que agora é
  verdadeiro para quem alcança a unidade por herança. Nenhum texto novo.
- `space-view.tsx`, `space.tsx` e `features/spaces/**` sem mudança de código.
- API simulada (`api-mocking`): `db.ts` → `canCreateDocuments: true` para o
  espaço de unidade alcançado; `handlers/spaces.ts` → o `GET
  …/:spaceId/documents` perde o ramo `'inherited'`/403; `handlers/documents.ts`
  → `POST /documents` aceita espaço de unidade com alcance `'inherited'`;
  `utils.ts` → o comentário da amostra herdada deixa de citar o aviso.

### D7 — Teste de fronteira

- Regras 1–11 continuam; nenhuma afrouxa.
- Regra 10: a asserção do código real `accessSource toContain('assignments: {
  some: { personId } }')` deixa de ser verdade (o ramo UNIT vira ids). Passa
  a exigir que `access.service.ts` contenha `unitSpacesReachedBy(` e que a
  definição de `readableDocumentsWhere` contenha `spaceId: { in:`. O exemplo
  infrator/conforme da regra fica igual.
- **Regra 12 nova**, com exemplo infrator e conforme: a regra de alcance tem
  uma só definição — a declaração de `resolveReach` (`function resolveReach`
  ou `const resolveReach`) só existe em `access/unit-reach.ts`, e nenhum
  arquivo fora de `access/` chama `resolveReach(`; o código real responde
  pela regra (hoje `spaces.service.ts` a violaria).

### D8 — Testes

- **API, integração (Postgres real)**:
  - `access.integration.test.ts`: mãe→filha herdando, lotado só na mãe →
    `edit` e `canWrite` verdadeiro no documento de um colega da filha;
    `readableDocumentsWhere` o inclui; filha volta a "Permissões próprias" →
    `none` e fora da lista na chamada seguinte; avó→mãe(própria)→filha, lotado
    na avó → `none`; herdado com documento na lixeira → `none`, dono `owner`;
    herdado que criou e perdeu a herança → `owner`; share `view` + herança →
    `edit`; lotação removida da mãe → `none`. O caso "herdado → none" da 127
    é invertido.
  - `spaces.integration.test.ts`: `GET /spaces/{id}/documents` herdado → 200
    (antes 403); `GET /spaces/{id}` herdado → `canCreateDocuments: true`;
    cadeia quebrada → 404; `list` e `listMembers` mantêm o comportamento da
    140/128 (prova de que a troca para `access` não mudou nada).
  - `documents.integration.test.ts`: `POST` com `spaceId` herdado → 201, dono
    = quem chama, aparece em "Meus documentos" dele e na lista do espaço;
    lotado direto abre (`edit`); cadeia quebrada → 404; herdado: `trash` de
    documento alheio → 404.
  - `favorites.integration.test.ts`: favorito de documento alcançado só por
    herança aparece e some quando a herança acaba.
  - `collab` (integração existente): herdado conecta e grava; perdida a
    herança, a próxima conexão é recusada.
- **API, unitários/contrato**: `access/__tests__/unit-reach.test.ts` (os casos
  de `resolveReach` que hoje estão em `spaces.service.test.ts`, movidos, e
  `reachedUnitSpaces` com `direct`/`inherited`); `spaces.service.test.ts`
  ajustado ao `AccessService` falso; `spaces.contract.test.ts` sem 403;
  `documents.contract.test.ts` com 201 para herdado; regras 10 e 12 da
  fronteira; testes unitários de `documents.service`/`favorites.service` que
  montam `AccessService` falso passam a devolver `Promise`.
- **Web**: `space-documents.test.tsx` (o caso 403 → aviso sai; herdado vê
  lista e botão); `space.test.tsx` da rota (herdado vê "Novo documento");
  testes dos handlers que esperavam 403.
- **e2e** — `apps/web/e2e/tests/unit-space-documents.spec.ts`: o cenário (2)
  "espaço herdado → aviso sem botão" vira "espaço herdado da amostra → vê a
  lista, cria pelo "Novo documento", o documento abre"; axe mantido.

## Interface

Sem tela nova e sem receita nova. Lidos `docs/design.md` e o piso de
`interface-design`. A página do espaço de unidade fica, para quem alcança pela
herança, igual à dos lotados diretos descrita na SPEC 127 (receitas
"Carregando", "Vazio", "Erro", "Lista", "Ação de página acima da lista",
"Botão principal"). Some o "Aviso informativo" com "Os documentos deste
espaço estão disponíveis para quem está lotado diretamente na unidade.".

### Mensagens (todas já existem)

| Situação | Texto | Onde |
|---|---|---|
| carregando | "Carregando documentos do espaço…" | `role="status"` |
| vazio | "Nenhum documento neste espaço ainda. Crie o primeiro em “Novo documento”." | vazio |
| erro | "Não foi possível carregar os documentos do espaço." + "Tentar novamente" | `role="alert"` |
| ação | "Novo documento" / "Criando…" | botão principal |
| servidor 404 | "Espaço não encontrado." | corpo da API (lista e criação) |
| removido | "Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade." | sai da tela, do controlador e do contrato |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | sem 403 em `listSpaceDocuments`; descrições de `POST /documents` 404 e `canCreateDocuments` (D4) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| criar | `apps/api/src/access/unit-reach.ts` | `resolveReach` movido, `reachedUnitSpaces` (D1) | `authorization` |
| alterar | `apps/api/src/access/access.service.ts` | `unitSpacesReachedBy`, `findDecision` com herança, `readableDocumentsWhere` assíncrono com ids (D1–D3) | `authorization`, `security` |
| alterar | `apps/api/src/spaces/spaces.service.ts` | usa `AccessService`; `canCreateDocuments` para todo alcance de unidade (D1, D4) | `authorization` |
| alterar | `apps/api/src/spaces/spaces.module.ts` | importa `AccessModule` | — |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | sem ramo 403 (D4) | `security` |
| alterar | `apps/api/src/documents/documents.service.ts` | `create` por alcance; `await` nas portas (D3, D5) | `authorization`, `security` |
| alterar | `apps/api/src/documents/favorites.service.ts` | `await` na porta (D3) | — |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 10 ajustada, regra 12 (D7) | `unit-testing` |
| criar | `apps/api/src/access/__tests__/unit-reach.test.ts` | D8 | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.service.test.ts` | casos de `resolveReach` saem; `AccessService` falso (D8) | `unit-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/spaces/__tests__/spaces.contract.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/favorites.integration.test.ts` | D8 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.service.test.ts` | porta assíncrona no falso (D8) | `unit-testing` |
| alterar | `apps/api/src/collab/__tests__/collab.integration.test.ts` | herdado conecta; perde e é recusado na próxima (D8) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/features/documents/components/space-documents.tsx` | sem ramo 403 e sem aviso (D6) | `interface-design`, `error-handling` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `canCreateDocuments` para herdado (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `GET …/documents` sem 403 (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `POST` aceita herdado (D6) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário da amostra herdada (D6) | `api-mocking` |
| alterar | `apps/web/src/features/documents/components/__tests__/space-documents.test.tsx` | D8 | `component-testing` |
| alterar | `apps/web/src/app/routes/app/__tests__/space.test.tsx` | D8 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/e2e/tests/unit-space-documents.spec.ts` | cenário herdado trabalha nos documentos (D8) | `e2e-testing` |
| alterar | `docs/architecture.md` | §3: a regra de alcance mora em `access/unit-reach.ts`; `readableDocumentsWhere` assíncrono; herança dá `edit`; regra 12; §spaces: `GET /spaces/{id}/documents` sem 403 | — |
| alterar | `docs/features/127-unit-space-documents/prd.md` | R10, usuários, decisão e métrica marcados como substituídos pela 152 (feito junto com esta SPEC) | — |
| alterar | `docs/features/128-unit-space-members/prd.md` | decisão "documentos exigem lotação direta" atualizada pela 152 (feito junto com esta SPEC) | — |

Intocados de propósito: `access-level.ts`, `levelOf` (só o comentário),
`trashedDocumentsWhere`, `shares.service.ts`, `collab.service.ts`,
`org-units/**`, `unit-assignments/**`, `listMembers` (R10), `space-view.tsx`,
`space.tsx`, `components/ui/**`, `schema.prisma` e todas as migrations.

## Estimativa de tamanho

Jornadas: 1 (quem herda trabalha nos documentos do espaço) · Telas novas: 0 ·
Fases: 3 · Linhas alteradas sem testes e sem gerado: ~230 (`unit-reach.ts`
~70, quase todo movido; `access.service` ~60; `spaces` serviço/controlador/
módulo ~40, saldo negativo; `documents`/`favorites` ~25; YAML ~15; web
`space-documents` ~−20; mocks ~20; docs ~20).

Sinais de "grande demais": nenhum dispara.

## Riscos

- `readableDocumentsWhere` assíncrono muda a assinatura "definitiva" da
  arquitetura §3: todo leitor novo precisa de `await`. O TypeScript acusa o
  esquecimento (um `Promise` não é `DocumentWhereInput`).
- Toda leitura de lista de documentos passa a ler as unidades da organização:
  uma consulta a mais por pedido, aceitável com dezenas de unidades.
- `resolveAccess` do herdado faz duas consultas; a colaboração chama a decisão
  a cada conexão, não a cada edição — custo aceitável.
- Quem perde a herança com o editor aberto continua gravando até a próxima
  conexão (R9, dívida 049).
- Duas pessoas criando e perdendo a herança ao mesmo tempo: D5 lê o alcance
  fora da transação; o pior caso é um documento criado de que a própria
  pessoa é dona.

## Dívida encontrada

- A regra de alcance morava em `spaces.service.ts` e era chamada só lá; ao
  movê-la, `SpacesService` passa a depender de `AccessService` para decidir
  quem vê espaço de unidade — `docs/architecture.md` §3 dizia que "espaço não
  dá acesso a documento" e §spaces descrevia `resolveReach` em `spaces`; os
  dois trechos ficam desatualizados até a fase 3.
- O filtro de organização na decisão de documento continua implícito
  (dívida registrada na 127): a leitura das unidades usa a organização da
  unidade do documento ou da pessoa, nunca a da sessão comparada às duas.
- `GET /spaces` e agora toda lista de documentos carregam a árvore inteira da
  organização por pedido (mesma natureza da dívida da 140 e da 068); com
  centenas de unidades, trocar por CTE recursiva ou índice composto com
  medição.
- Texto de "Meus documentos" ("visíveis só para você até serem
  compartilhados") segue desatualizado desde a 127; com esta fatia mais gente
  vê os documentos criados no espaço.
