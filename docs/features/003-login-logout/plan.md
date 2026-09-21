# PLAN 003 — login-logout

Branch: `feature/003-login-logout`

Fonte: `docs/features/003-login-logout/spec.md` (as siglas D1…D12 são as decisões técnicas da SPEC e R1…R11 os requisitos do PRD; o texto necessário de cada uma está copiado na tarefa). Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict, Prisma 6, NestJS 11 com SWC, Vitest com os projetos `api` e `web`.

Pré-condição de todas as fases: `docker compose up -d` na raiz (Postgres local). Comandos de verificação, sempre na raiz e sempre a suíte inteira: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. "Sem aviso" vale para os quatro.

Regras que valem para todas as tarefas:

- Nenhum literal com cara de senha, token ou hash em arquivo versionado (o GitGuardian reprova). Nos testes da API a senha vem de `crypto.randomUUID()`; a senha da API simulada é montada por `join` (`MOCK_PASSWORD`).
- Todo componente devolve `React.JSX.Element`; `ref` é prop comum (sem `forwardRef`); todo botão é o componente `Button` de `apps/web/src/components/ui/button/button.tsx`; imports absolutos com `@/`; sem barrel files; arquivos em kebab-case.
- Nenhuma migration nesta fatia (`Session` e `Person` já existem). Testes e agentes não rodam `prisma migrate diff` nem `prisma migrate reset`: o esquema vem do `global-setup` (`migrate deploy`) e a limpeza é `resetDatabase(prisma)` de `apps/api/test/reset-database.ts`.
- Cobertura ≥ 80% de linhas por arquivo novo ou alterado. Não contam arquivos só de tipos nem os excluídos do relatório pelo `vitest.config.ts` da raiz (`**/types/**`, `**/generated/**`, `**/src/testing/**`).
- A estimativa da SPEC (~380 linhas sem testes) está perto do teto: nenhuma tarefa acrescenta escopo.

Desvios em relação à tabela de arquivos da SPEC, ambos sem mudar escopo:

1. `docs/design.md` sai da fase 3 e entra na fase 2 (T2.6): a skill `interface-design` manda a receita alterada entrar na mesma entrega da tela que a usa, e o critério visual da fase 2 aponta para ela.
2. `apps/web/src/app/routes/__tests__/app-gate.test.tsx` e `apps/web/src/app/routes/__tests__/install.test.tsx` entram na T2.7: os dois afirmam hoje o `<h1>` "Acesso por login em breve", que deixa de existir com o R10, e a SPEC não os listou.

## Fase 1 — Contrato e API: entrar com e-mail e senha, e sair revogando a sessão

Caminhos relativos à raiz do repositório.

