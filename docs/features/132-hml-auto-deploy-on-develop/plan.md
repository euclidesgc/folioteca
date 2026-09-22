# PLAN 132 — Publicação automática em homologação a cada merge em develop

Branch: `feature/132-hml-auto-deploy-on-develop` (base `origin/develop`, não empilhada)

Commits esperados: 1 de docs inicial + 1 por fase (2), sem contar o de fechamento. Nenhuma migration nova nesta fatia.

## Fase 1 — Imagens da API e da web construídas e provadas localmente, com o commit no `/api/health`

- [x] T1.1 — Expor o commit publicado em `GET /api/health`, do contrato ao mock
  - Arquivos: `apps/api/src/config/env.ts` (alterar); `apps/api/src/health/health.controller.ts` (alterar); `packages/api-contract/openapi.yaml` (alterar); `packages/api-contract/src/generated/openapi.d.ts` (alterar, só pelo script); `apps/web/src/testing/mocks/handlers/health.ts` (alterar)
  - O que fazer: no schema de `env.ts`, acrescentar `SOURCE_COMMIT: z.string().min(1).default('unknown')`. `HealthController` passa a devolver `{ status, database, commit }`, com `commit` vindo de `SOURCE_COMMIT` da configuração validada. No `openapi.yaml`, o schema `Health` ganha a propriedade `commit` (`type: string`) e a inclui em `required`; o caminho continua `/health` sob o servidor `/api` (conferir à mão que nenhum caminho mudou). Regenerar `openapi.d.ts` exclusivamente com `pnpm --filter @folioteca/api-contract generate` (nunca editar à mão). O handler MSW de health da web devolve `commit` (ex.: `"test-commit"`) para ficar fiel ao contrato.
  - Skills: unit-testing, api-mocking
  - Complexidade: baixa

- [x] T1.2 — Imagem da API: build em estágios, não-root, migração na subida
  - Arquivos: `apps/api/Dockerfile` (criar); `.dockerignore` (criar); `apps/api/package.json` (alterar); `pnpm-lock.yaml` (alterar)
  - O que fazer: mover `prisma` de `devDependencies` para `dependencies` em `apps/api/package.json` e atualizar o lock com `pnpm install`. `.dockerignore` na raiz exclui `node_modules`, `**/node_modules`, `dist`, `**/dist`, `.env*`, `**/.env*`, `.git`, `coverage`, `**/coverage`, `playwright-report`, `test-results`. `apps/api/Dockerfile` (contexto = raiz do repo): base `node:24-alpine`, corepack com a versão do `packageManager` da raiz; estágio de build com `pnpm install --frozen-lockfile`, `pnpm --filter api build` e `pnpm --filter api deploy --prod /out`, copiando schema e migrations do Prisma e rodando `prisma generate` em `/out`; estágio final com `ENV NODE_ENV=production`, `ARG SOURCE_COMMIT=unknown`, `ENV SOURCE_COMMIT=$SOURCE_COMMIT`, `USER node`, `EXPOSE 3000`, `HEALTHCHECK` com `wget -qO- http://127.0.0.1:3000/api/health` e `CMD ["sh","-c","npx prisma migrate deploy && exec node dist/main.js"]`. Nenhum valor secreto no arquivo.
  - Skills: security
  - Complexidade: alta

- [x] T1.3 — Imagem da web: SPA em nginx sem root, com proxy de mesma origem para `/api` e `/collab`
  - Arquivos: `apps/web/Dockerfile` (criar); `apps/web/nginx/default.conf.template` (criar)
  - O que fazer: `apps/web/Dockerfile` (contexto = raiz): estágio de build `node:24-alpine` com corepack, `pnpm install --frozen-lockfile` e `pnpm --filter web build`, sem nenhuma `VITE_*`; estágio final `nginxinc/nginx-unprivileged:1.27-alpine`, copia o `dist` da web para a raiz do nginx e o template para `/etc/nginx/templates/default.conf.template`, `EXPOSE 8080`, `HEALTHCHECK` com `wget -qO- http://127.0.0.1:8080/`. O template: `listen 8080`; `location /` com `try_files $uri /index.html`; `location /assets/` com cache longo (`expires 1y` / `Cache-Control: public, immutable`); `location /api/` e `location /collab` com `proxy_pass ${API_UPSTREAM}`, `proxy_set_header Host $host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`; no `/collab`, `proxy_http_version 1.1`, `Upgrade $http_upgrade` e `Connection "upgrade"`. Com `API_UPSTREAM` ausente, a subida do contêiner falha com mensagem que nomeia `API_UPSTREAM` (ex.: script em `/docker-entrypoint.d/` que sai com erro "API_UPSTREAM é obrigatória.").
  - Skills: security
  - Complexidade: alta

