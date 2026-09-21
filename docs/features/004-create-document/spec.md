# SPEC 004 — create-document

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Parte de `docs/architecture.md` §2 (contrato primeiro), §3 (decisão
de acesso: caminho único), §6 (sessão) e §7 (testes). A branch sai de
`feature/003-login-logout` (§9, entregas empilhadas).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `NewDocumentButton` (feature `documents`), colocado na barra lateral pelo slot novo `sidebarActions` do `AppLayout`. Chama `POST /api/documents` (sem corpo), que cria "Sem título" no espaço pessoal de quem chama, e navega para `paths.document.getHref(id)`. Clique duplo não cria dois (D11). |
| R2 | `Document.ownerId` = quem criou; `AccessService` só conhece o proprietário nesta fatia (D3). `isAdmin` e a lotação não entram na regra. Provado por integração contra Postgres: pessoa B (inclusive administradora) não lê, não lista e não renomeia o documento da pessoa A. |
| R3 | `GET /api/documents?scope=mine` devolve `updatedAt desc`, limite 100. `SidebarDocuments` mostra os 8 primeiros; a página `/my-documents` mostra todos com `DocumentsList`. Os dois leem a mesma query (um só pedido à API) e mostram a data com `formatDateTime` dentro de `<time>`. |
| R4 | `DocumentsList` e `SidebarDocuments` tratam, nesta ordem: carregando, erro (com "Tentar novamente"), vazio, dados (skill `error-handling`). |
| R5 | `DocumentTitleForm`: campo "Título" num `<form>`; Enter envia o formulário, e sair do campo chama `form.requestSubmit()` — um caminho só de salvamento (D10). `PATCH /api/documents/{id}`. |
| R6 | Schema da API: `trim()`, `max(200)`, vazio vira "Sem título" (D6). O campo tem `maxLength={200}`; depois de salvar, o formulário é reposto com o título que a API devolveu. |
| R7 | `DocumentView` mostra, abaixo do título, o aviso literal da seção Interface. |
| R8 | API: `404 { message: "Documento não encontrado." }` idêntico para inexistente, de outra pessoa e id malformado (D5). Web: o interceptor converte 404 em `NotFoundError`; `DocumentView` mostra "Documento não encontrado" (D9). |
| R9 | Módulo `access` com as duas portas (D3); teste estrutural reprova consulta a `document` fora do caminho (D4); toda decisão de acesso é do servidor — a web não filtra nada. |
| R10 | Textos literais na seção Interface. Botão é `Button`; itens são `<Link>`; o título é um `<input>` com `<label>`; e2e com axe nas três telas e criação pelo teclado. |

## Decisões técnicas

### D1 — Modelo `Document` e migration escrita à mão

- Escolha: em `apps/api/prisma/schema.prisma`,
  `Document { id String @id @default(uuid()); title String; spaceId; authorId; ownerId; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt }`,
  com relações para `Space`, `Person` (`"DocumentAuthor"`) e `Person` (`"DocumentOwner"`), todas `onDelete: Restrict`, e índices `@@index([ownerId, updatedAt(sort: Desc)])` e `@@index([spaceId])`. `authorId` nunca é escrito depois do `create` (nenhum `update` o inclui; teste de integração confere que renomear não o muda). Sem conteúdo (005), favorito (006) ou lixeira (007).
  A migration `0003_document/migration.sql` é **escrita à mão** no estilo das `0001`/`0002` e aplicada por `prisma migrate deploy` (o `global-setup` dos testes já faz isso no banco de teste). Conferência: `prisma validate` e `prisma migrate status`. Ninguém roda `prisma migrate diff`, `migrate reset` nem `migrate dev` contra os bancos.
- Alternativa descartada: `prisma migrate dev --create-only` — motivo: usa banco sombra e pode propor reset do banco de desenvolvimento (lição das fatias anteriores).
- Alternativa descartada: `onDelete: Cascade` a partir de `Person` — motivo: apagar pessoa não pode apagar documento em silêncio; o destino dos documentos de quem sai é fatia própria.

### D2 — Contrato primeiro: quatro operações em `/documents`

