# SPEC 013 — free-spaces

A pessoa com sessão cria um **espaço livre** (grupo de trabalho, projeto,
comissão), vira **dona** dele e chega a ele pela seção "Espaços" da barra
lateral. PRD aprovado em `prd.md`, nesta pasta, com 10 requisitos, já com o
corte aprovado: nome repetido recusado é a **137** `free-space-unique-name`;
membros e o teste de fronteira da tabela de membros são da **134**.

Parte de `docs/architecture.md` §2 (contrato primeiro), §3 (espaço **não** dá
acesso a documento — esta fatia não muda isso) e §6 (guards na classe,
`organizationId` sempre da sessão, e o parágrafo da 012 sobre `/spaces`).

**Base da entrega**: `feature/013-free-spaces` sai de
`feature/012-unit-spaces`. Todo diff e toda conferência de "arquivo intocado"
são contra `feature/012-unit-spaces`, nunca contra `develop`.

Lições vigentes para toda tarefa do PLAN: `React.JSX.Element`; `ref` é prop
comum, sem `forwardRef`; botão nosso é sempre `Button`; navegação interna só
com `<Link>`/`<NavLink>`; cobertura ≥ 80% por arquivo; nenhum aviso em
`install`, `lint`, `typecheck`, `test` e `build`; espera pós-rota ou pós-`lazy`
sempre com `timeout` explícito (`LAZY_TIMEOUT`, `ROUTE_TIMEOUT`), nunca `sleep`;
typecheck e lint finais com o cache limpo (`pnpm exec tsc -b --clean`);
**migration escrita à mão**, **nunca** `prisma migrate diff/dev/reset` — só
`validate`, `status` e `deploy`; o arquivo gerado do contrato só pelo script;
o agente derruba tudo o que subir.

O que **já existe** e esta fatia só aproveita:

- Banco: enum `SpaceType` **já tem `FREE`** (migration 0002); a restrição
  `Space_type_owner_check` já prevê FREE com `personId` e `orgUnitId` nulos.
  Nenhum código cria espaço FREE hoje (conferido: só `PERSONAL` em
  `installation`, `invitations`, `documents.service.ts`, `test/create-person.ts`
  e `UNIT` em `org-units` e `installation`).
- API: módulo `spaces` da 012 (`spaces.service.ts` com `list` e colador pt-BR,
  `spaces.controller.ts` com `SessionGuard` na classe), `parseBody`,
  `@CurrentPerson()`, `CsrfGuard` global, `createPersonWithSession`,
  `test/http.ts`, `contract.ts`.
- Web: feature `unit-spaces` (`get-spaces.ts` com chave `['spaces']`,
  `sidebar-unit-spaces.tsx`, `unit-space-view.tsx`), rota `unit-space.tsx`,
  `paths.unitSpace`, `Dialog`/`DialogContent`/`DialogTitle`/`DialogDescription`
  (devolve o foco a quem abriu), `Form`, `Input`, `Button`, `isConflictError`,
  `useNotifications`, e o modelo de formulário em diálogo de
  `features/org-units/components/create-org-unit-form.tsx`.
- Mocks: `spaces: MockSpace[]`, `addUnitSpace`, `listSpacesOf`,
  `getSignedInPerson()`, handler `GET /spaces` com `getSignedInPerson`,
  `devOverride`/`networkDelay`/`SESSION_COOKIE_NAME`,
  `expectNoSeriousA11yViolations`.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `SidebarFreeSpaces` (feature `spaces`) montada em `root.tsx` logo depois de `SidebarUnitSpaces`, com `<nav aria-label="Espaços">`, `<h2>` "Espaços" e o botão "Novo espaço" **em todos os estados** — carregando, vazio, erro e com dados (D6). |
