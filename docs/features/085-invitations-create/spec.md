# SPEC 085 — invitations-create

Primeira das fatias em que o item 009 `invitations` foi cortado (085 criar,
086 aceitar, 087 revogar, 088 listar, 089 enviar por e-mail). PRD aprovado em
`prd.md`, nesta mesma pasta. Parte de `docs/architecture.md` §2 (contrato
primeiro), §6 (sessão opaca, só o `sha256` no banco; `AdminGuard` sempre
depois do `SessionGuard`) e §7 (testes).

**Base da entrega**: a branch `feature/085-invitations-create` sai de
`feature/066-org-units-delete` (PR #108, ainda não mesclada). **Toda**
comparação de "arquivo intocado" e todo diff é contra `feature/066-org-units-delete`,
nunca contra `develop`.

Lições vigentes que valem para toda tarefa do PLAN (herdadas da 065/066):
`React.JSX.Element` (nunca o `JSX` global); botão nosso é sempre o componente
`Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`, `lint`,
`typecheck`, `test` e `build`; **toda** espera depois de mudança de rota ou
chunk `lazy` com `timeout` explícito (unitário: `LAZY_TIMEOUT`; e2e:
`ROUTE_TIMEOUT`), nunca `sleep` fixo; typecheck e lint finais rodados de
verdade com o cache limpo (`pnpm exec tsc -b --clean`); **nenhum** `prisma
migrate diff/dev/reset` — só `validate`, `status` e `deploy`; nenhum literal
com cara de senha ou de token; o agente derruba tudo o que subir.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `POST /invitations` aceita **só** `{ email }` (schema estrito); nada de nome nem senha (D1, D4). O formulário tem um campo só (D8). |
| R2 | `expiresAt = createdAt + 7 dias` (`INVITATION_TTL_MS`, constante do módulo), calculado no servidor e devolvido no 201 (D4). |
| R3 | A criação roda numa transação: `deleteMany` dos convites daquele e-mail + `create` do novo. O convite anterior (e o hash dele) deixa de existir, então o link antigo não valida mais na 086 (D4). O índice único de D3 garante que duas criações simultâneas nunca deixem dois pendentes. |
| R4 | `Person` com o mesmo e-mail (normalizado) → **409** "Esta pessoa já faz parte da organização." (D4), repetido pela API simulada (D9). |
| R5 | Depois do 201, o `InvitationLink` mostra o link e o botão "Copiar link"; o resultado (sucesso ou falha) vai para a store de notificações, que já renderiza `role="status"` / `role="alert"` (D8). |
| R6 | O `token` só existe no corpo do 201. A web guarda em `useState` do componente de página, some ao criar outro convite ou ao sair da rota; nunca vai para o cache do React Query nem para `localStorage`. A tela diz isso em texto fixo (Interface). Não há `GET` nesta fatia (D1). |
| R7 | `randomBytes(32).toString('base64url')`; a coluna é `tokenHash` (sha256 hex) e **não existe** coluna com o token em claro (D3, D5). Nenhum `Logger` no caminho; o token não entra em mensagem de exceção (D5). Integração prova que no banco só há o hash (D10). |
| R8 | `@UseGuards(SessionGuard, AdminGuard)` na **classe** do `InvitationsController`, como em `OrgUnitsController` (D6). Integração prova 403 e 401; a API simulada repete (D9). |
| R9 | Textos literais na seção Interface, em pt_BR; caminhos em inglês (`/invitations`). e2e com axe na página e no estado com o link (D10). |

## Decisões técnicas

### D1 — Contrato `POST /invitations` (contrato primeiro, §2)

- Escolha: em `packages/api-contract/openapi.yaml`, caminho **`/invitations`**
  (sem o prefixo `/api`, como todos os caminhos do arquivo — o `/api` é do
  proxy do Vite e do `env.API_URL`, não do contrato), operação `post`,
  `operationId: createInvitation`, tag `invitations`.
- Corpo: `CreateInvitationInput` = `{ email: string (format: email) }`,
  `required: [email]`, `additionalProperties: false`.
- Resposta **201**: `CreatedInvitationResponse` = `{ data: CreatedInvitation }`,
  com `CreatedInvitation` = `{ id, email, expiresAt (date-time), createdAt
  (date-time), token }`. A `description` de `token` registra a regra: *"Token
  do convite em claro. Devolvido uma única vez, na criação; o servidor guarda
  só o hash e não tem como mostrá-lo de novo."*
- Erros: **400** `ValidationError`; **401**, **403**, **409** `Error` (schemas
  que já existem). A `description` da operação fixa a ordem observável: CSRF
  (guard global) → 401 → 403 → 400 (corpo) → 409 (e-mail já é de uma pessoa).
- Um schema **separado** para o 201 (`CreatedInvitation`), em vez de um
  `Invitation` com `token` opcional: a 088 vai listar convites **sem** token, e
  um campo opcional deixaria o tipo da web mentir sobre quando o token existe.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`;
  `apps/api/test/generated-types.test.ts` continua valendo sem alteração.
- Alternativa descartada: `POST /people/invitations` ou `POST /invitations` com
  `personId` — motivo: o recurso é o convite, e a pessoa ainda não existe.
- Alternativa descartada: incluir o `GET /invitations` já aqui — motivo: é a
  fatia 088; o PRD tirou de escopo.
- Alternativa descartada: devolver o **link completo** montado pelo servidor —
  motivo: a API não conhece a origem da aplicação (SPA servida em outro host,
  proxy, porta de e2e) e passaria a precisar de uma variável de ambiente nova.
  Quem sabe a origem é o navegador (D7).

### D2 — Modelo `Invitation` no Prisma

- Escolha, em `apps/api/prisma/schema.prisma`:
  ```prisma
  /// Convite pendente para entrar na organização. Só o sha256 do token é
  /// guardado, como em `Session`: o link em claro existe uma única vez, na
  /// resposta da criação.
  ///
  /// Um índice único por expressão (`lower("email")`) garante "um convite
  /// pendente por e-mail" e o Prisma não sabe expressá-lo: ele vive só na
  /// migration `0009` escrita à mão. Como na `0007`, ele é invisível a este
  /// schema e por isso `migrate diff` nunca pode ser rodado aqui.
  model Invitation {
    id             String   @id @default(uuid())
    organizationId String
    email          String
    tokenHash      String   @unique
    invitedById    String
    createdAt      DateTime @default(now())
    expiresAt      DateTime

    organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
    invitedBy    Person       @relation("InvitationInviter", fields: [invitedById], references: [id], onDelete: Restrict)

    @@index([organizationId, createdAt(sort: Desc)])
  }
  ```
  `Organization` ganha `invitations Invitation[]` e `Person` ganha
  `sentInvitations Invitation[] @relation("InvitationInviter")`.
- **Nenhuma coluna com o token em claro** (R7) e nenhuma coluna de estado
  (`acceptedAt`, `revokedAt`): nesta fatia toda linha é um convite pendente —
  aceitar é a 086 e revogar é a 087, e cada uma acrescenta a coluna de que
  precisa na migration dela.
- `onDelete` coerente com a `0008` (documento → espaço → unidade em
  `RESTRICT`): **`RESTRICT` nas duas FKs**. Em `organizationId` porque a
  organização é singleton e apagá-la não pode levar convites junto em silêncio;
  em `invitedById` pelo mesmo motivo de `Document.authorId`/`ownerId`, que já
  são `Restrict`: a autoria do convite é dado de auditoria, e apagar quem
  convidou tem de ser uma decisão explícita de quem escrever esse caminho.
  Não existe hoje nenhum caminho que apague `Person` ou `Organization`, então
  `RESTRICT` não muda comportamento nenhum — declara a regra antes que exista.
- Alternativa descartada: `onDelete: Cascade` em `invitedById` — motivo:
  esconderia convites sumindo quando um administrador for removido; o convite
  é da organização, não da pessoa que o criou.
- Alternativa descartada: guardar `email` já minúsculo e usar `@unique` simples
  do Prisma — motivo: a normalização é do schema Zod (D4) e vale para o dado
  gravado, mas a garantia do banco precisa ser insensível a caixa mesmo se
  alguém escrever direto pelo Prisma; a expressão `lower("email")` é o mesmo
  recurso que a `0007` já usa para nomes de irmãs.

### D3 — Migration `0009` escrita à mão

- Escolha: `apps/api/prisma/migrations/0009_invitation/migration.sql`,
  escrita à mão (a regra do projeto proíbe `migrate diff/dev/reset`; só
  `validate`, `status` e `deploy`):
  ```sql
  CREATE TABLE "Invitation" (
      "id" TEXT NOT NULL,
      "organizationId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL,
      "invitedById" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
  );

  CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

  CREATE INDEX "Invitation_organizationId_createdAt_idx" ON "Invitation"("organizationId", "createdAt" DESC);

  -- One pending invitation per e-mail address, regardless of letter case:
  -- the same expression index the 0007 uses for sibling names. Every row in
  -- this table is a pending invitation today; when the 086 adds `acceptedAt`
  -- and the 087 adds `revokedAt`, this index becomes partial (WHERE both are
  -- null) in the migration of those slices.
  CREATE UNIQUE INDEX "Invitation_lower_email_key" ON "Invitation"(lower("email"));

  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ```
  Os nomes de constraint e de índice são os que o Prisma geraria
  (`<Tabela>_<coluna>_key`, `<Tabela>_<coluna>_fkey`), para o schema e o SQL
  não divergirem; `Invitation_lower_email_key` é a exceção que só o SQL conhece,
  como `OrgUnit_parentId_lower_name_key` na `0007`.
- **O índice não tem `WHERE` nesta fatia** — e é o mesmo desenho parcial da
  `0007` aplicado ao que existe hoje: sem coluna de estado, "pendente" é toda
  linha, e um predicado só sobre `expiresAt` seria inválido (`now()` não é
  imutável, o Postgres recusa). Registrado como dívida para a 086/087.
- Aplicada por `migrate deploy` (em hml, só pelo contêiner — regra da memória).
  Depois de escrever: `prisma validate` e `prisma migrate status`, nada mais.
- Alternativa descartada: nascer com `acceptedAt`/`revokedAt` nulos e o índice
  já parcial — motivo: colunas que nenhuma linha de código lê ou escreve nesta
  fatia; a 086 e a 087 sabem melhor o que cada uma precisa gravar.

### D4 — `InvitationsService.create` e a substituição sem corrida

- Escolha, em `apps/api/src/invitations/invitations.service.ts`:
  `create(organizationId, invitedById, body: unknown): Promise<CreatedInvitation>`:
  1. `createInvitationSchema.parse(body)` (D5) → `email` já aparado e em
     minúsculas. Falha vira 400 pelo mesmo caminho de `org-units`.
  2. `const token = randomBytes(32).toString('base64url')`;
     `const tokenHash = hashToken(token)`; `expiresAt = new Date(Date.now() + INVITATION_TTL_MS)`,
     com `INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000` (R2).
  3. `this.prisma.$transaction(async (tx) => { … })`:
     - `tx.person.findFirst({ where: { email }, select: { id: true } })` →
       se existe, `ConflictException(ALREADY_A_PERSON_MESSAGE)` (R4). A busca
       usa o e-mail **já normalizado**, e `Person.email` é gravado normalizado
       desde a instalação (`installation.schema.ts` faz `.trim().toLowerCase()`).
     - `tx.invitation.deleteMany({ where: { email } })` — o convite pendente
       anterior some, com o hash dele (R3): o link antigo deixa de validar.
     - `tx.invitation.create({ data: { organizationId, email, tokenHash, invitedById, expiresAt }, select: { id: true, email: true, createdAt: true, expiresAt: true } })`.
  4. `catch`: `P2002` em `Invitation_lower_email_key` → `ConflictException(RACE_MESSAGE)`;
     qualquer outro erro é relançado **sem** o token na mensagem.
  5. Devolve `{ ...created, token }` — único lugar em que o token sai do
     processo.
- **O que o índice garante**: duas criações simultâneas para o mesmo e-mail
  passam as duas pelo `deleteMany` (nada a apagar ainda) e chegam juntas ao
  `create`; sem o índice, ficariam **dois** pendentes, e o link "substituído"
  continuaria valendo. Com ele, uma das duas falha com `P2002` e vira um 409
  legível — a regra "um convite pendente por e-mail" é do banco, não da ordem
  em que as transações rodaram.
- Mensagens (constantes do serviço, copiadas na Interface):
  `ALREADY_A_PERSON_MESSAGE = 'Esta pessoa já faz parte da organização.'`;
  `RACE_MESSAGE = 'Outro convite para este e-mail foi criado ao mesmo tempo. Tente de novo.'`.
- **Por que o token nunca vai para log**: ele só existe como variável local e
  como campo do valor de retorno. O serviço não tem `Logger`; nenhuma exceção
  interpola o token; o Nest não loga corpo de resposta; o filtro global de erro
  só escreve `{ message }`. Do lado da web, ele fica em `useState` e no DOM —
  nunca em `console`, `localStorage` ou query string da SPA.
- Alternativa descartada: `upsert` por e-mail — motivo: reaproveitaria a linha
  e exigiria `where` por um `@unique` do Prisma, que não existe (o índice é por
  expressão); e apagar e recriar deixa claro que é um convite **novo**.
- Alternativa descartada: transação `Serializable` — motivo: o índice único já
  resolve a corrida com menos custo e sem retry, como na `0007`/`0008`.

### D5 — `hashToken`: duplicar no módulo de convites (`security`)

- Problema: `hashToken` é uma função **privada** de
  `apps/api/src/auth/session.service.ts` (não exportada).
- Escolha: **duplicar** — `apps/api/src/invitations/invitations.service.ts`
  passa a ter a sua própria
  `function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }`,
  com o mesmo comentário ("só o hash vai para o banco"). Três linhas, sem
  import cruzado entre módulos.
- Motivo: extrair para `common/` é refatoração de código compartilhado que toca
  o caminho de sessão (o mais sensível do app) numa fatia que não trata de
  sessão, e obrigaria a mexer nos testes de `auth/`. `invitations` **não** deve
  depender de `auth/session.service.ts` — o convite não é sessão; o que os dois
  compartilham é uma primitiva de criptografia, não uma regra.
- Alternativa descartada: exportar `hashToken` de `session.service.ts` e
  importá-lo — motivo: cria uma dependência de `invitations` para dentro de
  `auth`, com a forma errada (um serviço passa a exportar utilidade solta).
- Alternativa descartada: `apps/api/src/common/hash-token.ts` agora — motivo:
  seria a decisão certa **na terceira** ocorrência; hoje são duas, e o custo é
  mexer em `auth/` fora de escopo. Registrado em "Dívida encontrada": a 086
  (que vai conferir o token do convite) é a terceira ocorrência e deve fazer a
  extração, com `session.service.ts` e `invitations.service.ts` passando a
  usá-la.
- O que **não** se duplica: `randomBytes(32).toString('base64url')` é uma linha
  do `node:crypto`, igual à da sessão por ser o mesmo tamanho de segredo (256
  bits) e o mesmo alfabeto seguro para URL — sem encoding extra no link (D7).

### D6 — `InvitationsModule`, controller e guards (`authorization`)

- Escolha: módulo novo `apps/api/src/invitations/` com
  `invitations.module.ts`, `invitations.controller.ts`, `invitations.service.ts`,
  `invitations.schema.ts`, espelhando `org-units/`. Registrado em
  `app.module.ts`.
- `@Controller('invitations')` + `@UseGuards(SessionGuard, AdminGuard)` **na
  classe** (R8), como `OrgUnitsController`: a rota nasce coberta e a 088/087
  herdam. `@Post()` + `@HttpCode(201)`, corpo cru (`@Body() body: unknown`),
  `@CurrentPerson() person` dá `organizationId` e `invitedById = person.id`.
- `invitations.schema.ts`:
  ```ts
  export const createInvitationSchema = z.strictObject(
    {
      email: z
        .string({ error: 'Informe o e-mail.' })
        .trim()
        .toLowerCase()
        .min(1, 'Informe o e-mail.')
        .pipe(z.email('Informe um e-mail válido.')),
    },
    { error: 'Campo não permitido.' },
  );
  ```
  É **o mesmo** encadeamento de `installation.schema.ts` (trim → lowercase →
  `z.email`), copiado de propósito para que o e-mail do convite e o e-mail da
  pessoa normalizem igual — é disso que depende o 409 de D4. O `strictObject`
  é o padrão de `org-units.schema.ts` para recusar campo a mais.
- Alternativa descartada: um `emailSchema` compartilhado em `common/` — motivo:
  mesma razão de D5; a terceira ocorrência (086, o formulário de aceite) faz a
  extração. Dívida registrada.

### D7 — Como o front monta o link (`security`)

- Escolha: `apps/web/src/features/invitations/utils/build-invitation-link.ts`:
  ```ts
  // The public route only exists from slice 086 on; until then the link is
  // built and copied, but opening it lands on the app's not-found page.
  const INVITATION_PATH = '/invitations';

  export const buildInvitationLink = ({ origin, token }: { origin: string; token: string }): string =>
    `${origin}${INVITATION_PATH}/${encodeURIComponent(token)}`;
  ```
  A **origem** vem de quem chama (`window.location.origin` no componente), não
  de dentro da função: assim o teste é puro e não depende de `jsdom`.
- O caminho **não** entra em `paths.ts` nesta fatia: `paths` descreve rotas que
  o roteador conhece, e `/invitations/:token` só passa a existir na 086. A 086
  move esta constante para `paths.invitationAccept` na mesma tarefa em que cria
  a rota (dívida registrada).
- Consequência assumida e dita em tela: nesta fatia o link é **montado e
  copiado**, e ainda não abre nada. Por isso 085 e 086 vão para revisão
  empilhadas e são mescladas juntas (PRD, "Fora de escopo"), para que nenhum
  link morto chegue a uma pessoa.
- `encodeURIComponent` mesmo sendo `base64url` (alfabeto já seguro para URL):
  custa nada e não deixa o link depender do formato do token.
- Alternativa descartada: o servidor devolver o link pronto — ver D1.

### D8 — Web: rota, feature e a tela (`routing`, `forms`, `interface-design`)

- **Rota**: `paths.admin.invitations = { path: '/admin/invitations', getHref: () => '/admin/invitations' }`
  em `config/paths.ts`; entrada nova em `app/router.tsx` com
  `lazy: () => import('@/app/routes/app/admin/invitations')` (mesmo padrão de
  `structure`); item "Convites" em `components/layouts/sidebar-admin.tsx`,
  **depois** de "Estrutura" (a lista da área "Administração" cresce por ordem
  de chegada; a receita "Seção da barra lateral" já cobre o item).
- `app/routes/app/admin/invitations.tsx`: mesmo molde de `structure.tsx` —
  `<Authorization allowedRoles={[ROLES.ADMIN]} forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}>`
  em volta de um `ContentLayout` com título e apoio (Interface). É a rota que
  guarda o token do convite recém-criado em `useState` e decide o que mostrar:
  o formulário sempre, e o `InvitationLink` abaixo dele quando há um convite
  recém-criado. Criar outro convite substitui o bloco.
- **Feature nova** `apps/web/src/features/invitations/`:
  - `api/create-invitation.ts`: `createInvitationInputSchema = z.object({ email: … })`
    (mensagens iguais às do servidor, para a validação do cliente e a do
    servidor dizerem a mesma coisa), `createInvitation({ data })` →
    `api.post('/invitations', data, { silentError: true })` e
    `useCreateInvitation({ mutationConfig })`. `silentError` porque o 409 é
    respondido **no campo** do formulário, como em `create-org-unit.ts`.
    **Sem `invalidateQueries`**: não existe lista de convites nesta fatia (a
    088 acrescenta a invalidação junto com o `GET`).
  - `components/create-invitation-form.tsx`: `Form` + `Input label="E-mail"`
    (`type="email"`, `autoComplete="off"`), botão de envio, guarda de clique
    duplo por `isSubmittingRef` (cópia do desenho de
    `create-org-unit-form.tsx`), `isConflictError` → `form.setError('email', …)`
    com a mensagem do servidor e `shouldFocus`, alerta interno para as demais
    falhas. `onSuccess(invitation)` devolve o convite criado à rota e
    `form.reset()`.
  - `components/invitation-link.tsx`: recebe `{ email, link }`, mostra o aviso
    de "uma única vez", o link num campo `readOnly` selecionável e o botão
    "Copiar link".
  - `utils/build-invitation-link.ts` (D7).
- **Copiar link e o retorno a leitores de tela**: `navigator.clipboard.writeText(link)`
  dentro de `try/catch`; o retorno vai para a **store de notificações que já
  existe** (`useNotifications.getState().addNotification`), que renderiza
  `role="status"` no sucesso e `role="alert"` no erro — é o mecanismo de aviso
  do app inteiro (a 066 usa o mesmo para "Unidade apagada") e não exige
  inventar uma região `aria-live` nova nesta feature.
  - `navigator.clipboard` **ausente** (contexto não seguro, navegador antigo) ou
    `writeText` **recusado** (permissão negada, `NotAllowedError`): o mesmo
    caminho — notificação de erro com a mensagem de instrução manual; o campo
    com o link **continua na tela**, `readOnly` e selecionável, e o `onClick`
    do botão também faz `select()` nele, para copiar com o teclado ser um
    `Ctrl+C`. A checagem é `typeof navigator.clipboard?.writeText !== 'function'`
    antes de chamar, e `catch` em volta da chamada: as duas situações caem no
    mesmo tratamento.
- **ESLint**: `eslint.config.js` ganha a zona da feature nova, na mesma tarefa
  (regra de `project-structure`):
  `{ target: './apps/web/src/features/invitations', from: './apps/web/src/features', except: ['./invitations'] }`.
- Alternativa descartada: guardar o token/link num store Zustand — motivo: é
  estado de uma tela só, some quando ela sai, e um store global aumentaria a
  chance de o token sobreviver à navegação (R6/R7).
- Alternativa descartada: mostrar o link num diálogo modal — motivo: o link
  precisa poder ficar visível enquanto a pessoa cola no e-mail dela; um modal
  empurra para fechar, e fechar apaga o link para sempre.
- Alternativa descartada: um `<p aria-live="polite">` próprio no
  `invitation-link.tsx` — motivo: duplicaria o canal de aviso do app; quem lê
  tela passaria a ter dois lugares por onde a mesma resposta chega.

### D9 — API simulada (`api-mocking`)

- Escolha: `apps/web/src/testing/mocks/handlers/invitations.ts`, no molde de
  `handlers/org-units.ts`: `http.post(`${env.API_URL}/invitations`)` com o
  mesmo preâmbulo (`networkDelay`, `devOverride('invitations')`, 401 sem cookie
  ou sem instalação, 403 para não-admin), depois corpo estrito (chave
  desconhecida → 400 "Campo não permitido."), e-mail ausente/vazio → 400
  "Informe o e-mail.", e-mail sem formato válido → 400 "Informe um e-mail
  válido.", e-mail igual ao da pessoa instalada (comparado em minúsculas) → 409
  "Esta pessoa já faz parte da organização."; senão grava e responde 201.
- `db.ts`: `MockInvitation = { id, email, createdAt, expiresAt }` (**sem
  token nem hash** — o banco falso não precisa conferir nada nesta fatia),
  array `invitations` no `DbState`, e `addInvitation({ email })` que **remove
  no lugar** (`splice`, pela regra do comentário de `touchDocumentUpdatedAt`)
  o convite pendente do mesmo e-mail antes de empilhar o novo, repetindo a
  substituição de R3. O token devolvido é um valor legível e explicitamente
  falso, montado em tempo de execução (`['mock','invitation','token',…].join('-')`
  + um contador), pelo mesmo motivo do `MOCK_PASSWORD`: nenhum literal com cara
  de credencial no repositório.
- `handlers/index.ts` (ou onde o array de handlers é composto) passa a incluir
  `invitationsHandlers`.
- **Chave de desenvolvimento nova**, documentada no comentário de `utils.ts`:
  `localStorage.setItem('mock-invitations', 'sample')` → semeia um convite
  pendente para `convidado@exemplo.com.br`, para ver a substituição de R3 no
  navegador. `mock-error=invitations` dá o 500 (já é o mesmo `devOverride`);
  `mock-role=member` dá o 403.
- Alternativa descartada: guardar `tokenHash` no banco falso — motivo: nada na
  web confere token; a 086 acrescenta quando passar a conferir.

### D10 — Testes

- **API, integração contra Postgres real** —
  `apps/api/src/invitations/__tests__/invitations.integration.test.ts`
  (ajudante `postInvitation(body, cookie?)` com `X-Requested-With`):
  admin cria → **201**, corpo com `token` **não vazio**, `expiresAt` ≈
  `createdAt + 7 dias` (tolerância de segundos); **no banco só existe o hash**:
  `prisma.invitation.findFirstOrThrow()` tem `tokenHash === createHash('sha256').update(token).digest('hex')`
  e **nenhuma** coluna traz o token — provado varrendo
  `Object.values(row)` e afirmando que nenhum valor de string contém o token
  (e não só olhando os campos que conhecemos); **não-admin → 403** "Apenas a
  administração pode fazer isso."; **anônimo → 401** "Sessão não encontrada.";
  **e-mail já cadastrado como pessoa → 409** com a mensagem exata, inclusive
  digitado em CAIXA ALTA e com espaços em volta (prova a normalização);
  **convidar de novo substitui**: dois `POST` para o mesmo e-mail →
  `prisma.invitation.count({ where: { email } })` é **1**, o `id` é outro, e o
  hash do **primeiro** token não existe mais em nenhuma linha (o link antigo
  não tem como validar); **e-mail inválido → 400** `{ message: 'Dados inválidos.', errors: [{ field: 'email', … }] }`;
  campo a mais → 400; **banco**: inserir dois convites do mesmo e-mail
  diferindo só na caixa das letras, direto pelo Prisma, rejeita com `P2002`
  (prova o índice da `0009`).
- **API, unitários** — `invitations.service.test.ts` (Prisma falso): o e-mail é
  aparado e minúsculo antes de qualquer consulta; 409 quando a pessoa existe,
  **sem** chegar ao `create`; `deleteMany` roda **antes** do `create` e na
  mesma transação; o `tokenHash` gravado é o sha256 do token devolvido e o
  token **não** aparece em nenhum outro campo de `data`; `P2002` →
  `ConflictException(RACE_MESSAGE)`; outro erro é relançado e a mensagem dele
  não contém o token.
- **API, contrato** — `invitations.contract.test.ts`: 201, 400, 401, 403 e 409
  do `POST` validados contra o `openapi.yaml`.
- **Web, unitários** — `utils/__tests__/build-invitation-link.test.ts`: monta
  `https://app.exemplo.org/invitations/<token>` a partir de origem e token;
  origem com barra final não duplica a barra; token com caractere fora do
  alfabeto esperado sai escapado. `api/__tests__/create-invitation.test.tsx`:
  manda `POST /invitations` com o corpo `{ email }`; 409 rejeita **sem**
  notificação global (`silentError`).
