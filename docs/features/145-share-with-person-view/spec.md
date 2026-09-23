# SPEC 145 — share-with-person-view

O proprietário procura uma pessoa da instância no diálogo "Compartilhar" e dá a
ela acesso de leitura ao documento; a pessoa abre o endereço e lê, somente
leitura. PRD aprovado em `prd.md`, nesta pasta, com 12 requisitos. Primeira das
fatias em que o item 015 foi dividido (145 → 147 `share-access-list` → 148
`share-edit-level`; 146 `share-level-change` depois da 148).

Parte de `docs/architecture.md` §"access": ordem proprietário → compartilhamento
direto → alvos → `none`; nada materializado; revogação imediata (decisão relida
a cada pedido); 404 opaco; assinaturas `resolveAccess`/`canWrite`/
`readableDocumentsWhere` definitivas (muda o corpo, não quem chama); `access`
exige integração contra Postgres real. A branch
`feature/145-share-with-person` sai de `develop`.

Lições vigentes para toda tarefa do PLAN: `React.JSX.Element`; `ref` é prop
comum; botão nosso é sempre `Button`; cobertura ≥ 80% por arquivo, medida com
`pnpm exec vitest run --coverage --coverage.reporter=json-summary` na raiz, sem
`--project`; nenhum aviso em `install`, `lint`, `typecheck`, `test` e `build`;
typecheck e lint finais com cache limpo (`pnpm exec tsc -b --clean`);
**migration escrita à mão**, nunca `prisma migrate diff/dev/reset`; arquivo
gerado do contrato só pelo script; nunca remover restrição do banco num teste;
sem Prettier reformatando arquivo existente; o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita (conferido no código):

- `AccessLevel = 'owner' | 'edit' | 'view' | 'none'` e `canEdit` em
  `access-level.ts` — os níveis já estão no tipo; só `levelOf` não os devolve.
- `AccessService.levelOf` já tem o ramo da lixeira **antes** do retorno final,
  escrito para o compartilhamento entrar depois dele.
- `DocumentsService.get` devolve `accessLevel` no `Document` (contrato já tem
  `owner|edit|view`); `rename` já faz `none → 404`, `!canEdit → 403`,
  `!canWrite → 409`. `listMine` já faz `AND` com `ownerId: personId`: o
  documento compartilhado **não** entra em "Meus documentos".
- `CollabService.onConnect`: `none` recusa, sem `canWrite` conecta `readOnly`.
  Nada muda no servidor de colaboração.
- Web: `DocumentView` já esconde `TrashDocumentButton` quando `accessLevel !==
  'owner'`; `DocumentEditor` já aceita `editable`; `MockDocument.accessLevel`
  já aceita `view`.
- `GET /people` (fatia 114) existe **sob `AdminGuard`** e devolve
  `PeopleResponse` (`data: PersonSummary[]`, `hasMore`); o hook compartilhado
  `hooks/use-people-search.ts` o chama. Não serve aqui (R3: qualquer pessoa
  autenticada) e não será afrouxado.
- Padrão de busca com debounce no componente (`promote-admin-search.tsx`,
  `assign-person-search.tsx`) e `Dialog` em `components/ui/dialog/dialog.tsx`.