- [x] T1.1 — Contrato OpenAPI de login e logout, com os tipos regenerados
  - Arquivos: `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, regenerado)
  - O que fazer (D1):
    - `POST /auth/login`, `operationId: login`, corpo `LoginBody` = `{ email: string; password: string }` (os dois obrigatórios). Respostas: `200` `CurrentUserResponse` (o mesmo schema de `GET /auth/me`) com o cabeçalho `Set-Cookie` documentado; `400` `ValidationError`; `401` `Error`; `403` `Error`.
    - `POST /auth/logout`, `operationId: logout`, sem corpo. Respostas: `204` sem conteúdo; `403` `Error`.
    - Rodar `pnpm --filter @folioteca/api-contract generate` e versionar a saída sem editar à mão. Login responde `200`, não `201` (não cria recurso endereçável).
  - Skills: —
  - Complexidade: baixa

- [x] T1.2 — Verificação de senha com hash falso memoizado e schema do corpo do login
  - Arquivos: `apps/api/src/auth/password.service.ts` (alterar); `apps/api/src/auth/login.schema.ts` (criar)
  - O que fazer (D2, D3):
    - `PasswordService.verify(hash: string, password: string): Promise<boolean>` com `verify` de `@node-rs/argon2`; hash malformado devolve `false`, **não lança**.
    - `PasswordService.getDummyHash(): Promise<string>`: gera **uma única vez**, de forma preguiçosa e memoizada (guardar a `Promise`, para duas chamadas simultâneas não gerarem dois hashes), o hash argon2id de `randomBytes(32)` com os mesmos `HASH_OPTIONS` do `hash`. Nenhum literal `$argon2id$…` no código.
    - `loginSchema` (Zod) e o tipo `LoginInput`: `email` = `trim().toLowerCase()`, `min(1, "Informe o e-mail.")` e formato de e-mail com "Informe um e-mail válido."; `password` = `min(1, "Informe a senha.")` e `max(128, "A senha pode ter no máximo 128 caracteres.")`, sem `trim`. **Não** exigir os 12 caracteres mínimos da instalação.
  - Skills: security
  - Complexidade: média

- [x] T1.3 — Revogação de sessão e opções-base do cookie
  - Arquivos: `apps/api/src/auth/session.service.ts` (alterar); `apps/api/src/auth/session-cookie.ts` (alterar)
  - O que fazer (D4):
    - `SessionService.revoke(token: string): Promise<void>`: `deleteMany` pelo `tokenHash` (`sha256` do token, a mesma função já usada por `create` e `findValid`); não falha se a linha não existir.
    - `getSessionCookieBaseOptions()` → `{ httpOnly: true, sameSite: 'lax', path: '/', secure: env.NODE_ENV === 'production' }`; `getSessionCookieOptions(expiresAt: Date)` passa a ser essa base mais `expires: expiresAt` (mesmo resultado de hoje). A base é o que o `clearCookie` do logout usa: o navegador só apaga o cookie se os atributos baterem.
  - Skills: authentication, security
  - Complexidade: baixa

- [x] T1.4 — `AuthService` e os dois endpoints no `AuthController`
  - Arquivos: `apps/api/src/auth/auth.service.ts` (criar); `apps/api/src/auth/auth.controller.ts` (alterar); `apps/api/src/auth/auth.module.ts` (alterar)
  - O que fazer (D2, D3, D4, D5):
    - `AuthService.login(body: unknown, currentToken?: string): Promise<{ user: CurrentUser; session: CreatedSession }>`, nesta ordem fixa (o `CsrfGuard` global já respondeu 403 "Requisição recusada." antes): (1) `parseBody(loginSchema, body)` → 400 "Dados inválidos." com `errors`; (2) busca a pessoa pelo e-mail normalizado, incluindo a organização; (3) **sempre** `passwordService.verify(person?.passwordHash ?? await passwordService.getDummyHash(), password)` — uma verificação argon2 também para e-mail inexistente; (4) pessoa ausente **ou** senha errada → `UnauthorizedException('E-mail ou senha incorretos.')`, a mesma mensagem nos dois casos; (5) se veio `currentToken`, `sessionService.revoke(currentToken)`; (6) `sessionService.create(person.id)`; devolve `toCurrentUser(person)` e a sessão.
    - `AuthService.logout(token?: string): Promise<void>`: com token, `sessionService.revoke(token)`; sem token, não faz nada. Nunca lança por sessão inexistente.
    - `AuthController`: `@Post('login')` com `@HttpCode(200)` — lê o cookie `folioteca_session` da requisição como `currentToken`, chama o serviço, grava `Set-Cookie` com `getSessionCookieOptions(expiresAt)` e responde `{ data: user }` tipado por `CurrentUserResponse`. `@Post('logout')` com `@HttpCode(204)`, **sem** `SessionGuard` — lê o cookie, chama `logout`, e **sempre** faz `clearCookie(SESSION_COOKIE_NAME, getSessionCookieBaseOptions())`, sem corpo. O controller só traduz HTTP; nenhuma regra nele.
    - `AuthModule` registra `AuthService`.
  - Skills: authentication, security
  - Complexidade: alta

- [x] T1.5 — Testes da fase 1
  - Arquivos: `apps/api/src/auth/__tests__/login-logout.integration.test.ts` (criar); `apps/api/src/auth/__tests__/auth.contract.test.ts` (alterar); `apps/api/src/auth/__tests__/password.service.test.ts` (criar); `apps/api/src/auth/__tests__/login.schema.test.ts` (criar)
  - O que fazer: HTTP com `supertest` sobre o app de `createApp()` contra o Postgres real; `resetDatabase(prisma)` em `beforeEach`. A pessoa do teste nasce por `POST /api/installation` (código = `process.env.INSTALL_CODE`, senha = `crypto.randomUUID()`), com e-mail em minúsculas. Todo `POST` envia `X-Requested-With: XMLHttpRequest`, salvo o caso que prova a falta dele. Nenhum teste compara tempo de relógio.
    - `login-logout.integration.test.ts`: `POST /api/auth/login returns 200 with the same body as GET /api/auth/me`; `sets the folioteca_session cookie with HttpOnly, SameSite=Lax and Path=/`; `the login cookie opens GET /api/auth/me`; `accepts the email in a different case and with surrounding spaces`; `returns 401 E-mail ou senha incorretos. for a wrong password`; `returns the same status and the same body for an unknown email`; `verifies one argon2 hash even when the email does not exist` (`vi.spyOn` em `PasswordService.prototype.verify` ou na instância do app; exatamente **uma** chamada); `never returns passwordHash`; `returns 400 with Dados inválidos and one error per invalid field` (`it.each`: e-mail vazio → "Informe o e-mail."; e-mail malformado → "Informe um e-mail válido."; senha vazia → "Informe a senha."; senha de 129 → "A senha pode ter no máximo 128 caracteres.", conferindo `field` e a mensagem); `does not set a cookie when the login fails`; `returns 403 Requisição recusada. without the X-Requested-With header`; `logging in with an old session cookie revokes the old session` (depois do segundo login o cookie antigo recebe 401 em `/api/auth/me` e `Session` tem 1 linha); `POST /api/auth/logout returns 204, deletes the session row and clears the cookie` (`Set-Cookie` de `folioteca_session` vazio e vencido; `session.count()` = 0); `the same cookie gets 401 on GET /api/auth/me after logout`; `logout without a cookie returns 204`; `a repeated logout returns 204`; `logout returns 403 without the X-Requested-With header`.
    - `auth.contract.test.ts` (acrescentar, com `expectMatchesContract`): `POST login 200 matches CurrentUserResponse`; `POST login 400 matches ValidationError`; `POST login 401 matches Error`; `POST logout 204 has no body`. Os dois casos existentes ficam.
    - `password.service.test.ts`: `verify returns true for the right password`; `verify returns false for a wrong password`; `verify returns false for a malformed hash instead of throwing`; `getDummyHash returns an argon2id hash`; `getDummyHash returns the same value on every call`; `getDummyHash hashes only once under concurrent calls`.
    - `login.schema.test.ts`: `accepts a valid body`; `lowercases and trims the email`; `does not trim the password`; `accepts a password shorter than 12 characters`; `rejects an empty email with Informe o e-mail.`; `rejects a malformed email with Informe um e-mail válido.`; `rejects an empty password with Informe a senha.`; `rejects a 129 character password with the literal message`.
  - Skills: integration-testing, unit-testing
  - Complexidade: alta

### Critérios de aceite da fase 1

- [x] CA1.1 — Com `docker compose up -d` rodando, passam na raiz **sem erro nem aviso**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. A saída de `pnpm test` não tem `console.error`, `console.warn` nem aviso do Nest ou do Prisma.
- [x] CA1.2 — `packages/api-contract/openapi.yaml` tem `POST /auth/login` (`operationId: login`; respostas 200 `CurrentUserResponse`, 400 `ValidationError`, 401 `Error`, 403 `Error`) com o corpo `LoginBody` (`email` e `password`, string, obrigatórios) e `POST /auth/logout` (`operationId: logout`; respostas 204 sem conteúdo e 403 `Error`). O teste que compara os tipos gerados com o contrato continua passando (o arquivo gerado não foi editado à mão).
- [x] CA1.3 — `apps/api/src/auth/password.service.ts` tem `verify(hash: string, password: string): Promise<boolean>`, que devolve `false` para hash malformado sem lançar, e `getDummyHash(): Promise<string>`, memoizado, gerado a partir de bytes aleatórios com os mesmos parâmetros de `hash` (argon2id, `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`). `rg -n "argon2id\\$" apps/api/src --glob '!**/__tests__/**'` não acha literal de hash.
- [x] CA1.4 — `apps/api/src/auth/login.schema.ts` exporta `loginSchema`, com o e-mail normalizado por `trim().toLowerCase()`, a senha sem `trim` e sem mínimo de 12, e as mensagens literais "Informe o e-mail.", "Informe um e-mail válido.", "Informe a senha." e "A senha pode ter no máximo 128 caracteres.".
- [x] CA1.5 — `SessionService.revoke(token: string): Promise<void>` em `apps/api/src/auth/session.service.ts` usa `deleteMany` pelo `sha256` do token. `apps/api/src/auth/session-cookie.ts` exporta `getSessionCookieBaseOptions()` (`httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` só em produção), e `getSessionCookieOptions(expiresAt)` é construída sobre ela.
- [x] CA1.6 — `apps/api/src/auth/auth.service.ts` tem `login(body, currentToken?)` e `logout(token?)`. Lendo o código de `login`, a ordem é: validação (400) → busca da pessoa → **uma** chamada a `verify` com `person?.passwordHash ?? hash falso`, feita antes de qualquer decisão → 401 → revoga a sessão do cookie recebido → cria a sessão. A `UnauthorizedException('E-mail ou senha incorretos.')` é a única resposta para e-mail inexistente e para senha errada (não há ramo que responda antes do `verify`).
- [x] CA1.7 — `apps/api/src/auth/auth.controller.ts`: `@Post('login')` com `@HttpCode(200)`, grava o cookie com `getSessionCookieOptions` e responde `{ data: CurrentUser }`; `@Post('logout')` com `@HttpCode(204)`, **sem** `SessionGuard`, sempre chama `clearCookie` com `getSessionCookieBaseOptions()`. O controller não acessa o Prisma nem o `PasswordService`. `AuthService` está nos `providers` do `AuthModule`.
- [x] CA1.8 — Existem e passam, pelos nomes listados em T1.5: `login-logout.integration.test.ts` (17 casos, entre eles `returns the same status and the same body for an unknown email`, `verifies one argon2 hash even when the email does not exist`, `logging in with an old session cookie revokes the old session`, `the same cookie gets 401 on GET /api/auth/me after logout` e `a repeated logout returns 204`), os 4 casos novos de `auth.contract.test.ts`, `password.service.test.ts` (6) e `login.schema.test.ts` (8). Os testes de integração usam o Postgres real, sem mock do Prisma, e nenhum mede duração. Conferir com `npx vitest run --project api --reporter=verbose`.
- [x] CA1.9 — Nenhuma senha, token ou hash literal nos testes da fase (`rg -n "password: '|password: \"" apps/api/src/auth/__tests__` só acha valores vindos de variável, `randomUUID()` ou `'x'.repeat(n)`). Não há migration nova em `apps/api/prisma/migrations`.
- [x] CA1.10 — O relatório de cobertura de `pnpm test` lista `apps/api/src/auth/auth.service.ts`, `auth.controller.ts`, `password.service.ts`, `session.service.ts`, `session-cookie.ts`, `login.schema.ts` e `auth.module.ts` com ≥ 80% de linhas cada; arquivo ausente do relatório conta como reprovado (o `.d.ts` gerado é excluído do relatório e não conta).

## Fase 2 — Web: tela "Entrar", rotas protegidas, 401 global e botão "Sair"

Caminhos relativos a `apps/web/`, salvo os que começam por `docs/` ou estão marcados como "raiz".

- [x] T2.1 — Tipo do contrato, caminho `/login` e os dois utilitários de redirecionamento
  - Arquivos: `src/types/api.ts` (alterar); `src/config/paths.ts` (alterar); `src/utils/get-safe-redirect-path.ts` (criar); `src/lib/hard-redirect.ts` (criar)
  - O que fazer (D6, D7, R5):
    - `types/api.ts` exporta `LoginBody`, derivado de `components['schemas']` de `@folioteca/api-contract`, sem redeclarar campos.
    - `paths.login` = `{ path: '/login', getHref: (redirectTo?: string) => string }`: com `redirectTo`, `'/login?redirectTo=' + encodeURIComponent(redirectTo)`; sem, `'/login'`.
    - `getSafeRedirectPath(redirectTo: string | null | undefined, fallback: string): string`, função pura: devolve `redirectTo` só se for caminho interno (começa por `/` seguido de algo que não seja `/` nem `\`); devolve `fallback` para `null`, vazio, URL absoluta (`https://…`), esquema (`javascript:`), `//host`, qualquer `\`, qualquer caractere de controle e destino que comece por `/login`.
    - `hardRedirect(href: string): void` = `window.location.assign(href)`. Módulo único para o fim de sessão (interceptor de 401 e "Sair"), substituível com `vi.mock` porque o jsdom não navega.
  - Skills: api-requests, routing, security, api-client
  - Complexidade: média

