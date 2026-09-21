# SPEC 001 — workspace-foundation

Parte de `docs/features/001-workspace-foundation/prd.md` e de `docs/architecture.md`. O repositório não tem código: só `AGENTS.md`, `CLAUDE.md`, `.gitignore` e `docs/`. Tudo abaixo é criação, salvo onde diz "alterar". Decisões tomadas com o dono ausente; nenhuma fica em aberto.

Ambiente: Node 24, pnpm 11, TypeScript 5.9 strict. Portas: web 5173, API 3000, Postgres 5433, web do e2e 5174.

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `AppLayout` (`components/layouts/app-layout.tsx`) com barra lateral única: nome "Folioteca" (link para o início) e `<nav aria-label="Navegação principal">` com quatro `NavLink` montados de `paths`: Favoritos, Meus documentos, Espaços, Lixeira. Rota-pai `routes/app/root.tsx` envolve todas as páginas. |
| R2 | Quatro rotas (`favorites`, `my-documents`, `spaces`, `trash`), cada uma com `ContentLayout` (título + texto de apoio) e o parágrafo da receita "Vazio" com o texto literal da seção Interface. |
| R3 | `routes/app/home.tsx` em `/`: boas-vindas e a lista das quatro áreas com o que cada uma guarda. |
| R4 | Feature `connection`: `ConnectionIndicator` lê `GET /api/health` por `useHealth` e mostra "Conectando…", "Conectado" ou "Sem conexão". Entra no rodapé da barra lateral por um slot do `AppLayout`, preenchido pela rota-pai (D8). |
| R5 | `useHealth` refaz a consulta sozinho: a cada 10 s enquanto conectado e a cada 3 s enquanto em erro, além de ao voltar o foco e ao voltar a rede (D7). O indicador deriva do estado da query, sem estado copiado. |
| R6 | `routes/not-found.tsx` registrada em `path: '*'`, última do array, com link "Voltar para o início" por `paths.home.getHref()`. |
| R7 | Abaixo de `md` (768 px, ponto de quebra padrão do Tailwind) a barra lateral vira painel recolhível sob uma barra de topo com o botão "Abrir menu"/"Fechar menu" (D9). A partir de `md` fica sempre visível. |
| R8 | Só elementos nativos (`<button type="button">`, `NavLink`), ordem de foco igual à visual, link "Pular para o conteúdo" como primeiro foco, `aria-expanded` + `aria-controls` no botão do menu, `Esc` recolhe o painel e devolve o foco ao botão, `focus-visible` em tudo. Coberto por teste de componente (teclado com `userEvent`) e pelo e2e. |
| R9 | `e2e/tests/open-app.spec.ts` roda axe (`@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) no início, numa área vazia, na 404 e em 360 px com o menu aberto; qualquer violação `critical` ou `serious` reprova. `eslint-plugin-jsx-a11y` no lint. |
| R10 | Textos literais da seção Interface, `<html lang="pt-BR">`, `<title>Folioteca</title>`; o e2e localiza tudo pelos textos em pt_BR. |

## Decisões técnicas

### D1 — Raiz do monorepo cobre os quatro comandos do verificador

- Escolha: `eslint.config.js` único na raiz (flat config, `typescript-eslint` com tipos, `react-hooks`, `jsx-a11y` e `import` com `no-restricted-paths` só para `apps/web/src`, `check-file` para kebab-case); `tsconfig.base.json` strict + `tsconfig.json` na raiz só com `references` (`packages/api-contract`, `apps/api`, `apps/web/tsconfig.app.json`, `apps/web/tsconfig.node.json`, `tsconfig.node.json` da raiz); `vitest.config.ts` na raiz com `test.projects` (`apps/api`, `apps/web`) e cobertura `v8` (limite 80% de linhas; fora da conta: `main.ts`, `main.tsx`, `src/testing/**`, `**/generated/**`, `*.d.ts`). Scripts da raiz: `dev` (`pnpm --parallel --filter "./apps/*" dev`), `lint` (`eslint . --max-warnings 0`), `typecheck` (`tsc -b --noEmit`), `test` (`vitest run --coverage`), `test:e2e` (`pnpm --filter web test:e2e`), `build` (`pnpm -r build`). Cada projeto composto grava o `tsBuildInfoFile` em `node_modules/.tmp/`.
- Alternativa descartada: configuração de lint, tipos e teste por pacote, com a raiz só chamando `pnpm -r` — motivo: o verificador roda `npx eslint .`, `npx tsc -b` e `npx vitest run` direto na raiz; sem configuração lá esses comandos não enxergam nada.
- Ordem de montagem: a fase 1 registra só `api-contract` e `api` nas referências e nos projetos; a fase 2 acrescenta a web. Assim os quatro comandos passam ao fim de cada fase.

### D2 — NestJS compilado com SWC, no dev, no build e no Vitest

- Escolha: `@nestjs/cli` com `-b swc` (`nest start --watch`, `nest build`) e `unplugin-swc` no `vitest.config.ts` da API, com um `.swcrc` só (`legacyDecorator` + `decoratorMetadata`). Os tipos são conferidos pelo `tsc -b --noEmit` da raiz.
- Alternativa descartada: esbuild padrão do Vitest — motivo: não emite `design:paramtypes`, e a injeção de dependência do NestJS quebra nos testes.

### D3 — Prisma 6, esquema sem modelos, migration inicial só com pgvector

- Escolha: `prisma` e `@prisma/client` 6.x, gerador `prisma-client-js`. `schema.prisma` só com `datasource` e `generator`; a migration `0001_init` é SQL escrito à mão (`CREATE EXTENSION IF NOT EXISTS vector;`). `PrismaService` estende `PrismaClient` com `onModuleInit`/`onModuleDestroy`. O health usa `$queryRaw` com `SELECT 1`.
- Alternativa descartada: Prisma 7 — motivo: exige driver adapter e `prisma.config.ts`, custo sem ganho numa fatia sem modelos; trocar depois é uma tarefa isolada. Alternativa descartada: `previewFeatures = ["postgresqlExtensions"]` — motivo: recurso em preview para o que uma linha de SQL resolve.

### D4 — Postgres local sem senha, preso ao loopback

- Escolha: `docker-compose.yml` com `pgvector/pgvector:pg16`, porta `127.0.0.1:5433:5432`, `POSTGRES_USER=folioteca`, `POSTGRES_HOST_AUTH_METHOD=trust` e `docker/postgres/init.sql` criando `folioteca_test` (o banco `folioteca` vem de `POSTGRES_DB`). URLs sem senha: `postgresql://folioteca@localhost:5433/folioteca`.
- Alternativa descartada: usuário e senha fixos no compose e nos `.env.example` — motivo: URL com senha versionada dispara o GitGuardian (falso positivo que trava o PR e só sai reescrevendo o commit). O `trust` vale só para o contêiner local, inacessível fora da máquina.

### D5 — Contrato: envelope `{ data }`, 503 quando o banco cai, tipos gerados versionados

- Escolha: `GET /health` (servidor `/api`) responde `200 { data: { status: "ok", database: "up" } }` ou `503 { message: string }` (corpo padrão da `ServiceUnavailableException` do Nest, mensagem "Banco de dados indisponível."; o schema `Error` exige só `message` e aceita campos extras). `packages/api-contract` é o pacote `@folioteca/api-contract`, só de tipos (`exports["."].types` → `src/generated/openapi.d.ts`), gerado por `openapi-typescript` (script `generate`) e **versionado**. Um teste da API regenera em memória e compara com o arquivo: contrato e tipos nunca divergem em silêncio. A web deriva os tipos em `src/types/api.ts` (`Health`, `HealthResponse`).
- Alternativa descartada: gerar os tipos no `postinstall` sem versionar — motivo: `tsc -b` e o editor dependeriam de um passo oculto, e o diff do PR deixaria de mostrar a mudança de tipo. Alternativa descartada: filtro global normalizando erros para `{ message }` — motivo: a fatia não tem 4xx; entra na 002 com o primeiro erro de validação.

### D6 — Validação contra o contrato com swagger-parser + ajv

- Escolha: `apps/api/test/contract.ts` expõe `expectMatchesContract({ path, method, status, body })`: carrega e valida o `openapi.yaml` com `@apidevtools/swagger-parser` (dereferenciado) e confere o corpo com `ajv` + `ajv-formats`. Os testes HTTP usam `supertest` sobre o app criado por `create-app.ts` (mesma função do `main.ts`, então o prefixo `/api` é testado de verdade). O caminho feliz roda contra o Postgres real; o 503 substitui o `PrismaService` por um que rejeita. `test/global-setup.ts` define `DATABASE_URL` do banco `folioteca_test` (se ausente) e roda `prisma migrate deploy`.
- Alternativa descartada: `jest-openapi`/`chai-openapi-response-validator` — motivo: acoplados a Jest/Chai e sem manutenção para OpenAPI 3.1.
- Consequência registrada no README: `vitest run` na raiz exige `docker compose up -d` antes.

### D7 — Indicador de conexão é uma query com polling, sem store

- Escolha: `features/connection/api/get-health.ts` no padrão `api-requests` (fetcher `getHealth(): Promise<HealthResponse>`, `getHealthQueryOptions`, `useHealth`), com `refetchInterval: (query) => query.state.status === 'error' ? 3_000 : 10_000`, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `staleTime: 0`, `networkMode: 'always'` (com o navegador offline a consulta falha na hora em vez de ficar pausada como "conectando") e `retry: false` do default. Estado exibido: `isPending` → conectando; `isError` → sem conexão; senão conectado.
- Alternativa descartada: store Zustand alimentado por `setInterval` — motivo: é estado de servidor; `client-state` manda ficar no cache do React Query. Alternativa descartada: WebSocket/SSE — motivo: infraestrutura que só a fatia 005 (colaboração) justifica.

### D8 — Layout compartilhado recebe o indicador por slot

- Escolha: `AppLayout` tem a prop `sidebarFooter: React.ReactNode`; `routes/app/root.tsx` passa `<ConnectionIndicator />`. O layout fica em `components/layouts/` e não importa de `features/`.
- Alternativa descartada: importar o indicador dentro do layout — motivo: compartilhado não importa de feature (`project-structure`).

### D9 — Em tela estreita a barra lateral é painel recolhível, não gaveta modal

- Escolha: abaixo de `md`, barra de topo com o nome do produto e o botão do menu; o painel abre **no fluxo**, entre a barra de topo e o conteúdo. Estado aberto/fechado em `useState` dentro do `AppLayout`; fecha ao navegar (mudança de `location.pathname`) e com `Esc`. Botão com texto visível, sem biblioteca de ícones.
- Alternativa descartada: gaveta sobreposta com `@radix-ui/react-dialog` — motivo: exige foco preso, overlay e portal para o mesmo resultado; mais dependência e mais superfície para o axe numa fatia de fundação.

### D10 — Cliente axios único sem notificação nesta fatia

- Escolha: `lib/api-client.ts` segue o modelo de `api-client` (`baseURL: env.API_URL`, `withCredentials`, `Accept`, devolve `response.data`, 401 rejeita com `UnauthenticatedError` sem redirecionar, erro sempre termina em `Promise.reject`), **sem** o bloco de notificação. `env.API_URL` tem default `/api`; o Vite faz proxy de `/api` para `http://localhost:3000`. `env.ENABLE_API_MOCKING` tem default `false`.
- Alternativa descartada: já criar `components/ui/notifications` e notificar no interceptor — motivo: a única chamada da fatia é um polling; notificaria a cada 3 s enquanto o servidor estivesse fora, e o indicador já é o aviso permanente. A fatia 002 cria as notificações e, junto, a opção por requisição que silencia o health.
- Alternativa descartada: proxy também de `/collab` — motivo: não existe servidor de colaboração até a 005.

### D11 — E2E contra a API simulada, em porta própria, sem projeto de autenticação

- Escolha: `apps/web/playwright.config.ts` a partir do modelo de `e2e-testing`, com `webServer` `pnpm dev --port 5174 --strictPort` e `VITE_APP_ENABLE_API_MOCKING=true`; sem projeto `setup` nem `storageState` (não há login). Um projeto `chromium`. O Vitest da web exclui `e2e/**`; `e2e/` e o config entram em `tsconfig.node.json` e no lint.
- Alternativa descartada: e2e contra API e Postgres reais — motivo: a skill fixa e2e com MSW; a API real já é provada pelos testes de integração e de contrato. Alternativa descartada: reutilizar a 5173 — motivo: com `reuseExistingServer`, um `pnpm dev` aberto sem mock seria reaproveitado e o teste passaria a depender da API no ar.

### D12 — Tailwind 4 pelo plugin do Vite; rotas conforme `routing`

- Escolha: `tailwindcss` 4 + `@tailwindcss/vite`, `index.css` só com `@import "tailwindcss";`. `react-router` 7 com `paths.ts` (`home` `/`, `favorites` `/favorites`, `myDocuments` `/my-documents`, `spaces` `/spaces`, `trash` `/trash`), filhas com `lazy`, `root.tsx` importado direto e exportando `ErrorBoundary`, `*` por último e **fora** do layout (a 404 é página inteira, como no modelo da skill).
- Alternativa descartada: Tailwind 3 com PostCSS — motivo: três arquivos de configuração a mais sem uso.

## Interface

Fonte: `docs/design.md`. Todas as páginas usam o contêiner de página (`<main id="main-content" className="mx-auto max-w-2xl p-8">`), um único `<h1>` com a receita de título e o texto de apoio com `mt-2 text-gray-600`.

### Moldura (`AppLayout`)

De cima para baixo, em tela larga (`md` ou mais): duas colunas — barra lateral fixa à esquerda, conteúdo à direita.

1. Link "Pular para o conteúdo" (visível só com foco; aponta para `#main-content`).
2. Barra lateral (`<aside>`):
   - topo: "Folioteca" (link para o início, `font-semibold`);
   - `<nav aria-label="Navegação principal">` com a lista: "Favoritos", "Meus documentos", "Espaços", "Lixeira"; o item da página atual tem `aria-current="page"` e fundo de destaque;
   - rodapé: indicador de conexão.
3. Conteúdo: `<Outlet />`.

Em tela estreita (abaixo de `md`): barra de topo com "Folioteca" à esquerda e, à direita, o botão secundário "Abrir menu" (`aria-expanded="false"`, `aria-controls` no painel). Aberto: o botão passa a "Fechar menu" e o painel (mesma navegação + indicador) aparece abaixo da barra de topo, empurrando o conteúdo. Recolhido, o painel não fica no DOM acessível (`hidden`). Funciona em 360 px sem rolagem horizontal.

### Indicador de conexão (rodapé da barra lateral)

| Estado | O que aparece |
|---|---|
| Carregando | `<p role="status">` com selo cinza "Conectando…" |
| Com dados | `<p role="status">` com selo verde "Conectado" |
| Erro | `<div role="alert">` com selo vermelho "Sem conexão" e, abaixo, em tom suave, "Tentando reconectar…" |
| Vazio | não se aplica: a resposta nunca é lista |

Sem botão "Tentar de novo": o PRD (R5) pede reconexão automática, sem ação da pessoa. Ao voltar a conexão, o selo volta a "Conectado" sozinho.

### Página inicial (`/`)

- `h1`: "Boas-vindas à Folioteca"
- apoio: "Aqui você escreve, organiza e compartilha os documentos da sua organização."
- `h2`: "Como a Folioteca se organiza"
- lista (receita "Lista"), cada item com o nome da área como `<Link>` (receita "Link de navegação") e, abaixo, a descrição em `text-gray-600`:
  - "Favoritos" — "Os documentos que você marca para ter sempre à mão."
  - "Meus documentos" — "O que você cria, visível só para você até compartilhar."
  - "Espaços" — "Documentos reunidos por equipe ou por assunto."
  - "Lixeira" — "Documentos excluídos, até serem restaurados ou apagados de vez."

### Áreas vazias

| Rota | `h1` | Apoio | Vazio |
|---|---|---|---|
| `/favorites` | "Favoritos" | "Os documentos que você marca como favoritos ficam à mão aqui." | "Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui." |
| `/my-documents` | "Meus documentos" | "Os documentos que você cria ficam aqui, visíveis só para você até serem compartilhados." | "Nenhum documento ainda. Os documentos que você criar aparecem aqui." |
| `/spaces` | "Espaços" | "Espaços reúnem os documentos de uma equipe ou de um assunto." | "Nenhum espaço ainda. Os espaços de que você participa aparecem aqui." |
| `/trash` | "Lixeira" | "Documentos excluídos ficam aqui até serem restaurados ou apagados de vez." | "A lixeira está vazia. Os documentos que você excluir aparecem aqui." |

Estas páginas não leem API nesta fatia: só o estado vazio existe; carregando e erro entram com a fatia que trouxer os dados (004, 006, 007, 012).

### 404 (qualquer outro endereço)

Página inteira, fora da moldura: `h1` "Página não encontrada"; apoio "O endereço que você abriu não existe ou foi movido."; link "Voltar para o início" (`replace`).

### Erros de código

- Raiz (`MainErrorFallback`): `h1` "Algo deu errado"; "Não foi possível abrir a página. Recarregue para tentar de novo."; botão principal "Recarregar".
- Área (`ErrorBoundary` de `root.tsx`): `h1` "Algo deu errado"; "Não foi possível abrir esta página. Tente de novo em instantes."; link "Voltar para o início".

### Receitas

Usadas: contêiner de página, título de página, subtítulo, texto de apoio, lista, selo de status, botão principal, botão secundário, link de navegação, vazio.

Novas, acrescentadas a `docs/design.md` ("Padrões acrescentados pelas entregas", fatia 001):

| Padrão | Classes |
|---|---|
| Moldura do app | `<div className="min-h-screen md:flex">`; conteúdo `min-w-0 flex-1` |
| Barra lateral | `<aside className="border-b border-gray-200 bg-gray-50 md:flex md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">`; blocos internos com `p-4` |
| Barra de topo (tela estreita) | `flex items-center justify-between gap-4 p-4 md:hidden` |
| Item da barra lateral | `block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`; ativo: `bg-gray-200 text-gray-900` |
| Link de pular conteúdo | `sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-blue-600 focus:outline-2 focus:outline-blue-600` |
| Selo de erro | par `bg-red-100 text-red-800` para a receita "Selo de status" |

## Arquivos

Todos "criar", salvo indicação. `(g)` = gerado por ferramenta e versionado.

### Raiz, contrato e API (fase 1)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `package.json` | `private`, `packageManager: pnpm@11`, `engines.node >=24`, scripts `dev`/`lint`/`typecheck`/`test`/`test:e2e`/`build`, dev-deps da raiz (eslint e plugins, typescript, vitest, `@vitest/coverage-v8`) | `project-structure` |
| criar | `pnpm-workspace.yaml` | `apps/*`, `packages/*`; `onlyBuiltDependencies` (prisma, `@prisma/client`, `@prisma/engines`, esbuild, `@swc/core`, msw) | — |
| criar | `.nvmrc` | `24` | — |
| criar | `tsconfig.base.json` | strict, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `composite` | — |
| criar | `tsconfig.json` | só `files: []` e `references` (D1) | — |
| criar | `tsconfig.node.json` | cobre `vitest.config.ts` da raiz | — |
| criar | `eslint.config.js` | flat config do repositório (D1); zona `no-restricted-paths` da feature `connection` e direção compartilhado → features → app | `project-structure` |
| criar | `vitest.config.ts` | `projects` + cobertura v8 (D1) | `unit-testing` |
| criar | `docker-compose.yml` | Postgres pgvector na 5433 (D4) | `security` |
| criar | `docker/postgres/init.sql` | `CREATE DATABASE folioteca_test;` | — |
| alterar | `.gitignore` | `node_modules`, `dist`, `coverage`, `.env`, `apps/web/e2e/test-results/`, `apps/web/e2e/report/` | — |
| criar | `README.md` | pré-requisitos, `docker compose up -d`, `pnpm install`, `pnpm dev`, comandos de verificação (pt_BR) | — |
| criar | `packages/api-contract/package.json` | `@folioteca/api-contract`, `exports` só de tipos, script `generate` | — |
| criar | `packages/api-contract/tsconfig.json` | projeto composto incluindo `src/generated` | — |
| criar | `packages/api-contract/openapi.yaml` | OpenAPI 3.1: servidor `/api`, `GET /health` (200 `HealthResponse`, 503 `Error`), schemas `Health`, `HealthResponse`, `Error` | — |
| criar (g) | `packages/api-contract/src/generated/openapi.d.ts` | saída do `openapi-typescript` | — |
| criar | `apps/api/package.json` | NestJS 11, Prisma 6, zod; scripts `dev`, `build`, `prisma:migrate`, `prisma:generate`; dev-deps supertest, swagger-parser, ajv, ajv-formats, openapi-typescript, unplugin-swc | — |
| criar | `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json` | decorators + metadata; build exclui testes | — |
| criar | `apps/api/nest-cli.json`, `apps/api/.swcrc` | builder SWC (D2) | — |
| criar | `apps/api/vitest.config.ts` | ambiente node, `unplugin-swc`, `globalSetup`, `fileParallelism: false` | `unit-testing` |
| criar | `apps/api/.env.example` | `DATABASE_URL` (sem senha), `PORT=3000` | `security` |
| criar | `apps/api/prisma/schema.prisma` | `datasource` + `generator` (D3) | — |
| criar | `apps/api/prisma/migrations/0001_init/migration.sql` | `CREATE EXTENSION IF NOT EXISTS vector;` | — |
| criar | `apps/api/prisma/migrations/migration_lock.toml` | `provider = "postgresql"` | — |
| criar | `apps/api/src/config/env.ts` | zod: `DATABASE_URL`, `PORT` (default 3000); falha na inicialização | `security` |
| criar | `apps/api/src/create-app.ts` | cria o app Nest e aplica o prefixo `/api`; usado por `main.ts` e pelos testes | — |
| criar | `apps/api/src/main.ts` | sobe em `env.PORT` | — |
| criar | `apps/api/src/app.module.ts` | importa `PrismaModule` e `HealthModule` | — |
| criar | `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/prisma/prisma.service.ts` | módulo global e serviço (D3) | — |
| criar | `apps/api/src/health/health.module.ts`, `apps/api/src/health/health.controller.ts` | `GET /health`: `SELECT 1`; falha → `ServiceUnavailableException` (D5) | — |
| criar | `apps/api/test/global-setup.ts` | `DATABASE_URL` de teste + `prisma migrate deploy` (D6) | — |
| criar | `apps/api/test/contract.ts` | `expectMatchesContract` (D6) | — |
| criar | `apps/api/test/generated-types.test.ts` | tipos versionados iguais aos regenerados (D5) | `unit-testing` |
| criar | `apps/api/src/health/__tests__/health.integration.test.ts` | 200 contra Postgres real; extensão `vector` instalada; 503 com Prisma rejeitando | — |
| criar | `apps/api/src/health/__tests__/health.contract.test.ts` | 200 e 503 validados contra o `openapi.yaml` | — |

### Web (fase 2)

Caminhos relativos a `apps/web/`.

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `package.json` | React 19, react-router 7, TanStack Query 5, axios, zod, react-error-boundary, Tailwind 4, `@folioteca/api-contract` (`workspace:*`); dev: Testing Library, jest-dom, user-event, jsdom, msw, Playwright, `@axe-core/playwright`; scripts `dev`, `build`, `test:e2e` | — |
| criar | `index.html` | `lang="pt-BR"`, `<title>Folioteca</title>`, `#root` | `interface-design` |
| criar | `vite.config.ts` | React, Tailwind, alias `@/`, porta 5173, proxy `/api` → `http://localhost:3000` | `api-client` |
| criar | `vitest.config.ts` | jsdom, `setupFiles`, alias `@/`, exclui `e2e/**` | `component-testing`, `e2e-testing` |
| criar | `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | app (`src`) e node (`vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `e2e`) | `e2e-testing` |
| criar | `.env.example` | `VITE_APP_API_URL=/api`, `VITE_APP_ENABLE_API_MOCKING=false` | `api-client`, `security` |
| criar (g) | `public/mockServiceWorker.js` | `npx msw init public/ --save` | `api-mocking` |
| criar | `src/main.tsx` | `enableMocking()` e depois render | `api-mocking` |
| criar | `src/index.css`, `src/vite-env.d.ts` | Tailwind; tipos de `import.meta.env` | `api-client` |
| criar | `src/app/index.tsx` | `App`: provider + router | `routing` |
| criar | `src/app/provider.tsx` | `ErrorBoundary` raiz + `QueryClientProvider` (`useState`) | `error-handling`, `api-client` |
| criar | `src/app/router.tsx` | registro com `lazy`, `*` por último (D12) | `routing` |
| criar | `src/app/routes/app/root.tsx` | `AppLayout` + `Outlet` + slot do indicador + `ErrorBoundary` da área | `routing`, `error-handling`, `interface-design` |
| criar | `src/app/routes/app/home.tsx` | página inicial | `routing`, `interface-design` |
| criar | `src/app/routes/app/favorites.tsx`, `my-documents.tsx`, `spaces.tsx`, `trash.tsx` | áreas vazias | `routing`, `interface-design` |
| criar | `src/app/routes/not-found.tsx` | 404 | `routing`, `interface-design` |
| criar | `src/config/env.ts` | zod: `API_URL` (default `/api`), `ENABLE_API_MOCKING` (`'true'` → boolean, default `false`) | `api-client` |
| criar | `src/config/paths.ts` | cinco caminhos com `path` + `getHref` (D12) | `routing` |
| criar | `src/lib/api-client.ts` | axios único (D10) | `api-client`, `error-handling` |
| criar | `src/lib/react-query.ts` | `queryConfig` e tipos utilitários | `api-client` |
| criar | `src/lib/errors.ts`, `src/lib/report-error.ts` | `UnauthenticatedError` + guard; ponto único de reporte | `error-handling` |
| criar | `src/types/api.ts` | `Health`, `HealthResponse` derivados de `@folioteca/api-contract` | `api-requests` |
| criar | `src/components/errors/main-error-fallback.tsx` | tela de erro da raiz | `error-handling`, `interface-design` |
| criar | `src/components/layouts/app-layout.tsx` | moldura, barra lateral, painel recolhível, link de pular (D8, D9) | `interface-design`, `ui-components`, `client-state`, `component-robustness` |
| criar | `src/components/layouts/content-layout.tsx` | contêiner de página + `h1` + apoio + `children` | `interface-design` |
| criar | `src/features/connection/api/get-health.ts` | fetcher + query options + hook (D7) | `api-requests`, `client-state` |
| criar | `src/features/connection/components/connection-indicator.tsx` | três estados (Interface) | `interface-design`, `error-handling` |
| criar | `src/testing/setup-tests.ts`, `src/testing/test-utils.tsx` | jest-dom + servidor MSW (sem `db`: não há escrita); `renderApp` com providers e router em memória | `api-mocking`, `component-testing` |
| criar | `src/testing/mocks/handlers/health.ts`, `handlers/index.ts`, `server.ts`, `browser.ts`, `index.ts`, `utils.ts` | handler de `${env.API_URL}/health` tipado por `HealthResponse`; `networkDelay`; chaves `mock-error=health` e `mock-delay` | `api-mocking` |
| criar | `src/components/layouts/__tests__/app-layout.test.tsx` | quatro links, `aria-current`, abrir/fechar por clique e teclado, `Esc`, fecha ao navegar | `component-testing` |
| criar | `src/features/connection/components/__tests__/connection-indicator.test.tsx` | conectando, conectado, sem conexão, e volta a "Conectado" após falha (`once: true` + timers) | `component-testing`, `api-mocking` |
| criar | `src/app/routes/__tests__/not-found.test.tsx`, `src/app/routes/app/__tests__/home.test.tsx`, `src/app/routes/app/__tests__/empty-areas.test.tsx` | textos literais, `h1` único, link de volta | `integration-testing` |

### E2E e documentação (fase 3)

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/web/playwright.config.ts` | D11 | `e2e-testing` |
| criar | `apps/web/e2e/tests/open-app.spec.ts` | jornada "abrir o app": moldura e "Conectado", navegação pelas quatro áreas só por teclado, 404 e volta, 360 px com menu, axe em cada parada (R9) | `e2e-testing` |
| alterar | `docs/design.md` | receitas novas (seção Interface) | `interface-design` |
| alterar | `docs/architecture.md` | §7: e2e na 5174 com API simulada; §8: Postgres local em `trust` no loopback e proxy de `/collab` só a partir da 005; §1: Prisma 6 e SWC | — |

## Estimativa de tamanho

Jornadas: 1 (abrir o app) · Telas novas: 1 principal (início; as quatro áreas vazias compartilham uma estrutura e a 404 é o modelo da skill) · Linhas alteradas (sem testes nem arquivos gerados): ~1.100, das quais ~500 são configuração · Fases previstas: 3

Sinais de `vertical-slicing`: jornadas, fases e telas dentro do limite. **O sinal 4 (PR acima de ~400 linhas) dispara.** Foi aceito por ordem de quem encomendou a SPEC: é a fundação do monorepo, as ~500 linhas de configuração não se dividem sem deixar algum dos quatro comandos do verificador sem cobertura, e o corte restante (API sem web, ou web sem API) entregaria uma camada isolada, o que o `AGENTS.md` proíbe. Compensação: três fases, cada uma terminando com os quatro comandos verdes (D1), para revisão por fase.

## Dívida encontrada

Nenhuma: não há código anterior. Compromissos que esta SPEC empurra para a fatia 002 (installation): notificações no interceptor com opção de silenciar o health (D10) e filtro global de erro `{ message }` na API (D5).