| R2 | `GET /spaces` passa a trazer também os espaços `FREE` com `ownerId` e `organizationId` da sessão, na **mesma** ordenação pt-BR com desempate por `id` (D3); a seção desenha um `<NavLink>` por item `type === 'free'` para `/spaces/:spaceId`, na ordem recebida. |
| R3 | Lista `free` vazia → texto "Você ainda não tem espaços." acima do botão (Interface). |
| R4 | Diálogo "Novo espaço" com `Form` + `Input` "Nome"; schema Zod `spaceNameSchema` (obrigatório, `trim`, NFC, máx. 120) na web **e** na API (D2, D5); erro no campo, diálogo aberto. Sem índice único: nome repetido é aceito. |
| R5 | `POST /spaces` cria `Space` FREE com `ownerId` = pessoa da sessão (D1, D3); a mutação **aguarda** a invalidação de `['spaces']` e então navega para `/spaces/:id` (D5, D6). |
| R6 | A mesma rota `/spaces/:spaceId` e a mesma view, generalizada: título e textos por `type` (D7, Interface). |
| R7 | O `where` de `list` exige `ownerId` **e** `organizationId` da sessão; `isAdmin` não é lido; `POST` só com `SessionGuard`, sem `AdminGuard` (D3). Relido do banco a cada pedido. |
| R8 | Sem rota por id: a página procura o id na lista da pessoa; inexistente, de outro dono, de outra organização e malformado caem no mesmo "Espaço não encontrado." (D4). |
| R9 | Foco inicial no "Nome" pelo Radix (primeiro focável); fechar sem criar devolve o foco ao "Novo espaço" pelo `Dialog`; `DialogContent` nunca desmontado condicionalmente; depois de criar, foco no `<main>` da página nova; `role="status"`/`role="alert"` nos estados; notificação "Espaço criado"; axe no e2e (D6, D7, D9). |
| R10 | Textos literais em pt_BR na seção Interface; caminhos `/spaces` e `/spaces/:spaceId` em inglês. |

## Decisões técnicas

### D1 — Migration `0013_free_space`, escrita à mão (`security`)

- `apps/api/prisma/migrations/0013_free_space/migration.sql`:

  ```sql
  ALTER TABLE "Space" ADD COLUMN "organizationId" TEXT;
  ALTER TABLE "Space" ADD COLUMN "name" TEXT;
  ALTER TABLE "Space" ADD COLUMN "ownerId" TEXT;

  ALTER TABLE "Space" ADD CONSTRAINT "Space_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "Space" ADD CONSTRAINT "Space_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  -- "Os espaços livres de que esta pessoa é dona", a leitura da barra lateral.
  CREATE INDEX "Space_ownerId_idx" ON "Space"("ownerId");

  ALTER TABLE "Space" DROP CONSTRAINT "Space_type_owner_check";
  ALTER TABLE "Space" ADD CONSTRAINT "Space_type_owner_check" CHECK (
      ("type" = 'PERSONAL' AND "personId" IS NOT NULL AND "orgUnitId" IS NULL
          AND "organizationId" IS NULL AND "name" IS NULL AND "ownerId" IS NULL)
      OR ("type" = 'UNIT' AND "orgUnitId" IS NOT NULL AND "personId" IS NULL
          AND "organizationId" IS NULL AND "name" IS NULL AND "ownerId" IS NULL)
      OR ("type" = 'FREE' AND "personId" IS NULL AND "orgUnitId" IS NULL
          AND "organizationId" IS NOT NULL AND "name" IS NOT NULL AND "ownerId" IS NOT NULL)
  );
  ```

  Comentários em pt_BR no arquivo explicando cada bloco, como na 0012.
- **Colunas que aceitam nulo, e a restrição exige as três só em FREE.**
  PERSONAL e UNIT existentes continuam válidos **sem preenchimento** (as três
  colunas nascem nulas), e nenhum dos cinco pontos que criam espaço hoje é
  tocado. Alternativa descartada: `organizationId NOT NULL` com preenchimento
  a partir de `Person`/`OrgUnit` — obrigaria mudar `installation`,
  `invitations`, `org-units`, `documents.service.ts` e `test/create-person.ts`,
  fora do escopo e dentro de `documents/`.
- **Dono numa coluna (`ownerId`), sem tabela de membros**: corte aprovado; a
  134 cria a tabela de membros e decide como o dono entra nela. Alternativa
  descartada nesta fatia: `SpaceMember` com papel — é a 134, com o teste de
  fronteira de `access/`.
- **Sem índice único de nome**: nome repetido é aceito (R4); o índice parcial
  `("ownerId", lower("name")) WHERE "type" = 'FREE'` é da 137.
- **RESTRICT** nas duas chaves, pela razão da 0008/0012: apagar pessoa ou
  organização nunca apaga um espaço em silêncio.
- A migration falharia se existisse linha FREE (nenhuma existe; nenhum código
  a cria). Conferência: `prisma validate` + `prisma migrate status` + `deploy`
  no banco de teste.
