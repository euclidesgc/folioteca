# SPEC 002 — installation

Parte de `docs/features/002-installation/prd.md` e de `docs/architecture.md` (§2 contrato primeiro, §6 autenticação, §7 testes). Código existente lido: `apps/api` (health, Prisma sem modelos, `create-app.ts`, `test/contract.ts`), `apps/web` (layout, `lib/api-client.ts` sem notificação, `features/connection`, mocks só de health) e `packages/api-contract`. Decisões tomadas com o dono ausente; nenhuma fica em aberto.

Compromissos herdados da SPEC 001 que esta fatia paga: notificações no interceptor com opção de silenciar o health (D10 da 001) e filtro global de erro `{ message }` na API (D5 da 001).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `AppGate` (rota-pai sem caminho) resolve `GET /installation` e `GET /auth/me` antes de qualquer tela. `routes/app/root.tsx`: instância não instalada → `<Navigate to={paths.install.getHref()} replace />`. |
| R2 | `InstallationForm` (feature `installation`) com cinco campos, pelos componentes de `components/ui/form/` e o schema `createInstallationInputSchema`. |
| R3 | API compara o código em tempo constante e responde `403 { message }` genérico **antes** de validar os outros campos (D6). A tela mostra um único alerta, igual para qualquer falha. |
| R4 | `password: z.string().min(12, …)` no schema da mutação, usado pelo `zodResolver`: o envio nem acontece. A API repete a regra (400). |
| R5 | `InstallationService.install` cria, numa transação, `Organization`, `OrgUnit` raiz, `Person` (`isAdmin: true`), `Space` PERSONAL da pessoa, `Space` UNIT da raiz e `Session` (D1, D4). |
| R6 | O `POST` responde 201 com `Set-Cookie` da sessão e o corpo de `/auth/me`; `useCreateInstallation` grava no cache o usuário e `installed: true`; a rota navega para `paths.home.getHref()` com `replace`. |
| R7 | `SidebarIdentity` (lê `useUser()`) no rodapé da barra lateral, acima do indicador de conexão, pelo slot `sidebarFooter` que já existe. |
| R8 | `routes/install.tsx`: instalada e sem sessão → aviso "Instância já instalada"; instalada e com sessão → vai para o início (D11). O formulário nunca é montado. |
| R9 | `409` quando já existe `Organization`; na corrida, a coluna `singleton` com `UNIQUE` derruba a segunda transação (`P2002` → 409). Teste de integração com duas requisições simultâneas contra o Postgres real (D2). |
| R10 | `routes/app/root.tsx`: instalada e sem usuário → `SessionRequired` ("Acesso por login em breve"), no lugar do layout. |
| R11 | Textos literais da seção Interface; `FieldWrapper` + `getFieldA11yProps` (label por `htmlFor`, `aria-invalid`, `aria-describedby`), foco no primeiro campo inválido, alerta em `role="alert"`; axe no e2e. |

## Decisões técnicas

### D1 — Modelo Prisma inicial: só o que a fatia usa, já no formato das próximas

- Escolha (migration `0002_installation`, gerada por `prisma migrate dev` e completada à mão com os `CHECK`):
  - `Organization`: `id` (uuid), `name`, `singleton Boolean @unique @default(true)`, `createdAt`. `CHECK (singleton)`.
  - `OrgUnit`: `id`, `organizationId` (FK), `parentId` (FK para si, nulo na raiz), `name`, `createdAt`; índice em `parentId`. A raiz leva o nome da organização.
  - `Person`: `id`, `organizationId` (FK), `name`, `email @unique`, `passwordHash`, `isAdmin @default(false)`, `createdAt`. O e-mail é gravado sempre com `trim().toLowerCase()`; `CHECK (email = lower(email))` garante no banco a unicidade sem diferenciar maiúsculas.
  - `Space`: `id`, `type SpaceType` (`PERSONAL | UNIT | FREE`), `personId @unique` (nulo salvo PERSONAL), `orgUnitId @unique` (nulo salvo UNIT), `createdAt`. `CHECK` de coerência entre `type` e as duas FKs.
  - `Session`: `id`, `tokenHash @unique`, `personId` (FK, `onDelete: Cascade`), `createdAt`, `expiresAt`; índice em `personId`.
