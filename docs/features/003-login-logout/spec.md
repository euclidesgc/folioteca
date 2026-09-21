# SPEC 003 — login-logout

Decisões tomadas em 21/09/2026 com o dono ausente (ele autorizou decidir e
registrar). Parte de `docs/architecture.md` §2 (contrato primeiro), §6
(autenticação) e §7 (testes).

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `ProtectedRoute` (novo, em `apps/web/src/lib/auth.tsx`) envolve a moldura do app em `root.tsx`: instância instalada e `useUser().data === null` leva a `/login?redirectTo=<caminho+busca>`. A rota `/login` fica sob o `AppGate`, fora do `Root` (sem barra lateral), com `LoginForm` (E-mail, Senha). |
| R2 | API: `AuthService.login` responde sempre `401 { message: "E-mail ou senha incorretos." }` para e-mail inexistente e para senha errada, e nos dois casos faz uma verificação argon2 (D2). Web: `LoginForm` mostra o mesmo alerta para qualquer 401. |
| R3 | `loginSchema` (API) e `loginInputSchema` (web) aplicam `.trim().toLowerCase()` ao e-mail; a instalação já grava o e-mail em minúsculas e `Person.email` é `@unique`. |
| R4 | `paths.login.getHref(redirectTo)` leva o destino na busca; a rota `/login` calcula `getSafeRedirectPath(searchParams.get('redirectTo'), paths.home.getHref())` e, havendo usuário, renderiza `<Navigate to={destino} replace />` (D6). |
| R5 | `apps/web/src/utils/get-safe-redirect-path.ts`, função pura com teste próprio: só caminho interno (`/x`); recusa vazio, URL absoluta, `//host`, qualquer `\`, caractere de controle e destino que comece por `/login`. |
| R6 | A mesma guarda da rota `/login`: com usuário no cache e sem `redirectTo`, o destino é `paths.home.getHref()`; o formulário não chega a ser desenhado. |
| R7 | `SidebarIdentity` ganha o `Button` secundário "Sair" abaixo do nome da pessoa. |
| R8 | `POST /api/auth/logout` apaga a linha de `Session` pelo `sha256` do token (`SessionService.revoke`) e limpa o cookie; `useLogout` chama `queryClient.clear()` e o botão faz `hardRedirect(paths.login.getHref())` (D7). Teste de integração: o mesmo cookie, reenviado depois do logout, recebe 401 em `/api/auth/me`. |
| R9 | Interceptor de resposta de `api-client.ts`: 401 fora de `/auth/*` e fora da tela `/login` rejeita com `UnauthenticatedError`, sem notificação, e faz `hardRedirect(paths.login.getHref(caminho atual))`. 401 de `/auth/me` vira `null` em `getUser` e o `ProtectedRoute` redireciona. Ver limite conhecido em D8. |
| R10 | `session-required.tsx` e o teste dele são excluídos; `root.tsx` deixa de importá-lo; o caso do e2e `install.spec.ts` que esperava "Acesso por login em breve" passa a esperar a tela de entrar. |
| R11 | Textos literais na seção Interface; `LoginForm` usa `Form`/`Input`/`FieldWrapper` existentes (rótulo por `htmlFor`, `aria-invalid`, `aria-describedby`, foco no primeiro campo inválido) e alerta em `role="alert"`; e2e com axe na tela vazia, com erros de validação e com o alerta de credencial. |

## Decisões técnicas

### D1 — Contrato primeiro: duas operações novas em `/auth`

- Escolha: `packages/api-contract/openapi.yaml` ganha
  - `POST /auth/login` (`operationId: login`), corpo `LoginBody { email: string; password: string }` (ambos obrigatórios). Respostas: `200` `CurrentUserResponse` (o mesmo corpo de `/auth/me`) com `Set-Cookie`; `400` `ValidationError`; `401` `Error` ("E-mail ou senha incorretos."); `403` `Error` (sem `X-Requested-With`).
  - `POST /auth/logout` (`operationId: logout`), sem corpo. Respostas: `204` sem conteúdo; `403` `Error`.
  Os tipos são regenerados pelo script do pacote e `apps/web/src/types/api.ts` exporta `LoginBody`.
- Alternativa descartada: `201` no login, como na instalação — motivo: login não cria recurso endereçável para o cliente; `200` com o corpo de `/auth/me` é o que a skill `authentication` espera para o `setQueryData`.

### D2 — Tempo equivalente para e-mail inexistente: hash falso gerado na subida

- Escolha: `PasswordService.verify(hash, password)` (novo, com `verify` de `@node-rs/argon2`; hash malformado devolve `false`, não lança) e `PasswordService.getDummyHash()`, que gera **uma vez**, de forma preguiçosa e memoizada, o hash argon2id de 32 bytes aleatórios com os mesmos `HASH_OPTIONS`. `AuthService.login` sempre chama `verify(person?.passwordHash ?? dummy, password)` e só depois decide o 401.
- Alternativa descartada: literal `$argon2id$…` fixo no código — motivo: tem cara de credencial e reprova no GitGuardian (lição da 002), e sai de sincronia se `HASH_OPTIONS` mudar.
- Como se prova: teste de integração espia `PasswordService.verify` e exige **uma** chamada no login com e-mail inexistente. Nenhum teste compara relógio (intermitente por natureza).

### D3 — Ordem do login e regra do corpo

- Escolha: guard global de CSRF → `parseBody(loginSchema)` (400) → busca da pessoa por e-mail com a organização → `verify` (D2) → 401 genérico → revoga a sessão do cookie que veio na requisição, se houver → `SessionService.create` → `Set-Cookie` com `getSessionCookieOptions`. `loginSchema`: e-mail `trim().toLowerCase().min(1, "Informe o e-mail.")` + `z.email("Informe um e-mail válido.")`; senha `min(1, "Informe a senha.").max(128, "A senha pode ter no máximo 128 caracteres.")`.
- Alternativa descartada: exigir os 12 caracteres mínimos da instalação também no login — motivo: o login não ensina a política de senha a quem tenta adivinhar, e uma futura mudança de política não pode trancar conta antiga. O `max(128)` fica para não entregar texto gigante ao argon2.
- Alternativa descartada: deixar a sessão anterior viva ao entrar de novo — motivo: acumula linha órfã em `Session` que ninguém mais consegue revogar pelo navegador.

### D4 — Logout sem `SessionGuard`, idempotente

- Escolha: `POST /auth/logout` não exige sessão: lê o cookie, chama `SessionService.revoke(token)` (`deleteMany` pelo `tokenHash`, não falha se não existir) e sempre responde `204` com `clearCookie`. `session-cookie.ts` passa a expor `getSessionCookieBaseOptions()` (httpOnly, sameSite, path, secure), reutilizada por `getSessionCookieOptions(expiresAt)` e pelo `clearCookie` — o navegador só apaga o cookie se os atributos baterem.
- Alternativa descartada: `@UseGuards(SessionGuard)` e 401 sem sessão — motivo: sair duas vezes (duas abas) viraria erro na tela e o interceptor de 401 entraria no caminho; o pedido é idempotência.

### D5 — `AuthService` novo; o controller só traduz HTTP

- Escolha: `apps/api/src/auth/auth.service.ts` com `login(body, currentToken?)` e `logout(token?)`; `AuthController` ganha os dois `@Post` e cuida só de cookie e status. `SessionService` ganha `revoke`.
- Alternativa descartada: regra dentro do controller — motivo: a instalação já separa serviço e controller; o teste do hash falso precisa de um ponto único.

### D6 — Rota `/login`, navegação pós-login declarativa

- Escolha: `paths.login = { path: '/login', getHref: (redirectTo?) => redirectTo ? '/login?redirectTo=' + encodeURIComponent(redirectTo) : '/login' }`. A rota `apps/web/src/app/routes/login.tsx` (carregada com `lazy`, filha do `AppGate`, irmã de `/install`) decide nesta ordem: instância não instalada → `<Navigate>` para `/install`; usuário presente → `<Navigate to={destino seguro} replace />`; senão desenha o `LoginForm`. `useLogin` grava o usuário com `setQueryData`; a própria guarda da rota, ao re-renderizar, leva ao destino. `LoginForm` **não** recebe `onSuccess`.
- Alternativa descartada: `navigate(redirectTo)` no `onSuccess` do formulário, como no exemplo da skill `authentication` — motivo: o `setQueryData` já faz a rota re-renderizar com usuário; duas navegações concorrentes (guarda do R6 para o início e `onSuccess` para o destino) dão resultado dependente de ordem. Um mecanismo só atende R4 e R6.
- Alternativa descartada: `/auth/login`, como no modelo da skill — motivo: o app não tem prefixo `/app` nem área `/auth`; `/install` já é de primeiro nível.

### D7 — Fim de sessão é sempre carga completa da página

- Escolha: `apps/web/src/lib/hard-redirect.ts` exporta `hardRedirect(href)` (`window.location.assign`). É usado pelo interceptor de 401 e pelo "Sair". `useLogout` segue a skill (`queryClient.clear()` no sucesso); o `SidebarIdentity` passa `onSuccess: () => hardRedirect(paths.login.getHref())`.
- Alternativa descartada: `navigate()` do roteador no logout — motivo: depois do `clear()`, o `AppGate` refaz `/auth/me`, o `ProtectedRoute` redireciona com `redirectTo` e o `navigate` do botão redireciona sem; a URL final depende da ordem. A carga completa também zera qualquer estado em memória que venha a existir (Zustand).
- Alternativa descartada: `window.location.href = …` direto em cada lugar — motivo: o jsdom não navega; um módulo único é substituível com `vi.mock` nos testes.

### D8 — Onde o 401 é tratado e o limite conhecido do R9

- Escolha: só no interceptor, com as duas condições da skill `authentication` (`!url.includes('/auth/')` e `!pathname.startsWith(paths.login.path)`). `ProtectedRoute` cobre o 401 de `/auth/me`. O comentário "401 never redirects here" sai do arquivo.
- Limite conhecido: hoje o app só chama `/health` (pública), `/installation` (pública) e `/auth/*`. Com a sessão revogada em outra aba, a navegação entre as áreas vazias não faz chamada protegida; a pessoa é levada à tela de entrar na próxima carga da página ou na primeira chamada protegida, que nasce na fatia 004. O mecanismo é provado por teste do interceptor com um endpoint fictício via `server.use`.
- Alternativa descartada: `refetchOnWindowFocus: 'always'` na query do usuário — motivo: uma falha de rede nesse refetch põe a query em erro e o `AppGate` trocaria o app inteiro pela tela "Não foi possível abrir a Folioteca".

### D9 — `ProtectedRoute` dentro do `Root`, depois da checagem de instalação

- Escolha: `root.tsx` mantém "não instalada → `/install`" e troca o `SessionRequired` por `<ProtectedRoute>` em volta do `AppLayout`. `ProtectedRoute` fica em `lib/auth.tsx` e usa `location.pathname + location.search`.
- Alternativa descartada: envolver o `Root` no `router.tsx` — motivo: instância não instalada cairia em `/login` antes de `/install`; e `lib/` não pode importar `features/installation` para decidir isso.

### D10 — Formulário: erro do servidor só no alerta do formulário

- Escolha: `login` usa `silentError: true` (mesmo padrão de `create-installation.ts`). Alerta: 401 (`isUnauthenticatedError`) → "E-mail ou senha incorretos."; qualquer outro erro → "Não foi possível entrar. Tente de novo em instantes.". Campo de senha `autoComplete="current-password"`, e-mail `autoComplete="username"`. Sem notificação de sucesso: a navegação é o retorno. Logout **não** é silencioso: se falhar, a notificação global avisa e a pessoa continua no app.
- Alternativa descartada: alerta + notificação global no login — motivo: a mesma frase duas vezes na mesma tela estreita.

### D11 — API simulada: senha do seed montada em tempo de execução

- Escolha: `DbState.installation` ganha `password`; o handler de instalação guarda a senha enviada; `seedInstalled` usa `MOCK_PASSWORD`, montada em `utils.ts` como o `MOCK_INSTALL_CODE` (`['mock', 'password', '0'.repeat(12)].join('-')`), espelhada em `apps/web/e2e/mock-credentials.ts` (o e2e está em outro projeto TypeScript, como `mock-install-code.ts`). Login simulado: compara e-mail em minúsculas e senha, grava `document.cookie`; logout: expira o cookie em `document.cookie` e responde 204. Nada de `Set-Cookie` do MSW (vaza entre testes, já documentado no handler de instalação).
- Alternativa descartada: aceitar qualquer senha no mock — motivo: a jornada "credencial errada" não seria reproduzível no navegador nem no e2e.
- Consequência para o e2e: a jornada entrar→sair usa a chave `mock-installation=installed` (a chave `signed-in` recria o cookie a cada carga e desfaria o logout).

### D12 — Lições das fatias anteriores, como regra desta SPEC

- `React.JSX.Element` em todo componente; todo botão é o `Button` de `components/ui/button`.
- Arquivo novo de configuração ou de e2e precisa estar coberto pelo `tsc -b` da raiz (o `e2e/mock-credentials.ts` entra no `tsconfig.e2e.json` existente, que já inclui `e2e/`).
- Cobertura ≥ 80% **por arquivo** novo ou alterado; nenhum aviso no lint, nos tipos nem no console dos testes.
- Nenhum literal com cara de senha, token ou hash em arquivo versionado: senha de teste vem de `randomUUID()`; a do mock é montada por `join`.
- Testes e agentes não recriam nem inspecionam o esquema do banco de teste com `prisma migrate diff` ou `prisma migrate reset`; o esquema vem do `global-setup` (`migrate deploy`) e a limpeza é `resetDatabase(prisma)`. Esta fatia não tem migration: `Session` e `Person` já existem.

## Interface

Receitas de `docs/design.md`: contêiner de página estreita, título de página, texto de apoio, campo de formulário, alerta dentro de formulário, botão principal, botão secundário, identidade na barra lateral.

### Tela "Entrar" (`/login`, sem barra lateral)

De cima para baixo, em `<main id="main-content" className="mx-auto max-w-md p-8">`:

1. `<h1>` **Entrar**
2. Texto de apoio: **Informe o e-mail e a senha da sua conta na Folioteca.**
3. Formulário (`mt-6`): campo **E-mail** (`type="email"`), campo **Senha** (`type="password"`), alerta (só com erro do servidor), botão principal de largura total **Entrar**.

Estados:

- Carregando a sessão: o `HydrateFallback` do `AppGate`, já existente (nada novo).
- Falha ao verificar a sessão: o `GateError` do `AppGate`, já existente.
- Validação local: **Informe o e-mail.** · **Informe um e-mail válido.** · **Informe a senha.** · **A senha pode ter no máximo 128 caracteres.** — sob o campo; o foco vai ao primeiro inválido.
- Enviando: botão desabilitado com **Entrando…**.
- Credencial recusada (401): alerta `role="alert"` acima do botão: **E-mail ou senha incorretos.** Os campos não são limpos.
- Outra falha (400 inesperado, 5xx, rede): alerta: **Não foi possível entrar. Tente de novo em instantes.**
- Já com sessão: nada é desenhado; redireciona.

Tela sem estado "vazio" (não lista dados).

### Barra lateral — identidade

Abaixo do nome da pessoa, `Button` `variant="secondary"` de largura total com `mt-3`: **Sair**; enviando: desabilitado com **Saindo…**. Falha do logout: notificação global existente ("Algo deu errado" + mensagem do cliente HTTP).

Receita alterada em `docs/design.md`: "Identidade na barra lateral" passa a registrar o botão secundário "Sair" (`mt-3 w-full`) entre o `<dl>` e o indicador de conexão. Nenhuma receita nova.

## Arquivos

### Fase 1 — contrato e API

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `packages/api-contract/openapi.yaml` | `POST /auth/login`, `POST /auth/logout`, schema `LoginBody` (D1) | — |
| alterar | `packages/api-contract/src/` (arquivo de tipos gerado) | regenerado pelo script do pacote; nunca editado à mão | — |
| criar | `apps/api/src/auth/login.schema.ts` | `loginSchema` Zod com mensagens em pt_BR (D3) | `security` |
| criar | `apps/api/src/auth/auth.service.ts` | `login` e `logout` (D2, D3, D4, D5) | `authentication`, `security` |
| alterar | `apps/api/src/auth/password.service.ts` | `verify` e `getDummyHash` memoizado (D2) | `security` |
| alterar | `apps/api/src/auth/session.service.ts` | `revoke(token)` com `deleteMany` | `authentication` |
| alterar | `apps/api/src/auth/session-cookie.ts` | `getSessionCookieBaseOptions()`; `getSessionCookieOptions` passa a usá-la (D4) | `security` |
| alterar | `apps/api/src/auth/auth.controller.ts` | `@Post('login')` com `@HttpCode(200)` e cookie; `@Post('logout')` com `@HttpCode(204)` e `clearCookie` | `authentication` |
| alterar | `apps/api/src/auth/auth.module.ts` | registra `AuthService` | — |
| criar | `apps/api/src/auth/__tests__/login-logout.integration.test.ts` | Postgres real: login certo (200, corpo igual ao de `/auth/me`, cookie `HttpOnly`/`SameSite=Lax`, o cookie abre `/auth/me`); senha errada e e-mail inexistente → mesmo 401 e mesmo corpo; e-mail em caixa diferente entra; e-mail inexistente chama `verify` uma vez; 400 com `errors` por campo; 403 sem `X-Requested-With`; resposta nunca contém `passwordHash`; login com cookie antigo revoga a sessão antiga; logout → 204, linha de `Session` apagada, cookie limpo, o mesmo cookie recebe 401 em `/auth/me`; logout sem cookie e logout repetido → 204 | `integration-testing` |
| alterar | `apps/api/src/auth/__tests__/auth.contract.test.ts` | valida contra o contrato: login 200, 400, 401 e logout 204 | `integration-testing` |
| criar | `apps/api/src/auth/__tests__/password.service.test.ts` | `verify` verdadeiro, falso e com hash malformado; `getDummyHash` devolve sempre o mesmo valor e é argon2id | `unit-testing` |
| criar | `apps/api/src/auth/__tests__/login.schema.test.ts` | caixa do e-mail, espaços, mensagens em pt_BR | `unit-testing` |

### Fase 2 — web

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| alterar | `apps/web/src/types/api.ts` | exporta `LoginBody` | `api-requests` |
| alterar | `apps/web/src/config/paths.ts` | `paths.login` com `getHref(redirectTo?)` (D6) | `routing` |
| criar | `apps/web/src/utils/get-safe-redirect-path.ts` | função pura do R5 | `security` |
| criar | `apps/web/src/utils/__tests__/get-safe-redirect-path.test.ts` | `null`, vazio, `/favorites?x=1`, `https://…`, `//host`, `/\host`, `javascript:`, caractere de controle, `/login…` | `unit-testing`, `security` |
| criar | `apps/web/src/lib/hard-redirect.ts` | `hardRedirect(href)` (D7) | `api-client` |
| criar | `apps/web/src/lib/__tests__/hard-redirect.test.ts` | chama `window.location.assign` com o destino | `unit-testing` |
| alterar | `apps/web/src/lib/auth.tsx` | `loginInputSchema`, `login`/`useLogin` (`setQueryData`), `logout`/`useLogout` (`queryClient.clear()`), `ProtectedRoute` (D9) | `authentication`, `routing` |
| alterar | `apps/web/src/lib/__tests__/auth.test.tsx` | `useLogin` grava o usuário sem segundo `GET /auth/me`; `useLogout` esvazia o cache; `ProtectedRoute` sem usuário vai a `/login?redirectTo=…` com caminho e busca, com usuário desenha os filhos | `unit-testing`, `authentication` |
| alterar | `apps/web/src/lib/api-client.ts` | 401 fora de `/auth/*` e fora de `/login` → `hardRedirect` para o login com o caminho atual; continua rejeitando com `UnauthenticatedError` e sem notificar (D8) | `api-client`, `authentication` |
| alterar | `apps/web/src/lib/__tests__/api-client.test.ts` | 401 de endpoint fictício redireciona com `redirectTo`; 401 de `/auth/me` e 401 estando em `/login` não redirecionam; nenhum caso notifica | `unit-testing`, `api-mocking` |
| criar | `apps/web/src/features/auth/components/login-form.tsx` | formulário (D10) | `forms`, `interface-design`, `authentication` |
| criar | `apps/web/src/features/auth/components/__tests__/login-form.test.tsx` | envio válido chama a API com o e-mail em minúsculas; vazio mostra as mensagens e foca o e-mail; botão desabilitado com "Entrando…"; 401 → alerta genérico; 500 → alerta de falha; nenhuma notificação global | `component-testing`, `forms` |
| alterar | `eslint.config.js` | zona `import/no-restricted-paths` para `apps/web/src/features/auth` | `project-structure` |
| criar | `apps/web/src/app/routes/login.tsx` | exporta `Component` (padrão do projeto, como `install.tsx`); guarda de D6 + título + `LoginForm` | `routing`, `interface-design`, `security` |
| criar | `apps/web/src/app/routes/__tests__/login.test.tsx` | entra e chega ao `redirectTo` interno; `redirectTo` externo cai no início; com sessão não mostra o formulário; instância não instalada vai a `/install` | `integration-testing` |
| alterar | `apps/web/src/app/router.tsx` | registra `paths.login.path` com `lazy`, filha do `AppGate`, fora do `Root` | `routing` |
| alterar | `apps/web/src/app/__tests__/router.test.tsx` | `/favorites` sem sessão termina em `/login?redirectTo=%2Ffavorites` | `integration-testing` |
| alterar | `apps/web/src/app/routes/app/root.tsx` | `ProtectedRoute` no lugar de `SessionRequired` (D9) | `routing`, `authentication` |
| alterar | `apps/web/src/app/routes/app/__tests__/root.test.tsx` | o caso "sem sessão" passa a esperar o redirecionamento | `integration-testing` |
| excluir | `apps/web/src/app/routes/app/session-required.tsx` | R10 | — |
| excluir | `apps/web/src/app/routes/app/__tests__/session-required.test.tsx` | R10 | — |
| alterar | `apps/web/src/components/layouts/sidebar-identity.tsx` | `Button` "Sair"/"Saindo…" com `useLogout` e `hardRedirect` (D7) | `interface-design`, `authentication`, `component-robustness` |
| alterar | `apps/web/src/components/layouts/__tests__/sidebar-identity.test.tsx` | "Sair" chama `POST /auth/logout`, esvazia o cache e redireciona a `/login`; desabilita enquanto envia; falha não redireciona | `component-testing` |
| alterar | `apps/web/src/testing/mocks/db.ts` | `password` na instalação simulada; `seedInstalled` usa `MOCK_PASSWORD` (D11) | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/utils.ts` | `MOCK_PASSWORD` montada por `join`; comentário das chaves de desenvolvimento | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/installation.ts` | guarda a senha enviada no banco simulado | `api-mocking` |
| alterar | `apps/web/src/testing/mocks/handlers/auth.ts` | `POST /auth/login` (400, 401, 200 + cookie) e `POST /auth/logout` (204, expira o cookie), tipados por `@/types/api` | `api-mocking` |

### Fase 3 — e2e e documentação

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/e2e/mock-credentials.ts` | espelho de `MOCK_PASSWORD` e do e-mail do seed (D11) | `e2e-testing` |
| criar | `apps/web/e2e/tests/login-logout.spec.ts` | começa sem sessão (`mock-installation=installed`): abrir `/favorites` → `/login?redirectTo=%2Ffavorites` + axe; envio vazio → mensagens, foco no e-mail + axe; senha errada → alerta + axe; credencial certa com e-mail em maiúsculas → `/favorites` com a identidade na barra; "Sair" → `/login`; abrir `/` de novo → continua em `/login`. Casos curtos: `redirectTo=https://…` termina em `/`; com `signed-in`, abrir `/login` termina em `/` | `e2e-testing` |
| alterar | `apps/web/e2e/tests/install.spec.ts` | o caso "shows the login notice on /" passa a esperar `/login` e o `<h1>` "Entrar"; os demais casos ficam como estão | `e2e-testing` |
| alterar | `docs/architecture.md` | §6: login, logout, hash falso, ordem das checagens, fim de sessão por carga completa | — |
| alterar | `docs/design.md` | receita "Identidade na barra lateral" com o botão "Sair" | `interface-design` |

`apps/web/e2e/tests/open-app.spec.ts` não muda e precisa continuar passando: o botão "Sair" entra na ordem de tabulação **depois** dos quatro links da navegação, que é até onde aquele teste tabula.

## Estimativa de tamanho

Jornadas: 1 (entrar e sair da mesma sessão) · Telas novas: 1 (`/login`) · Linhas alteradas (sem testes): ~380 (contrato ~70, API ~110, web ~170, docs ~30) · Fases previstas: 3

Sinais de "grande demais": nenhum disparou; a estimativa de linhas está perto do teto de ~400 e o PLAN não deve acrescentar escopo.

## Dívida encontrada

- `POST /auth/login` sem limite de tentativas (já previsto no PRD como fora de escopo): precisa de item próprio no roadmap, ao lado do 037 (`installation-rate-limit`).
- Sessão revogada em outra aba só é percebida na próxima carga ou na primeira chamada protegida (D8): revisar quando a 004 criar o primeiro endpoint protegido; se ainda houver tela sem chamada, considerar revalidar `/auth/me` ao voltar o foco, com o `AppGate` tolerando erro de refetch quando já há dado.
- `AppGate`/`AuthLoader` trocam o app inteiro pela tela de erro em qualquer `isError` da query do usuário, mesmo com dado em cache: hoje é inofensivo (a query nunca refaz), mas bloqueia a melhoria acima.
- `apps/web/e2e/mock-install-code.ts` e agora `mock-credentials.ts` duplicam constantes de `src/testing/mocks/utils.ts` por causa da separação de projetos TypeScript: um módulo sem `import.meta.env`, incluído nos dois `tsconfig`, removeria a duplicação.
- O modelo da skill `routing` pede `export default` nos arquivos de rota; o projeto usa `export function Component` com `lazy` direto (`install.tsx`, áreas). Esta fatia segue o padrão do projeto; alinhar é tarefa isolada.