- `Person` **não tem** campo de ativo/inativo; ver Dívida.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `ShareDocumentDialog` só é montado com `accessLevel === 'owner'` e fora da lixeira, na linha de ações (D7); o servidor recusa não-dono (D4). |
| R2 | Busca `GET /people/search?q=` com `enabled` a partir de 2 caracteres, debounce no componente, teto de 10 no servidor, `mode: 'insensitive'` em nome e e-mail (D5, D6, D7). |
| R3 | Controller próprio só com `SessionGuard`; `organizationId` da sessão; exclui `id` de quem pede; `select` só `id/name/email` (D5). |
| R4 | Resultado → "Selecionar" → bloco da pessoa escolhida com o selo "Pode ver" e o botão "Compartilhar"; sucesso anuncia e limpa a busca (D7). |
| R5 | `upsert` em `@@unique([documentId, personId])`; resposta 200 igual na repetição (D2, D4). |
| R6 | 400 para si mesmo e para pessoa inexistente/de outra organização; alerta no diálogo, seleção mantida (D4, D7). |
| R7 | Decisão relida em cada `resolveAccess`; nenhuma sessão ou cache no servidor (D3). |
| R8 | `resolveAccess → 'view'`; `canWrite` falso → colaboração `readOnly` e `PATCH` 403; web: `editable={false}`, título sem campo, rótulo "Somente leitura", sem lixeira (D3, D8). |
| R9 | `none → 404` antes de tudo em `GET` e `PUT`; o caminho único é `AccessService` (D3, D4). |
| R10 | Ramo da lixeira antes do compartilhamento em `levelOf`; share não é apagada ao mover para a lixeira (D3). |
| R11 | `Dialog` do Radix (foco preso e devolvido ao gatilho), `<label>` no campo, contagem em `role="status"`, sucesso em `aria-live`, erro em `role="alert"`; axe no e2e (D7, D10). |
| R12 | Textos literais em Interface. |

## Decisões técnicas

### D1 — Contrato (contrato primeiro, `packages/api-contract/openapi.yaml`)

- `PUT /documents/{documentId}/shares/{personId}`, tag `documents`, operação
  `shareDocument`. Corpo `ShareDocumentInput` = `{ level: 'view' }`
  (`enum: [view]` nesta fatia; a 148 acrescenta `edit` ao enum — mudança
  aditiva), obrigatório, `additionalProperties: false`. Respostas: **200**
  `DocumentShareResponse` = `{ data: { personId, name, email, level } }`;
  **400**, **401**, **403**, **404**, **409** com `Error`.
- `GET /people/search?q=`, tag `people`, operação `searchPeopleToShare`.
  Resposta **200** `PeopleResponse` (reaproveita `PersonSummary`, `hasMore`);
  **401**. Sem 403: qualquer pessoa com sessão.
- Identidade de caminho conferida à mão: YAML `/documents/{documentId}/shares/{personId}`
  ↔ `@Put(':documentId/shares/:personId')` no `DocumentsController` com
  `@Param('documentId')` e `@Param('personId')`; YAML `/people/search` ↔
  `@Controller('people/search')` + `@Get()`. Os testes de contrato chamam
  exatamente esses caminhos.
- Por que 200 com corpo e não 204: o aviso de sucesso usa o nome devolvido
  pelo servidor (mesmo padrão da promoção, 114), nunca o da linha da busca.
- Alternativa descartada: `POST /documents/{id}/shares` com `personId` no
  corpo — o `PUT` no par documento/pessoa é idempotente por natureza (R5) e é
  a mesma rota que a 148/146 vão usar para trocar e tirar o nível.
- Alternativa descartada: `GET /people?scope=share` na rota existente — ela
  tem `AdminGuard` na classe; abrir por parâmetro misturaria duas regras de
  guarda numa classe e contraria "guards na classe, nenhum por método".

### D2 — Tabela `DocumentShare`, migration `0015_document_share`

- `apps/api/prisma/migrations/0015_document_share/migration.sql`, à mão:
  - `CREATE TYPE "ShareLevel" AS ENUM ('VIEW', 'EDIT');`
  - `CREATE TABLE "DocumentShare" ("documentId" TEXT NOT NULL, "personId" TEXT
    NOT NULL, "level" "ShareLevel" NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "DocumentShare_pkey" PRIMARY KEY
    ("documentId", "personId"));`
  - `CREATE INDEX "DocumentShare_personId_idx" ON "DocumentShare"("personId");`
  - FKs `documentId → Document(id)` e `personId → Person(id)`, ambas
    `ON DELETE CASCADE ON UPDATE CASCADE`.
- `schema.prisma`: `enum ShareLevel { VIEW EDIT }` (mesma convenção
  maiúscula de `SpaceType`, mapeada para `'view'|'edit'` no serviço);
  `model DocumentShare` com `@@id([documentId, personId])`,
  `@@index([personId])`; relações `Document.shares` e `Person.documentShares`.
- `EDIT` já existe no enum do banco para a 148 não precisar de migration; nesta
  fatia o serviço só grava `VIEW` (o schema Zod só aceita `'view'`). Nenhum
  `none` (fica na 146).