- **Web, componente** — `create-invitation-form.test.tsx`: rótulo "E-mail"
  associado ao campo; enviar vazio mostra "Informe o e-mail." sem chamar a API;
  e-mail inválido mostra "Informe um e-mail válido."; sucesso chama `onSuccess`
  com o convite e limpa o campo; 409 do servidor vira erro **no campo**, com
  foco nele e o que foi digitado preservado; 500 mostra o alerta interno; dois
  `Enter` seguidos fazem **um** pedido (handler contador).
  `invitation-link.test.tsx`: mostra o link completo e o aviso de "uma única
  vez"; "Copiar link" chama `writeText` com o link e publica a notificação de
  sucesso; recusa publica a notificação de erro e o link continua na tela.
  **Como mockar `navigator.clipboard` no jsdom**: o jsdom não implementa
  `navigator.clipboard` e a propriedade não é gravável — o teste usa
  `Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn() }, configurable: true })`
  num `beforeEach`, e `Reflect.deleteProperty(navigator, 'clipboard')` no
  `afterEach` (por isso `configurable: true`), para os três casos: sucesso
  (`writeText` resolve), recusa (`writeText` rejeita com
  `new DOMException('…', 'NotAllowedError')`) e **ausência** (a propriedade não
  é definida; o componente nem chega a chamar). O `setup-tests.ts` **não** muda:
  o mock é local ao arquivo de teste que precisa dele.