- [x] T2.2 — API simulada: senha do seed, login e logout
  - Arquivos: `src/testing/mocks/utils.ts` (alterar); `src/testing/mocks/db.ts` (alterar); `src/testing/mocks/handlers/installation.ts` (alterar); `src/testing/mocks/handlers/auth.ts` (alterar)
  - O que fazer (D11):
    - `utils.ts`: exporta `MOCK_PASSWORD`, montada em tempo de execução como o `MOCK_INSTALL_CODE` (`['mock', 'password', '0'.repeat(12)].join('-')`); o comentário das chaves de desenvolvimento passa a dizer que, com `mock-installation=installed`, entra-se com o e-mail do seed e essa senha.
    - `db.ts`: `MockInstallation` ganha `password: string`; `seedInstalled` grava `MOCK_PASSWORD`. A senha nunca sai em resposta de handler.
    - `handlers/installation.ts`: guarda a senha enviada no banco simulado.
    - `handlers/auth.ts`: `POST ${env.API_URL}/auth/login` — campos inválidos → 400 `{ message: 'Dados inválidos.', errors }` com as mesmas mensagens da API; sem instalação, e-mail (comparado em minúsculas e sem espaços) diferente ou senha diferente → 401 `{ message: 'E-mail ou senha incorretos.' }`; senão grava o cookie `folioteca_session` em `document.cookie` e responde 200 `CurrentUserResponse`. `POST ${env.API_URL}/auth/logout` — expira o cookie em `document.cookie` e responde 204 sem corpo. Os dois começam por `await networkDelay()` e `devOverride('auth')`, com corpos tipados por `@/types/api`. **Não** usar `Set-Cookie` do MSW (vaza entre testes).
  - Skills: api-mocking
  - Complexidade: média