- Chave primária composta em vez de `id` + `unique`: igual a `Favorite` e
  `OrgUnitAssignment`; o par **é** a linha.
- Alternativa descartada: coluna `sharedWith` em array no `Document` — não
  indexa por pessoa (a 019 lista por pessoa) nem dá cascade.

### D3 — `AccessService` lê o compartilhamento direto

- `findDecision(documentId, personId)` passa a selecionar, na **mesma**
  consulta, `shares: { where: { personId }, select: { level: true } }` —
  continua uma ida ao banco por decisão. `DocumentDecision` ganha
  `shareLevel: 'view' | 'edit' | null`.
- `levelOf`: dono → `'owner'`; lixeira → `'none'` (inalterado, **antes** do
  compartilhamento — R10); `shareLevel` → `'view'`/`'edit'`; senão `'none'`.
  `canWrite` não muda de corpo: `canEdit('view')` é falso.
- `readableDocumentsWhere(personId)` → `{ trashedAt: null, OR: [{ ownerId:
  personId }, { shares: { some: { personId } } }] }` (mantém o literal
  `trashedAt: null` que a regra 8 do teste de fronteira exige).
  `trashedDocumentsWhere` intocada (só o dono).
- Assinaturas públicas intocadas (architecture.md: definitivas).
- Consequência conferida: `DocumentsService.get` passa a achar o documento
  compartilhado pela porta; `favorites` passa a aceitar favoritar documento
  compartilhado (já decide por `resolveAccess`) — coerente, nada a mudar.
- Alternativa descartada: consulta separada à share depois do documento —
  duas idas ao banco em todo `resolveAccess`, inclusive no do dono.

### D4 — `SharesService` (`documents/shares.service.ts`) e a rota `PUT`

- `share(requester: PersonWithOrganization, documentId, personId, body)`,
  ordem fixa (a mesma de `rename`):
  1. `resolveAccess(requester.id, documentId)`: `'none'` → **404**
     `documentNotFound()` (opaco).
  2. `!== 'owner'` → **403** "Só o proprietário pode compartilhar este
     documento.".
  3. `!canWrite` (dono com documento na lixeira) → **409** com a mensagem já
     existente de documento na lixeira.
  4. `parseBody(shareDocumentSchema, body)` → **400**.
  5. `personId === requester.id` → **400** "Você já é o proprietário deste
     documento.".
  6. `prisma.person.findFirst({ where: { id: personId, organizationId:
     requester.organizationId }, select: { id, name, email } })` (id malformado
     não chega ao banco, `isUuid`) → ausente: **400** "Pessoa não encontrada
     nesta instância.".
  7. `prisma.documentShare.upsert({ where: { documentId_personId }, create: {
     …, level: 'VIEW' }, update: { level: 'VIEW' } })` → 200 com a pessoa e
     `level: 'view'`.
- `documents.schema.ts`: `shareDocumentSchema = z.strictObject({ level:
  z.literal('view', { error: 'Escolha o nível de acesso.' }) }, { error:
  'Campo não permitido.' })`.
- Acesso antes do corpo: corpo inválido não revela que documento alheio existe
  (mesma razão de `rename`).
- Por que serviço próprio e não em `documents.service.ts`: mesmo padrão de
  `favorites.service.ts` (tabela satélite com serviço dono); o teste de
  fronteira ganha a regra 9 (D9).
- Alternativa descartada: 404 também para quem tem `view` — o PRD (R9) só
  exige resposta de inexistente para quem **não tem** acesso; quem já lê sabe
  que o documento existe, e 403 segue a ordem 404→403 documentada.

### D5 — Busca `GET /people/search` em controller próprio

- `people/people-search.controller.ts`: `@Controller('people/search')`,
  `@UseGuards(SessionGuard)` na classe, `@Get()` →
  `people.searchToShare(person.organizationId, person.id, q)`. Registrado em
  `people.module.ts`. O `PeopleController` (`AdminGuard`) fica intocado.