- `apps/api/prisma/schema.prisma`: `Space` ganha `organizationId String?`,
  `name String?`, `ownerId String?`, `organization Organization?`,
  `owner Person? @relation("SpaceOwner", ...)` e `@@index([ownerId])`;
  `Person.space` passa a `@relation("PersonalSpace")` nos dois lados (duas
  relações `Person`–`Space` exigem nome); `Person.ownedSpaces Space[]
  @relation("SpaceOwner")`; `Organization.spaces Space[]`. O comentário de
  `Space` registra que a restrição de tipo vive só na migration.

### D2 — Contrato: `POST /spaces` e `type: free` (§2)

- Em `packages/api-contract/openapi.yaml`, **no mesmo caminho `/spaces`** que
  já tem o `get`, acrescenta `post`, `operationId: createSpace`, tag `spaces`,
  corpo `CreateSpaceInput`, respostas **201** `SpaceResponse`, **400** e
  **401** com `Error`. Sem 403 (qualquer pessoa com sessão), sem 404 (não há
  id), sem 409 (a 137 acrescenta).

  ```yaml
  CreateSpaceInput:
    type: object
    required: [name]
    additionalProperties: false
    properties:
      name: { type: string, minLength: 1, maxLength: 120 }  # contado após trim
  SpaceResponse:
    type: object
    required: [data]
    properties:
      data: { $ref: '#/components/schemas/Space' }
  ```

- `Space.type` passa de `enum: [unit]` para `enum: [unit, free]`; a descrição
  de `name` passa a "Nome da unidade, no espaço de unidade; nome dado pelo
  dono, no espaço livre". A `description` do `get` acrescenta: e os espaços
  livres de que a pessoa da sessão é dona, na organização dela; mesma ordem.
- **Identidade de caminho, conferida à mão**: `/spaces` já existe (012) e só
  ganha um método; nenhum caminho novo é declarado, e continua valendo a regra
  da 012 — **nenhum segmento literal** sob `/spaces/`.
- Alternativa descartada: `POST /spaces/free` — literal que colidiria com o
  futuro `/spaces/{spaceId}`. Também descartado: `type` no corpo — o único
  tipo que uma pessoa cria é FREE, então o servidor decide.
- Tipos regenerados só por `pnpm --filter @folioteca/api-contract generate`.

### D3 — API: `create` e `list` no módulo `spaces` (`authorization`, `security`)