- [x] T2.3 — Sessão no cliente: `useLogin`, `useLogout`, `ProtectedRoute` e o 401 global
  - Arquivos: `src/lib/auth.tsx` (alterar); `src/lib/api-client.ts` (alterar)
  - O que fazer (D6, D7, D8, D9, D10):
    - `auth.tsx`, seguindo o modelo da skill `authentication`: `loginInputSchema` (Zod: e-mail `trim().toLowerCase()`, "Informe o e-mail." · "Informe um e-mail válido."; senha "Informe a senha." · "A senha pode ter no máximo 128 caracteres.") e `LoginInput`; `login({ data }: { data: LoginInput }): Promise<CurrentUserResponse>` = `api.post('/auth/login', data, { silentError: true })`; `useLogin({ onSuccess }?)` grava `response.data` em `getUserQueryOptions().queryKey` com `setQueryData` (sem refazer `GET /auth/me`); `logout(): Promise<void>` = `api.post('/auth/logout')`, **sem** `silentError`; `useLogout({ onSuccess }: { onSuccess?: () => void } = {})` chama `queryClient.clear()` no sucesso e depois `onSuccess`.
    - `ProtectedRoute({ children }: { children: React.ReactNode }): React.JSX.Element`: sem usuário (`useUser().data` nulo) → `<Navigate to={paths.login.getHref(location.pathname + location.search)} replace />`; com usuário → os filhos. Não decide nada sobre instalação (`lib/` não importa de `features/`).
    - `api-client.ts`: no 401, continua rejeitando com `UnauthenticatedError` e sem notificar; **além disso**, quando a URL da requisição não contém `/auth/` **e** `window.location.pathname` não começa por `paths.login.path`, chama `hardRedirect(paths.login.getHref(window.location.pathname + window.location.search))`. O comentário "401 never redirects here…" sai do arquivo.
  - Skills: authentication, routing, api-client
  - Complexidade: alta

- [x] T2.4 — Feature `auth`: formulário de entrar
  - Arquivos: `src/features/auth/components/login-form.tsx` (criar); raiz `eslint.config.js` (alterar)
  - O que fazer (D10, R2, R11):
    - `eslint.config.js`: zona de `import/no-restricted-paths` para `apps/web/src/features/auth`, igual às de `connection` e `installation`.
    - `LoginForm(): React.JSX.Element` — **sem** prop `onSuccess`: quem navega depois do login é a guarda da rota. Usa `Form`, `Input` e `Button` de `components/ui`, `zodResolver(loginInputSchema)` e `useLogin()`.
    - Estrutura, de cima para baixo, com espaço vertical entre os itens: campo "E-mail" (`type="email"`, `autoComplete="username"`); campo "Senha" (`type="password"`, `autoComplete="current-password"`); alerta do servidor (só com erro), acima do botão, `role="alert"`, receita "Alerta dentro de formulário"; botão principal de largura total `type="submit"` "Entrar".
    - Comportamento: envio inválido não chama a API, mostra as mensagens sob o campo ("Informe o e-mail." · "Informe um e-mail válido." · "Informe a senha." · "A senha pode ter no máximo 128 caracteres.") e leva o foco ao primeiro inválido; cada campo com `<label>` por `htmlFor`, `aria-invalid` e `aria-describedby`. Enviando: botão desabilitado, `aria-busy`, texto "Entrando…". Erro 401 (`isUnauthenticatedError`): "E-mail ou senha incorretos."; qualquer outro erro (400 inesperado, 5xx, rede): "Não foi possível entrar. Tente de novo em instantes.". Os campos não são limpos; o alerta some no próximo envio. Nenhuma notificação global, nem de erro nem de sucesso.
  - Skills: forms, interface-design, authentication, project-structure
  - Complexidade: média