- `PeopleService.searchToShare`: termo `trim()` com menos de 2 caracteres →
  `{ data: [], hasMore: false }` sem tocar no banco (mesma razão do termo em
  branco de `search`: o estado normal da tela não vira erro); senão o mesmo
  `findMany` de `search` com `NOT: { id: requesterId }` e o teto
  `PEOPLE_SEARCH_LIMIT` (10). `select` só `id/name/email`.
- Constante `PEOPLE_SHARE_SEARCH_MIN_LENGTH = 2` exportada do serviço.
- Alternativa descartada: 400 para termo curto — o cliente nunca envia (D6), e
  um 400 viraria notificação de erro do interceptor.

### D6 — Chamadas da web (`api-requests`)

- `features/documents/api/search-people-to-share.ts`: `searchPeopleToShare(term)`
  → `api.get('/people/search', { params: { q: term } })`; `queryKey:
  ['people', 'share-search', term]`, `enabled: term.trim().length >= 2`,
  `placeholderData: keepPreviousData`, `staleTime` 30 s. Fica na feature
  (só `documents` usa); **não** reaproveita `hooks/use-people-search.ts`, que
  chama a rota de administração.
- `features/documents/api/share-document.ts`: `shareDocument({ documentId,
  personId })` → `api.put(`/documents/${documentId}/shares/${personId}`, {
  level: 'view' }, { silentError: true })`; `useShareDocument({
  mutationConfig })`. Nada a invalidar nesta fatia (sem lista de acesso; a
  147 invalida a sua chave).
- `silentError: true`: o erro é mostrado no próprio diálogo (R6), sem
  notificação duplicada.
- Sem React Hook Form/Zod: não há formulário de dados, só busca e escolha.

### D7 — Diálogo "Compartilhar" (`features/documents/components/share-document-dialog.tsx`)

- Gatilho: `Button` secundário "Compartilhar" na linha de ações do documento,
  antes da lixeira. Montado por `DocumentView` só com `accessLevel ===
  'owner'` e fora da lixeira.
- Estado local (`client-state`): `term`, `deferredTerm` (debounce de 300 ms
  num `useEffect` com `setTimeout`, como `promote-admin-search.tsx`),
  `selected: PersonSummary | null`. Nada em Zustand nem na URL.
- Com `selected`, o bloco da pessoa escolhida substitui a lista; "Trocar
  pessoa" volta à busca com o termo preservado.
- Duplo clique (`component-robustness`): ref `isSharingRef` + botão
  `disabled` com "Compartilhando…".
- Sucesso: mensagem `aria-live="polite"` dentro do diálogo "Documento
  compartilhado com {nome}." (nome da resposta), `term`/`selected` limpos e
  foco no campo de busca. O diálogo continua aberto (pronto para outra
  pessoa, R4).
- Erro (R6): alerta `role="alert"` no diálogo com a mensagem do servidor
  quando 400/403/409, ou a genérica; `selected` mantido.
- Fechar: botão "Fechar", `Esc` ou clique fora; o `Dialog` devolve o foco ao
  gatilho. Ao reabrir, o diálogo começa limpo.
- Alternativa descartada: página `/documents/:id/share` — o PRD fala em
  diálogo, e página nova seria uma tela principal a mais.

### D8 — Somente leitura na web