- Escolha: `packages/api-contract/openapi.yaml` ganha, todas com `401 Error` (sem sessão):
  - `POST /documents` (`createDocument`), sem corpo → `201 DocumentResponse`; `403 Error` (sem `X-Requested-With`).
  - `GET /documents` (`getDocuments`), query `scope` obrigatória, enum `[mine]` → `200 DocumentsResponse`; `400 ValidationError` para `scope` ausente ou desconhecido.
  - `GET /documents/{documentId}` (`getDocument`) → `200 DocumentResponse`; `404 Error`.
  - `PATCH /documents/{documentId}` (`updateDocument`), corpo `UpdateDocumentBody { title: string }` → `200 DocumentResponse`; `400 ValidationError`; `403 Error`; `404 Error`.
  Schemas: `AccessLevel` (enum `owner | edit | view`), `Document { id, title, spaceId, authorId, ownerId, createdAt, updatedAt, accessLevel }`, `DocumentSummary { id, title, updatedAt }`, `DocumentResponse { data: Document }`, `DocumentsResponse { data: DocumentSummary[] }`. O parâmetro `documentId` é `string` **sem** `format: uuid` (D5). Tipos regenerados pelo script do pacote; `apps/web/src/types/api.ts` exporta os novos.
- Alternativa descartada: `scope` opcional com padrão `mine` — motivo: as próximas listas (favoritos, espaço, lixeira) entram como novos valores; padrão implícito esconde erro de chamada.
- Alternativa descartada: omitir `accessLevel` até existir compartilhamento — motivo: o campo custa uma linha agora e evita mudar o contrato de `GET /documents/{id}` quando a web precisar bloquear edição. Nesta fatia a web **não** ramifica por ele (só existe `owner`).

### D3 — Módulo `access`: duas portas, assinatura definitiva

- Escolha: `apps/api/src/access/` com
  - `access-level.ts`: `type AccessLevel = 'owner' | 'edit' | 'view' | 'none'` e `canEdit(level)` (`owner` ou `edit`);
  - `AccessService.resolveAccess(personId: string, documentId: string): Promise<AccessLevel>` — id que não é UUID devolve `none` sem consultar; senão lê `ownerId` do documento: dono → `owner`; qualquer outro caso → `none`;
  - `AccessService.readableDocumentsWhere(personId: string): Prisma.DocumentWhereInput` — hoje `{ ownerId: personId }`;
  - `AccessModule` exporta o serviço.
  A equivalência das duas portas é provada por teste de integração: para cada par (pessoa, documento) do cenário, `resolveAccess !== 'none'` se e só se o documento aparece em `findMany({ where: readableDocumentsWhere(pessoa) })`.
- Alternativa descartada: `readableDocumentsWhere` devolvendo SQL cru (`Prisma.sql`) — motivo: nada nesta fatia exige SQL cru; quando a árvore de unidades (§4) entrar, o corpo muda sem mudar quem chama, desde que todos passem pela porta.
- Alternativa descartada: a regra dentro de `DocumentsService` — motivo: é exatamente o que a §3 proíbe; pesquisa, IA e colaboração vão perguntar ao mesmo lugar.

### D4 — Teste estrutural do caminho único

- Escolha: `apps/api/src/access/__tests__/document-access-boundary.test.ts` varre `apps/api/src/**/*.ts` (fora `__tests__/`) e reprova:
  1. qualquer ocorrência de `/\.document\s*\./` ou de `"Document"` dentro de `$queryRaw`/`$executeRaw` em arquivo fora de `src/access/` e `src/documents/`;
  2. em `src/documents/`, qualquer `.document.findUnique(`; e qualquer `.document.(findMany|findFirst|count|aggregate|groupBy)(` cuja chamada (até o parêntese que a fecha) não contenha `readableDocumentsWhere(`;
  3. em `src/documents/`, `.document.(update|updateMany|delete|deleteMany)(` fora de `documents.service.ts`.
  O teste traz casos próprios com texto de exemplo (um infrator e um conforme por regra) para provar que a expressão pega o que diz pegar. Escritas em `documents.service.ts` vêm sempre depois de `resolveAccess` — isso é provado pelos testes de integração, não pela varredura.