- [x] T2.5 — Rota `/login`, moldura protegida e fim do aviso "login em breve"
  - Arquivos: `src/app/routes/login.tsx` (criar); `src/app/router.tsx` (alterar); `src/app/routes/app/root.tsx` (alterar); `src/app/routes/app/session-required.tsx` (excluir); `src/app/routes/app/__tests__/session-required.test.tsx` (excluir)
  - O que fazer (D6, D9, R1, R4, R6, R10):
    - `login.tsx` exporta `Component` (padrão do projeto, como `install.tsx`) e decide nesta ordem: instância não instalada (`useInstallation`) → `<Navigate to={paths.install.getHref()} replace />`; usuário presente → `<Navigate to={getSafeRedirectPath(searchParams.get('redirectTo'), paths.home.getHref())} replace />`, sem desenhar o formulário; senão a tela. É esta guarda, ao re-renderizar depois do `setQueryData` do login, que leva ao destino: um mecanismo só para "já tem sessão" e "acabou de entrar".
    - Tela, em `<main id="main-content">` com a receita "Contêiner de página estreita", sem barra lateral: `<h1>` "Entrar" (receita de título de página); texto de apoio "Informe o e-mail e a senha da sua conta na Folioteca."; `LoginForm` com espaço acima. Carregando e erro da sessão já são do `AppGate` (nada novo). Tela sem estado "vazio".
    - `router.tsx`: `paths.login.path` registrado com `lazy`, filho do `AppGate`, irmão de `/install`, **fora** da rota do layout (`Root`).
    - `root.tsx`: mantém "não instalada → `/install`"; troca `<SessionRequired />` por `<ProtectedRoute>` em volta do `AppLayout`. Excluir `session-required.tsx` e o teste dele na mesma tarefa (senão os tipos quebram).
  - Skills: routing, interface-design, security, authentication
  - Complexidade: média

- [x] T2.6 — Botão "Sair" na identidade da barra lateral, com a receita atualizada
  - Arquivos: `src/components/layouts/sidebar-identity.tsx` (alterar); `docs/design.md` (alterar)
  - O que fazer (D7, R7, R8):
    - Abaixo do nome da pessoa, `Button` secundário de largura total, com espaço acima: "Sair"; enviando: desabilitado, `aria-busy`, "Saindo…". Usa `useLogout({ onSuccess: () => hardRedirect(paths.login.getHref()) })` — carga completa da página, nunca `navigate()` do roteador. Falha do logout: não redireciona, o botão volta a "Sair" e a notificação global existente avisa ("Algo deu errado"). Sem usuário o componente continua sem renderizar nada. Continua sem importar de `@/features` nem de `@/app`.
    - O botão fica **depois** dos quatro links da navegação na ordem de tabulação (o e2e `open-app.spec.ts` tabula até eles e não muda).
    - `docs/design.md`: a receita "Identidade na barra lateral" passa a registrar o botão secundário "Sair" (`mt-3 w-full`) entre o `<dl>` e o indicador de conexão. Nenhuma receita nova.
  - Skills: interface-design, authentication, component-robustness
  - Complexidade: baixa

- [x] T2.7 — Testes da fase 2
  - Arquivos: `src/utils/__tests__/get-safe-redirect-path.test.ts` (criar); `src/lib/__tests__/hard-redirect.test.ts` (criar); `src/features/auth/components/__tests__/login-form.test.tsx` (criar); `src/app/routes/__tests__/login.test.tsx` (criar); `src/lib/__tests__/auth.test.tsx` (alterar); `src/lib/__tests__/api-client.test.ts` (alterar); `src/components/layouts/__tests__/sidebar-identity.test.tsx` (alterar); `src/app/__tests__/router.test.tsx` (alterar); `src/app/routes/app/__tests__/root.test.tsx` (alterar); `src/app/routes/__tests__/app-gate.test.tsx` (alterar); `src/app/routes/__tests__/install.test.tsx` (alterar)
  - O que fazer: interações por `userEvent`; consultas por papel e texto em pt_BR; API só pelo MSW de `src/testing` (`seedInstalled`, `MOCK_PASSWORD`, `server.use` para forçar erro). `@/lib/hard-redirect` substituído com `vi.mock` onde houver fim de sessão. Testes de rota usam as rotas reais de `createRoutes()` num roteador em memória. Nenhum erro nem aviso no console (inclusive `act`).
    - `get-safe-redirect-path.test.ts`: `returns the fallback for null`; `returns the fallback for an empty string`; `keeps an internal path with its search` (`/favorites?x=1`); `rejects an absolute URL`; `rejects a protocol-relative URL` (`//host`); `rejects a backslash host` (`/\host`); `rejects a javascript: URL`; `rejects a control character`; `rejects a path that starts with /login`.
    - `hard-redirect.test.ts`: `calls window.location.assign with the target`.
    - `auth.test.tsx` (acrescentar): `loginInputSchema lowercases and trims the email`; `loginInputSchema rejects empty fields with the literal messages`; `useLogin writes the user to the cache without a second GET /auth/me`; `useLogin rejects with UnauthenticatedError on 401 and notifies nothing`; `useLogout clears the query cache and calls onSuccess`; `useLogout does not clear the cache when the request fails`; `ProtectedRoute redirects to /login with the path and the search in redirectTo`; `ProtectedRoute renders the children when there is a user`.
    - `api-client.test.ts` (acrescentar; endpoint fictício por `server.use`): `a 401 outside /auth redirects to /login with the current path in redirectTo`; `a 401 from /auth/me does not redirect`; `a 401 while on /login does not redirect`; `no 401 case adds a notification`. O caso existente `does not notify on 401` fica.
    - `login-form.test.tsx`: `renders the E-mail and Senha fields and the Entrar button`; `uses autocomplete username and current-password`; `submits the email in lowercase`; `empty submit shows the messages and focuses the email field`; `an invalid email does not send the request`; `button shows Entrando… disabled and aria-busy while sending`; `shows E-mail ou senha incorretos. on 401 and keeps the typed values`; `shows the failure alert on 500`; `clears the alert on the next submit`; `never adds a global notification`.
    - `login.test.tsx` (integração): `shows Entrar as the only h1 with the support text and no sidebar`; `signing in lands on the internal redirectTo`; `signing in with an external redirectTo lands on the home page`; `signing in without redirectTo lands on the home page`; `with a session the form is never rendered and the app opens`; `a not installed instance goes to /install`; `a wrong password stays on /login with the alert`.
    - `sidebar-identity.test.tsx` (acrescentar; os 3 casos existentes ficam): `Sair posts to /auth/logout, clears the cache and redirects to /login`; `button shows Saindo… disabled while sending`; `a failed logout does not redirect and shows the global notification`.
    - `router.test.tsx` (acrescentar): `/favorites without a session ends at /login?redirectTo=%2Ffavorites`; `registers /login outside the layout route`.
    - `root.test.tsx` (acrescentar): `without a session redirects to the login page instead of rendering the layout`.
    - `app-gate.test.tsx`: o caso `installed without session shows Acesso por login em breve instead of the layout` vira `installed without session shows the login page instead of the layout` (espera o `<h1>` "Entrar" e nenhuma navegação principal). `install.test.tsx`: `Ir para o início leads to the login notice` vira `Ir para o início leads to the login page` (espera o `<h1>` "Entrar").
  - Skills: unit-testing, component-testing, integration-testing, api-mocking, security
  - Complexidade: alta

