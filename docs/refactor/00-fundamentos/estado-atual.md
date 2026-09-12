# Estado atual do código — retrato medido em 11/09/2026

Fotografia da branch `develop` (HEAD `f6114ab`) para os planos de `docs/refactor/`
saberem o que já existe e é reaproveitável, e o que falta. Sem opinião de produto:
tudo aqui foi lido no repositório, contado ou executado.

## 1. Resumo — o que a aplicação faz hoje de ponta a ponta

Quem abre o hotsite (`apps/site`, Next) lê uma landing de uma página — tese,
demonstração estática, dores, modelo de acesso, funcionalidades, preços, fecho — e
clica em "Entrar" ou "Criar conta", que levam à SPA (`apps/web`). Lá a pessoa cria
a conta da empresa (`/criar-conta`: nome, empresa, e-mail, senha de 12+), recebe o
e-mail de confirmação (Mailpit em dev), entra em `/entrar`, recupera e redefine a
senha (`/recuperar-senha`, `/redefinir-senha`). Com sessão (cookie `httpOnly` de 14
dias emitido pelo Better Auth na API) ela vê o esqueleto: barra superior com quatro
destinos — Documentos, Canais, Pesquisa, Organização — todos em **estado vazio com
botão sem ação**, e `/perfil`, onde troca nome, senha e e-mail e encerra sessões.
`/design` mostra os quinze primitivos. Não existe documento, canal, espaço, convite,
busca nem editor: o banco tem só as tabelas de conta e `Organization`.

## 2. Monorepo e ferramentas

- **Raiz**: `packageManager: pnpm@11.25.0`, `engines.node >=24` (`.nvmrc` 24,
  `engine-strict`). Scripts `dev` (materializa `.env`, `docker compose up -d --wait`,
  `pnpm -r --parallel dev`) e `contract` (gera `openapi.json` e o cliente da web).
- **`pnpm-workspace.yaml`**: `apps/*`, `packages/*`; `allowBuilds` só `prisma` e
  `@prisma/engines`; `overrides` de segurança (`js-yaml`, `multer`, `deepmerge-ts`,
  `mysql2`); `minimumReleaseAge: 10080` (sete dias).
- **Versões-chave**: `api` — NestJS 11.2.3, Prisma 7.10.0 + `@prisma/adapter-pg`,
  `better-auth` 1.7.2, `class-validator` 0.14.2, `joi` 18.2.5, `helmet` 8.3.0,
  `nodemailer` 9.1.1, `@nestjs/terminus` 11.1.1, `@nestjs/swagger` 11.4.7, Jest
  30.4.2, Supertest 7.2.2. `web` — React 19.2.8, `react-router` 8.3.1, Vite 8.2.2
  (Rolldown), Tailwind 4.3.3, `@ark-ui/react` 5.39.1, TanStack Query 5.102.8, axios
  1.20.0, `better-auth` 1.7.2, RHF 7.87.0, zod 4.5.4, cva, clsx, tailwind-merge,
  Vitest 4.1.11, Testing Library, MSW 2.15.0, Playwright 1.62.1, `@axe-core/playwright`
  4.13.0, `@hey-api/openapi-ts` 0.99.0. `site` — Next 16.3.3, Tailwind 4 via PostCSS.
  `@folioteca/tema`, `@folioteca/editor`. **Não há Zustand.**
- **Scripts por app**: api `dev/start/build/lint/typecheck/test/test:integration/
  openapi:generate/db:generate/db:migrate` (+ `postinstall: prisma generate`); web
  `dev/build/preview/lint/typecheck/test/e2e/api:generate`; site
  `dev (-p 3001)/build/start/lint/typecheck`.
- **TypeScript 5.9.3**, `tsconfig.json` por app (sem raiz): api CommonJS/ES2022 com
  decorators; web `bundler`, `strict`, alias `@/* → src/*`.
- **ESLint 10.9.1 + typescript-eslint 8.68.0**, flat config por app
  (`apps/*/eslint.config.mjs`); web soma a regra local `local/valor-magico`; site usa
  `@next/eslint-plugin-next`. **Não há Prettier.**
- **`docker-compose.yml`**: `postgres` (`pgvector/pgvector:pg16`, `127.0.0.1:5433`,
  init `docker/postgres/init/01-vector.sql` = `CREATE EXTENSION vector`) e `mailpit`
  (`v1.21`, `1025` SMTP, `8025` web).