- [x] T1.4 — Script de prova local das duas imagens
  - Arquivos: `scripts/verify-images.sh` (criar, executável)
  - O que fazer: `set -euo pipefail` e `trap` que remove contêineres e o banco descartável ao sair. Builda `apps/api/Dockerfile` e `apps/web/Dockerfile` com contexto na raiz e `--build-arg SOURCE_COMMIT=local-test`; cria o banco `folioteca_image_check` no Postgres do `docker compose`; sobe a API apontando para ele, espera o estado `healthy`; confere que `/api/health` devolve `commit` igual a `local-test`; sobe a web com `API_UPSTREAM` apontando para a API; confere que `/` e uma rota profunda (ex.: `/qualquer/rota`) devolvem o `index.html`, e que `/api/health` via web devolve `status`; sobe a web sem `API_UPSTREAM` e confere que ela sai com mensagem contendo `API_UPSTREAM`. Imprime `OK: imagens verificadas` no fim e sai 0; qualquer falha sai ≠ 0. Não entra no `pnpm test`.
  - Skills: —
  - Complexidade: média

- [x] T1.5 — Testes da fase 1
  - Arquivos: `apps/api/src/config/__tests__/env.test.ts` (alterar); `apps/api/src/health/__tests__/health.integration.test.ts` (alterar); `apps/api/src/health/__tests__/health.contract.test.ts` (alterar)
  - O que fazer: em `env.test.ts`, casos `uses SOURCE_COMMIT when provided`, `defaults SOURCE_COMMIT to unknown when absent`, `rejects empty SOURCE_COMMIT`. Em `health.integration.test.ts`, casos `returns commit from SOURCE_COMMIT`, `returns commit unknown when SOURCE_COMMIT is not set`. Em `health.contract.test.ts`, caso `matches the Health schema with required commit`. Ajustar asserções existentes de health para incluir `commit`.
  - Skills: unit-testing, integration-testing
  - Complexidade: baixa

### Critérios de aceite da fase 1

- [x] CA1.1 — `apps/api/src/config/env.ts` declara `SOURCE_COMMIT: z.string().min(1).default('unknown')`.
- [x] CA1.2 — `HealthController` em `apps/api/src/health/health.controller.ts` devolve um objeto com as chaves `status`, `database` e `commit`, e `commit` vem de `SOURCE_COMMIT`.
- [x] CA1.3 — Em `packages/api-contract/openapi.yaml`, o schema `Health` tem `commit` (`type: string`) listado em `required`; `rtk git diff origin/develop -- packages/api-contract/openapi.yaml` não altera nenhuma chave de caminho sob `paths:` (conferido à mão).
- [x] CA1.4 — `pnpm --filter @folioteca/api-contract generate` seguido de `git diff --exit-code packages/api-contract/src/generated/openapi.d.ts` sai 0, e o tipo gerado de `Health` contém `commit: string`.
- [x] CA1.5 — `apps/web/src/testing/mocks/handlers/health.ts` devolve um corpo com `commit`.
- [x] CA1.6 — `apps/api/package.json` lista `prisma` em `dependencies` e não em `devDependencies`; `pnpm install --frozen-lockfile` passa.
- [x] CA1.7 — `apps/api/Dockerfile` contém `ARG SOURCE_COMMIT=unknown`, `ENV SOURCE_COMMIT=$SOURCE_COMMIT`, `USER node`, `EXPOSE 3000`, um `HEALTHCHECK` com `wget` em `http://127.0.0.1:3000/api/health`, `pnpm --filter api deploy --prod` e `CMD ["sh","-c","npx prisma migrate deploy && exec node dist/main.js"]`.
- [x] CA1.8 — `apps/web/Dockerfile` usa `nginxinc/nginx-unprivileged:1.27-alpine` no estágio final, `EXPOSE 8080`, `HEALTHCHECK` com `wget` em `http://127.0.0.1:8080/`, copia o template para `/etc/nginx/templates/default.conf.template` e não contém `VITE_`.
- [x] CA1.9 — `apps/web/nginx/default.conf.template` tem `listen 8080`, `try_files $uri /index.html`, `location /assets/` com cache longo, `location /api/` e `location /collab` com `proxy_pass ${API_UPSTREAM}` e `proxy_set_header Host $host`, e o bloco `/collab` define `Upgrade $http_upgrade` e `Connection "upgrade"`.
- [x] CA1.10 — `.dockerignore` na raiz exclui `node_modules`, `dist`, `.env*`, `.git`, `coverage`, `playwright-report` e `test-results`; `grep -rE "(PASSWORD|SECRET|postgres://)" apps/api/Dockerfile apps/web/Dockerfile apps/web/nginx/` não encontra nada.
- [x] CA1.11 — `bash scripts/verify-images.sh` sai 0 e imprime `OK: imagens verificadas` (builda as duas imagens, confere `commit` = `local-test`, fallback do SPA, `/api/health` via web e falha da web sem `API_UPSTREAM` nomeando a variável); depois dele, `docker ps -a` não lista contêineres criados pelo script.
- [x] CA1.12 — Existem os testes `uses SOURCE_COMMIT when provided`, `defaults SOURCE_COMMIT to unknown when absent` e `rejects empty SOURCE_COMMIT` em `apps/api/src/config/__tests__/env.test.ts`; `returns commit from SOURCE_COMMIT` e `returns commit unknown when SOURCE_COMMIT is not set` em `apps/api/src/health/__tests__/health.integration.test.ts`; `matches the Health schema with required commit` em `apps/api/src/health/__tests__/health.contract.test.ts`.
- [x] CA1.13 — Cobertura ≥ 80% em `apps/api/src/config/env.ts` e `apps/api/src/health/health.controller.ts`, lida do `coverage/coverage-summary.json` gerado por `pnpm --filter api test -- --coverage` (sem `--project`).
- [x] CA1.14 — `git diff --name-only origin/develop` não inclui nenhum arquivo novo em `apps/api/prisma/migrations/`.