- Alternativa descartada: regra de ESLint `no-restricted-syntax` — motivo: não enxerga "a chamada contém a porta"; e um teste falha com mensagem que aponta arquivo e linha.
- Alternativa descartada: extensão do Prisma Client que injeta o filtro — motivo: esconde a regra e quebra o `resolveAccess`, que precisa do nível e não só de "pode ler".

### D5 — 404 único: inexistente, sem acesso e id malformado

- Escolha: `apps/api/src/documents/document-not-found.ts` exporta `documentNotFound()`, que devolve `new NotFoundException('Documento não encontrado.')`. É a **única** origem de 404 do módulo. `DocumentsService.get` e `.rename` fazem: `resolveAccess` → `none` → `documentNotFound()`. Id malformado cai em `none` (D3), nunca em 400. A leitura do documento é `findFirst({ where: { AND: [{ id }, readableDocumentsWhere(personId)] } })`; `null` (corrida) → o mesmo 404. No `PATCH`, a ordem é: CSRF → sessão → acesso (404) → nível `view` → `403 "Você não tem permissão para editar este documento."` → corpo (400) → gravação. O acesso vem **antes** da validação do corpo, para um corpo inválido não revelar que o documento existe.
  Integração compara status **e** corpo (`toEqual`) das três situações, no `GET` e no `PATCH`.
- Alternativa descartada: 400 para id malformado — motivo: distingue "endereço impossível" de "endereço de outra pessoa"; o PRD (R8) pede resposta sem sinal.
- Observação: o ramo `view → 403` é inalcançável com dados reais nesta fatia; é coberto por teste unitário de `DocumentsService` com `AccessService` substituído.

### D6 — Regra do título num schema só

- Escolha: `apps/api/src/documents/documents.schema.ts`: `DEFAULT_DOCUMENT_TITLE = 'Sem título'`, `TITLE_MAX_LENGTH = 200`, `updateDocumentSchema = z.object({ title: z.string({ error: 'Informe o título.' }).trim().max(200, 'O título pode ter no máximo 200 caracteres.').transform((v) => v === '' ? DEFAULT_DOCUMENT_TITLE : v) })` e `listDocumentsQuerySchema = z.object({ scope: z.enum(['mine'], { error: 'Informe um escopo válido.' }) })`. Os dois passam por `parseBody` (já existe; serve para qualquer objeto). Na web, `updateDocumentInputSchema` tem as mesmas regras e mensagens, **sem** a transformação: quem decide o "Sem título" é a API, e a tela mostra o que ela devolveu.
- Alternativa descartada: a web trocar vazio por "Sem título" antes de enviar — motivo: duas fontes da mesma regra; o mock e a API real divergiriam.

### D7 — Criação no espaço pessoal, com autocorreção

- Escolha: `DocumentsService.create(person)` faz `space.upsert({ where: { personId }, create: { type: 'PERSONAL', personId }, update: {} })` e cria o documento com `authorId = ownerId = person.id`, numa transação. A instalação já cria o espaço pessoal; o `upsert` cobre pessoa criada por outro caminho (testes de integração hoje, convites na 009).
- Alternativa descartada: 500 quando o espaço pessoal falta — motivo: a pessoa ficaria sem conseguir criar documento por um defeito que o sistema sabe consertar.

### D8 — Listagem: `scope=mine` compõe a porta com o filtro de dono

- Escolha: `findMany({ where: { AND: [readableDocumentsWhere(personId), { ownerId: personId }] }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 100, select: { id, title, updatedAt } })`. Hoje os dois filtros coincidem; quando houver compartilhamento, "meus" continua sendo "de que sou dono", e a porta continua garantindo a leitura.
- Alternativa descartada: só `{ ownerId }` — motivo: reprova no teste estrutural (D4) e abre precedente de lista fora da porta.
- Limite 100 sem paginação: fora de escopo do PRD; vira dívida quando alguém passar de 100.

### D9 — Web: 404 vira `NotFoundError`; leitura do documento é silenciosa

