# SPEC 132 — Publicação automática em homologação a cada merge em develop

## Cobertura dos requisitos

| Requisito | Como é atendido |
|---|---|
| R1 | `apps/api/Dockerfile` e `apps/web/Dockerfile` (hoje inexistentes, causa das falhas) nos caminhos que as apps Coolify já esperam; o auto deploy pelo GitHub App e os watch paths já existentes seguem disparando (D1, D2). |
| R2 | A web serve o SPA por nginx e repassa `/api` e `/collab` (WebSocket) para a API na mesma origem, preservando `Host` e cookies (D3). Banco novo e vazio + `INSTALL_CODE` configurado permitem refazer a instalação (D6, ações do dono). |
| R3 | `GET /api/health` passa a devolver `data.commit`, lido de `SOURCE_COMMIT` injetado pelo Coolify no build (D4). |
| R4 | Build ou healthcheck falho mantém o contêiner anterior no ar (comportamento do Coolify com healthcheck habilitado); o log fica no painel de publicações. |
| R5 | `HEALTHCHECK` com `wget` em `/api/health` (API, checa o banco) e `/` (web); healthcheck do Coolify da API corrigido de `/health` para `/api/health` (D5). |
| R6 | `CMD` da API: `prisma migrate deploy && exec node dist/main.js`; `prisma` vira dependência de produção; schema e migrations copiados para a imagem (D2). |
| R7 | Nada de valor no repositório: `.dockerignore` exclui `.env*`; segredos só no painel; `SOURCE_COMMIT` e `API_UPSTREAM` não são segredos. |
| R8 | `DATABASE_URL` ausente derruba a API na subida com "Variáveis de ambiente inválidas — DATABASE_URL: DATABASE_URL é obrigatória." (já existe em `apps/api/src/config/env.ts`); o `prisma migrate deploy` roda antes e também nomeia `DATABASE_URL`. `API_UPSTREAM` ausente na web falha a subida do nginx com mensagem nomeando a variável (D3). |

## Decisões técnicas

### D1 — Build do monorepo em estágios com `pnpm deploy`
- Escolha: imagem `node:24-alpine`, corepack com a versão do `packageManager`; estágio `build` faz `pnpm install --frozen-lockfile` e `pnpm --filter api build` (ou `--filter web`); API usa `pnpm --filter api deploy --prod /out` para gerar `node_modules` só de produção (inclui `@folioteca/api-contract`, que é só tipos) e roda `prisma generate` no `/out`. Contexto de build é a raiz (base directory `/` já configurado).
- Alternativa descartada: copiar o `node_modules` inteiro do workspace — motivo: imagem com devDependencies (nest cli, swc, vitest), maior e com mais superfície.

### D2 — API: runtime não-root, migração no início
- Escolha: estágio final `node:24-alpine`, `USER node`, `EXPOSE 3000`, `NODE_ENV=production`, `HEALTHCHECK` com `wget -qO- http://127.0.0.1:3000/api/health`, `CMD ["sh","-c","npx prisma migrate deploy && exec node dist/main.js"]` (o `exec` entrega o SIGTERM ao Node, preservando o flush do `collab`). `prisma` passa de devDependency para dependency.
- Alternativa descartada: migração num passo pré-deploy do Coolify — motivo: o Postgres de hml não é público e o pré-deploy não tem as mesmas garantias; decisão já validada antes do recomeço.