- Alternativa descartada: `citext` para o e-mail — motivo: mais uma extensão para o que normalização + `CHECK` resolvem. Alternativa descartada: índice único parcial "uma raiz por organização" — motivo: o Prisma 6 não representa índice parcial e pode acusar divergência no `migrate dev`; só a instalação cria unidade sem pai, e a fatia 008 sempre exige `parentId`. Alternativa descartada: já criar lotação, nome de espaço livre, documento ou compartilhamento — motivo: nada disso é usado aqui; coluna nula e tabela nova entram depois sem retrabalho.

### D2 — "Só uma instalação" é garantido pelo banco

- Escolha: `Organization.singleton` com `UNIQUE` + `CHECK`. O serviço responde 409 cedo se já houver organização; na corrida, as duas passam dessa leitura e a segunda falha no `INSERT` com `P2002`, que vira `ConflictException` ("Esta instância já foi instalada."). A transação inteira da perdedora é desfeita.
- Alternativa descartada: `pg_advisory_xact_lock` — motivo: SQL cru para o que uma restrição declarativa garante mesmo se alguém escrever outro caminho de criação. Alternativa descartada: só conferir `count()` antes — motivo: é exatamente a corrida que o R9 proíbe.

### D3 — Senha com `@node-rs/argon2`

- Escolha: `@node-rs/argon2`, argon2id, `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1` (mínimo da OWASP), em `auth/password.service.ts`. Senha aceita de 12 a 128 caracteres (o teto limita o custo do hash).
- Alternativa descartada: pacote `argon2` — motivo: compila no `postinstall` e exigiria liberar mais um build em `onlyBuiltDependencies`; o `@node-rs` traz binário pronto.

### D4 — Sessão: token opaco, guardado como hash

- Escolha: token de 32 bytes aleatórios (base64url) no cookie `folioteca_session` (`httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` quando `NODE_ENV=production`, 30 dias); a tabela guarda só `sha256(token)`. `SessionService` (`create`, `findValid`), `SessionGuard` (401 "Sessão não encontrada.") e decorator `@CurrentPerson()`. Leitura do cookie com `cookie-parser`. Renovação e saída são da fatia 003.
- Alternativa descartada: guardar o token cru — motivo: vazamento do banco viraria sessão válida. Alternativa descartada: JWT — motivo: a arquitetura fixa sessão opaca com revogação por exclusão de linha.

### D5 — `INSTALL_CODE` opcional no ambiente; ausente bloqueia a instalação

- Escolha: `INSTALL_CODE: z.string().min(16).optional()` (vazio vira ausente) e `NODE_ENV` (default `development`) em `config/env.ts`. Sem código, todo `POST /installation` responde o mesmo 403 e o serviço registra um aviso no log. Comparação: `timingSafeEqual` sobre o `sha256` dos dois valores (tamanhos iguais, tempo constante). `.env.example` traz `INSTALL_CODE=` vazio com comentário.
- Alternativa descartada: variável obrigatória — motivo: derrubaria a API de uma instância já instalada por uma variável que ela não usa mais, e um valor de exemplo versionado dispara o GitGuardian.
- Nos testes o código é gerado em `test/global-setup.ts` com `randomBytes`; nenhum código nem senha literal entra no repositório (senhas de teste: `crypto.randomUUID()`; senha curta: `'x'.repeat(11)`).

### D6 — Ordem das checagens do `POST /installation`

- Escolha: cabeçalho `X-Requested-With` (403) → já instalada (409) → código (403) → validação dos campos (400) → hash → transação. O código é lido do corpo cru antes do schema completo; assim um código errado nunca devolve erro de campo (R3).
- Alternativa descartada: `ValidationPipe` no parâmetro do controller — motivo: responderia 400 com erros de campo a quem não tem o código.

### D7 — Validação com Zod e filtro global `{ message }`

- Escolha: `common/http-exception.filter.ts` global: `HttpException` → `{ message }` com a mensagem pt_BR de quem lançou; 404 → "Recurso não encontrado."; qualquer outra exceção → 500 "Erro interno do servidor." + log. Erro de validação: `400 { message: "Dados inválidos.", errors: [{ field, message }] }`, produzido por `common/parse-body.ts` (`parseBody(schema, body)`), com as mensagens do schema. O 503 do health passa a ser só `{ message }` (o teste de integração da 001 muda).
- Alternativa descartada: `class-validator` + `ValidationPipe` — motivo: duas dependências novas e mensagens padrão em inglês; o Zod já está na API.
- Alternativa descartada: pacote compartilhado com o schema para API e web — motivo: infraestrutura nova para cinco campos; as regras ficam iguais nos dois lados e o teste de contrato prende o formato.