- **`.env.example`** (único `.env`, na raiz): `NODE_ENV`, `PORT`, `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `API_URL`, `WEB_ORIGIN` (CSV), `SMTP_HOST/PORT/USER/PASSWORD`,
  `MAIL_FROM`, `VITE_API_URL`, `VITE_COOKIE_DOMAIN`, `NEXT_PUBLIC_APP_URL`,
  `NEXT_PUBLIC_COOKIE_DOMAIN`.
- **Outros**: `Dockerfile` nos três apps (contexto = raiz), `apps/web/nginx.conf`,
  `.vscode/launch.json`, `.gitleaks.toml`, `.github/dependabot.yml` (github-actions,
  semanal, alvo `develop`), `.claude/skills/` (22 `nest-*`/`react-*`),
  `.claude/agents/` (5). 616 arquivos rastreados.

## 3. `apps/api`

### Módulos (`src/`, 1.156 linhas)

| Pasta/arquivo | O que faz |
|---|---|
| `main.ts` | Lê `.env` da raiz, valida com Joi, chama `createApp()`. |
| `bootstrap.ts` | `NestFactory.create` com `bodyParser: false`; `helmet` (CSP off, `X-Frame-Options: DENY`, HSTS só em produção); CORS; monta o Better Auth em `/api/auth`; `express.json()`. |
| `app.module.ts` | `ConfigModule` global com `validationSchema`; `ValidationPipe` global `{ whitelist, forbidNonWhitelisted }`. |
| `config/` | `environment.schema.ts` (Joi), `environment-variables.ts`, `web-origins.ts` (`parseWebOrigins`, `isWebOriginList`). |
| `cors.ts` | `enableCors({ origin: [WEB_ORIGIN...], credentials: true })`. |
| `prisma/` | `PrismaService` (extends `PrismaClient` com `PrismaPg`), global. |
| `mail/` | `MailService.send({to, subject, text})` por nodemailer SMTP, global. |
| `auth/` | `createAuth()` (fábrica do Better Auth), provider `AUTH_INSTANCE`, `AUTH_BASE_PATH = "/api/auth"`. |
| `account/` | `AccountController` → `AccountService.register` → `AccountRepository.createOrganizationForUser` (transação: cria `Organization`, marca `ADMIN`); `dto/register.dto.ts`. |
| `health/` | `HealthController` (`/health`, `/health/ready`), `DatabaseHealthIndicator` (conta migrations concluídas). |
| `swagger.ts` | `buildOpenApiDocument` ("Folioteca API" 1.0.0). |

### Rotas expostas

- `GET /health` → `{"status":"ok"}`; `GET /health/ready` (Terminus 200/503).
- `POST /auth/register` (202 sempre; `RegisterDto`: `name`, `organizationName`,
  `email`, `password` 12–128) → `auth.api.signUpEmail` com `callbackURL =
  WEB_ORIGIN[0]/documentos` + criação da organização.
- `/api/auth/*` — rotas do Better Auth (`sign-in/email`, `sign-out`, `get-session`,
  `request-password-reset`, `reset-password`, `send-verification-email`,
  `verify-email`, `update-user`, `change-password`, `change-email`, `list-sessions`,
  `revoke-session`, `revoke-other-sessions`…); `sign-up/email` **desabilitada** por
  HTTP. Sem prefixo global.

### Prisma (`prisma/schema.prisma`) e migrações

Uma migração: `20260910020900_fundacao_de_conta`. Enum `UserRole { ADMIN, MEMBER }`.

| Tabela | Colunas |
|---|---|
| `Organization` | `id` uuid, `name`, timestamps; `members User[]`. |
| `User` | `id`, `name`, `email` único, `emailVerified`, `image?`, `role` (default `MEMBER`), `organizationId?` (FK `SET NULL`, índice), timestamps. |
| `Session` | `id`, `expiresAt`, `token` único, `ipAddress?`, `userAgent?`, `userId` (FK cascade, índice), timestamps. |
| `Account` | `id`, `issuer`, `accountId`, `providerId`, tokens OAuth opcionais, `scope?`, `password?`, `userId` (FK cascade), timestamps. |
| `Verification` | `id`, `identifier` (índice), `value`, `expiresAt`, timestamps. |

`prisma.config.ts` lê `DATABASE_URL` do `.env` da raiz. Não há tabela de documento,
canal/espaço, permissão, convite, versão ou vetor — a extensão `vector` existe no
compose e nenhum modelo a usa.

### Autenticação (`auth/auth.factory.ts`)

`prismaAdapter(postgresql)`, `baseURL = API_URL`, `basePath = /api/auth`, `secret =
BETTER_AUTH_SECRET` (mín. 32), `trustedOrigins = WEB_ORIGIN`. E-mail/senha com
`requireEmailVerification`, senha 12–128, `sendResetPassword` (texto, 1 h);
verificação `sendOnSignUp`, `expiresIn 24h`, `autoSignInAfterVerification`;
`user.changeEmail.enabled` **sem** `sendChangeEmailVerification` (a UI promete link
ao endereço novo — a verificar); sessão 14 dias; cookie `httpOnly`, `sameSite lax`,
`secure` só em produção. **Não há `/me` no Nest**: a web lê `GET /api/auth/get-session`.
Provedores sociais e SSO: nenhum.

### Guard, filtro, validação, contrato, e-mail, logs

- **Guard de rota: não existe** (`CanActivate|UseGuards|APP_GUARD` → 0). Nenhuma
  rota do Nest lê a sessão.
- **Filtro de exceção: não existe** (`APP_FILTER`/`@Catch` → 0).
- **Validação**: `ValidationPipe` global; um DTO de entrada (`RegisterDto`, com
  `@Transform` trim/lowercase); `HealthResponse` só de saída.
- **OpenAPI**: `scripts/generate-openapi.ts` monta um módulo com **só `HealthModule`**
  e grava `apps/api/openapi.json` — apenas `/health`, `/health/ready` e o schema
  `HealthResponse`. **`POST /auth/register` está fora do contrato**, e o Better Auth
  também. O CI reprova `openapi.json` ou `apps/web/src/shared/api/generated/` dessincronizados.
- **E-mail**: nodemailer SMTP, `secure: false`, auth só com `SMTP_USER/PASSWORD`;
  Mailpit em dev; log `{ event: "mail.sent", to }`.
- **Logs**: `Logger` do Nest em `AccountService` (`account.register.rejected`) e
  `MailService`, objeto estruturado; sem módulo de logger nem correlation id.

### Testes e imagem

- **Unidade** (`jest.config.js`, `src/**/*.spec.ts`): 3 arquivos, 46 testes —
  `environment.schema` (21), `web-origins` (21), `database.health` (4, Prisma dublê).
  **`account/` e `auth/` sem teste.**
- **Integração** (`test/jest-e2e.config.js` — é `.js`, não `jest-e2e.json`; `testRegex
  .e2e-spec.ts$`; `transformIgnorePatterns: []` para o ESM do Better Auth; 30 s): 4
  arquivos, 13 testes — `cors` (4), `environment-validation` (1), `health` (1),
  `security-headers` (7). Sobem a app por `createApp()` contra o Postgres de
  `DATABASE_URL` (compose local; no CI, service container com porta sorteada).
  **Sem Testcontainers** (o README diz que há). Nada cobre `/auth/register`.
- CI roda ainda `prisma migrate deploy` + `prisma migrate diff --exit-code` (drift).
- **Dockerfile**: dois estágios, `pnpm deploy --filter=api --prod`, `prisma generate`
  em `/app`, runtime `node:24.13-alpine` + `tini`; `CMD` = `prisma migrate deploy &&
  node dist/main.js`.

## 4. `apps/web`

### Estrutura de `src/`

`app/` (`App.tsx`, `main.tsx`, `providers/query-provider.tsx`, `layout/` 9 arquivos,
`routes/` 13 rotas + `index.tsx`), `features/{auth,conta,health}`, `shared/{api,
components/ui, components/access, config, hooks (vazio), lib, styles, theme}`.
Import só `shared → features → app` (G5).

### Rotas (`app/routes/index.tsx`) e o que cada tela mostra

| Caminho | Hoje |
|---|---|
| `/entrar` | `AuthLayout` + `EntrarForm`; links para recuperar senha e criar conta. |
| `/criar-conta` | `CriarContaForm`; ao 202 mostra "confira o e-mail". |
| `/recuperar-senha` | `RecuperarSenhaForm` (`requestPasswordReset`, `redirectTo` `/redefinir-senha`). |
| `/redefinir-senha` | `RedefinirSenhaForm` (`resetPassword` com `token` da URL). |
| `/design` | `PaginaViva`, pública, fora do esqueleto: tokens e os 15 primitivos. |
| `/` | `Navigate` para `/documentos`. |
| `/documentos` | `SecaoLayout` com sublateral `ArvoreDeDocumentos` (vazia) + `EmptyState` e botão inerte. |
| `/canais` | Idem, com `ArvoreDeCanais`. |
| `/pesquisa` | `EmptyState` sem sublateral; botão inerte. |
| `/organizacao` | `HealthStatus` (sonda do `/health`) + `EmptyState` "Nenhum membro convidado". |
| `/perfil` | Quatro `PerfilSecao`: Nome, Senha, E-mail, Sessões abertas. |
| `*` | `NaoEncontradaRoute`; `ErroInesperadoRoute` é o `errorElement` da raiz. |

De `/` a `/perfil` tudo fica sob `RotaProtegida` → `AppShell`.

### Esqueleto (`app/layout/`)

`app-shell.tsx` (`SkipLink` + `AppHeader` + `Outlet`, sem `<main>`); `app-header.tsx`
(sticky: `GavetaDeDestinos`, marca, `NavegacaoDeDestinos` horizontal ≥768 px,
`MenuDeConta`); `gaveta-de-destinos.tsx` (drawer com `Dialog` abaixo de 768 px);
`navegacao-de-destinos.tsx` (`DESTINOS` = 4 `NavLink`, cva por orientação);
`menu-de-conta.tsx` (`Menu` Ark: nome/e-mail da sessão, "Sua conta", tema, "Sair" =
`signOut` + `queryClient.clear()` + `/entrar`); `secao-layout.tsx` (`Sublateral`
opcional + `<main id="conteudo">` `max-w-4xl`); `sublateral.tsx` (`aside` 16 rem a
partir de tablet, empilha abaixo); `skip-link.tsx`; `listas-da-sublateral.tsx`.

### Primitivos (`shared/components/ui/`, 15, cada um com `.test.tsx`)

- `avatar` — iniciais, `role="img"`, cva `size sm/md/lg`.
- `badge` — cva `tone neutro/acao`, `size normal/reduzida`.
- `button` — cva `variant primary/secondary/ghost/destructive`, `size sm/md/lg`.
- `card` — polimórfico (`as`), borda `fio`, `shadow-repouso`.
- `checkbox` — Ark: `Root/Control/Indicator/Label/HiddenInput`.
- `dialog` — Ark: `Root/Trigger/Backdrop/Positioner/Content/Title/CloseTrigger`.
- `empty-state` — título (`h2`–`h4`), descrição, `action`.
- `field` — composto próprio: `Root/Label/Control/Password (olho)/Hint/Error`, com `aria-invalid`/`aria-describedby`.
- `menu` — Ark: `Root/Trigger/Positioner/Content/Item/ItemText`.
- `pagination` — `nav` "Paginação", `aria-current="page"`.
- `select` — Ark: `Root/Label/Control/Trigger/ValueText/Positioner/Content/Item/ItemText/HiddenSelect`.
- `skeleton` — `aria-hidden`, `animate-pulse`.
- `switch` — Ark: `Root/Control/Thumb/Label/HiddenInput/Context`.
- `toast` — `role="status"`, cva `tone neutro/sucesso`; sem fila.
- `tooltip` — Ark: `Root/Trigger/Positioner/Content`.

`shared/components/access/`: `AccessSpine` (filete `border-l-4`, cva `origin
canal/pessoa/privado`), `AccessBadge` (Badge + marca + rótulo), `marks/channel.tsx`,
`person.tsx`, `private.tsx`. `shared/components/alternador-de-tema.tsx`. Nenhum
componente de `access/` é usado fora de `/design`.

### Tema

`shared/styles/theme.css`: `@import "tailwindcss"`; quatro `@font-face`
auto-hospedadas (Fraunces, Atkinson Hyperlegible Next, IBM Plex Mono 400/600);
`@theme` com seis cores (`papel`, `tinta`, `grafite`, `verdete`, `carimbo`, `fio`),
três faces, `--spacing 0.25rem`, raios `sutil/padrao/amplo`, sombras `repouso/eleva`,
**um breakpoint** `--breakpoint-desde-tablet: 768px`, `--duracao-rapida 120ms`,
`--duracao-padrao 220ms`, `--curva-padrao`. Três estados: `:root` claro;
`@media (prefers-color-scheme: dark) :root:not([data-tema="claro"])`;
`:root[data-tema="escuro"]`; nomes semânticos (`--superficie`, `--acao`,
`--lombada-*`), `color-scheme`, `:focus-visible` global, `prefers-reduced-motion`.
Dark mode por **atributo `data-tema`** escrito em `main.tsx` a partir do **cookie
`folioteca.tema`** antes do render; `shared/theme/ThemeProvider/useTema` alterna e
grava o cookie (`VITE_COOKIE_DOMAIN`, `Secure` sob https).

### HTTP, tipos, estado, formulários

- `shared/api/client.ts`: única instância axios (`baseURL = VITE_API_URL`, 10 s),
  `ApiError` via interceptor; `shared/api/generated/` (`@hey-api/openapi-ts`, só
  tipos): hoje `HealthResponse`, `GetHealth*`, `GetReadiness*`; barril `index.ts`.
- `shared/config/env.ts` (falha sem `VITE_API_URL`), `build-api-url.ts`;
  `shared/lib/cn.ts`, `axe-severidade.ts`.
- Servidor: TanStack Query (`useHealth`, `useSessoes`); sessão: `useSession` do
  cliente Better Auth (`credentials: include`). Sem Zustand, sem estado de URL.
- Formulários: RHF + `zodResolver` nos cinco forms de auth/conta.

### `features/auth`, `features/conta`, `features/health`

- `auth/index.ts` exporta `authClient`, `useSession`, `signOut`, `changeEmail`,
  `changePassword`, `updateUser`, `listSessions`, `revokeSession`,
  `revokeOtherSessions`, `CAMINHO_ENTRAR/RECUPERAR_SENHA/REDEFINIR_SENHA`,
  `AuthLayout`, `EntrarForm`, `CriarContaForm`, `RecuperarSenhaForm`,
  `RedefinirSenhaForm`, `RotaProtegida`. `api/auth-client.ts` (`createAuthClient`),
  `api/registrar.ts` (`POST /auth/register` por axios, tipo à mão), `api/auth-handlers.ts`
  (MSW). `EntrarForm` traduz `INVALID_EMAIL_OR_PASSWORD` e `EMAIL_NOT_VERIFIED` (mostra
  `ReenviarConfirmacao`) e volta ao `location.state.de`. `RotaProtegida`: `isPending`
  → "Verificando sua sessão…"; sem sessão → `/entrar`. Guarda de experiência apenas.
- `conta/index.ts` exporta `CAMINHO_PERFIL`, `NomeForm` (`updateUser`), `SenhaForm`
  (`changePassword` com senha atual + checkbox `revokeOtherSessions`), `EmailForm`
  (`changeEmail`), `SessoesLista` (`useSessoes` + `revokeSession`, marca a corrente),
  `PerfilSecao`; `api/chaves.ts`, `use-sessoes.ts`, `conta-handlers.ts` (MSW).
- `health`: `getHealth`, `useHealth`, `HealthStatus` (`role="status"`).

### Testes

- **Vitest** (bloco `test` de `vite.config.ts`, jsdom, `vitest.setup.ts` com
  `matchMedia` dublê): 33 arquivos, 156 testes — ui 62, auth 30, conta 21, lib 12,
  config 10, health 7, access 6, app 4, theme 4 — mais 20 de `packages/tema`.
- **Playwright** (`e2e/`, 7 specs, 45 casos): `esqueleto.spec.ts` (14: destinos,
  gaveta, foco, tema, sublateral), `primitivos.spec.ts` (15, em `/design`),
  `a11y.spec.ts` (5, axe nos dois temas e estados), `politica-de-conteudo.spec.ts` (4),
  `pagina-viva.spec.ts` (4), `tema-atravessa.spec.ts` (2, hotsite → app),
  `health.spec.ts` (1). `e2e/apoio/sessao.ts` é **dublê de sessão**: intercepta
  `**/api/auth/get-session*` e responde `SESSAO_DE_TESTE` com cabeçalhos CORS; fixture
  automática de `esqueleto`, `a11y` e `health`. **Não há e2e de login real** (o
  comentário cita um `entrar.spec.ts` inexistente). `apoio/axe.ts` (WCAG A/AA;
  `critical`/`serious` reprovam; o resto vai a `e2e-apontamentos.json`), `apoio/console.ts`.
- `playwright.config.ts`: `fullyParallel`, `maxFailures 0`, `retries 0`, reporters
  `list` + `json` (`e2e-resultado.json`) + `html`; sem `projects` (Chromium); `webServer`
  tríplice — API (`pnpm --filter api run start`, `:3000`, segredo fixo de teste,
  `WEB_ORIGIN` web+site), web (`build` + `vite preview` em `WEB_PREVIEW_PORT`, padrão
  4173), site (`build` + `next start -p 3101`). `scripts/e2e/relatorio.sh rodar|criterio`
  amarra o relatório à árvore medida.

### CSP, cabeçalhos e lint próprio

- `vite.config.ts`: `requireApiUrlOnBuild` e `injectContentSecurityPolicyOnBuild` —
  só no `build`, `<meta http-equiv="Content-Security-Policy">` com `default-src 'self';
  script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'
  ${VITE_API_URL}; object-src 'none'; base-uri 'self'; form-action 'self'`.
  `server`/`preview` respondem `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options: DENY`, `Permissions-Policy`; `nginx.conf` repete os quatro.
  `codeSplitting` em `react`/`ark`/`vendor`. `scripts/verificar-politica.sh` mede
  `dist/` e os dois servidores (+ testes bash em `scripts/__tests__/`).
- `eslint-rules/valor-magico.js`: reprova `bg-[`, `text-[`, `p-[`, `h-[` em
  `className` sem marca de justificativa na linha acima; vale em `src/**` exceto
  `src/shared/components/**`.

## 5. `apps/site`

- **Uma página**, `src/app/page.tsx`: `Hero` ("O acesso segue o trabalho, não o
  organograma"), `Demo` (documento **estático**, não o editor), `Pains`, `AccessModel`,
  `Ask`, `Features`, `Pricing` (Grátis R$ 0; Time R$ 79/mês para 10 pessoas + R$ 7/pessoa
  até 50; Empresa por `mailto`), `Closing`. `content/` vazio (`.gitkeep`).
- **`layout.tsx`**: `dynamic = "force-dynamic"`; lê o cookie `folioteca.tema` no
  servidor e estampa `data-tema`; preload das fontes; skip link; `SiteHeader` (âncoras
  Produto/Funcionalidades/Preços, `ThemeToggle` — único `"use client"` —, "Entrar" →
  `NEXT_PUBLIC_APP_URL/entrar`); `SiteFooter`. `lib/app-url.ts`, `lib/moldura.ts`,
  `lib/cn.ts`; `components/ui/` (`badge`, `button`/`ButtonLink`, `card`, `marks`)
  duplicam os da web; `styles/theme.css` repete os tokens e soma `desde-laptop` (1024)
  e `desde-monitor` (1280).
- **CSP/proxy**: `src/proxy.ts` gera nonce por requisição e emite `script-src 'self'
  'nonce-…'` + diretivas constantes (`frame-ancestors 'none'`) na requisição e na
  resposta. `next.config.ts`: quatro cabeçalhos + HSTS em produção,
  `transpilePackages: ["@folioteca/tema"]`, `output: "standalone"`, `agentRules:
  false`, `poweredByHeader: false`.
- **Testes**: nenhum unitário; `scripts/verificar-politica.sh producao|desenvolvimento`
  sobe o servidor e mede cabeçalhos, política e nonce (+ teste bash). CI: typecheck,
  build, política, gates.

## 6. `packages/`

- **`tema`** (`src/tema.ts`, 20 testes rodados pela web): `type Tema`, `CHAVE_DO_TEMA =
  "folioteca.tema"`, `ATRIBUTO_DO_TEMA = "data-tema"`, `comoTema`, `temaEfetivo`,
  `lerTemaDoDocumento` (cookie do navegador ou cabeçalho `Cookie`),
  `serializarCookieDeTema` (Path, 1 ano, SameSite=Lax, Domain opcional, Secure). Sem build.
- **`editor`**: `package.json` sem dependência, `README.md` (promete Plate) e
  `src/.gitkeep`. **Vazio**; Plate não está no lockfile.

## 7. CI e portões

- **Gatilhos** (`.github/workflows/`): `ci-nestjs.yml` ("NestJS"), `ci-react.yml`
  ("React"), `ci-site.yml` ("Site"), `portoes.yml` ("Portões") — `push` em
  `main`/`develop` com filtro de caminhos e `pull_request`
  (`opened/reopened/synchronize/ready_for_review`), `concurrency` por ref, jobs `casa`
  (`runs-on: self-hosted`) e `nuvem` (`ubuntu-latest`, `needs: casa`), ambos com
  `if: draft != true`. `bloqueio.yml` reprova PR com rótulo `blocked-on-*`.
- **Suítes** (`_suite-*.yml`, `workflow_call` com `runner`): nestjs — `guarda`,
  `contrato` (openapi + cliente sincronizados), `qualidade` (lint, tipos, unidade),
  `integracao` (Postgres pgvector como service container de porta sorteada,
  `test:integration`, `db:migrate` + `migrate diff`), `gates`. react — `guarda`,
  `qualidade` (tipos, lint, Vitest, build, política, testes bash), `comportamental`
  (Postgres + Mailpit, migrate, Chromium, `relatorio.sh rodar` em `WEB_PREVIEW_PORT
  4273`, artefatos), `gates`. portoes — `medir` (todos os `__tests__/*.test.sh`,
  portões diretos, build dos três apps, gitleaks + `segredo.sh`), `divergencias` (G8).
  site — `verificacao`.
- **`scripts/gates/*.sh`**, um por linha:
  - `gate3_no_comments.sh` — comentário sem marca de justificativa (G3).
  - `gate4_no_todo.sh` — `TODO|FIXME|XXX|HACK` (G4, sem escape).
  - `gate5_import_direction.sh` — import contra `shared → features → app` ou interior de outra feature (G5).
  - `gate7_layer_boundary.sh` — controller que cita Prisma/ORM (G7).
  - `gate8_divergence_status.sh` — status do `D-nnn.md` igual ao `product/state.json`.
  - `quarentena.sh` — `minimumReleaseAge` = 10080 e lista de isenções vazia.
  - `acoes_em_sha.sh` — todo `uses:` em SHA de 40 hex, com piso de contagem.
  - `vulnerabilidade.sh` — `pnpm audit` sem alta/crítica sem isenção com prazo.
  - `fluxos.sh` — guarda de rascunho e `ready_for_review` em todo fluxo.
  - `pnpm_isolado.sh` — `pnpm/action-setup` com `dest` próprio do job.
  - `concorrencia.sh` — `concurrency` nos gatilhos e ausente nas suítes.
  - `portas_de_servico.sh` — service container sem porta fixa no host.
  - `atalho.sh` — marcador `atalho:` com teto, troca e item de roadmap existente.
  - `e2e_uma_subida.sh` — nenhum `-g/--grep/--shard/--max-failures` no Playwright.
  - `icone_unico.sh` — ícone idêntico e declarado nos dois apps.
  - `plano.sh` — plano do item ativo passa no lint de critérios.
  - `segredo.sh` — gitleaks na árvore e nos três artefatos de build.
  - `bloqueio.sh` — rótulo `blocked-on-*` reprova. `medir.sh` — biblioteca de asserções.
- **`gates_runner.sh`**: lê `.harness/gates.json`, roda G3/G4/G5/G7 por arquivo (modo
  `greenfield` = tolerância zero; `--all`, `--diff-only`, `--baseline`), depois os
  onze portões diretos com código de saída propagado; `--sem-artefatos` pula só `segredo.sh`.
- **`scripts/merge-se-liberado.sh <pr> [--squash]`**: recusa merge com rótulo de
  bloqueio, verificação vermelha/pendente ou medição impossível; tetos de tempo.
- **`.harness/gates.json`**: G3, G4, G5 em `apps/web/src/**`; G3, G4, G7 em
  `apps/api/src/**`; `apps/site` **não** declarado (o README do site diz que G3/G4
  valem lá). **`tool-matrix.json`**: escopo de escrita e ferramentas por agent
  (`react-implementer` → `apps/web/**`, `nest-implementer` → `apps/api/**`,
  `contract-guardian` → `packages/api-client/**`, inexistente). `config.json`: `route
  greenfield`, `modo_autonomo true`, branches `producao main` / `integracao develop`.
- **Branches**: `develop` é a única local; `main` só no remoto, no commit de bootstrap.

## 8. Deploy (`docs/DEPLOY.md`, `docs/setup-secrets.md`)

Coolify, projeto `Folioteca`, ambientes `hml` e `prod` (mais um `production` vazio).
Banco `folioteca-db-hml` (`pgvector/pgvector:pg16`). Três apps de homologação na
branch `develop`, `base_directory: /` + `dockerfile_location` por app, **auto deploy
ligado** (merge em `develop` publica): `folioteca-api-hml` (`:3000`,
`https://api-hml.folioteca.duckdns.org`, health `/health`), `folioteca-web-hml`
(`:80`, `https://hml.folioteca.duckdns.org`, health `/`), `folioteca-site-hml`
(`:3001`, `https://site-hml.folioteca.duckdns.org`). Domínio wildcard
`*.folioteca.duckdns.org`. Variáveis da web/site são de **build** (`VITE_*`,
`NEXT_PUBLIC_*`), as da API de **runtime**; cookie de tema no domínio pai.
**Migrations em hml rodam no boot do contêiner da API.** **Não há produção**: as
apps de `prod` são do projeto antigo (item `083`). `setup-secrets.md` tabela cada
variável, se é segredo e onde obter.

## 9. Documentos de produto que ainda valem

- **`product/00-visao-de-produto.md`** (PRD v0.4, 02/09/2026) fixa: o problema (três
  dores); quatro públicos; o escopo (hotsite, conta por e-mail/senha, organização
  criada no cadastro, convites, hierarquia que não concede acesso, editor em blocos,
  espaço privado, canais abertos/restritos, publicação, concessão individual,
  transferência de propriedade, comentário ancorado, busca por permissão, versões,
  conversa com IA com citação, chave de modelo por organização); o modelo de acesso
  (níveis sem acesso/leitura/comentário/edição + proprietário; autoria ≠ propriedade;
  sujeitos pessoa e canal; regras numeradas; canal geral; resolução no servidor);
  não-escopo (mensagens, cursores ao vivo, link público, 2FA, Google, SSO, importação,
  app nativo, áudio, IA que escreve, cobrança); cinco métricas; riscos; anotações
  (Plate, índice pgvector no mesmo banco).
- **`product/00-linguagem-visual.md`** fixa: direção "Lombada" (filete de 4 px na
  borda esquerda dizendo a origem do acesso — canal/verdete, pessoa/carimbo,
  privado/grafite); seis cores com valor por tema e contraste AA medido; três faces
  auto-hospedadas e escala de oito degraus; espaço múltiplo de 0,25 rem; três raios;
  duas sombras; 120/220 ms; um breakpoint (768 px); régua de acessibilidade (foco
  visível, movimento reduzido, nenhum valor mágico, cor nunca sinal único, axe
  crítico/sério reprova); regra de idioma (interface pt-BR, identificador em inglês,
  mesmo verbo do botão ao aviso, estado vazio é convite, erro diz o que fazer).
- **`docs/autenticacao.md`** decide Better Auth na própria API, sessão no banco,
  Prisma 7.10.0, RHF + Zod; quatro fatias: 1 (banco + sessão) entregue; 2 (telas)
  "em curso" — o "Falta" cita `/recuperar-senha` e `/redefinir-senha`, que **já
  existem**, e `/confirmar-email`, que não existe (o link cai em `/documentos` pelo
  `callbackURL`); 3 (Google) e 4 (SSO) pendentes; tema por cookie; esqueleto com barra
  superior; **harness suspenso** (`active_item: null` em `product/state.json`).
- **`docs/estrutura-espacos-e-compartilhamento.md`** (476 linhas, **não rastreado**):
  plano em dez fases (0–9) de estrutura organizacional, espaços, convites,
  compartilhamento e editor Plate mínimo. O modelo está copiado em
  `docs/refactor/00-fundamentos/modelo-de-acesso.md` (também não rastreado), que
  renomeia "Canais" para **Espaços**. Outro documento o resume.

## 10. Lacunas medidas

O que a visão promete e não existe no código:

- **Nenhuma tabela de documento, espaço/canal, membro, permissão, convite, versão,
  comentário, embedding.** Só cinco tabelas de conta e `Organization`; `UserRole` é
  gravado no cadastro e nunca lido.
- **Nenhuma rota de negócio na API**: só `/health`, `/health/ready`, `/auth/register`.
- **Nenhum guard que leia a sessão em rota do Nest**; sem decorator de usuário
  corrente, sem papel, sem resolução de acesso no servidor.
- **Nenhum filtro global de exceção nem erro de domínio.**
- **`POST /auth/register` fora do OpenAPI**; a web o chama com tipo à mão.
- **`packages/editor` vazio**; Plate ausente; a demo do hotsite é estática.
- **`/documentos`, `/canais`, `/pesquisa`, `/organizacao` são marcadores**: estado
  vazio com botão sem `onClick`; sublateral com estados vazios fixos.
- **Sem convite, hierarquia, admissão/desligamento, canal geral, busca, conversa com
  IA, chave de modelo por organização.**
- **Sem produção**; `main` no bootstrap.
- **Sem rate limiting** (`@nestjs/throttler` ausente); o `429` que `CriarContaForm`
  trata não tem quem o emita em `/auth/register`.
- **Sem Google nem SSO** (fatias 3 e 4).

O que existe mas está órfão ou meio feito:

- `HealthStatus` em `/organizacao` (sonda de dev em tela de produto).
- `AccessSpine`, `AccessBadge`, `Avatar`, `Card`, `Pagination`, `Select`, `Switch`,
  `Toast`, `Tooltip`, `Skeleton` usados só em `/design`; `Toast` sem fila.
- `account/` e `auth.factory.ts` sem nenhum teste.
- `changeEmail` sem `sendChangeEmailVerification`; `EmailForm` promete link ao
  endereço novo — a verificar.
- e2e de sessão só com dublê; nenhum caso entra de verdade.
- `shared/hooks/` vazio; `.gitkeep` sobrando em `shared/components/`.
- READMEs de `apps/api` e `apps/web` desatualizados (dizem que Prisma, Tailwind,
  roteador e autenticação "são item de roadmap"; citam Testcontainers).
- Hotsite mostra preços, enquanto o PRD põe cobrança em não-escopo; `content/` vazio.
- `tool-matrix.json` cita `packages/api-client/**` inexistente; `gates.json` não cobre
  `apps/site`.
- Vocabulário: código, tokens (`--lombada-canal`, `origin="canal"`) e rotas dizem
  "canal"; o modelo fechado em `docs/refactor` diz "espaço".

## 11. Convenções em vigor que os planos devem respeitar

Do `CLAUDE.md` do repositório (Código, Ferramentas, React, NestJS):

- **Código**: zero comentário exceto o porquê que o código não mostra (com marca
  `motivo:`, `decisão:`, `contorno:`, `invariante:`…); sem `TODO` (pendência vira
  roadmap); autorização é do servidor, no cliente é experiência; segredo nunca no
  repositório; sem dependência não declarada; código e commits em inglês, documentos e
  interface em pt-BR.
- **Ferramentas**: grafo antes de busca crua; saída estreitada na origem; `bash
  scripts/gates/gates_runner.sh` antes de dar por pronto — portão que não mediu
  reprova; erro repetido vira causa raiz.
- **React (`apps/web`)**: Vite SPA sem componente/ação de servidor; import só `shared
  → features → app`, feature acessa feature pelo barril; classificar estado
  (componente, aplicação = Zustand, servidor = TanStack Query, formulário = RHF + Zod,
  URL = search params); dado de servidor é query, nunca `useEffect` + cache manual;
  um cliente HTTP em `shared/api` com tipos do OpenAPI; variante é `cva`, sem valor
  mágico, cor nunca sinal único; teste por papel e texto acessível; violação
  crítica/séria reprova; suíte comportamental sobe a app uma vez contra o build;
  fonte auto-hospedada e CSP `style-src 'self'` sob `default-src 'self'`.
- **NestJS (`apps/api`)**: feature = `module/controller/service/repository` (+ `dto/`);
  controller só traduz HTTP e só o repositório injeta Prisma (G7); esquema muda por
  migration versionada; toda entrada tem DTO `class-validator` sob `ValidationPipe`
  `whitelist` + `forbidNonWhitelisted`; identidade vem do sujeito autenticado, nunca
  do corpo; erro de domínio no serviço e filtro global sem vazar mensagem; configuração
  validada no boot; log estruturado sem token/senha/corpo; unidade com repositório
  dublê, comportamental por Supertest; API muda no OpenAPI primeiro, `oasdiff` e
  clientes regenerados no mesmo PR.
- **O que os portões cobram**: G3, G4, G5, G7, G8; quarentena de sete dias com
  isenções vazias; ações do CI em SHA; lockfile sem alta/crítica; nada roda em rascunho
  e `ready_for_review` declarado; pnpm isolado por job; `concurrency` só nos gatilhos;
  service container sem porta fixa; marcador `atalho:` completo; Playwright numa
  subida só; ícone único; plano do item ativo válido; gitleaks limpo na árvore e nos
  três builds; contrato OpenAPI e cliente gerado sincronizados; `prisma migrate diff`
  sem drift; CSP e cabeçalhos medidos em `web` e `site`; merge só por
  `merge-se-liberado.sh`.