### Critérios de aceite da fase 2

- [x] CA2.1 — Com `docker compose up -d` rodando, passam na raiz **sem erro nem aviso**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. A saída de `pnpm test` não tem `Warning:`, `act(`, `console.error` nem `console.warn`, e o build não acusa aviso novo.
- [x] CA2.2 — `apps/web/src/config/paths.ts` tem `login` com `path` `/login` e `getHref(redirectTo?: string)`, que devolve `/login` ou `/login?redirectTo=<encodeURIComponent>`. `apps/web/src/types/api.ts` exporta `LoginBody` derivado de `@folioteca/api-contract`, sem redeclarar campos.
- [x] CA2.3 — `getSafeRedirectPath(redirectTo: string | null | undefined, fallback: string): string` em `apps/web/src/utils/get-safe-redirect-path.ts` é função pura (sem `window`, sem import de React) e devolve o `fallback` para `null`, vazio, `https://…`, `//host`, `/\host`, `javascript:`, caractere de controle e `/login…`. `hardRedirect(href: string): void` em `apps/web/src/lib/hard-redirect.ts` chama `window.location.assign`. `rg -n "location\.(href|assign|replace)" apps/web/src --glob '!**/__tests__/**'` só acha `hard-redirect.ts`.
- [x] CA2.4 — `apps/web/src/lib/auth.tsx` exporta, além do que já existia: `loginInputSchema`, `login({ data }): Promise<CurrentUserResponse>` (com `silentError: true`), `useLogin` (grava o usuário em `['authenticated-user']` com `setQueryData`), `logout(): Promise<void>` (sem `silentError`), `useLogout` (chama `queryClient.clear()` no sucesso) e `ProtectedRoute`, que sem usuário devolve `<Navigate … replace />` para `paths.login.getHref(location.pathname + location.search)`. O arquivo não importa de `@/features` nem de `@/app`.
- [x] CA2.5 — `apps/web/src/lib/api-client.ts`: o 401 rejeita com `UnauthenticatedError` e não notifica; chama `hardRedirect` para `paths.login.getHref(<caminho + busca atuais>)` só quando a URL da requisição não contém `/auth/` e o `pathname` atual não começa por `/login`. O comentário "401 never redirects here" não existe mais.
- [x] CA2.6 — `apps/web/src/features/auth/components/login-form.tsx`: `LoginForm` não tem prop `onSuccess` nem chama `navigate`; rótulos literais "E-mail" (`type="email"`, `autoComplete="username"`) e "Senha" (`type="password"`, `autoComplete="current-password"`); mensagens "Informe o e-mail.", "Informe um e-mail válido.", "Informe a senha." e "A senha pode ter no máximo 128 caracteres."; alerta `role="alert"` acima do botão com "E-mail ou senha incorretos." no 401 e "Não foi possível entrar. Tente de novo em instantes." em qualquer outro erro; botão `type="submit"` "Entrar" / "Entrando…", desabilitado e `aria-busy` enquanto envia. O formulário não chama `addNotification`. O `eslint.config.js` da raiz tem a zona de `import/no-restricted-paths` para `features/auth`, e a feature não importa de outra feature nem de `@/app`.
- [x] CA2.7 — `apps/web/src/app/routes/login.tsx` exporta `Component` e decide nesta ordem: não instalada → `Navigate` para `paths.install.getHref()`; com usuário → `Navigate` com `replace` para `getSafeRedirectPath(searchParams.get('redirectTo'), paths.home.getHref())`; senão a tela. Textos literais: `<h1>` "Entrar" e apoio "Informe o e-mail e a senha da sua conta na Folioteca.". `apps/web/src/app/router.tsx` registra `/login` com `lazy`, sob o `AppGate` e fora da rota do layout.
- [x] CA2.8 — `apps/web/src/app/routes/app/root.tsx` envolve o `AppLayout` em `<ProtectedRoute>` e mantém o redirecionamento para `/install` quando não instalada. `session-required.tsx` e o teste dele não existem mais, e `rg -n "SessionRequired|Acesso por login em breve" apps/web/src` é vazio.
- [x] CA2.9 — `apps/web/src/components/layouts/sidebar-identity.tsx` tem, abaixo do nome da pessoa, um `Button` `variant="secondary"` de largura total com o texto "Sair" / "Saindo…" (desabilitado enquanto envia), que usa `useLogout` com `onSuccess` = `hardRedirect(paths.login.getHref())`; não usa `navigate`. O componente não importa de `@/features` nem de `@/app`.
- [x] CA2.10 — Piso de acabamento, conferível lendo o código: `login.tsx` fica em `<main id="main-content">` com as classes da receita "Contêiner de página estreita" do `docs/design.md`, tem **um único** `<h1>` com as classes de título de página e o apoio com as de texto de apoio; há espaço vertical entre título, apoio, campos, alerta e botão; cada campo tem `<label>` ligado por `htmlFor`; o alerta usa a receita "Alerta dentro de formulário" (borda e fundo de destaque); todo botão da fase é o componente `Button`, com `type` explícito (`rg -n "<button" apps/web/src/features/auth apps/web/src/app/routes/login.tsx apps/web/src/components/layouts/sidebar-identity.tsx` vazio). `rg -n "style=\{\{|!important|<a href=\"/|forwardRef|: JSX\.Element" apps/web/src` não acha nada. `docs/design.md` registra, na receita "Identidade na barra lateral", o botão secundário "Sair" (`mt-3 w-full`) entre o `<dl>` e o indicador de conexão, e `sidebar-identity.tsx` usa essas classes.
- [x] CA2.11 — API simulada: `MOCK_PASSWORD` é exportada de `apps/web/src/testing/mocks/utils.ts` e montada por `join` (sem literal inteiro da senha no repositório); `seedInstalled` grava essa senha; o handler de instalação guarda a senha enviada; `handlers/auth.ts` tem `POST /auth/login` (400 com `errors`, 401 "E-mail ou senha incorretos.", 200 com o cookie gravado em `document.cookie`) e `POST /auth/logout` (204, expira o cookie em `document.cookie`), ambos começando por `await networkDelay()`; nenhum handler usa o cabeçalho `Set-Cookie`. A senha não aparece em nenhum corpo de resposta.
- [x] CA2.12 — Existem e passam, pelos nomes listados em T2.7: `get-safe-redirect-path.test.ts` (9), `hard-redirect.test.ts` (1), `login-form.test.tsx` (10, entre eles `submits the email in lowercase`, `shows E-mail ou senha incorretos. on 401 and keeps the typed values` e `never adds a global notification`), `login.test.tsx` (7, entre eles `signing in lands on the internal redirectTo`, `signing in with an external redirectTo lands on the home page` e `with a session the form is never rendered and the app opens`), os 8 casos novos de `auth.test.tsx`, os 4 novos de `api-client.test.ts`, os 3 novos de `sidebar-identity.test.tsx`, os 2 novos de `router.test.tsx`, o caso novo de `root.test.tsx` e os dois casos renomeados de `app-gate.test.tsx` e `install.test.tsx`. Os demais testes das fatias 001 e 002 continuam passando. Conferir com `npx vitest run --project web --reporter=verbose`.
- [x] CA2.13 — O relatório de cobertura de `pnpm test` lista com ≥ 80% de linhas cada: `apps/web/src/utils/get-safe-redirect-path.ts`, `lib/hard-redirect.ts`, `lib/auth.tsx`, `lib/api-client.ts`, `config/paths.ts`, `features/auth/components/login-form.tsx`, `app/routes/login.tsx`, `app/router.tsx`, `app/routes/app/root.tsx` e `components/layouts/sidebar-identity.tsx`; arquivo ausente do relatório conta como reprovado. Não contam `src/types/api.ts` (só tipos) nem `src/testing/**` (excluídos do relatório).
- [x] CA2.14 — Nenhum arquivo de `apps/web/src/components`, `lib`, `config`, `types` ou `utils` importa de `@/features` ou `@/app`; não há barrel novo; nenhum token em `localStorage` (`rg -n "localStorage" apps/web/src --glob '!**/testing/**'` vazio) e nenhuma variável `VITE_*` nova.