### D8 — Defesa de CSRF como guard global

- Escolha: `common/csrf.guard.ts` (`APP_GUARD`): método diferente de `GET`/`HEAD`/`OPTIONS` sem `X-Requested-With` → 403 "Requisição recusada.". Na web, o interceptor de request envia `X-Requested-With: XMLHttpRequest` em toda requisição.
- Alternativa descartada: token CSRF — motivo: a arquitetura (§6) já fixou o cabeçalho.

### D9 — Contrato

- Escolha, em `openapi.yaml`: `GET /installation` → 200 `InstallationStatusResponse` (`{ data: { installed } }`); `POST /installation` (corpo `CreateInstallationBody`: `code`, `organizationName`, `name`, `email`, `password`) → 201 `CurrentUserResponse`, 400 `ValidationError`, 403 e 409 `Error`; `GET /auth/me` → 200 `CurrentUserResponse` (`{ data: { person: { id, name, email, isAdmin }, organization: { id, name } } }`), 401 `Error`. Envelope `{ data }` mantido (D5 da 001); `getUser` devolve `response.data`.
- Alternativa descartada: `/auth/me` sem envelope, como no modelo da skill — motivo: o projeto inteiro usa `{ data }`.

### D10 — Web: usuário como estado de servidor, sem login ainda

- Escolha: `lib/auth.tsx` só com `getUser` (401 → `null`), `getUserQueryOptions` (`['authenticated-user']`, `staleTime: Infinity`, `retry: false`), `useUser` e `AuthLoader`. `useLogin`, `useLogout` e `ProtectedRoute` entram na 003. O interceptor continua sem redirecionar em 401.
- Alternativa descartada: copiar o modelo inteiro — motivo: código sem uso reprova a cobertura por arquivo e a regra de não criar para o futuro.

### D11 — Rotas e redirecionamentos

- Escolha: `paths.install` (`/install`). Em `router.tsx`, uma rota-pai sem caminho com `AppGate` envolve `/install` (lazy, fora do layout) e a área `/`; `*` segue por último, fora do gate. `AppGate` = `useInstallation()` + `AuthLoader`: carregando, erro com "Tentar de novo", ou `<Outlet />`. Decisão por estado:

  | Instalada | Sessão | `/install` | `/` e filhas |
  |---|---|---|---|
  | não | — | formulário | vai para `/install` |
  | sim | não | aviso "Instância já instalada" | aviso "Acesso por login em breve" |
  | sim | sim | vai para `/` | app |

- Com sessão, `/install` redireciona em vez de avisar: depois do sucesso os dois caches mudam no mesmo instante, e o aviso piscaria antes da navegação. Quem já está dentro vê a própria organização na barra lateral.
- Alternativa descartada: recarregar a página após instalar — motivo: o banco simulado do MSW vive na memória da página e o e2e perderia a instalação.
- Se a mutação falhar, o hook invalida `getInstallationQueryOptions()`: num 409 a tela troca sozinha para o aviso, sem classe de erro nova.

### D12 — Notificações e interceptor

- Escolha: `components/ui/notifications/` (store Zustand + componente, montado em `provider.tsx`); erro em `role="alert"`, demais em `role="status"`, some em 6 s, botão "Fechar". O interceptor notifica como no modelo de `api-client` (mensagem do servidor só em 4xx). Opção por requisição `silentError?: boolean` (aumento de tipo do `AxiosRequestConfig` dentro de `api-client.ts`); `getHealth` passa `{ silentError: true }`. 401 continua sem notificação.
- Alternativa descartada: silenciar por URL (`/health`) no interceptor — motivo: o cliente passaria a conhecer endpoints de feature.

### D13 — Componentes compartilhados novos, só os usados