- `document-view.tsx`: `const isReadOnly = document.accessLevel === 'view'`.
  Com `isReadOnly` (e fora da lixeira): `<h1>` visível com o título (mesmo
  estilo do ramo da lixeira) no lugar do `DocumentTitleForm`; selo "Somente
  leitura" na linha de ações; sem `SaveIndicator`; `editable={!isTrashed &&
  !isReadOnly}`. `FavoriteButton` continua (favoritar não altera o documento).
- O servidor é a barreira de verdade (R8): a colaboração já conecta
  `readOnly` sem `canWrite` e o `PATCH` já dá 403 para `view`.
- Alternativa descartada: acrescentar `access` à resposta — `accessLevel` já
  existe no contrato com os três valores.

### D9 — Teste de fronteira de `Document` (sem afrouxar)

- Nenhuma regra existente muda. `readableDocumentsWhere` continua com o
  literal `trashedAt: null` (regra 8) e nenhum arquivo novo toca
  `.document.` fora de `access/` e `documents/`.
- **Regra 9 nova**, no mesmo arquivo, com teste de exemplo infrator/conforme
  como as demais: só `access/access.service.ts` (leitura, dentro do
  `findDecision`/`readableDocumentsWhere`) e `documents/shares.service.ts`
  tocam `.documentShare.` ou `"DocumentShare"` cru; `shares.service.ts` chama
  `resolveAccess(`; `documentShare.findUnique` proibido fora de
  `access.service.ts`. Isso **aperta** a fronteira: sem a regra, qualquer
  módulo poderia gravar compartilhamento.

### D10 — API simulada (`api-mocking`)

- `testing/mocks/db.ts`: `MockDocumentShare = { documentId, personId, level:
  'view' }`, `shares: MockDocumentShare[]` no estado; `shareDocument(documentId,
  personId)` (upsert); `searchPeopleToShare(term, requesterId)` sobre
  `allPeople()` (mín. 2, máx. 10, sem quem pede); semente
  `seedSharedReadOnlyDocument()` que cria um documento de outra pessoa com
  `accessLevel: 'view'` para a sessão simulada; chave de desenvolvimento
  `mock-documents=shared-view` em `mocks/index.ts`.
- `handlers/documents.ts`: `PUT ${env.API_URL}/documents/:documentId/shares/:personId`
  com o preâmbulo de sempre (`networkDelay`, `devOverride('documents')`, 401)
  e 404/403/400/200 como D4.
- `handlers/people.ts`: `GET ${env.API_URL}/people/search` (só 401 e 200).

### D11 — Testes

- **API, integração (Postgres real, serviço real)**:
  - `access.integration.test.ts`: dono `owner`; share `VIEW` → `view`,
    `canWrite` falso; sem share → `none`; share + lixeira → `none`, restaurar
    → `view` de novo (R10); `readableDocumentsWhere` inclui o compartilhado e
    exclui na lixeira; apagar a linha da share → `none` na chamada seguinte
    (relido a cada pedido).
  - `shares.integration.test.ts` (novo, HTTP): 200 e linha única; repetir →
    200 e ainda uma linha (R5); para si mesmo → 400; `randomUUID()` e id
    malformado de pessoa → 400; documento alheio sem acesso → 404; pessoa
    com `view` tentando compartilhar → 403; corpo vazio, `level: 'edit'` e
    campo extra → 400; documento na lixeira → 409; sem sessão → 401. Outra
    organização: `share({ …requester, organizationId: randomUUID() }, …)`
    pelo serviço real com pessoa existente → 400 (o singleton de
    `Organization` impede segunda organização).
  - `documents.integration.test.ts`: `GET` do compartilhado → 200 com
    `accessLevel: 'view'`; `PATCH` → 403; `POST trash` → 404; terceira pessoa
    → 404 idêntico ao inexistente; "Meus documentos" da pessoa não lista o
    compartilhado.
  - `collab` (integração existente ampliada): conexão de quem tem `view` é
    `readOnly` e uma atualização enviada não é gravada.
  - `people.integration.test.ts`: `/people/search` sem `AdminGuard` (membro
    comum → 200), exclui quem pede, termo de 1 caractere → vazio, teto 10,
    maiúsculas indiferentes; `searchToShare(randomUUID(), …)` → vazio.
- **API, unitários/contrato**: `access-level`/`levelOf` com os ramos novos;
  `shares.service.test.ts` com Prisma falso (ordem 404→403→409→400);
  `documents.schema.test.ts`; `documents.contract.test.ts` e
  `people.contract.test.ts` com os caminhos exatos; teste de fronteira (D9).
- **Web**: `search-people-to-share.test.tsx` (não chama com 1 caractere,
  chama com 2, `q` no parâmetro); `share-document.test.tsx` (corpo `{ level:
  'view' }`, caminho); `share-document-dialog.test.tsx` (pede mais
  caracteres, "Buscando…", vazio, lista, selecionar, sucesso anunciado e
  busca limpa, erro 400 mantém a pessoa, duplo clique envia uma vez, `Esc`
  devolve o foco ao gatilho); `document-view.test.tsx` (gatilho só para o
  dono; `view` → "Somente leitura", `data-editable="false"`, sem campo de
  título, sem lixeira).
- **e2e** — `apps/web/e2e/tests/share-with-person-view.spec.ts`, API
  simulada. Os e2e existentes usam MSW no navegador com o banco falso **em
  memória da aba**: duas sessões não compartilham estado. Por isso dois
  testes no mesmo arquivo: (1) dono, só teclado: abre "Compartilhar", digita
  1 caractere e vê o pedido de mais, digita o nome, seleciona, compartilha,
  ouve o sucesso; axe com o diálogo aberto; (2) segundo contexto do
  Playwright com `mock-documents=shared-view`: abre o endereço, vê "Somente
  leitura", o editor não aceita digitação e não há "Compartilhar" nem
  lixeira. A jornada entre duas sessões reais fica provada na integração da
  API (acima).

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas: "Linha
de ações do documento", "Botão secundário", "Diálogo de formulário" (caixa,
título, descrição, rodapé), "Campo de formulário", "Resultados de busca",
"Selo de status", "Alerta dentro de formulário", "Carregando", "Erro". Receita
**nova**, acrescentada a "Padrões acrescentados pelas entregas" com a fatia 145:

| Padrão | Classes |
|---|---|
| Selo de somente leitura | receita "Selo de status" com o par `bg-gray-100 text-gray-800`, na "Linha de ações do documento", à esquerda (`mr-auto`) |

### Página do documento — o que muda

- **Proprietário, fora da lixeira**: linha de ações ganha "Compartilhar"
  (secundário, altura ≥ 40px) antes de "Mover para a lixeira".
- **Pode ver**: linha de ações com o selo "Somente leitura" à esquerda e a
  estrela de favorito à direita; título como `<h1>` visível (`text-2xl
  font-bold break-words`) no lugar do campo; sem indicador de salvamento;
  editor não editável.

### Diálogo "Compartilhar"

De cima para baixo: título "Compartilhar documento"; descrição "Quem você
escolher poderá ler “{título}”, sem alterar nada."; campo com rótulo "Buscar
pessoa" e dica "Nome ou e-mail, com pelo menos 2 letras."; área de
resultados; mensagem de sucesso (ao vivo); alerta de erro (só em falha);
rodapé com "Fechar".

Estados da área de resultados (no mesmo lugar):

- **Menos de 2 caracteres**: "Digite pelo menos 2 letras para buscar." (tom
  suave).
- **Carregando**: `role="status"` "Buscando…".
- **Vazio**: "Nenhuma pessoa encontrada." (tom suave, em `role="status"`).
- **Erro da busca**: alerta "Não foi possível buscar pessoas." com botão
  "Tentar de novo".
- **Com dados**: contagem em `role="status"` ("1 resultado." / "{n}
  resultados."), lista com nome (principal, `truncate`) e e-mail (secundário,
  `text-gray-600`, `break-words`) à esquerda e botão `ghost` "Selecionar" à
  direita, com `aria-label` "Selecionar {nome}".
- **Pessoa escolhida** (substitui a lista): nome e e-mail; selo "Pode ver";
  frase "Esta pessoa poderá ler o documento."; botões "Trocar pessoa"
  (secundário) e "Compartilhar" (principal; "Compartilhando…" enquanto envia).

A 360px: caixa `w-[calc(100%-2rem)]`, linha de resultado com `flex-wrap`,
rodapé com `flex-wrap`.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| gatilho | "Compartilhar" | linha de ações |
| selo | "Somente leitura" | linha de ações (pode ver) |
| título do diálogo | "Compartilhar documento" | diálogo |
| descrição | "Quem você escolher poderá ler “{título}”, sem alterar nada." | diálogo |
| rótulo / dica | "Buscar pessoa" / "Nome ou e-mail, com pelo menos 2 letras." | campo |
| termo curto | "Digite pelo menos 2 letras para buscar." | resultados |
| buscando | "Buscando…" | resultados (`role="status"`) |
| vazio | "Nenhuma pessoa encontrada." | resultados |
| contagem | "1 resultado." / "{n} resultados." | resultados |
| falha da busca | "Não foi possível buscar pessoas." + "Tentar de novo" | alerta |
| selecionar | "Selecionar" (`aria-label` "Selecionar {nome}") | item |
| nível | "Pode ver" | selo da pessoa escolhida |
| explicação | "Esta pessoa poderá ler o documento." | pessoa escolhida |
| ações | "Trocar pessoa" / "Compartilhar" / "Compartilhando…" / "Fechar" | diálogo |
| sucesso | "Documento compartilhado com {nome}." | diálogo (`aria-live="polite"`) |
| falha genérica | "Não foi possível compartilhar o documento. Tente de novo." | alerta (`role="alert"`) |
| servidor 400, si mesmo | "Você já é o proprietário deste documento." | corpo da API |
| servidor 400, pessoa | "Pessoa não encontrada nesta instância." | corpo da API |
| servidor 400, corpo | "Dados inválidos." + "Escolha o nível de acesso." / "Campo não permitido." | corpo da API |
| servidor 403 | "Só o proprietário pode compartilhar este documento." | corpo da API |
| servidor 404 | "Documento não encontrado." (já existe) | corpo da API |

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `PUT …/shares/{personId}`, `GET /people/search`, `ShareDocumentInput`, `DocumentShareResponse` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script | — |
| criar | `apps/api/prisma/migrations/0015_document_share/migration.sql` | enum, tabela, índice, FKs (D2) | — |
| alterar | `apps/api/prisma/schema.prisma` | `ShareLevel`, `DocumentShare`, relações (D2) | — |
| alterar | `apps/api/src/access/access.service.ts` | `findDecision` com share, `levelOf`, `readableDocumentsWhere` (D3) | `authorization` |
| alterar | `apps/api/src/documents/documents.schema.ts` | `shareDocumentSchema` (D4) | — |
| criar | `apps/api/src/documents/shares.service.ts` | `share` (D4) | `authorization`, `security` |
| alterar | `apps/api/src/documents/documents.controller.ts` | `@Put(':documentId/shares/:personId')` (D1, D4) | `security` |
| alterar | `apps/api/src/documents/documents.module.ts` | provê `SharesService` | — |
| alterar | `apps/api/src/people/people.service.ts` | `searchToShare` (D5) | `security` |
| criar | `apps/api/src/people/people-search.controller.ts` | `GET /people/search` com `SessionGuard` (D5) | `security` |
| alterar | `apps/api/src/people/people.module.ts` | registra o controller | — |
| alterar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | regra 9 (D9) | `unit-testing` |
| alterar | `apps/api/src/access/__tests__/access.integration.test.ts` | D11 | `integration-testing` |
| alterar | `apps/api/src/access/__tests__/access-level.test.ts` | D11 | `unit-testing` |
| criar | `apps/api/src/documents/__tests__/shares.integration.test.ts` | D11 | `integration-testing` |
| criar | `apps/api/src/documents/__tests__/shares.service.test.ts` | D11 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | D11 | `integration-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.schema.test.ts` | D11 | `unit-testing` |
| alterar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | D11 | `integration-testing` |
| alterar | `apps/api/src/collab/__tests__/` (integração existente) | `view` conecta `readOnly` e não grava (D11) | `integration-testing` |
| alterar | `apps/api/src/people/__tests__/people.integration.test.ts` | D11 | `integration-testing` |
| alterar | `apps/api/src/people/__tests__/people.service.test.ts` | D11 | `unit-testing` |
| alterar | `apps/api/src/people/__tests__/people.contract.test.ts` | D11 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/src/features/documents/api/search-people-to-share.ts` | D6 | `api-requests` |
| criar | `apps/web/src/features/documents/api/share-document.ts` | D6 | `api-requests`, `error-handling` |
| criar | `apps/web/src/features/documents/components/share-document-dialog.tsx` | D7 | `interface-design`, `client-state`, `component-robustness` |
| alterar | `apps/web/src/features/documents/components/document-view.tsx` | gatilho só do dono; somente leitura (D8) | `interface-design`, `authorization` |
| alterar | `apps/web/src/testing/mocks/db.ts` | shares, busca, semente `shared-view` (D10) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/index.ts` | chave `mock-documents=shared-view` (D10) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/documents.ts` | `PUT …/shares/:personId` (D10) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/people.ts` | `GET /people/search` (D10) | `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/search-people-to-share.test.tsx` | D11 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/documents/api/__tests__/share-document.test.tsx` | D11 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/documents/components/__tests__/share-document-dialog.test.tsx` | D11 | `component-testing` |
| alterar | `apps/web/src/features/documents/components/__tests__/document-view.test.tsx` | D11 | `component-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/share-with-person-view.spec.ts` | D11 | `e2e-testing` |
| alterar | `docs/design.md` | receita "Selo de somente leitura" | `interface-design` |
| alterar | `docs/architecture.md` | §"access": compartilhamento direto implementado (`DocumentShare`, ordem dono → lixeira → share → `none`), regra 9 da fronteira, `/people/search` sem `AdminGuard` | — |

Intocados de propósito: `apps/api/src/collab/collab.service.ts`,
`access-level.ts`, `PeopleController` e `hooks/use-people-search.ts` (rota de
administração), `favorites.service.ts`, `trashedDocumentsWhere`,
`components/ui/**`, migrations `0001`–`0014`.

## Estimativa de tamanho

Jornadas: 1 (o dono compartilha para leitura; abrir somente leitura é o
resultado da mesma jornada visto por quem recebe) · Telas novas: 0 (um
diálogo na página do documento) · Fases: 3 · Linhas alteradas sem testes e sem
gerado: ~430 (YAML ~80, migration + schema ~30, `access` ~20, `shares.service`
+ schema + controller + módulo ~75, busca de pessoas ~40; web: chamadas ~60,
diálogo ~150, `document-view` ~20; mocks ~55; docs ~15). Sem YAML e mocks:
~300 de código de produção.

Sinais de "grande demais": nenhum dispara de forma clara; linhas no limite
(~430 contando YAML e mocks, como na 140). Se estourar na execução, o corte é
tirar a busca (`/people/search` + campo) e compartilhar por e-mail exato —
não recomendado, porque R2/R3 são o caminho do usuário.

## Riscos

- `findDecision` passa a filtrar a share por `personId`: a assinatura privada
  muda (`findDecision(documentId, personId)`) e todos os chamadores internos
  (`resolveAccess`, `canWrite`) precisam passar a pessoa. O PLAN deve prová-lo
  na integração do `access`, não só no unitário.
- A porta `readableDocumentsWhere` agora inclui documentos de terceiros: todo
  leitor dela que presumia "só do dono" precisa ser conferido. Conferido:
  `listMine` já faz `AND ownerId`; `get` e `favorites` devem mesmo aceitar o
  compartilhado. Um leitor novo fora dessa lista é bug.
- e2e com API simulada não prova duas sessões reais; a prova fica na
  integração da API com Postgres. Se o dono quiser o e2e contra a API real,
  é infraestrutura nova de e2e, fora deste tamanho.
- O enum do banco já tem `EDIT` sem uso nesta fatia: um `upsert` errado com
  `EDIT` passaria no banco; o schema Zod (`z.literal('view')`) e o teste de
  corpo `level: 'edit'` → 400 são a trava.

## Dívida encontrada

- **"Pessoa inativa" não existe no modelo**: `Person` não tem campo de
  ativo/inativo nem de saída da instância. Nesta fatia, "saiu da instância" se
  reduz a "não existe ou é de outra organização" (400); a exclusão de pessoa,
  quando existir, apaga a share por cascade. Se a instância ganhar
  desativação, `searchToShare`, `SharesService` e `levelOf` precisam filtrar
  por ela (o PRD da 145 assume que ela existe).
- Duas buscas de pessoas quase iguais (`search` de administração e
  `searchToShare`) no mesmo serviço, e dois hooks na web
  (`hooks/use-people-search.ts` e `features/documents/api/search-people-to-share.ts`);
  unificar quando a administração puder usar a rota sem `AdminGuard` sem
  perder `hasMore`.
- O filtro por `organizationId` só é provado com `randomUUID()` no serviço
  real — `Organization.singleton` impede segunda organização no banco.
- O banco falso da web vive na memória da aba: nenhuma jornada entre duas
  pessoas é testável em e2e hoje (vale também para a 147/148/019).