## Fase 3 — Jornada "entrar e sair" provada de ponta a ponta e documentada

- [ ] T3.1 — Documentação da autenticação na arquitetura
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer, em pt_BR, só na §6, sem reescrever o resto: `POST /auth/login` (200 com o corpo de `/auth/me`) e `POST /auth/logout` (204, idempotente, sem exigir sessão); 401 único "E-mail ou senha incorretos." para e-mail inexistente e senha errada, com **uma** verificação argon2 nos dois casos graças ao hash falso gerado na subida (nunca um literal); ordem das checagens do login (cabeçalho `X-Requested-With` → campos → pessoa → verificação → 401 → revoga a sessão anterior → cria a sessão); o login não aplica a política de tamanho mínimo da senha; na web, fim de sessão é sempre carga completa da página (`hardRedirect`), usada pelo "Sair" e pelo 401 global fora de `/auth/*` e fora de `/login`; `redirectTo` só aceita caminho interno; limite conhecido: sessão revogada em outra aba só é percebida na próxima carga ou na primeira chamada protegida.
  - Skills: —
  - Complexidade: baixa

- [ ] T3.2 — Testes da fase 3 (e2e da jornada "entrar e sair")
  - Arquivos: `apps/web/e2e/mock-credentials.ts` (criar); `apps/web/e2e/tests/login-logout.spec.ts` (criar); `apps/web/e2e/tests/install.spec.ts` (alterar)
  - O que fazer: localizar tudo por papel e texto em pt_BR; acessibilidade pelo helper existente `apps/web/e2e/a11y.ts`. Estado inicial por `page.addInitScript` gravando `mock-installation` no `localStorage`. A jornada entrar→sair usa `installed` (a chave `signed-in` recria o cookie a cada carga e desfaria o logout).
    - `mock-credentials.ts`: exporta `MOCK_EMAIL` (`ana.souza@exemplo.com.br`, o e-mail do seed) e `MOCK_PASSWORD`, montada pelo mesmo `join` de `src/testing/mocks/utils.ts` (o e2e é outro projeto TypeScript, como `mock-install-code.ts`). O arquivo é coberto pelo `tsc -b` da raiz e pelo lint por estar em `apps/web/e2e/`.
    - `login-logout.spec.ts`:
      - `opening a protected address without a session lands on the login page` — `/favorites` termina em `/login?redirectTo=%2Ffavorites`, `<h1>` "Entrar", campos "E-mail" e "Senha", sem a navegação principal; axe.
      - `empty submit shows the validation messages and focuses the email field` — "Informe o e-mail." e "Informe a senha."; foco em "E-mail"; axe com os erros na tela.
      - `a wrong password shows the generic alert and stays on the login page` — alerta "E-mail ou senha incorretos."; URL continua em `/login`; axe com o alerta na tela.
      - `signing in with the email in uppercase lands on the requested page, and Sair ends the session` — a partir de `/favorites`: entra com `MOCK_EMAIL.toUpperCase()` e `MOCK_PASSWORD`; termina em `/favorites` com os nomes da organização e da pessoa na barra lateral; clica "Sair" e termina em `/login`; abre `/` de novo e continua em `/login`.
      - `an external redirectTo ends on the home page` — `/login?redirectTo=https%3A%2F%2Fexample.com`, entra, termina em `/`.
      - `opening /login with a session goes to the home page` — com `mock-installation=signed-in`, `/login` termina em `/` sem mostrar o formulário.
    - `install.spec.ts`: o caso `an installed instance without session shows the login notice on /` vira `an installed instance without session lands on the login page` (espera a URL `/login` e o `<h1>` "Entrar", sem a navegação principal; axe). Os outros cinco casos ficam como estão.
    - `apps/web/e2e/tests/open-app.spec.ts` **não muda** e continua passando.
  - Skills: e2e-testing
  - Complexidade: média