- Escolha: `utils/cn.ts`, `ui/button/button.tsx` (modelo de `ui-components`), `ui/form/form.tsx`, `field-wrapper.tsx` (com prop `description` para a dica da senha, ligada por `aria-describedby`) e `input.tsx`. Os dois botões existentes (`app-layout.tsx`, `main-error-fallback.tsx`) passam a usar `Button`. Dependências novas da web: `react-hook-form`, `@hookform/resolvers`, `zustand`, `clsx`, `tailwind-merge`, `class-variance-authority`.
- Alternativa descartada: criar também `select.tsx` e `textarea.tsx` — motivo: sem uso nesta fatia.

### D14 — API simulada: estado em memória e chave de desenvolvimento

- Escolha: `mocks/db.ts` escrito à mão (`{ installation: { organization, person } | null }`, `seedDb`, `resetDb`, `seedInstalled({ signedIn })`, que também grava o cookie em `document.cookie`). Padrão: **não instalada**. Handlers `installation.ts` e `auth.ts` leem o cookie `folioteca_session`. O mock aceita o código `MOCK_INSTALL_CODE` (exportado de `mocks/utils.ts`). Chave nova `mock-installation` = `installed` (instalada, sem sessão) ou `signed-in` (instalada, com sessão), lida em `enableMocking()`. O `open-app.spec.ts` da 001 passa a usar `signed-in` num `beforeEach`.
- Alternativa descartada: `@mswjs/data` — motivo: o estado é um registro único, sem lista. Alternativa descartada: projeto `setup` com `storageState` — motivo: o cookie sobrevive à recarga, o banco simulado não.

## Interface

Fonte: `docs/design.md`. Telas fora da moldura usam `<main id="main-content">` com a receita nova "Contêiner de página estreita", um `<h1>` e texto de apoio.

### Instalação (`/install`, não instalada)

De cima para baixo:

1. `h1`: "Instalar a Folioteca"
2. apoio: "Informe o código de instalação recebido na contratação e crie a organização e a sua conta de administrador."
3. formulário (`mt-6`, campos com `space-y-4`):

| Rótulo | Tipo / `autoComplete` | Mensagens de validação |
|---|---|---|
| "Código de instalação" | `text` / `off` | "Informe o código de instalação." |
| "Nome da organização" | `text` / `organization` | "Informe o nome da organização." · "O nome da organização pode ter no máximo 120 caracteres." |
| "Seu nome" | `text` / `name` | "Informe o seu nome." · "O nome pode ter no máximo 120 caracteres." |
| "E-mail" | `email` / `email` | "Informe o e-mail." · "Informe um e-mail válido." |
| "Senha" | `password` / `new-password`; dica abaixo do campo: "Mínimo de 12 caracteres." | "A senha precisa ter pelo menos 12 caracteres." · "A senha pode ter no máximo 128 caracteres." |

4. alerta de erro do servidor (acima do botão, `role="alert"`, fica até o próximo envio): "Instalação não concluída. Confira os dados informados e tente de novo."
5. botão principal `type="submit"`: "Instalar"; enviando: "Instalando…", desabilitado e `aria-busy`.

Sucesso: notificação "Instalação concluída" e ida para o início.

### Estados do gate (qualquer endereço)

| Estado | O que aparece |
|---|---|
| Carregando | `HydrateFallback` existente: "Carregando…" (`role="status"`) |
| Erro | receita "Erro": "Não foi possível abrir a Folioteca." + botão "Tentar de novo" (refaz as duas consultas) |
| Vazio | não se aplica |

### Avisos (página inteira, fora da moldura)

| Onde | `h1` | Apoio | Ação |
|---|---|---|---|
| `/install`, instalada e sem sessão | "Instância já instalada" | "Esta instância da Folioteca já foi instalada. A instalação só acontece uma vez." | link "Ir para o início" |
| `/` e filhas, instalada e sem sessão | "Acesso por login em breve" | "Esta instância já está instalada. A tela de login chega em breve; por enquanto, só quem fez a instalação neste navegador continua com acesso." | nenhuma |

### Barra lateral

No rodapé, acima do indicador: `<dl>` com `dt` só para leitor de tela ("Organização", "Pessoa"); nome da organização em `text-sm font-medium text-gray-900 truncate` e, abaixo, nome da pessoa em `text-sm text-gray-600 truncate`. Espaço `mt-3` até o indicador.

### Notificações

Pilha no canto superior direito; cada item com título, mensagem opcional e botão "Fechar". Erro do cliente HTTP: título "Algo deu errado"; mensagem do servidor em 4xx ou "Não foi possível concluir a operação. Tente novamente em instantes.".