- Escolha: `apps/web/src/lib/errors.ts` ganha `NotFoundError` e `isNotFoundError`; o interceptor de `api-client.ts`, em 404, notifica (respeitando `silentError`) e rejeita com `NotFoundError`. `getDocument` usa `silentError: true`: a página já mostra o estado certo no lugar do conteúdo ("Documento não encontrado" ou o erro com "Tentar novamente"), e um aviso flutuante diria o mesmo duas vezes — mesmo raciocínio já usado em `create-installation.ts`. As demais chamadas (lista, criar, renomear) mantêm a notificação do interceptor.
- Alternativa descartada: `isAxiosError(error) && error.response?.status === 404` dentro do componente — motivo: a skill `error-handling` pede classe de domínio com type guard; status HTTP não aparece em componente.
- Sem `clientLoader`: o `router.tsx` atual não entrega `queryClient` às rotas (`lazy` direto, export `Component`). Seguimos a convenção que existe; o desvio em relação à skill `routing` está em "Dívida encontrada".

### D10 — Título editável: formulário com um caminho de salvamento

- Escolha: `DocumentTitleForm` usa `Form` + `Input` existentes com `updateDocumentInputSchema`, `defaultValues: { title: document.title }`. Enter envia o `<form>`; `onBlur` do campo chama `event.currentTarget.form?.requestSubmit()`. O `onSubmit` sai cedo se `mutation.isPending` ou se `values.title` (já aparado) for igual ao título salvo — assim Enter seguido de Tab não grava duas vezes. No sucesso: `form.reset({ title: response.data.title })` (é aqui que o vazio aparece como "Sem título"). `useUpdateDocument` faz `setQueryData` no documento e invalida a lista. A rota passa `key={documentId}` ao `DocumentView` (skill `component-robustness` §7). Falha: o interceptor notifica e o formulário mostra o alerta próprio; o texto digitado fica no campo.
  O `<h1>` da página é o título salvo, **só para leitor de tela** (`sr-only`); o campo visível leva o estilo de título. Receita nova "Título editável" no `docs/design.md`.
- Alternativa descartada: `<h1 contentEditable>` — motivo: sem `<label>`, sem `maxLength`, colagem traz HTML; acessibilidade pior.
- Alternativa descartada: salvar a cada tecla com debounce — motivo: o PRD pede salvar ao sair do campo ou no Enter; salvamento contínuo chega com o editor (005).

### D11 — "Novo documento": sem clique duplo, navegação na feature

- Escolha: `NewDocumentButton` usa `Button` com `isLoading={mutation.isPending}`, texto "Criando…" durante o envio, e retorno antecipado no manipulador se `isPending`. No sucesso, `useCreateDocument` grava o documento no cache (`setQueryData` com a key de `getDocumentQueryOptions(id)`) e invalida a lista; o componente navega com `useNavigate()` + `paths.document.getHref(id)` (`paths` é compartilhado; a skill `routing` permite).
- Alternativa descartada: só `disabled` — motivo: o segundo clique pode chegar antes da re-renderização (`component-robustness` §9).

### D12 — Barra lateral por slots; o layout não conhece a feature

- Escolha: `AppLayout` ganha duas props opcionais `ReactNode`: `sidebarActions` (acima da navegação principal, dentro do painel recolhível) e `sidebarSection` (abaixo da navegação, acima do `sidebarFooter`). `root.tsx` passa `<NewDocumentButton />` e `<SidebarDocuments />`. `AppLayout` continua sem importar nada de `features/`.
- Consequência conhecida: o botão entra na ordem do Tab antes de "Favoritos"; o caso de teclado de `e2e/tests/open-app.spec.ts` ganha um `Tab` a mais.
- Alternativa descartada: `AppLayout` importar os componentes da feature — motivo: proibido pela direção dos imports.

### D13 — API simulada: documentos no banco fake escrito à mão