- **Web, integração de rota** —
  `app/routes/app/admin/__tests__/invitations.test.tsx`: a jornada da rota com
  MSW — admin abre `/admin/invitations`, preenche o e-mail, envia, vê o link e
  o aviso; não-admin é levado ao início e **nenhuma** requisição a
  `/invitations` sai; criar um segundo convite substitui o bloco do link (o
  link antigo não está mais no DOM).
- **e2e** — `apps/web/e2e/tests/invitations-create.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota,
  `mock-installation=signed-in`: (a) só teclado — da barra lateral até
  "Convites", preencher o e-mail, enviar, ver o bloco do link, `Tab` até
  "Copiar link", `Enter`, ver a notificação "Link copiado";
  `expectNoSeriousA11yViolations` **duas vezes**: na página vazia e com o bloco
  do link visível. (b) convidar o e-mail da pessoa instalada mostra o erro no
  campo e o bloco do link não aparece. No Playwright a permissão de área de
  transferência é concedida pelo contexto (`permissions: ['clipboard-write']`),
  no mesmo lugar em que os outros specs configuram o contexto. Os e2e da 064,
  065 e 066 não mudam: o item novo da barra lateral vem **depois** de
  "Estrutura", então nenhuma contagem de `Tab` existente muda.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. Receitas usadas:
"Contêiner de página", "Título de página", "Texto de apoio", "Campo de
formulário", "Alerta dentro de formulário", "Botão principal", "Botão
secundário", "Aviso informativo", "Notificação", "Seção da barra lateral",
"Item da barra lateral". Receita **nova**, acrescentada a "Padrões
acrescentados pelas entregas" com a fatia 085:

| Padrão | Classes |
|---|---|
| Segredo mostrado uma única vez | bloco `mt-6 rounded-md border border-amber-200 bg-amber-50 p-4`; título `text-sm font-medium text-amber-900`; explicação `mt-1 text-sm text-amber-800`; o valor num `<input readOnly>` com as classes da receita "Campo de formulário" mais `font-mono` e `bg-white`, dentro de `mt-3 flex flex-wrap items-center gap-2`, com o botão de copiar (secundário) ao lado; o valor nunca é reexibido depois que o bloco sai da tela |

### Página "Convites" (`/admin/invitations`)

De cima para baixo, dentro do `ContentLayout` (mesma moldura de "Estrutura"):

- `<h1>` "Convites".
- Texto de apoio: "Convide novas pessoas informando o e-mail. O link do
  convite aparece aqui, uma única vez, e vale por 7 dias."
- Formulário (`<form>` com um campo): rótulo "E-mail", campo `type="email"`,
  dica abaixo do campo: "A pessoa escolhe o nome e a senha ao criar a conta."
  Botão principal "Criar convite" (enviando: "Criando…", desabilitado, com
  indicador).
- Abaixo, quando um convite acabou de ser criado, o bloco "Segredo mostrado uma
  única vez" (receita nova).

Estados: a página **não lê** nada da API (não há `GET` nesta fatia), então não
tem carregando, vazio nem erro de carga. Tem: **em branco** (só o formulário),
**enviando** (botão), **erro de campo** (mensagem sob o campo, `aria-invalid`),
**erro geral** (alerta dentro do formulário) e **criado** (bloco do link).

### Bloco do convite criado

Título "Convite criado para {e-mail}". Explicação: "Copie o link agora: ele
aparece uma única vez e não pode ser mostrado de novo. Se perder, convide o
mesmo e-mail outra vez para gerar um link novo." Abaixo, o link num campo
`readOnly` (rótulo "Link do convite", visível) e o botão secundário "Copiar
link". O bloco some quando outro convite é criado ou quando a pessoa sai da
página.

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| campo vazio | "Informe o e-mail." | sob o campo (cliente e servidor) |
| formato inválido | "Informe um e-mail válido." | sob o campo (cliente e servidor) |
| servidor, 409 pessoa | "Esta pessoa já faz parte da organização." | sob o campo, com foco nele |
| servidor, 409 corrida | "Outro convite para este e-mail foi criado ao mesmo tempo. Tente de novo." | sob o campo |
| servidor, 400 campo a mais | "Campo não permitido." | não chega à tela (o formulário manda só `email`) |
| servidor, 401 | "Sessão não encontrada." (já existe) | interceptor global → recarrega para o login |
| servidor, 403 | "Apenas a administração pode fazer isso." (já existe) | corpo da API; a tela nem é montada para não-admin |
| outras falhas | "Não foi possível criar o convite. Tente de novo em instantes." | alerta dentro do formulário |
| copiou | "Link copiado" | notificação de sucesso (`role="status"`) |
| não deu para copiar | título "Não foi possível copiar" · mensagem "Selecione o link e copie com o teclado." | notificação de erro (`role="alert"`); o link continua na tela |

Layout a 360px: o campo do link e o botão ficam num `flex-wrap`, o campo com
`min-w-0 flex-1` e `font-mono text-sm`; o link não quebra o layout porque está
dentro de um `<input>`, que rola horizontalmente sozinho.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `/invitations` `post`: 201/400/401/403/409; schemas `CreateInvitationInput`, `CreatedInvitation`, `CreatedInvitationResponse` (D1) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` (D1) | — |
| criar | `apps/api/prisma/migrations/0009_invitation/migration.sql` | tabela, índices (inclusive `lower("email")`) e FKs em `RESTRICT`, à mão (D3) | `security` |
| alterar | `apps/api/prisma/schema.prisma` | modelo `Invitation` + relações em `Organization` e `Person` (D2) | — |
| criar | `apps/api/src/invitations/invitations.schema.ts` | `createInvitationSchema` (D6) | `security` |
| criar | `apps/api/src/invitations/invitations.service.ts` | `create`, `hashToken` local, `INVITATION_TTL_MS`, duas mensagens (D4, D5) | `security` |
| criar | `apps/api/src/invitations/invitations.controller.ts` | `@Post()` 201, guards na classe (D6) | `authorization`, `security` |
| criar | `apps/api/src/invitations/invitations.module.ts` | módulo (D6) | `project-structure` |
| alterar | `apps/api/src/app.module.ts` | registra `InvitationsModule` (D6) | `project-structure` |
| criar | `apps/api/src/invitations/__tests__/invitations.service.test.ts` | D10 | `unit-testing` |
| criar | `apps/api/src/invitations/__tests__/invitations.integration.test.ts` | D10, inclusive a prova do índice da `0009` e "só o hash no banco" | `integration-testing` |
| criar | `apps/api/src/invitations/__tests__/invitations.contract.test.ts` | D10 | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/config/paths.ts` | `admin.invitations` (D8) | `routing` |
| alterar | `apps/web/src/app/router.tsx` | rota `lazy` de `/admin/invitations` (D8) | `routing` |
| alterar | `apps/web/src/components/layouts/sidebar-admin.tsx` | item "Convites" depois de "Estrutura" (D8) | `interface-design` |
| criar | `apps/web/src/app/routes/app/admin/invitations.tsx` | rota protegida, guarda o convite criado em `useState` (D8) | `routing`, `authorization`, `interface-design` |
| criar | `apps/web/src/features/invitations/api/create-invitation.ts` | schema de entrada, fetcher `silentError`, hook (D8) | `api-requests`, `forms` |
| criar | `apps/web/src/features/invitations/components/create-invitation-form.tsx` | formulário de um campo, 409 no campo, guarda de clique duplo (D8) | `forms`, `interface-design`, `error-handling` |
| criar | `apps/web/src/features/invitations/components/invitation-link.tsx` | bloco do link, "Copiar link", notificações (D8) | `interface-design`, `component-robustness`, `security` |
| criar | `apps/web/src/features/invitations/utils/build-invitation-link.ts` | origem + `/invitations/:token` (D7) | `security` |
| alterar | `eslint.config.js` | zona `features/invitations` em `import/no-restricted-paths` (D8) | `project-structure` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `MockInvitation`, `invitations` no estado, `addInvitation` com substituição (D9) | `api-mocking` |
| criar | `apps/web/src/testing/mocks/handlers/invitations.ts` | `POST` com 401/403/400/409/201 (D9) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/index.ts` | inclui `invitationsHandlers` (D9) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário das chaves: `mock-invitations=sample` e `mock-error=invitations` (D9) | `api-mocking` |
| criar | `apps/web/src/features/invitations/utils/__tests__/build-invitation-link.test.ts` | D10 | `unit-testing` |
| criar | `apps/web/src/features/invitations/api/__tests__/create-invitation.test.tsx` | D10 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/invitations/components/__tests__/create-invitation-form.test.tsx` | D10 | `component-testing`, `api-mocking` |
| criar | `apps/web/src/features/invitations/components/__tests__/invitation-link.test.tsx` | D10, `navigator.clipboard` por `defineProperty` | `component-testing` |
| criar | `apps/web/src/app/routes/app/admin/__tests__/invitations.test.tsx` | D10 | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/invitations-create.spec.ts` | duas jornadas de D10, axe nos dois estados | `e2e-testing` |
| alterar | `docs/design.md` | receita "Segredo mostrado uma única vez" (085) | `interface-design` |
| alterar | `docs/architecture.md` | §6: parágrafo "Entrega `invitations-create` (fatia 085)" — token de 32 bytes `base64url` guardado só como `sha256` (mesmo desenho de `Session`), devolvido uma única vez no 201; `hashToken` duplicado em `invitations` de propósito (a 086 extrai); "um convite pendente por e-mail" garantido pelo índice por expressão `lower("email")` da `0009`, com a substituição numa transação; `POST /invitations` herda `SessionGuard` + `AdminGuard` da classe, ordem CSRF → 401 → 403 → 400 → 409; o link é montado pelo navegador, e o caminho público `/invitations/:token` só existe a partir da 086 | — |
| alterar | `docs/roadmap.md` | item 085 concluído; dívidas abaixo que virarem item | — |

