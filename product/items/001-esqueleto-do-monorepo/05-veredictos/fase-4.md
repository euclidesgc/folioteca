```
VEREDICTO: APROVADO

Portões
  lint/analyze: OK
    apps/site  `pnpm lint`            → exit 0 (eslint .)
    apps/site  `pnpm typecheck`       → exit 0 (tsc --noEmit)
    apps/api   `pnpm lint`            → exit 0
    apps/api   `pnpm exec tsc --noEmit` → exit 0
    apps/web   `pnpm exec tsc --noEmit` → exit 0
    apps/web   `pnpm lint`            → exit 0
  testes:       OK
    apps/api  `pnpm test`  → exit 0 — "Test Suites: 1 passed, 1 total / Tests: 11 passed, 11 total"
    apps/web  `pnpm test -- --reporter=dot` → exit 0 — "Test Files 2 passed (2) / Tests 7 passed (7)"
    packages/editor não declara scripts (package.json só tem name/private/version) — nada a rodar
  gates:        OK
    `bash scripts/gates/gates_runner.sh` → exit 0
    "✓ gates: limpos (árvore completa, 220 arquivo(s) considerados)."
    Zero conferido, não presumido: o runner faz `sys.exit(1)` no ramo de violação, e
    .harness/gates.json registra G3 e G4 (pack "projeto") sobre `apps/site/src/**` —
    o código novo estava dentro do universo medido, não fora dele.
  install:      OK — `pnpm install --frozen-lockfile` na raiz → exit 0, "Already up to date"

Critérios de aceite

  [x] 1 (estrutural) — `apps/site/src/app/layout.tsx` e `page.tsx` existem; nenhum `'use client'` sob `apps/site/src/`
      `ls -la` confirma os dois arquivos (530 e 744 bytes).
      `find apps/site/src -type f` devolve exatamente três entradas:
        apps/site/src/app/layout.tsx
        apps/site/src/app/page.tsx
        apps/site/src/components/.gitkeep
      `grep -rn "use client" apps/site/src/` → sem saída, exit 1 (nenhuma ocorrência).

  [x] 2 (comportamental) — o hotsite entrega o texto dentro do HTML
      Com `pnpm dev` rodando na raiz:
      `rtk proxy curl -s localhost:3001 | grep -o 'Folioteca'` → quatro linhas `Folioteca`.
      Conferência extra de que o texto é do servidor, não injetado depois:
      `curl -s localhost:3001 | grep -o '<h1>Folioteca</h1>'` → `<h1>Folioteca</h1>`
      `curl -s localhost:3001 | grep -c 'biblioteca de fólios da empresa'` → `1`

  [x] 3 (comportamental) — os quatro serviços respondem
      `rtk proxy bash -c 'docker compose port postgres 5432; curl ... /health; curl ... :5173; curl ... :3001'` → exit 0
      saída literal:
        127.0.0.1:5433
        200
        200
        200
      Contém `5433` e as três linhas `200`.

  [x] 4 (comando) — clone recém-feito sobe até `/health` responder `ok` dentro de 60s
      Pré-condição verificada antes da execução, não assumida:
        `docker images | grep pgvector` → pgvector/pgvector:pg16 presente no cache local
        `ss -ltnH | grep -E ":(3000|3001|5173|5433)\b"` → "NONE"; `docker ps` → vazio
      Comando executado literalmente como escrito → **exit 0**.
      Confirmei que o zero corresponde ao clone, e não a resto de execução anterior:
        `curl -s localhost:3000/health` → `{"status":"ok"}`
        `docker ps` → `tmp4zbw4xobhu-postgres-1 | 127.0.0.1:5433->5432/tcp`
        `docker volume ls` → `tmp4zbw4xobhu_postgres-data` (volume novo, projeto nomeado
        pelo diretório do clone `/tmp/tmp.4zbw4XobHu`, como o critério descreve)
        listeners: 3000, 3001, 5173 e 127.0.0.1:5433 todos ocupados pelo clone
      O diretório temporário permanece, como o critério exige.

  [x] 5 (comando) — clone recém-feito instala com lockfile congelado e lista os pacotes
      Comando executado literalmente → **exit 0**. Saída de `pnpm ls -r --depth -1`:
        folioteca /tmp/tmp.Xgz2OA57zY (PRIVATE)
        api@0.0.0 /tmp/tmp.Xgz2OA57zY/apps/api (PRIVATE)
        site@0.0.0 /tmp/tmp.Xgz2OA57zY/apps/site (PRIVATE)
        web@0.0.0 /tmp/tmp.Xgz2OA57zY/apps/web (PRIVATE)
        @folioteca/editor@0.0.0 /tmp/tmp.Xgz2OA57zY/packages/editor (PRIVATE)
      Contém `api`, `site`, `web` e `@folioteca/editor`.

Instrumentos do implementer
  nenhum. Os cinco critérios foram medidos por verificação própria — inspeção de
  arquivo, `curl` contra o processo vivo, `docker ps`/`docker volume ls` e código de
  saída dos comandos literais. As suítes jest e vitest do avaliado entraram apenas no
  portão "testes" da DoD, que é onde uma suíte é o instrumento por definição; nenhum
  critério se apoiou nelas.

Apontamentos
  Nenhum bloqueio. Um achado fora do alcance dos critérios, que não muda o veredicto:

  .github/workflows/ci-react.yml:6,8 e .github/workflows/ci-nestjs.yml:6,8 — nenhum
  workflow cobre `apps/site/**`. Os filtros são `paths: ["apps/web/**", "scripts/gates/**",
  ...]` e `paths: ["apps/api/**", "scripts/gates/**", ...]`; `portoes.yml` roda só as
  asserções de medição e `bloqueio.yml` só os rótulos. `grep -rn "site" .github/workflows/`
  não devolve nada.
  Consequência concreta: um PR que toca apenas `apps/site/**` — que é exatamente a forma
  deste diff — não dispara lint, typecheck nem `gates_runner.sh`. E `gates_runner.sh` só é
  invocado em ci-react.yml:145 e ci-nestjs.yml:196, ambos atrás desses mesmos filtros, de
  modo que os portões G3 e G4 recém-registrados para `apps/site/src/**` em .harness/gates.json
  só rodam no CI quando o PR calha de mexer em `apps/api/**`, `apps/web/**` ou `scripts/gates/**`.
  Importa porque `apps/site/package.json` passou a declarar `lint` e `typecheck` nesta fase, e
  o README do diretório (apps/site/README.md) afirma que a DoD global e G3/G4 valem aqui —
  hoje isso vale na minha máquina e na de quem rodar à mão, não no CI, que é a autoridade
  sobre a DoD. Os dois comandos passam agora; o que falta é quem os cobre no PR seguinte.
```