- Escolha: `db.ts` ganha `documents: MockDocument[]` no estado (vazio no seed padrão — o e2e existente espera a área vazia) e `seedSampleDocuments()` com dados pt_BR variados: título de 200 caracteres sem espaço, "Sem título", data antiga. Chave de desenvolvimento nova `mock-documents=sample`, lida em `mocks/index.ts` e documentada em `utils.ts`. `handlers/documents.ts` repete o contrato: 401 sem cookie, 201 na criação, 404 com o mesmo corpo para id desconhecido, `trim`/vazio/200 no `PATCH`, lista por `updatedAt desc` com limite 100, `devOverride('documents')`. Ids com `crypto.randomUUID()`.
- Alternativa descartada: `@mswjs/data`, como sugere a skill `api-mocking` — motivo: o banco fake do projeto já é escrito à mão (decisão da 002); trocar de abordagem no meio é refatoração, não esta fatia. Fica registrada em "Dívida encontrada".

### D14 — Segunda pessoa nos testes de integração

- Escolha: `apps/api/test/create-person.ts` exporta `createPersonWithSession(app, { name, email, isAdmin? })`: cria `Person` (na organização existente) e o `Space` pessoal direto pelo Prisma, abre sessão com `SessionService.create` e devolve `{ person, cookie }`. `passwordHash` recebe `randomUUID()` — não é hash válido, então essa pessoa não entra por senha, e nenhum literal com cara de credencial vai para o repositório. `reset-database.ts` inclui `"Document"` no `TRUNCATE`.
- Alternativa descartada: endpoint de convite provisório — motivo: convites são a fatia 009.

### D15 — Lições das fatias anteriores, como regra desta SPEC

- `React.JSX.Element` em todo componente; nunca o `JSX` global. `ref` como prop comum.
- Todo botão é o `Button` de `components/ui/button` (inclusive "Tentar novamente"; o de erro usa `className` com `bg-red-600 hover:bg-red-700 focus-visible:outline-red-600`).
- Cobertura ≥ 80% **por arquivo** novo ou alterado; nenhum aviso em lint, tipos (todos os `tsconfig`) e console dos testes.
- Nenhum literal com cara de senha ou token; o que precisar é montado em execução (`randomUUID()`, constantes de `mocks/utils.ts`).
- Critério de "arquivo intocado" no PLAN compara com `feature/003-login-logout` (base real da branch), não com `develop`.
- Nada de `prisma migrate diff|reset|dev` contra os bancos (D1).

## Interface

Receitas do `docs/design.md` usadas: contêiner de página, título de página, texto de apoio, lista, carregando, vazio, erro, botão principal, link de navegação, item da barra lateral, campo de formulário, alerta dentro de formulário.

Receitas novas (acrescentadas ao `docs/design.md`, coluna Fatia = 004):

| Padrão | Classes |
|---|---|
| Título editável | rótulo da receita "Campo de formulário"; campo com `h-12 text-2xl font-bold` no lugar de `h-10 text-sm` |
| Seção da barra lateral | contêiner `px-4 pb-4`; cabeçalho `<h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">`; lista `mt-2 space-y-1`; item = receita "Item da barra lateral" com título `block truncate` e data `block text-xs font-normal text-gray-600`; estados em `px-3 text-sm` (carregando/vazio `text-gray-600`, erro `text-red-800`) |
| Data em lista | `<time className="shrink-0 text-sm text-gray-600">` |
| Aviso informativo | `<p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">` |

Formato de data: `formatDateTime` → `Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })` (ex.: "21/09/2026, 14:32"), sempre dentro de `<time dateTime={iso}>`.

### Barra lateral

De cima para baixo, dentro do painel: botão "Novo documento" (largura total, `p-4`) → navegação principal (como hoje) → seção "Meus documentos" → rodapé (identidade e conexão, como hoje).

- Botão: **"Novo documento"**; durante o envio **"Criando…"**, desabilitado, `aria-busy`.
- Seção: `<nav aria-label="Meus documentos recentes">` com cabeçalho **"Meus documentos"**.
  - Carregando (`role="status"`): **"Carregando documentos…"**
  - Erro (`role="alert"`): **"Não foi possível carregar seus documentos."** + `Button` secundário **"Tentar novamente"**
  - Vazio: **"Nenhum documento ainda."**
  - Com dados: até 8 itens, cada um `<Link>` para o documento, com título (truncado, `title` com o texto inteiro) e a data abaixo. `aria-current="page"` no documento aberto (`NavLink`). Com mais de 8: link **"Ver todos"** para `/my-documents`.