Intocados de propósito (comparar com `feature/066-org-units-delete`):
`apps/api/src/auth/**` (inclusive `session.service.ts` e `admin.guard.ts`),
`apps/api/src/access/**`, `apps/api/src/documents/**`, `apps/api/src/org-units/**`,
`apps/api/src/installation/**`, `apps/api/src/common/**`, `apps/api/test/**`,
migrations `0001`–`0008`, `apps/web/src/lib/**`, `apps/web/src/components/**`,
`apps/web/src/features/{auth,connection,installation,documents,org-units}/**`,
`apps/web/src/testing/setup-tests.ts`, `apps/web/src/app/routes/app/admin/structure.tsx`,
os e2e da 064, 065 e 066.

## Estimativa de tamanho

Jornadas: 1 (a administração convida um e-mail e copia o link) · Telas
principais novas: 1 ("Convites") · Fases previstas: 3 · Linhas alteradas (sem
testes, sem o `.d.ts` gerado): ~430 (API ~215 — YAML ~75, migration ~25,
schema Prisma ~20, `invitations.schema.ts` ~15, serviço ~60, controller ~15,
módulo ~12, `app.module.ts` ~2; web ~185 — paths/router/sidebar ~20, rota ~35,
`create-invitation.ts` ~35, formulário ~70, `invitation-link.tsx` ~55,
`build-invitation-link.ts` ~8, eslint ~5; `src/testing/` ~70; docs ~25). Com
testes: ~950.