### Mensagens da API (pt_BR)

403 código: "Não foi possível concluir a instalação. Confira os dados informados." · 409: "Esta instância já foi instalada." · 400: "Dados inválidos." (+ mensagens de campo iguais às da tela) · 401: "Sessão não encontrada." · 403 sem cabeçalho: "Requisição recusada." · 404: "Recurso não encontrado." · 500: "Erro interno do servidor."

### Receitas

Usadas: título de página, texto de apoio, botão principal, botão secundário, link de navegação, carregando, erro.

Alteradas: botão principal e secundário trocam `px-4 py-2` por `inline-flex h-10 items-center justify-center gap-2 px-4` (alvo de 40 px do piso; é a base do `Button`).

Novas, em "Padrões acrescentados pelas entregas" (fatia 002):

| Padrão | Classes |
|---|---|
| Contêiner de página estreita | `<main className="mx-auto max-w-md p-8">` |
| Campo de formulário | rótulo `block text-sm font-medium text-gray-900`; campo `mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 aria-[invalid=true]:border-red-500`; dica `mt-1 text-sm text-gray-600`; erro `mt-1 text-sm text-red-700` |
| Alerta dentro de formulário | `rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800` |
| Notificação | pilha `fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2`; item `rounded-md border bg-white p-4 shadow-lg` + borda por tipo (`border-red-200`, `border-green-200`, `border-amber-200`, `border-gray-200`) |
| Identidade na barra lateral | como descrito em "Barra lateral" |

## Arquivos

### Fase 1 — contrato e API

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | três operações e schemas (D9) | — |
| alterar (g) | `packages/api-contract/src/generated/openapi.d.ts` | regenerado | — |
| alterar | `apps/api/package.json` | `@node-rs/argon2`, `cookie-parser`, `@types/cookie-parser` | `security` |
| alterar | `apps/api/.env.example` | `INSTALL_CODE=` vazio + comentário | `security` |
| alterar | `apps/api/prisma/schema.prisma` | modelos e enum (D1) | — |
| criar | `apps/api/prisma/migrations/0002_installation/migration.sql` | gerada + `CHECK`s (D1, D2) | — |
| alterar | `apps/api/src/config/env.ts` | `INSTALL_CODE`, `NODE_ENV` (D5) | `security` |
| alterar | `apps/api/src/create-app.ts` | `cookie-parser` e filtro global em `configureApp` | — |
| alterar | `apps/api/src/app.module.ts` | `AuthModule`, `InstallationModule`, `APP_GUARD` do CSRF | — |
| criar | `apps/api/src/common/http-exception.filter.ts` | D7 | — |
| criar | `apps/api/src/common/parse-body.ts` | Zod → 400 com `errors` (D7) | — |
| criar | `apps/api/src/common/csrf.guard.ts` | D8 | `security` |
| criar | `apps/api/src/auth/auth.module.ts` | exporta `SessionService`, `PasswordService` | — |
| criar | `apps/api/src/auth/password.service.ts` | argon2id (D3) | `security` |
| criar | `apps/api/src/auth/session.service.ts` | `create`, `findValid`, hash do token (D4) | `security` |
| criar | `apps/api/src/auth/session-cookie.ts` | nome e opções do cookie | `security` |
| criar | `apps/api/src/auth/session.guard.ts`, `apps/api/src/auth/current-person.decorator.ts` | 401 sem sessão válida | — |
| criar | `apps/api/src/auth/auth.controller.ts` | `GET /auth/me` | — |
| criar | `apps/api/src/installation/installation.module.ts`, `installation.controller.ts` | `GET` e `POST /installation` (201 + cookie) | — |
| criar | `apps/api/src/installation/installation.service.ts` | ordem D6, transação D1/D2 | `security` |
| criar | `apps/api/src/installation/installation.schema.ts` | Zod com mensagens pt_BR | — |
| criar | `apps/api/src/installation/verify-install-code.ts` | tempo constante (D5) | `security` |
| alterar | `apps/api/test/global-setup.ts` | gera `INSTALL_CODE` | — |
| criar | `apps/api/test/reset-database.ts` | `TRUNCATE … CASCADE` entre testes | — |
| criar | `apps/api/src/installation/__tests__/installation.integration.test.ts` | sucesso (linhas criadas, hash argon2id, e-mail em minúsculas, cookie `HttpOnly; SameSite=Lax`), 403 código errado e código ausente, 403 antes de 400, 400 por campo, 409, **corrida** (`Promise.all` de dois `POST` → `[201, 409]`, uma linha de cada), 403 sem `X-Requested-With`, `GET` antes e depois | — |
| criar | `apps/api/src/installation/__tests__/installation.contract.test.ts` | 200, 201, 400, 403, 409 contra o contrato | — |
| criar | `apps/api/src/auth/__tests__/auth.integration.test.ts`, `auth.contract.test.ts` | `me` com cookie, 401 sem cookie, com token inválido e com sessão vencida | — |
| criar | `apps/api/src/installation/__tests__/verify-install-code.test.ts`, `apps/api/src/common/__tests__/http-exception.filter.test.ts`, `parse-body.test.ts`, `csrf.guard.test.ts` | unidades; filtro: 404, 500 sem vazar detalhe | `unit-testing` |
| alterar | `apps/api/src/health/__tests__/health.integration.test.ts` | 503 passa a `{ message }` | — |
| alterar | `apps/api/src/config/__tests__/env.test.ts` | variáveis novas | `unit-testing` |