### Página "Meus documentos" (`/my-documents`, já existe)

`ContentLayout` com título **"Meus documentos"** e a descrição atual (**"Os documentos que você cria ficam aqui, visíveis só para você até serem compartilhados."**). O parágrafo vazio fixo sai; entra `DocumentsList`:

- Carregando: **"Carregando documentos…"**
- Erro: **"Não foi possível carregar seus documentos."** + botão de erro **"Tentar novamente"**
- Vazio (texto atual, mantido): **"Nenhum documento ainda. Os documentos que você criar aparecem aqui."**
- Com dados: receita de lista; em cada item, `<Link>` com o título à esquerda (`min-w-0 truncate`, `title` com o texto inteiro, receita de link de navegação) e a data à direita.

### Página do documento (`/documents/:documentId`, nova)

`<main id="main-content">` com a receita de contêiner de página. Um estado por vez:

- Carregando: `<h1>` **"Documento"** + **"Carregando documento…"**
- Não encontrado (404): `<h1>` **"Documento não encontrado"**; apoio **"Este documento não existe ou você não tem acesso a ele."**; link **"Ir para Meus documentos"** (`paths.myDocuments.getHref()`). Sem `role="alert"` vermelho: é destino errado, não falha.
- Erro (qualquer outra falha): `<h1>` **"Documento"** + receita de erro **"Não foi possível carregar o documento."** + **"Tentar novamente"**
- Com dados: `<h1 className="sr-only">` com o título salvo; campo **"Título"** (receita "Título editável", `maxLength={200}`, `autoComplete="off"`); mensagem de validação **"O título pode ter no máximo 200 caracteres."**; alerta de falha ao salvar (receita "Alerta dentro de formulário"): **"Não foi possível salvar o título. Tente de novo."**; abaixo, aviso informativo: **"O editor de conteúdo chega em uma próxima entrega. Por enquanto, você pode dar um título ao documento."**

Título padrão em todo lugar: **"Sem título"**.

## Arquivos

### Fase 1 — contrato e API

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | quatro operações e schemas de D2 | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script do pacote | — |
| alterar | `apps/api/prisma/schema.prisma` | modelo `Document`; relações inversas em `Space` e `Person` | — |
| criar | `apps/api/prisma/migrations/0003_document/migration.sql` | tabela, FKs e índices (D1) | — |
| criar | `apps/api/src/access/access-level.ts` | `AccessLevel`, `canEdit` | — |
| criar | `apps/api/src/access/access.service.ts` | `resolveAccess`, `readableDocumentsWhere` | `security` |
| criar | `apps/api/src/access/access.module.ts` | exporta `AccessService` | — |
| criar | `apps/api/src/access/__tests__/access-level.test.ts` | `canEdit` por nível | `unit-testing` |
| criar | `apps/api/src/access/__tests__/access.integration.test.ts` | dono/estranho/administrador/id malformado; equivalência das duas portas (D3) | — |
| criar | `apps/api/src/access/__tests__/document-access-boundary.test.ts` | teste estrutural (D4) | — |
| criar | `apps/api/src/documents/documents.schema.ts` | schemas e constantes (D6) | — |
| criar | `apps/api/src/documents/document-not-found.ts` | origem única do 404 (D5) | — |
| criar | `apps/api/src/documents/documents.service.ts` | `create`, `listMine`, `get`, `rename` | `security` |
| criar | `apps/api/src/documents/documents.controller.ts` | quatro rotas, `@UseGuards(SessionGuard)` na classe, `@HttpCode(201)` no `POST` | — |
| criar | `apps/api/src/documents/documents.module.ts` | importa `AuthModule` e `AccessModule` | — |
| criar | `apps/api/src/documents/__tests__/documents.schema.test.ts` | trim, vazio, 200/201 caracteres, `scope` | `unit-testing` |
| criar | `apps/api/src/documents/__tests__/documents.service.test.ts` | ramo `view → 403` com `AccessService` substituído (D5) | `unit-testing` |
| criar | `apps/api/src/documents/__tests__/documents.integration.test.ts` | criar; listar por `updatedAt desc` e limite; renomear; `authorId` não muda; B não lê/lista/renomeia A; 404 idênticos (`toEqual`) nos três casos; 401 sem sessão; 403 sem `X-Requested-With`; `upsert` do espaço | — |
| criar | `apps/api/src/documents/__tests__/documents.contract.test.ts` | 201, 200, 400, 401, 404 contra o contrato | — |
| alterar | `apps/api/src/app.module.ts` | registra `AccessModule` e `DocumentsModule` | — |
| criar | `apps/api/test/create-person.ts` | `createPersonWithSession` (D14) | — |
| alterar | `apps/api/test/reset-database.ts` | `"Document"` no `TRUNCATE` | — |