### D3 — Web: nginx na mesma origem, proxy de `/api` e `/collab`
- Escolha: estágio final `nginx:1.27-alpine` (modo não-root: `nginxinc/nginx-unprivileged:1.27-alpine`, porta 8080 — ver ações), `try_files $uri /index.html` para o SPA, cache longo em `/assets/`, `location /api/` e `location /collab` com `proxy_pass ${API_UPSTREAM}`, `proxy_set_header Host $host`, `X-Forwarded-*`, e `Upgrade`/`Connection` no `/collab`. Template em `/etc/nginx/templates/default.conf.template` (envsubst da imagem oficial). Sem `VITE_APP_API_URL` no build: o padrão `/api` de `apps/web/src/config/env.ts` já serve. `API_UPSTREAM` = endereço interno da API na rede do Coolify (ex.: `http://hvn6t37t7ul3xkhsg9h1etqo:3000`).
- Alternativa descartada: web chamando a API em outro domínio com CORS — motivo: sessão em cookie httpOnly e checagem de `Origin` contra `Host` no `/collab` exigiriam CORS com credenciais, `SameSite=None` e `COLLAB_ALLOWED_ORIGINS`; mesma origem replica o proxy do Vite e não muda código. Descartada também a rota por caminho no Traefik do Coolify: não é testável localmente.
- Observação: a porta da app web no Coolify muda de 80 para 8080 (imagem sem root).

### D4 — Commit no `/api/health` via `SOURCE_COMMIT`
- Escolha: Dockerfile da API declara `ARG SOURCE_COMMIT=unknown` e `ENV SOURCE_COMMIT=$SOURCE_COMMIT`; `env.ts` ganha `SOURCE_COMMIT: z.string().min(1).default('unknown')`; `HealthController` devolve `{ status, database, commit }`; `openapi.yaml` ganha `commit` (string, obrigatório) em `Health` e o tipo gerado é regenerado. No Coolify, liga-se "Include Source Commit in Build" na app da API.
- Alternativa descartada: gravar o commit num arquivo pelo `git rev-parse` no build — motivo: o contexto do Coolify não inclui `.git`.

### D5 — Healthchecks
- Escolha: Coolify da API passa a checar `/api/health` porta 3000 (hoje `/health`, que dá 404 pelo `setGlobalPrefix('api')`); web checa `/` porta 8080. `wget` (existe no alpine; `curl` não).
- Alternativa descartada: excluir `health` do prefixo global — motivo: muda contrato e testes sem ganho.

### D6 — Banco novo e vazio para hml
- Escolha: criar um Postgres novo (`pgvector/pgvector:pg16`, como o local) no mesmo ambiente do Coolify, não público; a API aponta para ele. O banco antigo fica intocado.
- Alternativa descartada: reaproveitar o banco antigo — motivo: as migrations da develop nova (`0001_init` … `0007_org_unit_name_uniqueness`) não têm histórico em comum garantido com as de antes do recomeço (processo refeito do zero em 20/09); `migrate deploy` num banco com `_prisma_migrations` alheio falha (P3005/P3009). Não foi possível comparar os nomes antigos nesta etapa (sem acesso a `git show`); a decisão vale nos dois casos e é a do PRD.

### D7 — Prova local por script
- Escolha: `scripts/verify-images.sh` builda as duas imagens com `--build-arg SOURCE_COMMIT=local-test`, sobe a API contra o Postgres do `docker compose` (banco descartável `folioteca_image_check`, criado e apagado pelo script), espera `healthy`, confere `commit == local-test` em `/api/health`, sobe a web com `API_UPSTREAM` apontando para a API, confere `index.html` em `/` e numa rota profunda (fallback) e `/api/health` via web; limpa contêineres ao sair (`trap`). Não entra no `pnpm test` (depende de Docker); é citado no PR e no `docs/architecture.md`.
- Alternativa descartada: job de CI buildando imagens — motivo: aumenta o escopo do workflow `verify`; fica como melhoria.