### Fase 2 — web

Caminhos relativos a `apps/web/`.

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `package.json` | dependências de D13 | `security` |
| alterar | `../../eslint.config.js` | zona `no-restricted-paths` da feature `installation` | `project-structure` |
| alterar | `src/config/paths.ts` | `install` | `routing` |
| alterar | `src/types/api.ts` | `InstallationStatusResponse`, `CurrentUser`, `CurrentUserResponse`, `CreateInstallationBody` | `api-requests` |
| criar | `src/utils/cn.ts` | `clsx` + `tailwind-merge` | `ui-components` |
| criar | `src/components/ui/button/button.tsx` | `cva`, `isLoading` | `ui-components`, `interface-design` |
| criar | `src/components/ui/form/form.tsx`, `field-wrapper.tsx`, `input.tsx` | modelos de `forms` + `description` | `forms`, `ui-components` |
| criar | `src/components/ui/notifications/notifications-store.ts`, `notifications.tsx` | D12 | `client-state`, `ui-components`, `error-handling` |
| alterar | `src/lib/api-client.ts` | notificação, `silentError`, `X-Requested-With` (D8, D12) | `api-client`, `error-handling`, `security` |
| criar | `src/lib/auth.tsx` | D10 | `authentication` |
| alterar | `src/app/provider.tsx` | monta `<Notifications />` | `error-handling` |
| alterar | `src/features/connection/api/get-health.ts` | `{ silentError: true }` | `api-requests` |
| criar | `src/features/installation/api/get-installation.ts` | fetcher + query options (`['installation']`) + hook | `api-requests` |
| criar | `src/features/installation/api/create-installation.ts` | schema, fetcher, hook (grava os dois caches; invalida no erro) | `api-requests`, `authentication` |
| criar | `src/features/installation/components/installation-form.tsx` | formulário (Interface) | `forms`, `interface-design`, `component-robustness` |
| criar | `src/app/routes/app-gate.tsx` | D11 | `routing`, `authentication`, `error-handling` |
| criar | `src/app/routes/install.tsx` | formulário, aviso ou redirecionamento | `routing`, `interface-design` |
| criar | `src/app/routes/app/session-required.tsx` | aviso do R10 | `interface-design` |
| alterar | `src/app/routes/app/root.tsx` | decisão por estado; `SidebarIdentity` no slot | `routing`, `authentication` |
| alterar | `src/app/router.tsx` | gate, `/install` lazy | `routing` |
| criar | `src/components/layouts/sidebar-identity.tsx` | R7 | `interface-design`, `component-robustness` |
| alterar | `src/components/layouts/app-layout.tsx`, `src/components/errors/main-error-fallback.tsx` | usam `Button` | `ui-components` |
| criar | `src/testing/mocks/db.ts`, `handlers/installation.ts`, `handlers/auth.ts` | D14 | `api-mocking` |
| alterar | `src/testing/mocks/handlers/index.ts`, `utils.ts`, `index.ts`, `src/testing/setup-tests.ts` | registro, `MOCK_INSTALL_CODE`, chave `mock-installation`, `seedDb`/`resetDb` e limpeza do cookie e do store de notificações | `api-mocking` |
| criar | `__tests__` de `button`, `form` (com `input` e `field-wrapper`), `notifications` (store e componente), `cn`, `auth`, `sidebar-identity`, `get-installation`, `create-installation` | cada arquivo novo ≥ 80% | `component-testing`, `unit-testing` |
| criar | `src/features/installation/components/__tests__/installation-form.test.tsx` | envio válido; vazio mostra mensagens e foca o primeiro inválido; senha de 11 não envia; botão desabilitado enviando; alerta em 403 | `component-testing`, `api-mocking` |
| criar | `src/app/routes/__tests__/install.test.tsx`, `app-gate.test.tsx`, `src/app/routes/app/__tests__/session-required.test.tsx` | os seis estados da tabela de D11, erro do gate com nova tentativa, 409 troca para o aviso | `integration-testing` |
| alterar | `src/lib/__tests__/api-client.test.ts`, `src/app/__tests__/router.test.tsx`, `index.test.tsx`, `provider.test.tsx`, `src/app/routes/app/__tests__/root.test.tsx`, `src/components/layouts/__tests__/app-layout.test.tsx`, `src/features/connection/components/__tests__/connection-indicator.test.tsx` | notificação em 4xx/5xx, silêncio no health e no 401, cabeçalho; app inteiro com `seedInstalled({ signedIn: true })` | `component-testing`, `integration-testing` |

### Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/tests/install.spec.ts` | abrir `/` cai em `/install`; axe; envio vazio; código errado mostra o alerta; instalação válida cai no início com organização e pessoa na barra lateral; com `mock-installation=installed`: `/install` avisa e `/` mostra "Acesso por login em breve"; axe em cada parada; senha gerada em tempo de execução | `e2e-testing` |
| alterar | `apps/web/e2e/tests/open-app.spec.ts` | `beforeEach` com `mock-installation=signed-in` (D14) | `e2e-testing` |
| alterar | `docs/design.md` | receitas (Interface) | `interface-design` |
| alterar | `docs/architecture.md` | §2: formato de erro e 400; §6: cookie, hash do token, 30 dias, `INSTALL_CODE` opcional, ordem das checagens | — |
| alterar | `README.md` | `INSTALL_CODE` e chave `mock-installation` | — |

Lições da 001 aplicadas: todo componente devolve `React.JSX.Element`; nenhum arquivo de configuração novo (o aumento de tipo do axios fica em `api-client.ts`, já coberto por `tsconfig.app.json`); todo arquivo novo de `src/` tem teste próprio, porque a cobertura conta arquivo nunca importado; lint, tipos, testes e build sem aviso.

## Estimativa de tamanho

Jornadas: 1 (instalar a instância) · Telas novas: 1 principal (instalação; os dois avisos são estados de página sem dados) · Linhas alteradas (sem testes, mocks nem arquivos gerados): ~1.300 (API ~450, contrato ~130, web ~650, docs ~70) · Fases previstas: 3

Sinais de `vertical-slicing`: jornadas, fases e telas dentro do limite. **O sinal 4 (PR acima de ~400 linhas) dispara.** Foi aceito por ordem de quem encomendou a SPEC (dono ausente, sem re-fatiar), como na 001. Cerca de metade do volume é infraestrutura que a 001 empurrou para cá ou que nasce com o primeiro formulário (filtro de erro, CSRF, sessão, notificações, `Button`, `form/`). Corte possível, se o dono preferir: 002a = contrato, API e formulário até cair no início (R1–R6, R9); 002b = avisos de instância já instalada, identidade na barra lateral e extração do `Button` (R7, R8, R10). Compensação: três fases, cada uma terminando com os comandos do verificador verdes.

## Dívida encontrada

- Sem limite de tentativas no `POST /installation`: o código pode ser testado por força bruta (mitigado pelo mínimo de 16 caracteres). Item de roadmap: limite por IP.
- `apps/web/src/lib/api-client.ts` define `withCredentials` e `Accept` duas vezes (no `Axios.create` e no interceptor).
- `ErrorBoundary` de `apps/web/src/app/routes/app/root.tsx` chama `reportError` durante o render; a skill `error-handling` pede `useEffect`.
- Sessões vencidas ficam na tabela; falta rotina de limpeza (fatia 003 ou tarefa própria).