## Fase 2 — Publicação em homologação documentada, com o roteiro de ações no Coolify

- [x] T2.1 — Documentar a publicação em homologação e o roteiro de configuração
  - Arquivos: `docs/architecture.md` (alterar)
  - O que fazer: nova seção `## 10. Publicação em homologação` em pt_BR, com subseções: imagens (API e web, estágios, não-root, portas 3000 e 8080); proxy de mesma origem (`/api` e `/collab` via nginx, por que não CORS); commit publicado (`SOURCE_COMMIT`, "Include Source Commit in Build", `commit` em `/api/health`); migração na subida (`prisma migrate deploy` antes do Node; banco novo e vazio obrigatório porque as migrations antigas de hml, como `20260910020900_fundacao_de_conta`, não têm relação com `0001_init` … `0007_org_unit_name_uniqueness`); variáveis por app (API: `DATABASE_URL` obrigatória, `PORT`, `NODE_ENV`, `INSTALL_CODE`, `COLLAB_ALLOWED_ORIGINS`, `COLLAB_STORE_DEBOUNCE_MS`, `SOURCE_COMMIT`; web: só `API_UPSTREAM` em runtime, sem `VITE_*`; `INSTALLATION_CODE` não é mais lido), incluindo a comparação com as variáveis já configuradas trazida pela orquestração; roteiro de ações em duas listas — "Orquestração (MCP do Coolify)": criar Postgres `pgvector/pgvector:pg16` novo não público, healthcheck da API `/api/health` porta 3000, ligar "Include Source Commit in Build", `NODE_ENV=production`, web na porta 8080 com healthcheck `/` porta 8080 e `API_UPSTREAM`, disparar e acompanhar o deploy — e "Dono (painel)": `DATABASE_URL` do banco novo, `INSTALL_CODE` (≥ 16 caracteres), apagar variáveis sobrando e, se quiser, o banco antigo; "Como verificar depois do merge": `/api/health` pelo domínio de hml mostra o `commit` do merge; prova local por `bash scripts/verify-images.sh`. Nenhum valor secreto no texto. O roteiro é executado pela orquestração fora das fases.
  - Skills: —
  - Complexidade: baixa

- [x] T2.2 — Testes da fase 2
  - Arquivos: nenhum arquivo de teste novo (fase só de documentação)
  - O que fazer: rodar a suíte inteira e `bash scripts/verify-images.sh` para confirmar que nada regrediu com a documentação.
  - Skills: —
  - Complexidade: baixa

### Critérios de aceite da fase 2

- [x] CA2.1 — `docs/architecture.md` tem o título `## 10. Publicação em homologação`, e a seção cita `SOURCE_COMMIT`, `API_UPSTREAM`, `DATABASE_URL`, `INSTALL_CODE`, `/api/health`, `8080`, `prisma migrate deploy` e `scripts/verify-images.sh`.
- [x] CA2.2 — A seção tem as listas "Orquestração (MCP do Coolify)" e "Dono (painel)" e a subseção "Como verificar depois do merge".
- [x] CA2.3 — A seção justifica o banco novo citando `20260910020900_fundacao_de_conta` e `0001_init`.
- [x] CA2.4 — `grep -nE "(postgres://|PASSWORD=)" docs/architecture.md` não encontra nenhum valor de segredo.
- [x] CA2.5 — `bash scripts/verify-images.sh` continua saindo 0 com `OK: imagens verificadas`.

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