- `apps/api/src/spaces/spaces.schema.ts` (novo): `spaceNameSchema` com as
  mesmas regras e mensagens de `orgUnitNameSchema` ("Informe o nome.", "O nome
  pode ter no máximo 120 caracteres."), `trim` + `normalize('NFC')`, e
  `createSpaceSchema = z.strictObject({ name: spaceNameSchema }, { error:
  'Campo não permitido.' })`. Alternativa descartada: importar de
  `org-units/org-units.schema.ts` — acoplaria dois módulos por um nome de
  domínio alheio (registrado como dívida: a cópia).
- `spaces.service.ts`, `create(organizationId, personId, body)`:
  `parseBody(createSpaceSchema, body)` → `prisma.space.create({ data: { type:
  'FREE', organizationId, ownerId: personId, name }, select: { id, name } })` →
  `{ data: { id, type: 'free', name } }`. Uma escrita só, sem transação.
- `list` passa a um `where` com `OR`:

  ```ts
  where: {
    OR: [
      { type: 'UNIT', orgUnit: { organizationId, assignments: { some: { personId } } } },
      { type: 'FREE', organizationId, ownerId: personId },
    ],
  },
  select: { id: true, type: true, name: true, orgUnit: { select: { name: true } } },
  ```

  O mapeamento vira `UNIT → { type: 'unit', name: orgUnit.name }` e
  `FREE → { type: 'free', name }` (sem `!`: linha sem nome é descartada no
  `flatMap`, o que a restrição do banco já impede). A ordenação continua a
  mesma, sobre a lista **misturada**. `isAdmin` continua fora da consulta.
- `spaces.controller.ts`: `@Post()` com `@HttpCode(201)`, `@CurrentPerson()` e
  `@Body() body: unknown`; o guard continua **só na classe**, `SessionGuard`,
  **sem `AdminGuard`**; `CsrfGuard` global já cobre o `POST`.
- `organizationId` e `ownerId` **sempre da sessão**, nunca do corpo (o schema
  estrito recusa campos extras com 400).
- `access/**`, `documents/**` e o teste `document-access-boundary.test.ts`
  **intocados**: nada aqui toca `Document`; o teste de membros é da 134.

### D4 — "Não encontrado" único continua da tela, por construção

- Sem `GET /spaces/{spaceId}`: a página procura o `spaceId` na lista da
  pessoa, que só contém espaços de que ela é dona (FREE) ou em que está lotada
  (UNIT). Inexistente, de outro dono, de outra organização e malformado não têm
  canal para se distinguir (R8). O padrão `findFirst` escopado com 404 opaco,
  sem `isUuid`, continua reservado para a primeira rota por id (128/134).
- Alternativa descartada: rota por id agora — seria uma segunda rota para
  devolver um nome que a lista já tem.

### D5 — Web: renomear a feature `unit-spaces` para `spaces` e a mutação (`project-structure`, `api-requests`, `forms`)

- **`features/unit-spaces/` vira `features/spaces/`** (`git mv`, conteúdo
  preservado): a lista de espaços, as duas seções e a página agora são de
  espaços em geral. Alternativa descartada: nova feature `free-spaces` — ela
  precisaria de `useSpaces`, e import entre features é proibido; mover
  `get-spaces.ts` para o compartilhado criaria uma pasta de API compartilhada
  sem precedente. A zona do ESLint `unit-spaces` é trocada pela de `spaces`.
- `features/spaces/api/create-space.ts`: `createSpaceInputSchema = z.object({
  name: spaceNameSchema })`; `createSpace(data)` →
  `api.post<SpaceResponse, SpaceResponse>('/spaces', data, { silentError:
  true })` (o erro é mostrado no formulário, não por notificação global);
  `useCreateSpace()` que **aguarda** `invalidateQueries({ queryKey:
  getSpacesQueryOptions().queryKey })` antes do `onSuccess` do chamador — o
  item já está na lista quando a página abre (R5), como em
  `create-org-unit.ts`.
- `features/spaces/utils/space-name-schema.ts`: o Zod do nome na web (mesmas
  regras de D3). Não importa de `features/org-units` (proibido).
- `SpaceResponse` e `CreateSpaceInput` aliados do contrato em `get-spaces.ts`
  e `create-space.ts`, como a 012 fez com `Space`.

### D6 — Web: seção "Espaços" e diálogo "Novo espaço" (`interface-design`, `forms`, `component-robustness`)

- `features/spaces/components/sidebar-free-spaces.tsx`, montada em `root.tsx`
  **depois** de `<SidebarUnitSpaces />` e antes de `<SidebarAdmin />`, na
  receita "Seção da barra lateral": `<nav aria-label="Espaços">`, `<h2>`
  "Espaços", o **conteúdo por estado** e, abaixo, o botão secundário
  `w-full` "Novo espaço" (`type="button"`), **sempre presente**.
  - carregando: `<p role="status">` "Carregando espaços…";
  - erro sem dados: `role="alert"` com a mensagem e "Tentar novamente";
  - vazio: "Você ainda não tem espaços.";
  - com dados: lista `type === 'free'` na ordem recebida, `<NavLink>` com
    `title` e `block truncate`, ativo pela receita "Item da barra lateral".
- **O `Dialog` fica fora do `switch` de estados**, irmão do botão, e o
  `DialogContent` é renderizado **sempre** (sem `{open ? … : null}` e sem
  condição sobre dados): o Radix monta e desmonta pelo `open`, depois de
  devolver o foco. Assim nem uma nova leitura de `['spaces']` nem a troca de
  estado da seção tiram o diálogo da árvore antes de o foco voltar — a
  regressão da 012. O formulário recebe `key` de um contador incrementado a
  cada abertura, para nascer limpo.
- **Foco ao abrir**: comportamento padrão do Radix — o campo "Nome" é o
  primeiro focável da caixa (título e descrição não são focáveis). Sem
  `onOpenAutoFocus` próprio nem comando de foco. Alternativa descartada: o
  `FocusCommand` de `create-org-unit-form.tsx` — lá existe porque a caixa é
  compartilhada por dois formulários; aqui seria código sem necessidade.
- **Foco ao fechar sem criar** (Esc, clique fora, "Cancelar"): o `Dialog`
  existente devolve a quem abriu — o botão "Novo espaço" (R9).
- **Ao criar**: `closedByCreationRef = true`, notificação de sucesso "Espaço
  criado", fecha o diálogo, `navigate(paths.space.getHref(id), { state: {
  focusMain: true } })`. No `onCloseAutoFocus`, se `closedByCreationRef`,
  `preventDefault()` (e zera a ref): o foco vai para o `<main>` da página nova
  (D7). Motivo: em tela estreita a troca de rota fecha o painel lateral
  (`app-layout.tsx`) e o botão "Novo espaço" fica escondido; devolver o foco
  a ele deixaria o foco no `body`.
- `features/spaces/components/create-space-form.tsx`: `Form` com
  `createSpaceInputSchema`, `Input` "Nome" (`autoComplete="off"`), rodapé da
  receita "Diálogo de formulário" com `DialogClose` "Cancelar" e "Criar
  espaço"/"Criando…" (`isLoading`); `isSubmittingRef` contra duplo Enter; falha
  do servidor que não seja 400 → "Alerta dentro de formulário" com
  `role="alert"`, diálogo aberto; 400 do servidor → `setError('name', …,
  { shouldFocus: true })` com a mensagem recebida.
- Alternativa descartada: seção que some quando vazia (como "Unidades") — ela
  carrega a ação de criar (PRD, decisão tomada).

### D7 — Web: rota e página generalizadas (`routing`, `interface-design`)

- `config/paths.ts`: `unitSpace` passa a **`space`** (mesmo
  `/spaces/:spaceId`); `router.tsx` aponta a entrada `lazy` para
  `app/routes/app/space.tsx` (renomeado de `unit-space.tsx`).
- `features/spaces/components/space-view.tsx` (renomeado de
  `unit-space-view.tsx`): textos por `space.type` (Interface); `<h1>` de
  estado passa a **"Espaço"**; a mensagem de não encontrado passa a ser
  **uma só** para os dois tipos (R8).
- Foco após criar: `space-view.tsx` lê `useLocation().state?.focusMain` e, com
  o espaço achado, foca o `<main>` uma vez (efeito com ref). Para isso
  `ContentLayout` ganha as props opcionais `ref` (prop comum, React 19) e
  `tabIndex`; a página passa `tabIndex={-1}` para o `<main>` receber foco
  programático sem entrar na ordem do Tab. Alternativa descartada:
  `document.getElementById('main-content')` — alcança o DOM por fora do React.
- `SidebarUnitSpaces` e os testes da 012 passam a usar `paths.space`.

### D8 — API simulada: helper único para criar espaço (`api-mocking`)

- `testing/mocks/db.ts`: `MockSpace` vira união —
  `{ id; type: 'unit'; orgUnitId }` | `{ id; type: 'free'; name; ownerId }`.
  **Um helper só para criar espaço livre**, `addFreeSpace(ownerId, name)`, com
  id `space-free-${contador}`, `push` no array existente (nunca substituição,
  razão de `touchDocumentUpdatedAt`). O handler e a semente, se houver, passam
  por ele; nenhum `state.spaces.push` fora dos dois helpers. A dívida 130
  (criação de espaço UNIT espalhada) não é tocada nem piorada.
- `listSpacesOf(personId)` passa a incluir os `free` com `ownerId === personId`,
  com o mesmo colador e desempate; o tipo de retorno vira o `Space` do
  contrato.
- `handlers/spaces.ts`: `http.post(\`${env.API_URL}/spaces\`)` com o mesmo
  preâmbulo (`networkDelay()`, `devOverride('spaces')`, 401 sem instalação,
  cookie ou `getSignedInPerson()`), valida o corpo com o `spaceNameSchema` da
  web (400 com `{ message }` da primeira issue) e responde **201** `{ data }`.
- `utils.ts`: o comentário de `mock-error=spaces` passa a citar também o `POST`.

### D9 — Testes

- **API, integração** (`spaces.integration.test.ts`, Postgres real):
  `POST` com "  Projeto Alfa  " → 201, `name` aparado, `type: 'free'`, e no
  banco `type = FREE`, `ownerId` e `organizationId` da sessão; nome vazio, só
  espaços, 121 caracteres e campo extra (`organizationId`, `ownerId`) → 400;
  dois espaços com o mesmo nome do mesmo dono → os dois 201 (R4); anônimo → 401;
  **sem token CSRF** → recusado como os outros `POST`; `GET` de A traz os livres
  de A misturados aos de unidade em ordem pt-BR; o espaço de A **não** aparece
  para B da mesma organização nem para a **administração** (R7); espaço FREE de
  outra organização inserido pelo Prisma não aparece.
- **API, migration** (no mesmo arquivo, via Prisma cru): inserir FREE sem
  `name` ou sem `ownerId` falha pela restrição; PERSONAL com `name` falha.
- **API, unitários** (`spaces.service.test.ts`): o `where` exato com o `OR`,
  sem `isAdmin`; `create` grava `organizationId`/`ownerId` recebidos e ignora
  o corpo; ordenação misturada.
- **API, contrato** (`spaces.contract.test.ts`): `POST` 201, 400 e 401 por
  `expectMatchesContract`.
- **Web, unitário**: `create-space.test.tsx` (chama `POST /spaces`,
  invalida `['spaces']` antes do `onSuccess`); `space-name-schema.test.ts`.
- **Web, componente**: `sidebar-free-spaces.test.tsx` — carregando
  (`role="status"`), vazio, erro com nova tentativa, com dados (só `free`, na
  ordem, `href` certo), botão presente nos quatro estados; o diálogo abre com
  foco no "Nome", `Esc` devolve o foco ao botão, erro de validação mantém o
  diálogo aberto, criação notifica e navega. `create-space-form.test.tsx` —
  duplo Enter envia um pedido; 500 mostra o alerta. `space-view.test.tsx`
  (renomeado) — textos por tipo, foco no `<main>` com `focusMain`.
- **Web, integração de rota** (`app/routes/app/__tests__/space.test.tsx`,
  renomeado): criar pela barra lateral leva a `/spaces/:id` com o nome no
  `<h1>` e o item na seção; id de espaço de outro dono e id inexistente mostram
  **o mesmo** conteúdo.
- **e2e** (`apps/web/e2e/tests/free-spaces.spec.ts`, API simulada,
  `ROUTE_TIMEOUT` em toda espera pós-rota): seção "Espaços" com "Você ainda
  não tem espaços."; **só pelo teclado**, abre "Novo espaço", confere foco no
  "Nome", envia vazio e vê o erro, digita o nome, cria, chega à página com o
  nome no `<h1>` e o item na seção; `expectNoSeriousA11yViolations` com o
  diálogo aberto e na página; reabre e fecha com `Esc`, foco de volta em
  "Novo espaço". O e2e `unit-spaces.spec.ts` continua passando sem mudança de
  comportamento.

### D10 — Documentação

- `docs/architecture.md` §6, parágrafo **"Entrega `free-spaces` (fatia
  013)"**: `POST /spaces` no mesmo caminho do `GET`, `SessionGuard` na classe,
  sem `AdminGuard`; `organizationId` e `ownerId` sempre da sessão; espaço livre
  visível só ao dono, `isAdmin` não lido; colunas nulas com a restrição de
  tipo exigindo as três só em FREE (0013 escrita à mão); dono em coluna até a
  134; nome repetido aceito até a 137; não encontrado único continua da tela;
  API simulada cria espaço livre por um helper só; espaço livre não dá acesso
  a documento (§3). O parágrafo da 012 troca "a 128" por "a primeira rota por
  id (128/134)" onde cita a rota por id.