### Critérios de aceite da fase 3

- [ ] CA3.1 — `pnpm test:e2e` na raiz passa (o Playwright sobe o próprio servidor; não precisa de API nem de Postgres), e continuam passando **sem erro nem aviso** `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build`.
- [ ] CA3.2 — `apps/web/e2e/tests/login-logout.spec.ts` contém, pelos nomes, os seis casos de T3.2, e `pnpm --filter web exec playwright test --list` os lista junto com os seis de `install.spec.ts` e os cinco de `open-app.spec.ts`. O arquivo chama a verificação do axe nas três paradas da tela de entrar (vazia, com erros de validação, com o alerta de credencial). Não há `test.skip`, `test.only` nem `disableRules`.
- [ ] CA3.3 — O caso da jornada completa entra com o e-mail em maiúsculas, confere a URL `/favorites` e os dois nomes na barra lateral, clica "Sair", confere `/login` e prova que abrir `/` depois do logout continua em `/login`. A jornada usa `mock-installation=installed`, não `signed-in`.
- [ ] CA3.4 — `apps/web/e2e/mock-credentials.ts` exporta `MOCK_EMAIL` e `MOCK_PASSWORD`, esta montada por `join`, com o mesmo valor em tempo de execução que `MOCK_PASSWORD` de `apps/web/src/testing/mocks/utils.ts`. Nenhuma senha literal em `apps/web/e2e/**`.
- [ ] CA3.5 — Em `apps/web/e2e/tests/install.spec.ts` o caso do aviso de login foi trocado por `an installed instance without session lands on the login page`, e os outros cinco casos mantêm os nomes. `git diff develop... -- apps/web/e2e/tests/open-app.spec.ts` é vazio. `rg -n "Acesso por login em breve" apps docs/architecture.md docs/design.md` é vazio.
- [ ] CA3.6 — Os arquivos de `apps/web/e2e/**` passam no `pnpm lint` e no `pnpm typecheck` e não são coletados pelo Vitest (`npx vitest run --project web` não lista nenhum `.spec.ts`).
- [ ] CA3.7 — `docs/architecture.md` §6 registra: os dois endpoints com seus status (200 e 204 idempotente); o 401 único "E-mail ou senha incorretos." com o hash falso gerado na subida; a ordem das checagens do login, incluindo a revogação da sessão anterior; o fim de sessão por carga completa da página; a regra do `redirectTo` interno; e o limite conhecido da sessão revogada em outra aba.
- [ ] CA3.8 — A fatia está utilizável de ponta a ponta: com `docker compose up -d` e `pnpm dev`, quem não tem sessão é levado a "Entrar", entra com e-mail e senha, chega ao endereço pedido e sai pelo "Sair" — comprovado, sem navegador aberto por pessoa, pela soma de CA1.8 (API real), CA2.12 (web com a API simulada pelo mesmo contrato tipado) e CA3.1.

## DoD da entrega

- [ ] DoD1 — Todas as tarefas e critérios do plano marcados
- [ ] DoD2 — Suíte de testes inteira passa
- [ ] DoD3 — Lint do projeto inteiro sem erros nem avisos
- [ ] DoD4 — Tipos de todos os `tsconfig` sem erros
- [ ] DoD5 — Console dos testes sem erro nem aviso
- [ ] DoD6 — `build` passa
- [ ] DoD7 — Nenhum import entre features nem contra o fluxo compartilhado → features → app
- [ ] DoD8 — Nenhum `console.log`, `TODO`, `// @debug`, `.only(` ou `.skip(` no diff da branch
- [ ] DoD9 — Nenhuma worktree ou branch temporária sobrando