Sinais de "grande demais": **um dispara** — ~430 linhas sem testes, acima do
teto de ~400. Os outros três não disparam (uma jornada, uma tela principal
nova, 3 fases). O estouro é de ~8% e é **infraestrutura que nasce uma vez**:
módulo novo na API (~90 linhas de esqueleto: módulo, controller, schema,
registro no `app.module.ts`) e feature nova na web (~25 linhas entre rota,
`paths`, `sidebar` e zona do ESLint) — nada disso reaparece na 086, 087, 088
ou 089, que entram num módulo e numa feature já existentes. O corte que
reduziria o restante já foi feito no PRD (a listagem virou a 088 e o envio por
e-mail a 089) e foi aceito. Se ainda assim o implementer passar de ~460 no
total sem testes, o corte de emergência é mover o bloco do link para a 086
(criar o convite sem mostrar o link seria inútil — por isso ele é o **último**
recurso, e não o primeiro).

## Dívida encontrada

- **`hashToken` duplicado** (D5): existe privado em `auth/session.service.ts` e
  passa a existir em `invitations/invitations.service.ts`. A 086 é a terceira
  ocorrência (conferir o token do convite) e deve extrair para
  `apps/api/src/common/hash-token.ts`, com os dois serviços passando a usá-la.
- **Schema de e-mail duplicado** (D6): o mesmo encadeamento `trim → toLowerCase
  → z.email` está em `installation.schema.ts` e agora em
  `invitations.schema.ts`. A 086 (formulário de aceite) é a terceira e deve
  extrair. Enquanto isso, mudar a normalização em um lugar e não no outro
  quebra o 409 de R4 — está dito em comentário nos dois arquivos.