- `docs/design.md`: receita nova **"Ação da seção da barra lateral"** (abaixo).

## Interface

Lidos `docs/design.md` e o piso de `interface-design`. Receitas usadas: "Seção
da barra lateral", "Item da barra lateral", "Diálogo de formulário", "Campo de
formulário", "Alerta dentro de formulário", "Notificação", "Contêiner de
página"/"Título de página" (via `ContentLayout`), "Texto de apoio", "Vazio",
"Carregando", "Erro", "Link de navegação", botões principal e secundário.
**Receita nova**: "Ação da seção da barra lateral" — botão secundário
`mt-2 w-full` logo abaixo do conteúdo da seção, presente em todos os estados.

### Seção "Espaços" (barra lateral, depois de "Unidades" e antes de "Administração")

| Estado | O que aparece |
|---|---|
| carregando | `<h2>` **"Espaços"**; `role="status"` **"Carregando espaços…"**; botão **"Novo espaço"** |
| erro | `<h2>` **"Espaços"**; `role="alert"` **"Não foi possível carregar seus espaços."** + botão secundário **"Tentar novamente"**; botão **"Novo espaço"** |
| vazio | `<h2>` **"Espaços"**; **"Você ainda não tem espaços."** (tom suave); botão **"Novo espaço"** |
| com dados | `<h2>` **"Espaços"**; um item por espaço livre com o **nome** (truncado, com `title`), o da página aberta no estado ativo; botão **"Novo espaço"** |

