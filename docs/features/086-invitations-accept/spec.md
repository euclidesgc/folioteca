# SPEC 086 — invitations-accept

Segunda das fatias em que o item 009 `invitations` foi cortado (085 criar, 086
aceitar, 087 revogar, 088 listar, 089 enviar por e-mail). PRD aprovado em
`prd.md`, nesta mesma pasta. Parte de `docs/architecture.md` §2 (contrato
primeiro), §6 (sessão opaca em cookie `httpOnly`, só o `sha256` no banco; o
parágrafo da 085 descreve o desenho do token do convite) e §7 (testes).

**Base da entrega**: a branch `feature/086-invitations-accept` sai de
`feature/085-invitations-create` (PR #109, ainda não mesclada). **Toda**
comparação de "arquivo intocado" e todo diff é contra
`feature/085-invitations-create`, nunca contra `develop`. As duas fatias vão
para revisão empilhadas e são **mescladas juntas**: só com esta o link copiado
na 085 abre alguma coisa.

Lições vigentes que valem para toda tarefa do PLAN (herdadas da 065/066/085):
`React.JSX.Element` (nunca o `JSX` global); botão nosso é sempre o componente
`Button`; cobertura ≥ 80% por arquivo; nenhum aviso em `install`, `lint`,
`typecheck`, `test` e `build`; **toda** espera depois de mudança de rota ou
chunk `lazy` com `timeout` explícito (unitário: `LAZY_TIMEOUT`; e2e:
`ROUTE_TIMEOUT`), nunca `sleep` fixo; typecheck e lint finais rodados de
verdade com o cache limpo (`pnpm exec tsc -b --clean`); **nenhum** `prisma
migrate diff/dev/reset` — só `validate`, `status` e `deploy`; nenhum literal
com cara de senha ou de token; o agente derruba tudo o que subir.

## Aviso de tamanho (estouro aprovado)

Esta fatia estoura o teto de ~400 linhas sem testes de `vertical-slicing`:
a estimativa é de **~615**. O estouro foi apresentado ao dono e **aprovado**
(opção A), pelos motivos abaixo — a seção "Estimativa de tamanho" traz a conta
detalhada.

- É uma **jornada de autenticação indivisível**: criar conta a partir de um
  link e entrar autenticado é o mínimo que prova o caminho de ponta a ponta.
  Cortar pela metade deixaria um lado inútil — ver o e-mail do convite sem
  poder aceitar não entrega valor nenhum, e o próprio PRD diz que sem o aceite
  o link não leva a lugar algum.
- **Não há infraestrutura reaproveitável para adiar**, ao contrário da 085
  (que pagou o módulo da API e a feature da web): aqui tudo o que se escreve é
  regra desta jornada.
- O corte alternativo estudado (**B**: adiar R1, tirando o
  `GET /invitations/{token}`, o schema de preview, a query e o estado de
  carregando) economizaria ~150 linhas, **deixaria a fatia ainda em ~470** —
  ou seja, não resolve o sinal — e pioraria o produto: a pessoa só descobriria
  que o link morreu depois de preencher nome e senha.
- As regras de recusa (R5, R6, R7) são de segurança e não podem ficar para
  depois: um link inválido não pode virar 500 nem oráculo de enumeração.

Os outros três sinais **não** disparam: uma jornada, uma tela principal nova,
três fases.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `GET /invitations/{token}` público devolve **só** `{ email, organizationName }` (D1); a rota `/invitations/:token` mostra os dois antes do formulário (Interface). |
| R2 | `acceptInvitationSchema` reusa as regras de `installation.schema.ts` para `name` e `password` (mínimo de 12), sem regra nova; o corpo **não tem** campo de e-mail — ele é o do convite, e a tela o mostra como texto, não como campo (D5, D8). |
| R3 | O `POST /invitations/{token}/accept` responde **201** com `CurrentUserResponse` e grava o cookie `folioteca_session` pelo mesmo caminho da instalação (D6, D7); a web guarda o corpo direto no cache de `getUserQueryOptions()` e navega para o início, sem passar pelo login (D9). |
| R4 | A transação cria a `Person` com `isAdmin: false` e **só** o espaço `PERSONAL`; nenhuma `OrgUnit` e nenhum espaço de unidade (D7). A barra lateral já esconde "Administração" de quem não é admin desde a 064 — nada muda lá. |
| R5 | `acceptedAt` marcado **dentro** da mesma transação (D3, D7); o `findPending` só aceita `acceptedAt: null`, então o segundo uso do link cai no 404 genérico. |
| R6 | Um único 404, com **o mesmo corpo byte a byte** nos quatro casos, montado por uma constante (D2, D4); a web trata qualquer falha do `GET` e o 404 do `POST` com a **mesma** tela de erro (D8, D9). |
| R7 | As duas rotas da API **ignoram o cookie** (sem `SessionGuard`, sem leitura da sessão) e a rota da web fica fora do `ProtectedRoute` e fora do gate de instalação (D6, D8): quem tem sessão vê a mesma tela de erro genérica e continua logado. |
| R8 | O token só existe em `useParams()` e no caminho da requisição; nada em `localStorage`, nada em `console`, nenhum `Logger` no caminho do servidor (D2, D8). |
| R9 | Textos literais na seção Interface, em pt_BR; caminhos em inglês (`/invitations/{token}/accept`). e2e com axe na tela de convite e na tela de erro (D11). |

## Decisões técnicas

### D1 — Contrato: `GET /invitations/{token}` (contrato primeiro, §2)

- Escolha: em `packages/api-contract/openapi.yaml`, caminho
  **`/invitations/{token}`** (sem o prefixo `/api`, como todos os caminhos do
  arquivo — o `/api` é do proxy do Vite e do `env.API_URL`), operação `get`,
  `operationId: getInvitation`, tag `invitations`, **sem** requisito de sessão.
- Parâmetro de rota `token: string`, com a `description` registrando que é o
  token em claro do link e que o servidor só guarda o hash dele.
- Resposta **200**: `InvitationPreviewResponse` = `{ data: InvitationPreview }`,
  com `InvitationPreview = { email, organizationName }` e nada mais.
- Resposta **404**: `Error`, com a `description`: *"O convite não está
  disponível. A mesma resposta para link inexistente, expirado, já aceito ou
  revogado: nada no corpo, no código ou no tempo de resposta distingue os
  casos."*
- **Por que o GET não vaza nada**: os dois campos devolvidos são os que a
  pessoa que recebeu o link **já sabe** (o e-mail é dela, e a organização está
  no convite que ela recebeu). Ficam de fora `id`, `expiresAt`, `createdAt` e
  qualquer dado de quem convidou — `expiresAt` diria "existiu e venceu", e um
  `id` daria material para correlacionar convites. Quem não tem o token não
  obtém nada, porque o token é o segredo: 256 bits em `base64url`.
- Alternativa descartada: devolver o convite inteiro (`CreatedInvitation` sem
  o `token`) — motivo: seria reaproveitar um schema por preguiça e entregar
  campos que a tela não usa; cada campo a mais é superfície de vazamento.
- Alternativa descartada: `HEAD` ou um `GET /invitations/{token}/status` com
  `{ valid: boolean }` — motivo: a tela precisa do e-mail e da organização
  (R1); dois endpoints para a mesma pergunta multiplicariam os caminhos de
  recusa, e é justamente a **unicidade** do caminho que garante R6.

### D2 — Contrato: `POST /invitations/{token}/accept`

- Escolha: mesma `paths`, sub-caminho **`/invitations/{token}/accept`**,
  operação `post`, `operationId: acceptInvitation`, tag `invitations`, **sem**
  requisito de sessão.
- Corpo: `AcceptInvitationInput` = `{ name: string, password: string }`,
  `required: [name, password]`, `additionalProperties: false`. **Não existe
  campo de e-mail**: ele vem do convite (R2), e aceitá-lo no corpo abriria a
  porta para criar conta com outro endereço.
- Resposta **201**: **`CurrentUserResponse`**, o mesmo schema já usado por
  `POST /installation` e `POST /auth/login`. A `description` registra que a
  resposta traz o `Set-Cookie` da sessão e que é o mesmo corpo de
  `GET /auth/me` — a web não precisa de um segundo pedido.
- Códigos e por quê:
  - **201** e não 200: o pedido **cria** uma pessoa; é o mesmo código que
    `POST /installation` usa para o mesmo tipo de efeito.
  - **404** genérico: convite inexistente, expirado, já aceito ou revogado.
    404 e não 401/403 porque a pergunta não é "quem é você" nem "você pode" —
    é "este recurso existe para você?", e a resposta honesta, sem vazar, é
    "não existe". 410 (Gone) seria mais preciso para "expirado/usado" e por
    isso mesmo está **descartado**: distinguir de 404 é o oráculo que R6 proíbe.
  - **409**: o e-mail do convite virou pessoa entre a criação do convite e o
    aceite (alguém instalou/criou a conta por outro caminho). Não é 404 porque
    aqui **não há nada a esconder**: quem tem o token já sabe o e-mail, e a
    pessoa precisa saber que deve entrar com a conta que já existe. É a mesma
    escolha de código do 409 da 085.
  - **400**: `ValidationError`, pelas regras de nome e senha — o mesmo formato
    `{ message, errors: [{ field, message }] }` do resto da API.
  - **403**: CSRF (guard global), quando falta `X-Requested-With`.
- A `description` da operação fixa a ordem observável: CSRF → 400 (corpo) →
  404 (convite) → 409 (e-mail já é de uma pessoa). O corpo é validado **antes**
  da busca do convite de propósito: assim o tempo de resposta de um corpo
  inválido não depende de o convite existir.
- Tipos regenerados com `pnpm --filter @folioteca/api-contract generate`;
  `apps/api/test/generated-types.test.ts` continua valendo sem alteração.
- Alternativa descartada: `POST /people` com o token no corpo — motivo: o
  recurso desta operação é o convite, e o token é a credencial de acesso a ele;
  no caminho, ele fica no mesmo lugar em que o `GET` já o espera.
- Alternativa descartada: o 201 devolver um schema próprio (`AcceptedInvitation`)
  — motivo: o que a web precisa depois de aceitar é exatamente "quem sou eu
  agora", que já tem nome no contrato; um schema novo faria a web escrever um
  segundo caminho para guardar o usuário no cache.

### D3 — Migration `0010` escrita à mão: `acceptedAt` e o índice parcial

- Escolha: `acceptedAt DateTime?` novo em `Invitation`
  (`apps/api/prisma/schema.prisma`), nulo enquanto pendente, com a data do
  aceite depois. **Não** se apaga a linha ao aceitar: R5 exige que o segundo
  uso do mesmo link falhe, e a linha aceita também é o registro de auditoria
  de quem entrou por convite. Apagar deixaria "não existe" e "já usado"
  indistinguíveis por acidente em vez de por decisão — e perderia a auditoria.
- `apps/api/prisma/migrations/0010_invitation_accepted_at/migration.sql`,
  escrita **à mão** (a regra do projeto proíbe `migrate diff/dev/reset`):
  ```sql
  ALTER TABLE "Invitation" ADD COLUMN "acceptedAt" TIMESTAMP(3);

  -- "One pending invitation per e-mail" must stop counting the accepted ones:
  -- with the 0009 index, an address that already accepted an invitation could
  -- never be invited again. The index becomes partial over the pending rows.
  -- The 087 adds "revokedAt" to this same predicate when it adds the column.
  DROP INDEX "Invitation_lower_email_key";

  CREATE UNIQUE INDEX "Invitation_lower_email_key" ON "Invitation"(lower("email"))
      WHERE "acceptedAt" IS NULL;
  ```
- O comentário do modelo `Invitation` no `schema.prisma` é atualizado: o índice
  por expressão agora é **parcial**, continua invisível ao schema e por isso
  `migrate diff` segue proibido aqui.
- Isto encerra a parte que cabe a esta fatia da **dívida 091** (índice ainda
  não parcial, registrada pela 085). A parte restante — incluir `revokedAt` no
  predicado — é da 087, e fica repetida em "Dívida encontrada".
- `DROP` + `CREATE` em vez de um índice novo com outro nome: o nome
  `Invitation_lower_email_key` é o que `invitations.service.ts` procura em
  `isLowerEmailViolation` para transformar `P2002` no 409 de corrida da 085;
  trocar o nome quebraria aquele caminho em silêncio.
- Alternativa descartada: um `status` enum (`PENDING`/`ACCEPTED`/`REVOKED`) —
  motivo: a 087 precisa saber **quando** revogou, e duas colunas de data
  guardam a mesma informação com o histórico junto; o predicado parcial fica
  igualmente simples.
- Alternativa descartada: apagar a linha do convite ao aceitar — ver acima.

### D4 — Como o token é comparado e por que as quatro recusas são idênticas
      (`security`, `authentication`)

- O token chega **em claro** no caminho da URL e nunca é consultado assim:
  `const tokenHash = hashToken(token)` (D5), e a busca é
  `prisma.invitation.findUnique({ where: { tokenHash } })` — `tokenHash` é
  `@unique` desde a 0009, então a igualdade acontece dentro do índice, sobre um
  digest de tamanho fixo (64 hex), e não sobre o segredo.
- **Comparação em tempo constante**: o serviço não se contenta com a igualdade
  do banco. Depois de achar a linha, confere
  `timingSafeEqual(Buffer.from(row.tokenHash, 'hex'), Buffer.from(tokenHash, 'hex'))`
  antes de seguir. Os dois buffers têm sempre 32 bytes (é um sha256), então
  `timingSafeEqual` nunca lança por tamanho diferente. O ganho prático sobre o
  índice é pequeno — o ponto é que a última palavra sobre "é este token mesmo?"
  fica num caminho sem atalho por prefixo, e o formato do token não muda isso.
- **Uma função, quatro casos**: `findPending(token)` devolve a linha **ou
  `null`**, e devolve `null` para inexistente, `expiresAt <= now`,
  `acceptedAt !== null` e (a partir da 087) `revokedAt !== null`. As quatro
  checagens rodam **sempre todas**, em memória, sobre o mesmo objeto, sem
  `return` antecipado entre elas — nenhuma delas dispara consulta a mais nem
  encerra o caminho antes das outras.
- **Por que a resposta é idêntica**: quem chama recebe `null` e lança
  `new NotFoundException(INVITATION_UNAVAILABLE_MESSAGE)`, uma constante única
  do módulo. Não existe um segundo lugar que monte um 404 nesse caminho, então
  corpo, código e cabeçalhos são **byte a byte iguais** nos quatro casos — e é
  isso que a integração afirma, comparando as respostas entre si e não cada uma
  com um literal (D11). O tempo também não separa os casos: a diferença entre
  "não achou linha" e "achou e recusou" é uma consulta que retorna zero ou uma
  linha pelo mesmo índice, e o caso "achou" faz **mais** trabalho, não menos —
  o contrário do oráculo clássico.
  - `INVITATION_UNAVAILABLE_MESSAGE = 'Convite não encontrado.'` — mensagem
    **de API**, em pt_BR, que a tela não usa: a web mostra o texto da seção
    Interface, e nunca ecoa a mensagem do servidor nesta rota (ecoar seria
    abrir uma porta para o servidor influenciar o que a tela diz).
- Alternativa descartada: buscar por `email` e comparar o hash em memória —
  motivo: exigiria conhecer o e-mail antes de conferir o token, que é
  exatamente a ordem invertida.
- Alternativa descartada: um 404 diferente para "token malformado" (por exemplo,
  caractere fora do `base64url`) — motivo: seria um oráculo de graça; o token
  é tratado como string opaca, o hash é calculado de qualquer coisa, e o
  resultado é o mesmo 404.

### D5 — `hashToken` sai para `common/` (encerra a dívida 090)

- Escolha: **criar `apps/api/src/common/hash-token.ts`**:
  ```ts
  import { createHash } from 'node:crypto';

  /**
   * Só o hash de um segredo opaco vai para o banco — sessões e convites usam
   * o mesmo desenho. O valor em claro existe apenas no cookie (sessão) ou no
   * link (convite).
   */
  export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  ```
- `apps/api/src/auth/session.service.ts` e
  `apps/api/src/invitations/invitations.service.ts` apagam a cópia privada
  deles e passam a importar daqui.
- Motivo: esta fatia é a **terceira ocorrência**, exatamente o gatilho que a
  SPEC 085 registrou (D5 de lá) ao decidir duplicar na segunda. Não extrair
  agora seria escolher uma terceira cópia numa rotina de criptografia — e o
  módulo `common/` já existe (`parse-body.ts`, `csrf.guard.ts`), então não se
  inventa pasta nenhuma.
- Isto **encerra a dívida 090** (`hashToken` duplicado). O parágrafo do §6 de
  `docs/architecture.md` escrito pela 085, que aponta a 086 como responsável
  pela extração, é atualizado no mesmo commit.
- `apps/api/src/auth/**` estava na lista de "intocados" da 085; aqui ele muda
  **em uma linha de import e na remoção da função privada**, e só por isso.
  Nenhuma mudança de comportamento em sessão: o teste de sessão existente
  continua passando sem alteração, e isso é critério.
- Alternativa descartada: continuar com três cópias — motivo: a regra de três
  já foi acordada por escrito na 085.
- Alternativa descartada: mover para `auth/hash-token.ts` — motivo: deixaria
  `invitations` importando de dentro de `auth`, que é justamente o que a 085
  recusou; a primitiva não é de nenhum dos dois.
- O que **não** se extrai: o schema de e-mail duplicado
  (`trim → toLowerCase → z.email`, dívida da 085). Esta fatia **não tem campo
  de e-mail** no corpo (D2), então ela não é a terceira ocorrência dele — a
  dívida continua aberta, agora com a 088 ou a 089 como candidata. Está dito em
  "Dívida encontrada".

### D6 — Controller: duas rotas públicas que ignoram o cookie
      (`authentication`, `authorization`)

- Escolha: as duas operações entram no `InvitationsController` já existente,
  **sem** os guards da classe. O `@UseGuards(SessionGuard, AdminGuard)` hoje
  está na **classe** (decisão da 085): as rotas novas o sobrescrevem com
  `@UseGuards()` **vazio** no método, o jeito do Nest de dizer "esta rota não
  herda", com um comentário explicando por quê.
  ```ts
  @Get(':token')
  @UseGuards() // pública: o convite é aberto por quem ainda não tem conta.
  async getInvitation(@Param('token') token: string): Promise<InvitationPreviewResponse>

  @Post(':token/accept')
  @HttpCode(201)
  @UseGuards() // pública: aceitar o convite é o que cria a conta.
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserResponse>
  ```
- **O servidor ignora a sessão nestas duas rotas** (R7): não há `SessionGuard`,
  não há `@CurrentPerson`, e **nada** lê `request.cookies`. Quem abre o link
  com sessão em curso recebe a mesma resposta de quem abre sem sessão, e a
  sessão dele não é tocada — nem lida, nem renovada, nem encerrada. Aceitar o
  convite com sessão aberta grava um `Set-Cookie` novo, o que na prática troca
  a sessão; a web impede que se chegue lá (D8), e o servidor não precisa saber
  disso para estar correto.
- O `CsrfGuard` global continua valendo no `POST`: ser pública não é ser
  desprotegida contra CSRF. O `GET` é método seguro e passa direto.
- Ordem de verificação de guards confirmada: o `CsrfGuard` é `APP_GUARD` em
  `app.module.ts`, então roda **antes** dos guards de classe ou de método — o
  403 de CSRF continua vindo primeiro, como nas outras fatias.
- Alternativa descartada: um `PublicInvitationsController` só para estas duas
  rotas — motivo: dois controllers para o mesmo recurso, e a 087/088 teriam de
  escolher entre eles a cada rota nova; o `@UseGuards()` vazio diz a mesma coisa
  em uma linha, no lugar em que quem lê a rota está olhando.
- Alternativa descartada: tirar os guards da classe e pô-los rota a rota —
  motivo: inverteria o padrão do projeto (065, 066, 085), em que a rota nasce
  coberta e a exceção é explícita.

### D7 — O aceite: uma transação (`security`, `authentication`)

- Escolha, em `apps/api/src/invitations/invitations.service.ts`:
  `accept(token: string, body: unknown): Promise<AcceptResult>`, com
  `AcceptResult = { user: CurrentUser; token: string; expiresAt: Date }` — a
  **mesma** forma de `InstallResult`, para o controller gravar o cookie com o
  mesmo código.
  1. `const data = parseBody(acceptInvitationSchema, body)` → **400** antes de
     qualquer consulta (D2).
  2. `const invitation = await this.findPending(token)`; `null` → **404**
     `INVITATION_UNAVAILABLE_MESSAGE` (D4).
  3. `const passwordHash = await this.passwords.hash(data.password)` —
     **fora da transação**, de propósito: o argon2id leva centenas de
     milissegundos e segurar uma transação aberta esse tempo é prender conexão
     e linha à toa. É exatamente o que `installation.service.ts` já faz.
  4. `this.prisma.$transaction(async (tx) => { … })`:
     - `tx.person.create({ data: { organizationId: invitation.organizationId, name: data.name, email: invitation.email, passwordHash, isAdmin: false } })`
       — o e-mail é o **do convite**, já normalizado na 085; `isAdmin: false`
       explícito (R4), mesmo sendo o default do schema, porque é regra e não
       acaso.
     - `tx.space.create({ data: { type: 'PERSONAL', personId: person.id } })` —
       **conferido no código**: é o que a instalação cria junto com a `Person`
       (`installation.service.ts` cria organização, unidade raiz, pessoa,
       espaço `PERSONAL` e espaço `UNIT`). Do que a instalação faz, só o espaço
       pessoal pertence à pessoa; organização e unidade raiz já existem, e o
       espaço `UNIT` é da unidade, não de quem entra (R4: a pessoa convidada
       não pertence a nenhuma unidade).
     - `tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })`
       — é isto que marca o convite como aceito (R5), dentro da transação: se
       qualquer passo falhar, o convite continua pendente e o link continua
       valendo.
     - `const session = await this.sessions.create(person.id, tx)` — o
       `SessionService.create` **já aceita** um `Prisma.TransactionClient`
       (foi assim que a instalação nasceu); nada muda nele.
     - devolve `{ user: toCurrentUser({ ...person, organization }), token: session.token, expiresAt: session.expiresAt }`.
  5. `catch`: `P2002` em `Person_email_key` → **409**
     `ALREADY_A_PERSON_MESSAGE` (a constante da 085, reaproveitada: é a mesma
     situação, dita à mesma pessoa). Qualquer outro erro é relançado **sem** o
     token na mensagem.
- **A corrida do 409 é resolvida pelo banco**, não pela checagem: `Person.email`
  é `@unique` no Prisma desde a 0001, então duas aceitações simultâneas do
  mesmo e-mail (ou um login criado por outro caminho no meio do aceite) caem em
  `P2002`. Não existe um `findFirst` prévio de e-mail: ele seria uma checagem
  que a corrida vence.
- O `organization` do `toCurrentUser` vem de uma leitura dentro da transação
  (`tx.organization.findUniqueOrThrow({ where: { id: invitation.organizationId } })`),
  reaproveitada pelo `GET` do preview (D8 usa `organizationName` de lá).
- **Cookie pelo mesmo caminho da instalação**: o controller chama
  `response.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt))`,
  literalmente o que `InstallationController.createInstallation` faz —
  `httpOnly`, `SameSite=Lax`, `Secure` em produção, 30 dias. Nenhum atributo
  novo, nenhuma função nova.
- `InvitationsModule` passa a injetar `PasswordService` e `SessionService`
  (importando `AuthModule`, como `InstallationModule` já faz).
- Alternativa descartada: hash da senha dentro da transação — ver passo 3.
- Alternativa descartada: criar a sessão depois da transação — motivo: uma
  falha ali deixaria a pessoa criada e o convite consumido sem sessão, e a
  pessoa cairia numa tela de login sem saber a própria senha… que ela acabou de
  escolher. Funciona, mas é um estado partido evitável por uma linha.
- Alternativa descartada: responder 201 **sem** sessão e mandar a pessoa para o
  login — motivo: R3 é explícito ("sem passar pela tela de entrar").

### D8 — Web: rota pública, tela e formulário
      (`routing`, `forms`, `interface-design`, `error-handling`)

- **`paths.ts`**: entrada nova
  `invitationAccept: { path: '/invitations/:token', getHref: (token: string) => `/invitations/${encodeURIComponent(token)}` }`.
  `build-invitation-link.ts` (da 085) **deixa de ter a constante própria** e
  passa a montar `${origin}${paths.invitationAccept.getHref(token)}` — o
  comentário "a rota só existe a partir da 086" sai. Isto **encerra a dívida
  092** registrada pela 085.
- **`router.tsx`**: a rota entra como filha do `AppGate`, **irmã de `/install`
  e `/login`** — fora do `Root` (sem barra lateral), fora do `ProtectedRoute` e
  fora de qualquer verificação de instalação:
  ```tsx
  { path: paths.invitationAccept.path, lazy: () => import('@/app/routes/invitation-accept') },
  ```
  **Como o gate funciona, conferido no código**: `AppGate` não redireciona
  ninguém; ele só **espera** as respostas de `GET /installation` e
  `GET /auth/me` antes de renderizar o `<Outlet />`, e mostra `GateError` se
  alguma falhar. Quem decide o que fazer com "instalado" e "logado" é cada
  rota (`install.tsx` redireciona, `ProtectedRoute` redireciona). Portanto
  ficar sob o `AppGate` **não** protege nem bloqueia nada: a rota de convite
  simplesmente não olha nenhuma das duas respostas. Fica sob o gate porque é
  onde o `HydrateFallback` e o tratamento de falha de rede já estão.
- **Consequência de R7, e onde ela é decidida**: a decisão está **na ausência
  de decisão** — a rota não consulta `useUser()` e não está dentro do
  `ProtectedRoute`. Quem tem sessão vê a mesma tela de qualquer um; se o convite
  for inválido, vê a tela de erro genérica; se for válido, vê o formulário e
  pode aceitar (criando uma segunda conta e trocando a própria sessão) — um
  caso que o PRD aceita como improvável e preferível a encerrar sessão alheia.
  Nada aqui chama `logout`, e nada limpa o cache do React Query.
- **`app/routes/invitation-accept.tsx`** (a rota é a tela; não há componente de
  página à parte):
  - `const { token = '' } = useParams()`; `useInvitation({ token })`.
  - `isPending` → estado de carregando.
  - `isError` (**qualquer** erro, não só 404) → tela de erro genérica. Tratar
    404 e 500 igual é deliberado: a tela não tem o que dizer de diferente, e
    distinguir daria à pessoa uma informação que o servidor se recusou a dar.
  - sucesso → `<AcceptInvitationForm token={token} email={data.email} organizationName={data.organizationName} onSuccess={…} />`,
    com `onSuccess` navegando para `paths.home.getHref()` com `replace: true`
    (o `replace` tira o link do convite do histórico — voltar não recarrega um
    token já usado).
  - `<Seo>`/título: segue o que as outras rotas públicas fazem hoje; se
    `install.tsx` e `login.tsx` não definem título por rota, esta também não
    (não é o assunto da fatia).
- **`features/invitations/api/get-invitation.ts`**: `getInvitation({ token })`
  → `api.get(`/invitations/${encodeURIComponent(token)}`, { silentError: true })`,
  `getInvitationQueryOptions(token)` com `retry: false` (um 404 não melhora
  tentando de novo) e `useInvitation`. `silentError` porque a **tela inteira**
  já é o aviso: a notificação global diria a mesma coisa por cima.
- **`features/invitations/api/accept-invitation.ts`**:
  `acceptInvitationInputSchema` (as mesmas regras e mensagens do servidor, D9),
  `acceptInvitation({ token, data })` →
  `api.post(`/invitations/${encodeURIComponent(token)}/accept`, data, { silentError: true })`
  e `useAcceptInvitation`, que no `onSuccess` faz
  `queryClient.setQueryData(getUserQueryOptions().queryKey, response.data)` — o
  mesmo desenho de `create-installation.ts` e de `useLogin`, sem segundo
  `GET /auth/me`. **Sem** `invalidateQueries` de convites (não há lista aqui).
- **`features/invitations/components/accept-invitation-form.tsx`**: `Form` +
  `Input label="Seu nome"` (`autoComplete="name"`) + `Input label="Senha"`
  (`type="password"`, `autoComplete="new-password"`, dica "Mínimo de 12
  caracteres."), guarda de clique duplo por `isPending` (cópia do desenho de
  `installation-form.tsx`), botão principal. O e-mail aparece **como texto**
  acima do formulário, nunca como campo desabilitado (R2: não é editável, e um
  campo desabilitado sugere que poderia ser).
  - `isNotFoundError(error)` no envio → chama `onExpired()`, e a rota troca
    para a **mesma** tela de erro genérica (o convite morreu entre abrir e
    enviar).
  - `isConflictError(error)` → alerta dentro do formulário com o texto do 409
    (Interface), com link para entrar.
  - erro de campo vindo do 400 → mensagem sob o campo, como nas outras fatias.
  - demais falhas → alerta genérico dentro do formulário.
- **Nada em `localStorage`** (R8): o token vive em `useParams`, é passado por
  prop e entra só no caminho da requisição. Não vai para o cache como dado —
  é **parte da chave** da query (`['invitation', token]`), o que é inevitável e
  some junto com a página; não há `console.log` no caminho.
- **ESLint**: nada a fazer — a zona `features/invitations` já entrou no
  `import/no-restricted-paths` na 085.
- Alternativa descartada: um `<InvitationError />` em `components/errors/` —
  motivo: é usado numa tela só; se a 087 precisar do mesmo bloco, ele se muda
  então (`project-structure`).
- Alternativa descartada: ler o token de um query param (`?token=`) — motivo: o
  link da 085 já está no formato de caminho, e query string costuma sobrar em
  `Referer` e em log de proxy com mais facilidade.

### D9 — API simulada (`api-mocking`)

- **`testing/mocks/db.ts`**:
  - `MockInvitation` ganha `token: string` e `acceptedAt: string | null`.
    Guardar o token em claro no banco falso é **decisão desta fatia**, não
    descuido: o navegador precisa conferir o link para a jornada existir, o
    "banco" é um objeto em memória da própria aba, e não há fronteira de
    segurança nenhuma ali. O valor continua sendo o `nextInvitationToken()`
    legível e montado em tempo de execução (nada com cara de credencial no
    repositório). O comentário do tipo diz isso em uma frase.
  - `DbState` ganha `people: MockPerson[]` (as pessoas criadas por convite) e
    **`signedInPersonId: string | null`**. `getSignedInPerson()` devolve a
    pessoa desse id, caindo para `installation.person` quando é `null` — é o
    que preserva o comportamento atual de todas as jornadas existentes.
  - `acceptInvitation({ token, name })` acha o convite pelo token, marca
    `acceptedAt` **no lugar** (`splice`/mutação, pela regra do comentário de
    `touchDocumentUpdatedAt`), empilha a pessoa nova em `people` com
    `isAdmin: false` e aponta `signedInPersonId` para ela.
  - Isto é **decisão desta fatia e não refatoração à parte**: sem um "quem está
    logado" que possa ser outra pessoa, o banco falso não consegue representar
    o resultado do aceite, e a rota não teria como ser testada de ponta a ponta
    no navegador. O custo é pequeno e fica contido em `db.ts` e numa linha de
    `handlers/auth.ts`.
- **`testing/mocks/handlers/auth.ts`**: `GET /auth/me` e `POST /auth/login`
  passam a responder com `getSignedInPerson()` no lugar de
  `installation.person`; o `logout` limpa `signedInPersonId`. É a **única**
  mudança no handler de autenticação, e o comportamento de todas as jornadas
  atuais fica idêntico (sem aceite, `signedInPersonId` é `null`).
- **`testing/mocks/handlers/invitations.ts`**: dois handlers novos, com as
  **mesmas regras** do servidor:
  - `http.get('/invitations/:token')`: `networkDelay`, `devOverride('invitations')`,
    busca por token; **404 com o mesmo corpo** para não achado, `expiresAt` no
    passado e `acceptedAt` preenchido; senão 200 com
    `{ email, organizationName: installation.organization.name }`. **Não** olha
    cookie (R7).
  - `http.post('/invitations/:token/accept')`: valida nome e senha (mesmas
    mensagens, 400), depois o convite (mesmo 404), depois 409 se o e-mail é o
    da pessoa instalada ou de alguém em `people`; no sucesso chama
    `acceptInvitation`, grava
    `document.cookie = \`${SESSION_COOKIE_NAME}=…; path=/\`` (o mesmo jeito do
    handler de login, pelo motivo já documentado lá: o store de cookie do MSW
    vaza entre testes) e responde 201 com `CurrentUserResponse`.
  - O 404 vem de **uma única função** `invitationUnavailable()` nos dois
    handlers, pelo mesmo motivo do servidor.
- **`testing/mocks/utils.ts`**: comentário das chaves de desenvolvimento ganha
  `mock-invitations=sample` (já existe; passa a valer para abrir o link no
  navegador, já que o token semeado é previsível) e a explicação de como obter
  o link de um convite semeado.
- Alternativa descartada: guardar o `sha256` do token no banco falso — motivo:
  o mock não tem ameaça a modelar e `crypto.subtle` é assíncrono, o que
  complicaria o handler sem ganho nenhum.

### D10 — Documentação

- `docs/architecture.md` §6: parágrafo **"Entrega `invitations-accept`
  (fatia 086)"** — as duas rotas públicas e o `@UseGuards()` vazio; o servidor
  ignora o cookie nelas (R7) e a sessão em curso nunca é encerrada; o token da
  URL só é usado como `sha256` e a conferência final é `timingSafeEqual`; o 404
  é idêntico nos quatro casos, por constante única; `acceptedAt` e o índice
  parcial da `0010`; a transação do aceite (pessoa não-admin + espaço pessoal +
  `acceptedAt` + sessão) com o hash de senha fora dela; o cookie pelo mesmo
  `getSessionCookieOptions` da instalação; ordem observável CSRF → 400 → 404 →
  409. O parágrafo da 085 é ajustado: `hashToken` **foi** extraído para
  `common/hash-token.ts` (dívida 090 encerrada) e o caminho público
  `/invitations/:token` **existe**.
- `docs/design.md`: receita nova "Tela pública centrada" (Interface).
- `docs/roadmap.md`: 086 concluída; dívidas que virarem item.

### D11 — Testes

- **API, integração contra Postgres real** —
  `apps/api/src/invitations/__tests__/invitations-accept.integration.test.ts`
  (ajudantes `getInvitation(token)` e `postAccept(token, body)` com
  `X-Requested-With`):
  - **aceite completo**: admin cria o convite → a convidada aceita → **201**,
    corpo igual ao de `GET /auth/me`, `Set-Cookie` com `HttpOnly` e `SameSite=Lax`;
    no banco existe uma `Person` com `isAdmin: false`, com o e-mail **do
    convite** (não o que veio no corpo — o corpo nem tem e-mail), **um** `Space`
    `PERSONAL` apontando para ela, **nenhum** `Space` `UNIT` novo, o convite com
    `acceptedAt` preenchido, e uma `Session` cujo `tokenHash` é o sha256 do
    cookie; usar o cookie devolvido em `GET /auth/me` responde 200 com a pessoa
    nova.
  - **segundo uso do mesmo link falha**: repetir o `POST` → 404.
  - **expirado falha**: convite com `expiresAt` no passado (escrito direto pelo
    Prisma) → 404 no `GET` e no `POST`.
  - **revogado falha**: **não há conceito de revogação nesta fatia** (a coluna
    `revokedAt` é da 087), então o caso não é testado aqui; o que esta fatia
    garante é que o `findPending` tem um único ponto para a 087 acrescentar a
    condição, e o teste da 087 cobre. Registrado em "Dívida encontrada".
  - **as quatro recusas com resposta idêntica**: os três casos que existem hoje
    (inexistente, expirado, já aceito) são comparados **entre si** —
    `status`, corpo serializado e o conjunto de cabeçalhos (menos `Date` e
    `Content-Length`, que variam por natureza) têm de ser iguais.
  - **e-mail que virou pessoa → 409**: criar o convite, criar a `Person` com o
    mesmo e-mail direto pelo Prisma, aceitar → 409 com a mensagem exata; o
    convite continua **sem** `acceptedAt` (a transação voltou atrás).
  - **senha fraca → 400**: 11 caracteres → `{ message: 'Dados inválidos.',
    errors: [{ field: 'password', … }] }`; nome vazio → 400 em `name`; campo a
    mais no corpo → 400; token válido com corpo inválido responde **400**, não
    404 (prova a ordem de D2).
  - **CSRF**: `POST` sem `X-Requested-With` → 403.
  - **sessão de terceiro é ignorada** (R7): `GET` e `POST` com o cookie de um
    admin logado respondem exatamente como sem cookie, e a sessão do admin
    continua válida depois (`GET /auth/me` com o cookie antigo ainda responde
    200).
  - **banco**: com o índice parcial da `0010`, o mesmo e-mail pode ser
    convidado de novo depois de aceito (o `POST /invitations` da 085 volta a
    responder 201) — e dois pendentes do mesmo e-mail continuam rejeitados com
    `P2002`.
- **API, unitários** — `invitations-accept.service.test.ts` (Prisma falso):
  `findPending` devolve `null` nos três casos e **sem** consulta adicional; o
  hash da senha acontece **antes** do `$transaction`; a ordem dentro da
  transação é pessoa → espaço → `update` do convite → sessão; a `Person` nasce
  com `isAdmin: false` e com o e-mail do convite mesmo que o corpo tente mandar
  outro (`strictObject` recusa antes); `P2002` vira `ConflictException`; o
  token não aparece em nenhuma mensagem de erro.
  `hash-token.test.ts` em `common/__tests__/`: o digest é estável e é o mesmo
  que `session.service` produzia antes (vetor fixo, não um segredo).
- **API, contrato** — `invitations.contract.test.ts` (existente) ganha os casos
  do `GET` (200, 404) e do `POST` (201, 400, 404, 409) validados contra o
  `openapi.yaml`.
- **Web, unitários** — `api/__tests__/get-invitation.test.tsx` e
  `api/__tests__/accept-invitation.test.tsx`: caminho e corpo corretos, token
  escapado no caminho, 404 rejeita **sem** notificação global (`silentError`),
  sucesso do aceite grava o usuário no cache de `getUserQueryOptions()`.
  `utils/__tests__/build-invitation-link.test.ts` (existente) passa a afirmar
  que o link bate com `paths.invitationAccept.getHref(token)`.
- **Web, componente** — `components/__tests__/accept-invitation-form.test.tsx`:
  rótulos associados; enviar vazio mostra "Informe o seu nome." e "A senha
  precisa ter pelo menos 12 caracteres." sem chamar a API; senha de 11
  caracteres é recusada no cliente; sucesso chama `onSuccess`; 409 mostra o
  alerta com o link para entrar; 404 chama `onExpired`; dois `Enter` seguidos
  fazem **um** pedido (handler contador); o e-mail aparece como texto e
  **não** existe campo de e-mail na tela (`queryByLabelText(/e-mail/i)` é nulo).
- **Web, integração de rota** —
  `app/routes/__tests__/invitation-accept.test.tsx`: abrir `/invitations/:token`
  com um convite semeado mostra o e-mail e a organização; preencher e enviar
  leva ao início já autenticada, com o nome da pessoa **nova** na barra lateral;
  token desconhecido mostra a tela de erro genérica com o link "Ir para a tela
  de entrar"; convite já aceito mostra **a mesma** tela; **com sessão de admin
  em curso**, abrir um link inválido mostra a tela de erro e a sessão continua
  (voltar ao início ainda mostra o admin logado) — a prova de R7 na web.
- **e2e** — `apps/web/e2e/tests/invitations-accept.spec.ts`, API simulada,
  `ROUTE_TIMEOUT = { timeout: 10_000 }` em toda espera pós-rota: **a jornada
  completa a partir do link** — `mock-installation=installed` +
  `mock-invitations=sample`, abrir a URL do convite direto (como quem clica no
  link de fora do app), conferir o e-mail na tela, preencher nome e senha só
  pelo teclado, enviar, cair na aplicação autenticada e **não** ver
  "Administração" na barra lateral (R4). Segundo caso: abrir um token inventado
  e ver a tela de erro. `expectNoSeriousA11yViolations` **duas vezes**: na tela
  do convite e na tela de erro. Os e2e da 085 e anteriores não mudam.

## Interface

Lidos `docs/design.md` e o piso da skill `interface-design`. Receitas usadas:
"Contêiner de página estreita", "Título de página", "Texto de apoio", "Campo de
formulário", "Alerta dentro de formulário", "Botão principal", "Link de
navegação", "Carregando", "Erro". Receita **nova**, acrescentada a "Padrões
acrescentados pelas entregas" com a fatia 086:

| Padrão | Classes |
|---|---|
| Tela pública centrada | `<main id="main-content" className="mx-auto max-w-md p-8">` (a mesma moldura de `/install` e `/login`), com os três estados — carregando, erro e conteúdo — **no mesmo lugar**, dentro dela: carregando é a receita "Carregando"; erro é a receita "Erro", com o `<h1>` dentro do bloco de alerta (como em `GateError`) e o link de navegação abaixo; conteúdo é `<h1>` + texto de apoio + formulário |

### Rota `/invitations/:token`

Fora do `ProtectedRoute` e fora do gate de instalação: é a tela de quem ainda
não tem conta.

**Estado carregando** (enquanto o `GET` não volta):

- `<p role="status">` "Carregando o convite…".

**Estado de erro** (404 ou qualquer outra falha do `GET`, e 404 no envio):

- Bloco de alerta (`role="alert"`) com:
  - `<h1>` "Convite indisponível".
  - "Este link de convite não é válido. Ele pode ter expirado ou já ter sido
    usado. Se você ainda precisa de acesso, peça um convite novo."
  - `<Link>` "Ir para a tela de entrar" → `paths.login.getHref()`.
- **Um só texto para os quatro casos** (R6): a tela não sabe qual foi o motivo,
  porque o servidor não conta.

**Estado com o convite** (200):

- `<h1>` "Criar sua conta na {organização}".
- Texto de apoio: "Convite para {e-mail}."
- Formulário, de cima para baixo:
  - "Seu nome" (`type="text"`, `autoComplete="name"`).
  - "Senha" (`type="password"`, `autoComplete="new-password"`), dica "Mínimo de
    12 caracteres.".
  - Alerta interno, quando houver.
  - Botão principal "Criar conta" (enviando: "Criando conta…", desabilitado,
    com indicador).

### Mensagens

| Situação | Texto | Onde |
|---|---|---|
| carregando o convite | "Carregando o convite…" | `role="status"`, no lugar do conteúdo |
| convite inválido, expirado, já usado ou revogado | título "Convite indisponível" · "Este link de convite não é válido. Ele pode ter expirado ou já ter sido usado. Se você ainda precisa de acesso, peça um convite novo." · link "Ir para a tela de entrar" | tela inteira, `role="alert"` |
| nome vazio | "Informe o seu nome." | sob o campo (cliente e servidor) |
| nome longo demais | "O nome pode ter no máximo 120 caracteres." | sob o campo (cliente e servidor) |
| senha curta | "A senha precisa ter pelo menos 12 caracteres." | sob o campo (cliente e servidor) |
| senha longa demais | "A senha pode ter no máximo 128 caracteres." | sob o campo (cliente e servidor) |
| servidor, 409 | "Este e-mail já tem conta na Folioteca. Entre com ela." + link "Ir para a tela de entrar" | alerta dentro do formulário |
| servidor, 404 no envio | o convite morreu entre abrir e enviar: a tela troca para o **estado de erro** acima | tela inteira |
| outras falhas | "Não foi possível criar a conta. Tente de novo em instantes." | alerta dentro do formulário |
| servidor, 400 campo a mais | "Campo não permitido." | não chega à tela (o formulário manda só `name` e `password`) |
| API, 404 (corpo, não mostrado) | "Convite não encontrado." | corpo da resposta; a tela **não** ecoa |

Layout a 360px: a moldura `max-w-md p-8` já é a de `/install`, testada desde a
002; o e-mail do convite vai num `<span className="break-words">` para endereço
longo não estourar a largura.

## Arquivos

Fase 1 — API (contrato primeiro)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `/invitations/{token}` `get` (200, 404) e `/invitations/{token}/accept` `post` (201 `CurrentUserResponse`, 400, 403, 404, 409); schemas `InvitationPreview`, `InvitationPreviewResponse`, `AcceptInvitationInput` (D1, D2) | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado pelo script `generate` | — |
| criar | `apps/api/prisma/migrations/0010_invitation_accepted_at/migration.sql` | `acceptedAt` + troca do índice por parcial `WHERE "acceptedAt" IS NULL`, à mão (D3) | `security` |
| alterar | `apps/api/prisma/schema.prisma` | `acceptedAt` em `Invitation` e o comentário do índice parcial (D3) | — |
| criar | `apps/api/src/common/hash-token.ts` | `hashToken` compartilhado; encerra a dívida 090 (D5) | `security` |
| alterar | `apps/api/src/auth/session.service.ts` | apaga a cópia privada e importa de `common/hash-token` (D5) | `security`, `authentication` |
| alterar | `apps/api/src/invitations/invitations.schema.ts` | `acceptInvitationSchema` (`name`, `password`), `strictObject` (D2) | `security`, `forms` |
| alterar | `apps/api/src/invitations/invitations.service.ts` | importa `hashToken`; `findPending` (`timingSafeEqual`, quatro casos), `getPreview`, `accept` (transação), `INVITATION_UNAVAILABLE_MESSAGE` (D4, D7) | `security`, `authentication` |
| alterar | `apps/api/src/invitations/invitations.controller.ts` | `@Get(':token')` e `@Post(':token/accept')` com `@UseGuards()` vazio; cookie por `getSessionCookieOptions` (D6, D7) | `authentication`, `authorization`, `security` |
| alterar | `apps/api/src/invitations/invitations.module.ts` | importa `AuthModule` para `PasswordService` e `SessionService` (D7) | `project-structure` |
| criar | `apps/api/src/common/__tests__/hash-token.test.ts` | D11 | `unit-testing` |
| criar | `apps/api/src/invitations/__tests__/invitations-accept.service.test.ts` | D11 | `unit-testing` |
| criar | `apps/api/src/invitations/__tests__/invitations-accept.integration.test.ts` | D11, inclusive as recusas comparadas entre si e a sessão de terceiro ignorada | `integration-testing` |
| alterar | `apps/api/src/invitations/__tests__/invitations.contract.test.ts` | casos do `GET` e do `accept` (D11) | `integration-testing` |

Fase 2 — Web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/config/paths.ts` | `invitationAccept` (D8) | `routing` |
| alterar | `apps/web/src/app/router.tsx` | rota `lazy` pública `/invitations/:token`, irmã de `/install` e `/login` (D8) | `routing` |
| criar | `apps/web/src/app/routes/invitation-accept.tsx` | os três estados; fora do `ProtectedRoute` e do gate (D8) | `routing`, `interface-design`, `error-handling` |
| criar | `apps/web/src/features/invitations/api/get-invitation.ts` | `queryOptions` sem retry, `silentError` (D8) | `api-requests` |
| criar | `apps/web/src/features/invitations/api/accept-invitation.ts` | schema de entrada, fetcher, hook que grava o usuário no cache (D8) | `api-requests`, `authentication`, `forms` |
| criar | `apps/web/src/features/invitations/components/accept-invitation-form.tsx` | nome + senha, 409 no alerta, 404 vira tela de erro, guarda de clique duplo (D8) | `forms`, `interface-design`, `error-handling` |
| alterar | `apps/web/src/features/invitations/utils/build-invitation-link.ts` | usa `paths.invitationAccept`; encerra a dívida 092 (D8) | `routing`, `security` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `token` e `acceptedAt` em `MockInvitation`; `people`, `signedInPersonId`, `getSignedInPerson`, `acceptInvitation` (D9) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/auth.ts` | `/auth/me` e `/auth/login` usam `getSignedInPerson()`; `logout` limpa `signedInPersonId` (D9) | `api-mocking`, `authentication` |
| alterar | `apps/web/src/testing/mocks/handlers/invitations.ts` | `GET /invitations/:token` e `POST /invitations/:token/accept`, 404 por função única (D9) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | comentário das chaves: como abrir o link do convite semeado (D9) | `api-mocking` |
| criar | `apps/web/src/features/invitations/api/__tests__/get-invitation.test.tsx` | D11 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/invitations/api/__tests__/accept-invitation.test.tsx` | D11 | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/invitations/components/__tests__/accept-invitation-form.test.tsx` | D11 | `component-testing`, `api-mocking` |
| alterar | `apps/web/src/features/invitations/utils/__tests__/build-invitation-link.test.ts` | link igual a `paths.invitationAccept.getHref` (D11) | `unit-testing` |
| criar | `apps/web/src/app/routes/__tests__/invitation-accept.test.tsx` | D11, inclusive R7 com sessão em curso | `integration-testing` |

Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/invitations-accept.spec.ts` | jornada completa a partir do link + tela de erro, axe nos dois estados | `e2e-testing` |
| alterar | `docs/design.md` | receita "Tela pública centrada" (086) | `interface-design` |
| alterar | `docs/architecture.md` | §6: parágrafo da 086 e ajuste do parágrafo da 085 (D10) | — |
| alterar | `docs/roadmap.md` | item 086 concluído; dívidas que virarem item | — |

Intocados de propósito (comparar com `feature/085-invitations-create`):
`apps/api/src/auth/**` **menos** `session.service.ts` (que muda só no import e
na remoção da função privada — `admin.guard.ts`, `session.guard.ts`,
`session-cookie.ts`, `auth.service.ts` e `auth.controller.ts` não mudam),
`apps/api/src/access/**`, `apps/api/src/documents/**`, `apps/api/src/org-units/**`,
`apps/api/src/installation/**`, `apps/api/src/common/**` menos o arquivo novo,
`apps/api/test/**`, migrations `0001`–`0009`, `apps/web/src/lib/**`,
`apps/web/src/components/**`, `apps/web/src/app/routes/app/**`,
`apps/web/src/features/{auth,connection,installation,documents,org-units}/**`,
`apps/web/src/features/invitations/components/{create-invitation-form,invitation-link}.tsx`,
`apps/web/src/features/invitations/api/create-invitation.ts`,
`apps/web/src/testing/setup-tests.ts`, `eslint.config.js`, os e2e da 064 a 085.

## Estimativa de tamanho

Jornadas: 1 (a pessoa convidada abre o link e entra com conta própria) ·
Telas principais novas: 1 (`/invitations/:token`, com os três estados) ·
Fases previstas: 3 · Linhas alteradas (sem testes, sem o `.d.ts` gerado):
**~615**.

- API ~276: `openapi.yaml` ~100 (dois caminhos + três schemas; o 201 já
  reaproveita `CurrentUserResponse`), migration `0010` ~10, `schema.prisma` ~6,
  `common/hash-token.ts` + ajuste em `session.service.ts` ~15,
  `invitations.service.ts` ~110, `invitations.schema.ts` ~20,
  `invitations.controller.ts` ~35 (incluindo o módulo).
- Web ~339: `paths.ts`/`router.tsx`/`build-invitation-link.ts` ~15, rota ~65,
  `get-invitation.ts` ~28, `accept-invitation.ts` ~38,
  `accept-invitation-form.tsx` ~80, `src/testing/` ~118.
- Docs ~30. Com testes: ~1.300.

Sinais de "grande demais": **um dispara** — ~615 linhas sem testes, 50% acima
do teto de ~400. O estouro foi levado ao dono e **aprovado** (ver "Aviso de
tamanho"): a jornada de autenticação é indivisível, não há infraestrutura
reaproveitável para adiar, e o corte alternativo estudado deixaria a fatia em
~470 (sem resolver o sinal) piorando o produto. Os outros três sinais não
disparam. Se o implementer passar de ~700 no total sem testes, o corte de
emergência é enxugar as `description` do `openapi.yaml` e adiar a extração de
`hashToken` (D5) para a 087 — nessa ordem, e avisando antes de fazer.

## Dívida encontrada

- **Dívida 090 (`hashToken` duplicado): encerrada aqui** (D5). Fica a regra: o
  próximo segredo opaco do projeto importa `common/hash-token.ts`.
- **Dívida 091 (índice não parcial): resolvida na parte desta fatia** (D3). O
  que falta é da **087**: incluir `revokedAt IS NULL` no predicado do
  `Invitation_lower_email_key` na migration dela. Se não fizer, um e-mail com
  convite revogado nunca mais poderá ser convidado.
- **Dívida 092 (`/invitations/:token` fora de `paths.ts`): encerrada aqui**
  (D8).
- **`findPending` ainda não conhece revogação** (D4/D11): a condição de
  `revokedAt` é da 087, e o teste "revogado falha" só existe lá. O ponto de
  extensão é um só, de propósito — acrescentar a condição em `findPending` é a
  única mudança necessária para o quarto caso cair no mesmo 404.
- **Schema de e-mail duplicado (aberta desde a 085)**: o encadeamento
  `trim → toLowerCase → z.email` continua em `installation.schema.ts` e em
  `invitations.schema.ts`. Esta fatia **não** é a terceira ocorrência (o corpo
  do aceite não tem e-mail), então a extração continua pendente — candidata
  agora é a 088 ou a 089.
- **Regras do campo nome nunca foram decididas** (ponto em aberto do PRD):
  esta fatia copia as da instalação (1 a 120 caracteres, aparado). Se algum dia
  o projeto quiser regra própria de nome de pessoa, os dois schemas mudam
  juntos — e aí vale extrair.
- **Nenhuma limitação de taxa no aceite**: como o `POST /invitations` da 085,
  esta rota não tem limite por IP nem por token. É **pública** e faz argon2id a
  cada chamada, o que a torna a rota mais cara do app para quem quiser gastar
  CPU alheia — o custo é limitado por precisar de um token válido para chegar
  ao hash? **Não**: o corpo é validado antes do convite (D7, passo 1) e o hash
  só acontece depois do 404, então um atacante sem token não consome argon2.
  Ainda assim, é o primeiro endpoint público de escrita sem sessão desde a
  instalação; vira item de roadmap junto com a 089.
- **Convite aceito nunca é removido**: agora a tabela acumula vencidos (085) e
  aceitos. É auditoria útil, mas a limpeza periódica continua item de roadmap.
- **Não há e2e contra a API real** (herdada): o 404 idêntico, o 409 e o cookie
  só são provados pela integração da API.
- **O banco falso do MSW ganhou um conceito de "quem está logado"** (D9): é
  decisão desta fatia e está contida em `db.ts` + uma linha de
  `handlers/auth.ts`, mas quem escrever a 087/088 deve lembrar que
  `installation.person` **não** é mais sinônimo de "a pessoa da sessão".
- Herdadas e ainda válidas: `lower()` depende do `LC_CTYPE` do banco de
  hml/produção (conferir pelo contêiner), agora também sob o predicado parcial;
  a migration `0010` em hml só pelo contêiner, com `migrate deploy`.
