VEREDICTO: APROVADO

Portões
  lint/analyze: NÃO REGISTRADO — nenhum manifesto do repositório declara script `lint` ou
                `typecheck`. `pnpm test` responde `ERR_PNPM_NO_SCRIPT  Missing script: test`;
                `pnpm -r --if-present lint|typecheck|test` sai 0 sem executar nada
                ("Scope: 4 of 5 workspace projects", nenhum alvo). Os dois workflows de CI
                (`.github/workflows/ci-nestjs.yml`, `ci-react.yml`) são filtrados por
                `paths: apps/api/**` e `apps/web/**`, e nenhum dos dois diretórios contém
                fonte — só o `package.json`. Não presumo que passariam: não há o que rodar.
  testes:       NÃO REGISTRADO — mesma evidência acima.
  gates:        OK — `bash scripts/gates/gates_runner.sh` → "✓ gates: limpos (árvore completa,
                141 arquivo(s) considerados)." exit 0.

Critérios de aceite
  [x] 1. `pnpm-workspace.yaml` declara `apps/*` e `packages/*`; quatro manifestos com os nomes
     — `grep -nE 'apps/\*|packages/\*' pnpm-workspace.yaml` → `2:  - "apps/*"` / `3:  - "packages/*"`.
       `apps/api/package.json:2` `"name": "api"`; `apps/web/package.json:2` `"name": "web"`;
       `apps/site/package.json:2` `"name": "site"`; `packages/editor/package.json:2`
       `"name": "@folioteca/editor"`.

  [x] 2. `packages/editor/package.json` sem `main`/`module`/`exports`/`types`/`bin`; sem fonte
     — chaves reais do manifesto: `["name","private","version"]` (cada uma das cinco proibidas
       reportada `absent`). `find packages/editor -type f \( -name '*.ts' -o -name '*.tsx'
       -o -name '*.js' -o -name '*.mjs' \)` → nenhuma linha, `| wc -l` → `0`. A árvore inteira
       do pacote é `README.md`, `src/.gitkeep`, `package.json`.

  [x] 3. `engines`, `packageManager`, `.nvmrc`, `.npmrc`
     — `package.json:4` `"packageManager": "pnpm@9.12.0"`, `package.json:6` `"node": ">=24"`
       dentro de `"engines"`. `od -c .nvmrc` → `2   4  \n`. `.npmrc:1` `engine-strict=true`.

  [x] 4. Install sob Node 22 é recusado com `>=24`
     — `docker run --rm -v "$PWD":/repo -w /repo node:22-bookworm-slim npx --yes pnpm@9.12.0
       install --frozen-lockfile` → exit **1**, saída:
       `ERR_PNPM_UNSUPPORTED_ENGINE  Unsupported environment (bad pnpm and/or Node.js version)`
       / `Expected version: >=24` / `Got: v22.23.2`. Exit ≠ 0 e a saída contém `>=24`.

  [x] 5. `.env.example` com as três linhas
     — `.env.example:11` `NODE_ENV=development`; `:12` `PORT=3000`; `:16`
       `DATABASE_URL=postgresql://folioteca:senha@localhost:5433/folioteca` (casadas por
       `grep -nE` ancorado em `^...$`).

  [x] 6. `.env` fora do git e sem segredo preenchido no template
     — `git ls-files --error-unmatch .env` → `error: pathspec '.env' did not match any file(s)
       known to git`, exit **1**. `grep -cE '^(JWT_SECRET|SMTP_PASSWORD|ENCRYPTION_KEY)=.+$'
       .env.example` → imprime `0`. (As três chaves existem no template em `:20`, `:32`, `:37`,
       todas sem valor.)

  [x] 7. Compose com a imagem, a porta, a montagem, e o SQL da extensão
     — `docker-compose.yml:3` `image: pgvector/pgvector:pg16`; `:9` `- "127.0.0.1:5433:5432"`;
       `:12` `- ./docker/postgres/init:/docker-entrypoint-initdb.d:ro`.
       `docker compose config` resolve para `published: "5433"`, `target: 5432`, e bind de
       `/home/euclidesgc/development/folioteca/docker/postgres/init` →
       `/docker-entrypoint-initdb.d`. `docker/postgres/init/01-vector.sql:1`
       `CREATE EXTENSION IF NOT EXISTS vector;`.

  [x] 8. Extensão `vector` presente após recriação do volume, sem comando manual
     — `docker compose down -v` → `Volume folioteca_postgres-data Removed`, confirmado por
       `docker volume ls | grep -i folioteca` sem resultado (exit 1).
       `pnpm dev` → `Volume folioteca_postgres-data Created` … `Container folioteca-postgres-1
       Healthy`, exit 0.
       `psql "postgresql://folioteca:senha@localhost:5433/folioteca" -c "SELECT extname FROM
       pg_extension"` →
       ```
        extname
       ---------
        plpgsql
        vector
       (2 rows)
       ```
       Nenhum comando foi executado contra o banco entre o `down -v` e o `psql`.

  [x] 9. Script `dev` na raiz com as duas substrings
     — valor: `[ -f .env ] || install -m 600 .env.example .env; docker compose up -d --wait &&
       pnpm -r --parallel --if-present dev`. Checagem programática:
       contém `docker compose up -d --wait` → `true`; contém `pnpm -r --parallel` → `true`.

Instrumentos do implementer
  nenhum — não existe suíte de testes no repositório, e os nove critérios foram verificados
  por execução própria (docker, psql, pnpm, git, grep) ou por leitura direta do arquivo.

Apontamentos
  package.json (raiz) — nenhum script `lint`, `typecheck` ou `test` declarado em nenhum dos
    cinco manifestos. Isso não reprova nenhum critério desta fase, mas significa que os portões
    de lint/tipos/testes da DoD global não têm comando para executar hoje: `pnpm test` falha com
    `ERR_PNPM_NO_SCRIPT` e `pnpm lint` na raiz cai no binário `lint` do sistema (imprime a ajuda
    de outra ferramenta e sai 0) — um falso verde se alguém confiar no exit code. Vale registrar
    em qual fase esses scripts entram.
  .github/workflows/ci-nestjs.yml:24 e ci-react.yml:24 — ambos fixam `node-version: "22"`, a
    mesma versão que o critério 4 acabou de provar que o workspace recusa
    (`ERR_PNPM_UNSUPPORTED_ENGINE ... Expected version: >=24`). Os dois workflows também apontam
    `cache-dependency-path` para `apps/api/pnpm-lock.yaml` e `apps/web/pnpm-lock.yaml`, que não
    existem — o lockfile é único, na raiz (`pnpm-lock.yaml`). Hoje nada dispara porque os filtros
    de `paths` não encontram fonte; no primeiro arquivo sob `apps/api/` ou `apps/web/`, o CI
    quebra no passo `Dependências`. Fora do escopo dos critérios desta fase, mas é o portão da
    DoD que vai reprovar a fase seguinte.

Nota de escopo: `product/items/001-esqueleto-do-monorepo/04-divergencias/D-001.md`,
`product/items/001-esqueleto-do-monorepo/decisoes-autonomas.md` e `product/state.json` fazem
parte do commit `d10ba2b`, mas não foram abertos — conforme instruído, e porque são o material
ao qual esta validação é cega. Nenhum plano, spec ou histórico veio no despacho.