- **Índice ainda não parcial** (D3): `Invitation_lower_email_key` não tem
  `WHERE` porque não há coluna de estado. A 086 (`acceptedAt`) e a 087
  (`revokedAt`) precisam trocá-lo por um índice parcial na migration delas; se
  não trocarem, um e-mail já convidado e aceito nunca mais poderá ser
  convidado.
- **O caminho `/invitations/:token` fora de `paths.ts`** (D7): mora como
  constante em `build-invitation-link.ts` porque a rota não existe. A 086 move
  para `paths.invitationAccept` ao criar a rota. Enquanto isso, o link gerado
  cai na página de "não encontrado" da SPA — por isso 085 e 086 são mescladas
  juntas.
- **Sem limite de convites por administrador ou por janela de tempo**: nada
  impede criar convites em rajada. Não é regressão (nenhum endpoint do app tem
  limitação de taxa hoje), mas este é o primeiro que gera segredo a pedido;
  vira item de roadmap junto com a 089 (envio por e-mail), quando passar a
  custar mensagem enviada.
- **Convite vencido nunca é removido**: as linhas com `expiresAt` no passado
  ficam na tabela e continuam ocupando o índice único — o mesmo e-mail não pode
  ser convidado de novo… exceto pela substituição de R3, que apaga a antiga.
  Funciona, mas a tabela cresce; uma limpeza periódica é item de roadmap.
- **A API simulada não guarda hash de token** (D9): a 086 precisará guardar
  para conferir o link no navegador.
- Herdadas e ainda válidas: `lower()` depende do `LC_CTYPE` do banco de
  hml/produção (conferir pelo contêiner) — vale agora também para o e-mail do
  convite; falta o projeto Playwright contra a API real, então o 403 e os 409
  do servidor só são provados pela integração da API.
