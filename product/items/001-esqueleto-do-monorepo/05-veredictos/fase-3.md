VEREDICTO: APROVADO

Portões
  lint/analyze: OK — `pnpm --filter web lint` (eslint .) EXIT=0; `pnpm --filter api lint` (eslint "src/**/*.ts" "test/**/*.ts" "scripts/**/*.ts") EXIT=0
  typecheck:    OK — `pnpm --filter web typecheck` EXIT=0; `pnpm --filter api typecheck` EXIT=0 (ambos `tsc --noEmit`)
  testes:       OK — web `vitest run`: "Test Files 2 passed (2) / Tests 7 passed (7)" EXIT=0
                     api `jest`: "Tests: 11 passed, 11 total" EXIT=0
                     api `jest --config test/jest-e2e.json`: "Tests: 3 passed, 3 total" EXIT=0
                     web `pnpm exec playwright test`: "1 passed (899ms)" EXIT=0
  build:        OK — `VITE_API_URL=http://localhost:3000 pnpm --filter web build` EXIT=0 ("✓ built in 157ms", dist/assets/index-BbSaTssR.js 480.10 kB)
                     Nota de ambiente confirmada por medição própria: sem a variável o build falha com
                     `RolldownError: VITE_API_URL is required to build apps/web` (EXIT=1). É guarda deliberada
                     em apps/web/vite.config.ts, não defeito — falha só na ausência da variável.
  gates:        OK — `bash scripts/gates/gates_runner.sh` EXIT=0 — "✓ gates: limpos (árvore completa, 209 arquivo(s) considerados)"

Critérios de aceite
  [x] 1. estrutural — types.gen.ts versionado com `export type HealthResponse` + client.ts exportando a instância
      `git ls-files apps/web/src/shared/api/` lista os quatro arquivos (client.ts, index.ts, generated/index.ts,
      generated/types.gen.ts) — portanto versionados, não gerados em tempo de build.
      apps/web/src/shared/api/generated/types.gen.ts:7 — `export type HealthResponse = { status: string; };`
      apps/web/src/shared/api/client.ts:30 — `export const httpClient = axios.create({ baseURL: env.apiUrl, timeout: 10_000 });`
      "usada pelo restante de apps/web/src" verificado por rastreio de uso: o único consumidor é
      apps/web/src/features/health/api/get-health.ts:1 (`import { httpClient } from "@/shared/api"`) e :5
      (`httpClient.get<HealthResponse>("/health", { signal })`). Não há segunda instância de cliente no diretório.

  [x] 2. comando — grep imprime exatamente uma linha
      `bash -c 'grep -rlE "(\bfetch\(|from .axios.)" apps/web/src --include=*.ts --include=*.tsx'`
      Saída íntegra (rtk proxy), exatamente uma linha:
        apps/web/src/shared/api/client.ts
      EXIT=0. Nenhum outro arquivo de apps/web/src usa fetch( ou importa axios.

  [x] 3. estrutural — reexport no barril e import via alias
      apps/web/src/shared/api/index.ts:2 — `export type { HealthResponse } from "./generated/types.gen";`
      apps/web/src/features/health/api/get-health.ts:2 — `import type { HealthResponse } from "@/shared/api";`
      O import é pelo barril público `@/shared/api`, não pelo caminho interno do gerado.

  [x] 4. comando — `pnpm --filter web typecheck` sai 0
      Saída: "$ tsc --noEmit" / EXIT=0.

  [x] 5. comportamental — role `status` contém `ok` com API real em :3000 e web em :5173
      Verificação própria, independente da suíte do avaliado:
      - Dado: subi a API real (`pnpm --filter api run start`, PORT=3000). `curl -s -i http://localhost:3000/health`
        devolveu `HTTP/1.1 200 OK` + corpo `{"status":"ok"}`.
      - E: subi a web real (`VITE_API_URL=http://localhost:3000 pnpm --filter web run dev`) — Vite em
        http://localhost:5173/, `curl` http_code=200.
      - Quando/Então: dirigi um Chromium headless próprio (script meu, descartado depois) contra
        http://localhost:5173/ e observei:
          role=status element count: 1
          role=status textContent: "ok"
          contains "ok": true
          health requests observed: [... "GET http://localhost:3000/health", "GET http://localhost:3000/health"]
          body html: <div id="root"><p role="status">ok</p></div>
        O texto vem de rede real contra a API em :3000 — não há mock no caminho e2e (o MSW de
        health-handlers.ts só serve aos testes de unidade).
      - Corroboração pelo runner designado: `pnpm exec playwright test` de dentro de apps/web —
        "✓ 1 e2e/health.spec.ts:3:1 › mostra o status da API na página inicial (186ms) / 1 passed".
      O critério discrimina de fato: HealthStatus (health-status.tsx:7,11,14) renderiza "carregando" em pending e
      "indisponível" em erro — nenhum dos dois contém "ok", então a asserção não passa por acidente.

Instrumentos do implementer
  Nenhum. Todos os cinco critérios foram confirmados por verificação própria — leitura de arquivo com
  linha citada (1 e 3), execução direta do comando (2 e 4) e navegador dirigido por mim contra os
  servidores reais (5). A suíte do avaliado (apps/web/e2e/health.spec.ts) foi executada apenas como
  corroboração do critério 5, depois de a evidência independente já estar obtida; o veredicto não depende dela.

Apontamentos
  Envelope vazou: o diff inclui product/items/001-esqueleto-do-monorepo/03-plan.md,
  product/items/001-esqueleto-do-monorepo/04-divergencias/D-011.md,
  product/items/001-esqueleto-do-monorepo/decisoes-autonomas.md, product/roadmap.md e product/state.json —
  plano, divergências e histórico de fase. Chegaram como parte do ponteiro (o diff), não como contexto
  avulso, e não abri o conteúdo de nenhum deles: julguei só os critérios. Vale ajustar o despacho para
  que artefatos de plano não venham no mesmo canal do objeto sob verificação.

  Não bloqueante — apps/web/src/features/.gitkeep, apps/web/src/shared/api/.gitkeep,
  apps/web/src/shared/config/.gitkeep e apps/web/src/app/providers/.gitkeep continuam versionados em
  diretórios que agora têm arquivos reais. São placeholders obsoletos; não afetam nenhum critério nem portão.

---

Duas observações fora do que foi pedido, para separar bem do veredicto:

- A cadeia contrato → tipo está de fato íntegra, não só presente. Conferi `apps/api/openapi.json` (versionado)
  contra o gerado: o schema `HealthResponse` (`status: string`, `required: ["status"]`) e a operação
  `GET /health` correspondem exatamente a `types.gen.ts`, e `apps/web/openapi-ts.config.ts` aponta
  `input: "../api/openapi.json"`. Não há drift entre contrato e cliente gerado.
- O e2e está ligado ao CI, então não vira teste órfão: `.github/workflows/ci-react.yml:111` instala o Chromium
  e `:116` roda `pnpm exec playwright test`. Isso apesar de `apps/web/package.json` não ter script `e2e` —
  o CI chama o binário direto.