### Fase 2 — web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/types/api.ts` | exporta `Document`, `DocumentSummary`, `DocumentResponse`, `DocumentsResponse`, `UpdateDocumentBody`, `AccessLevel` | `api-requests` |
| alterar | `apps/web/src/lib/errors.ts` | `NotFoundError`, `isNotFoundError` | `error-handling` |
| alterar | `apps/web/src/lib/api-client.ts` | 404 rejeita com `NotFoundError` (D9) | `api-client`, `error-handling` |
| alterar | `apps/web/src/lib/__tests__/api-client.test.ts` | 404 com e sem `silentError` | `unit-testing` |
| alterar | `apps/web/src/config/paths.ts` | `document: { path: '/documents/:documentId', getHref(documentId) }` | `routing` |
| criar | `apps/web/src/utils/format-date-time.ts` + `__tests__/format-date-time.test.ts` | data pt_BR | `unit-testing` |
| criar | `apps/web/src/features/documents/api/get-documents.ts` | fetcher, `getDocumentsQueryOptions()` (key `['documents', { scope: 'mine' }]`), `useDocuments` | `api-requests` |
| criar | `apps/web/src/features/documents/api/get-document.ts` | fetcher silencioso, `getDocumentQueryOptions(id)` (key `['documents', id]`), `useDocument` | `api-requests`, `error-handling` |
| criar | `apps/web/src/features/documents/api/create-document.ts` | `useCreateDocument`: `setQueryData` do item + invalida a lista | `api-requests` |
| criar | `apps/web/src/features/documents/api/update-document.ts` | `updateDocumentInputSchema`, `useUpdateDocument`: `setQueryData` do item + invalida a lista | `api-requests`, `forms` |
| criar | `apps/web/src/features/documents/api/__tests__/*.test.ts(x)` | um por operação: resposta, keys e invalidação | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/documents/components/new-document-button.tsx` | D11 | `component-robustness`, `ui-components`, `routing` |
| criar | `apps/web/src/features/documents/components/documents-list.tsx` | quatro estados, truncate, `<time>` | `interface-design`, `error-handling`, `component-robustness` |
| criar | `apps/web/src/features/documents/components/sidebar-documents.tsx` | 8 itens, "Ver todos", quatro estados | `interface-design`, `error-handling`, `component-robustness` |
| criar | `apps/web/src/features/documents/components/document-view.tsx` | carregando / não encontrado / erro / dados + aviso do editor | `interface-design`, `error-handling` |
| criar | `apps/web/src/features/documents/components/document-title-form.tsx` | D10 | `forms`, `component-robustness` |
| criar | `apps/web/src/features/documents/components/__tests__/*.test.tsx` | um por componente: estados; clique duplo cria um só; título de 200 caracteres; Enter e blur salvam uma vez; vazio volta "Sem título"; falha mantém o texto e mostra o alerta | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/components/layouts/app-layout.tsx` + `__tests__/app-layout.test.tsx` | slots `sidebarActions` e `sidebarSection` (D12) | `project-structure`, `interface-design` |
| alterar | `apps/web/src/app/routes/app/root.tsx` + `__tests__/root.test.tsx` | preenche os dois slots | `project-structure` |
| alterar | `apps/web/src/app/routes/app/my-documents.tsx` | troca o vazio fixo por `DocumentsList` | `routing`, `interface-design` |
| alterar | `apps/web/src/app/routes/app/__tests__/empty-areas.test.tsx` | tira "Meus documentos" do conjunto de áreas vazias fixas | `integration-testing` |
| criar | `apps/web/src/app/routes/app/__tests__/my-documents.test.tsx` | jornada: vazio → criar pela barra → renomear → aparece na lista; erro 500 com nova tentativa | `integration-testing`, `api-mocking` |
| criar | `apps/web/src/app/routes/app/document.tsx` + `__tests__/document.test.tsx` | `export function Component`; `useParams<{ documentId: string }>()`; `<DocumentView key={documentId} />`; 404 mostra "Documento não encontrado" | `routing`, `integration-testing` |
| alterar | `apps/web/src/app/router.tsx` + `__tests__/router.test.tsx` | rota `lazy` filha do `Root` | `routing`, `performance` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `documents`, `MockDocument`, `seedSampleDocuments` (D13) | `api-mocking` |
| criar | `apps/web/src/testing/mocks/handlers/documents.ts` | quatro handlers (D13) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/index.ts` | registra `documentsHandlers` | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/index.ts`, `apps/web/src/testing/mocks/utils.ts` | chave `mock-documents=sample` e a documentação dela | `api-mocking` |
| alterar | `eslint.config.js` | zona `./apps/web/src/features/documents` em `import/no-restricted-paths` | `project-structure` |

### Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/create-document.spec.ts` | jornada: "Novo documento" (pelo teclado) → página com "Sem título" e o aviso → renomear com Enter → o nome aparece na barra lateral → link "Meus documentos" → o nome está na lista → abre pela lista. Segundo caso: `/documents/<uuid desconhecido>` mostra "Documento não encontrado". axe na página do documento, na lista e no não encontrado. Navega só por links depois de criar (o banco fake volta ao seed na recarga). | `e2e-testing` |
| alterar | `apps/web/e2e/tests/open-app.spec.ts` | um `Tab` a mais antes de "Favoritos" (D12); confere o botão "Novo documento" | `e2e-testing` |
| alterar | `docs/design.md` | quatro receitas novas | `interface-design` |
| alterar | `docs/architecture.md` | §3: assinatura final das portas, 404 único com id malformado, ordem do `PATCH`, teste estrutural | — |
| alterar | `docs/roadmap.md` | itens de "Dívida encontrada"; estado da 004 | — |

## Estimativa de tamanho

Jornadas: 1 (criar → renomear → achar na lista) · Telas novas: 1 (página do documento; "Meus documentos" já existe e só ganha a lista) · Linhas alteradas (sem testes e sem o `openapi.d.ts` gerado): ~850 (contrato ~180, API ~230, web ~400, docs ~40) · Fases previstas: 3

**Sinal de "grande demais" disparado:** o nº 4 da skill `vertical-slicing` (PR acima de ~400 linhas sem testes). Os outros três não disparam. A conversa principal determinou, com o dono ausente, seguir sem re-fatiar; o registro fica aqui para o dono rever. Corte natural, se ele preferir: **004a** — contrato, modelo, módulo `access`, criar e abrir o documento (botão + página com título editável + 404); **004b** — listagem (`GET ?scope=mine`, seção da barra lateral, página "Meus documentos"). O módulo `access` sozinho não é fatia (não é utilizável por ninguém).

## Dívida encontrada

- `apps/web/src/app/router.tsx` registra rotas com `lazy` direto e export `Component`, sem o `convert(queryClient)` da skill `routing`; por isso nenhuma rota consegue pré-carregar dados com `clientLoader`.
- `apps/web/src/testing/mocks/db.ts` é um banco fake escrito à mão; a skill `api-mocking` pede `@mswjs/data` a partir do momento em que há criar/editar (passa a valer nesta fatia).
- Colunas de id do Prisma são `text` (sem `@db.Uuid`): o banco aceita id que não é UUID; a checagem de formato fica só no código.
- `apps/api/test/reset-database.ts` lista as tabelas à mão; tabela nova esquecida só não vaza entre testes por causa do `CASCADE`.
- `GET /documents?scope=mine` corta em 100 sem avisar a tela; falta paginação (fora de escopo no PRD).
- `apps/web/src/app/routes/app/root.tsx` chama `reportError` durante o render — já registrada como item 039 do roadmap; não repetir.