### Diálogo "Novo espaço"

| Parte | Texto |
|---|---|
| título | **"Novo espaço"** |
| descrição | **"Um lugar para um grupo de trabalho, um projeto ou uma comissão. Você será a pessoa dona dele."** |
| campo | rótulo **"Nome"** |
| erros do campo | **"Informe o nome."** · **"O nome pode ter no máximo 120 caracteres."** |
| falha do servidor | `role="alert"`: **"Não foi possível criar o espaço. Tente de novo em instantes."** |
| rodapé | **"Cancelar"** (secundário) · **"Criar espaço"** / **"Criando…"** (principal) |
| sucesso | notificação **"Espaço criado"**; diálogo fecha; vai para a página |

### Página `/spaces/:spaceId`

| Parte | Espaço de unidade (012, inalterado) | Espaço livre |
|---|---|---|
| `<h1>` | nome da unidade | nome do espaço |
| texto de apoio | **"O espaço de documentos da sua unidade."** | **"Um espaço livre, de que você é dona."** |
| receita "Vazio" | texto da 012, inalterado | **"Os documentos deste espaço ainda não chegaram. Em breve você vai guardar e encontrar documentos aqui."** |

| Estado | O que aparece |
|---|---|
| carregando | `<h1>` **"Espaço"**; `role="status"` **"Carregando o espaço…"** |
| erro | `<h1>` **"Espaço"**; `role="alert"` **"Não foi possível carregar o espaço."** + **"Tentar novamente"** |
| não encontrado (qualquer tipo) | `<h1>` **"Espaço"**; `role="alert"` **"Espaço não encontrado."** + **"Ele não existe ou você não tem acesso a ele."** + link **"Voltar para o início"** |
| achado | tabela acima |