### Ações por responsável
- (a) Repositório (PR): arquivos da tabela abaixo.
- (b) Orquestração via MCP do Coolify (depois do merge, não secretas): criar o Postgres novo de hml; na API, healthcheck path `/api/health`, ligar "Include Source Commit in Build", `NODE_ENV=production` se faltar; na web, porta 8080, healthcheck `/` porta 8080, variável `API_UPSTREAM` (runtime); disparar/acompanhar o deploy e conferir `/api/health` pelo domínio.
- (c) Só o dono, no painel: `DATABASE_URL` da API com a URL interna e senha do banco novo; `INSTALL_CODE` (≥16 caracteres; o nome antigo `INSTALLATION_CODE` não é mais lido e pode ser apagado); apagar variáveis sobrando e, se quiser, o banco antigo; `folioteca-site-hml` fica como está.
- Levantamento das variáveis: a API exige `DATABASE_URL`; opcionais `PORT` (3000), `NODE_ENV`, `INSTALL_CODE`, `COLLAB_ALLOWED_ORIGINS` (vazio = mesma origem, correto com D3), `COLLAB_STORE_DEBOUNCE_MS`, e a nova `SOURCE_COMMIT`. A web não precisa de `VITE_*` no build; em runtime só `API_UPSTREAM`. A comparação com os nomes já configurados nas apps hml é feita pela orquestração com `env_vars` (sem reveal) antes da fase 2, e o resultado entra no roteiro do `docs/architecture.md`.

## Interface

Sem interface.

## Arquivos

| Ação | Caminho | O que muda | Skills |
|---|---|---|---|
| criar | `apps/api/Dockerfile` | multi-stage pnpm deploy, prisma generate, não-root, `HEALTHCHECK` wget, `ARG SOURCE_COMMIT`, CMD com migrate | `security` |
| criar | `apps/web/Dockerfile` | multi-stage, `pnpm --filter web build`, nginx-unprivileged | `security` |
| criar | `apps/web/nginx/default.conf.template` | SPA fallback, cache de assets, proxy `/api` e `/collab` (WS) para `${API_UPSTREAM}` preservando `Host` | `security` |
| criar | `.dockerignore` | exclui `node_modules`, `dist`, `.env*`, `.git`, `coverage`, relatórios do Playwright | `security` |
| alterar | `apps/api/package.json` | `prisma` de devDependencies para dependencies | `security` |
| alterar | `pnpm-lock.yaml` | reflexo da mudança acima | — |
| alterar | `apps/api/src/config/env.ts` | `SOURCE_COMMIT` com padrão `unknown` | `unit-testing` |
| alterar | `apps/api/src/config/__tests__/env.test.ts` | caso com e sem `SOURCE_COMMIT` | `unit-testing` |
| alterar | `apps/api/src/health/health.controller.ts` | devolve `commit` | — |
| alterar | `apps/api/src/health/__tests__/health.integration.test.ts` | espera `commit` | `integration-testing` |
| alterar | `apps/api/src/health/__tests__/health.contract.test.ts` | valida o schema novo | `integration-testing` |
| alterar | `packages/api-contract/openapi.yaml` | `Health.commit` obrigatório | — |
| alterar | `packages/api-contract/src/generated/openapi.d.ts` | regenerado com `pnpm --filter @folioteca/api-contract generate` | — |
| alterar | `apps/web/src/testing/mocks/` (handler de health, se existir) | incluir `commit` para manter o mock fiel ao contrato | `api-mocking` |
| criar | `scripts/verify-images.sh` | prova local das duas imagens (D7) | — |
| alterar | `docs/architecture.md` | nova seção "10. Publicação em homologação": imagens, proxy de mesma origem, `SOURCE_COMMIT`, migração na subida, variáveis por app, roteiro de ações (b) e (c), como verificar pós-merge | — |

## Estimativa de tamanho

Jornadas: 1 · Telas novas: 0 · Linhas alteradas (sem testes): ~300 · Fases previstas: 2 (1: imagens, nginx, commit no health, script e testes; 2: documentação e roteiro no Coolify)

## Dívida encontrada

- A app Coolify da API checa `/health`, mas a rota real é `/api/health` (prefixo global); corrigido nas ações desta fatia, não no código.
- `INSTALLATION_CODE` configurado em hml antes do recomeço não é o nome lido hoje (`INSTALL_CODE`).
- Falta projeto Playwright contra a API real + Postgres (dívida da 005, já registrada); a verificação em hml pós-merge segue manual.
- CI não builda as imagens: um Dockerfile quebrado só aparece no deploy de hml.