A 360px: nome longo quebra no `<h1>` (`break-words`) e é truncado com `title`
na barra lateral; diálogo com a largura da receita; nada em px fixo.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `post` em `/spaces`, `CreateSpaceInput`, `SpaceResponse`, `type: [unit, free]` (D2) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script (D2) | — |
| criar | `apps/api/prisma/migrations/0013_free_space/migration.sql` | colunas, chaves, índice, restrição refeita (D1) | `security` |
| alterar | `apps/api/prisma/schema.prisma` | campos e relações nomeadas (D1) | — |
| criar | `apps/api/src/spaces/spaces.schema.ts` | `spaceNameSchema`, `createSpaceSchema` (D3) | `security` |
| alterar | `apps/api/src/spaces/spaces.service.ts` | `create`; `list` com `OR` e tipo `free` (D3) | `authorization`, `security` |
| alterar | `apps/api/src/spaces/spaces.controller.ts` | `@Post()` 201 (D3) | `authorization` |
| alterar | `apps/api/src/spaces/__tests__/{spaces.service.test.ts,spaces.integration.test.ts,spaces.contract.test.ts}` | D9 | `unit-testing`, `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| mover | `apps/web/src/features/unit-spaces/**` → `apps/web/src/features/spaces/**` | renomear a feature, com testes (D5) | `project-structure` |
| alterar | `eslint.config.js` | zona `unit-spaces` → `spaces` (D5) | `project-structure` |
| criar | `apps/web/src/features/spaces/utils/space-name-schema.ts` | Zod do nome (D5) | `forms` |
| criar | `apps/web/src/features/spaces/api/create-space.ts` | chamada, mutação, invalidação aguardada (D5) | `api-requests`, `client-state` |
| alterar | `apps/web/src/features/spaces/api/get-spaces.ts` | alias `SpaceResponse` (D5) | `api-requests` |
| criar | `apps/web/src/features/spaces/components/create-space-form.tsx` | formulário do diálogo (D6) | `forms`, `component-robustness`, `error-handling` |
| criar | `apps/web/src/features/spaces/components/sidebar-free-spaces.tsx` | seção "Espaços" e diálogo sempre montado (D6) | `interface-design`, `component-robustness` |
| mover e alterar | `.../spaces/components/unit-space-view.tsx` → `space-view.tsx` | textos por tipo, não encontrado único, foco no `<main>` (D7) | `interface-design`, `error-handling` |
| alterar | `apps/web/src/features/spaces/components/sidebar-unit-spaces.tsx` | `paths.space` (D7) | — |
| alterar | `apps/web/src/components/layouts/content-layout.tsx` | props opcionais `ref` e `tabIndex` no `<main>` (D7) | `ui-components` |
| mover e alterar | `apps/web/src/app/routes/app/unit-space.tsx` → `space.tsx` | imports novos (D7) | `routing` |
| alterar | `apps/web/src/config/paths.ts` | `unitSpace` → `space` (D7) | `routing` |
| alterar | `apps/web/src/app/router.tsx` | entrada `lazy` para `space.tsx` (D7) | `routing` |
| alterar | `apps/web/src/app/routes/app/root.tsx` | imports novos; monta `SidebarFreeSpaces` (D6) | `project-structure` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `MockSpace` em união, `addFreeSpace`, `listSpacesOf` (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/spaces.ts` | `POST /spaces` (D8) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário `mock-error=spaces` (D8) | `api-mocking` |
| criar/alterar | `apps/web/src/features/spaces/{api,utils,components}/__tests__/*` | D9 | `unit-testing`, `component-testing`, `api-mocking` |
| alterar | `apps/web/src/components/layouts/__tests__/content-layout.test.tsx` (ou criar) | `ref` e `tabIndex` | `component-testing` |
| mover e alterar | `apps/web/src/app/routes/app/__tests__/unit-space.test.tsx` → `space.test.tsx` | D9 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/free-spaces.spec.ts` | jornada de D9, axe | `e2e-testing` |
| alterar | `docs/architecture.md` | §6, parágrafo da 013; ajuste no da 012 (D10) | — |
| alterar | `docs/design.md` | receita "Ação da seção da barra lateral" | `interface-design` |
| alterar | `docs/roadmap.md` | 013 concluída; dívidas abaixo | — |

Intocados de propósito (comparar com `feature/012-unit-spaces`):
`apps/api/prisma/migrations/0001…0012`; `apps/api/src/{access,documents,auth,common,org-units,unit-assignments,people,admin-roles,invitations,installation}/**`
(inclusive `access/__tests__/document-access-boundary.test.ts`, que é da 134);
`apps/api/test/create-person.ts`; `apps/web/src/lib/**`;
`apps/web/src/components/ui/**`; `apps/web/src/components/layouts/{app-layout,sidebar-admin}.tsx`;
`apps/web/src/app/routes/app/spaces.tsx`; `apps/web/src/features/unit-assignments/**`
(a chave literal `['spaces']` continua a mesma); os outros handlers falsos;
`apps/web/e2e/tests/unit-spaces.spec.ts`.

## Estimativa de tamanho

Jornadas: **1** (criar um espaço livre e chegar a ele) · Telas principais
novas: **0** (a página é a da 012; o diálogo é secundário) · Fases previstas:
**3** · Linhas alteradas (sem testes, sem o `.d.ts` gerado, com renomeações
contadas só pelo que muda dentro dos arquivos): **~355** — migration ~25,
`schema.prisma` ~15; contrato ~45; API ~55 (schema ~12, serviço ~30,
controller ~10); web ~160 (renomeação/`paths`/`router`/`root`/eslint ~15,
`space-name-schema` ~10, `create-space` ~30, `create-space-form` ~55,
`sidebar-free-spaces` ~80 com o diálogo, `space-view` ~20, `content-layout`
~5); `src/testing/` ~40 (db ~25, handler ~15); docs ~15. Com testes: ~800.

Sinais de "grande demais": **nenhum dispara** (1 jornada, 3 fases, nenhuma
tela principal nova, abaixo de ~400). Se o implementer passar de ~420, o corte
é o foco no `<main>` após criar (deixar o foco voltar ao botão, aceitando o
caso de tela estreita como dívida) — **nunca** o escopo por sessão, o
não encontrado único nem o diálogo sempre montado.

## Dívida encontrada

- **A página `/spaces` ("Espaços") continua dizendo "Nenhum espaço ainda"**,
  placeholder da 001 sem ligação com `GET /spaces`, agora também para quem
  tem espaços livres na barra lateral. É a fatia **129**.
- **O esquema de validação do nome é copiado**: `apps/api/src/spaces/spaces.schema.ts`
  repete as regras e mensagens de `apps/api/src/org-units/org-units.schema.ts`
  (e, na web, `features/spaces/utils/space-name-schema.ts` repete
  `features/org-units/utils/org-unit-name-schema.ts`). Vale extrair um
  `nameSchema` comum (`apps/api/src/common/` e `apps/web/src/utils/`) quando
  uma terceira entidade nomeada aparecer.
