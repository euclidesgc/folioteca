VEREDICTO: APROVADO

**Objeto sob verificação:** branch `001-esqueleto-do-monorepo/fase-5-ci-tres-frentes`, diff `chore/ancora-do-estado-na-raiz...HEAD` (commits `3b49812` e `85dddfa`). Toda a medição foi feita na raiz `/home/euclidesgc/development/folioteca`, com árvore limpa no início e no fim.

**Nota de método.** `.harness/config.json` registra o quirk `rtk-output-proxy`: um hook global reescreve comandos de Bash e filtra a saída. Todo comando citado abaixo foi executado via o escape `rtk proxy`, de modo que as saídas transcritas são as saídas cruas. O ponteiro do diff toca também `product/items/001-esqueleto-do-monorepo/03-plan.md`, `04-divergencias/D-016..D-018.md`, `decisoes-autonomas.md`, `product/roadmap.md` e `product/state.json`; desses arquivos eu li apenas os nomes no `--stat`, e não abri o conteúdo de nenhum — a régua foram os dez critérios recebidos.

## Portões

```
lint/typecheck: OK
testes:         OK
gates:          OK
```

**Lint** — `pnpm -r --if-present lint` → `EXIT=0`
```
apps/api lint: Done
apps/site lint: Done
apps/web lint: Done
```

**Typecheck** — `pnpm -r --if-present typecheck` → `EXIT=0`
```
apps/api typecheck: Done   apps/site typecheck: Done   apps/web typecheck: Done
```

**Testes** — `pnpm -r --if-present test` → `EXIT=0`
```
apps/api test: Tests: 11 passed, 11 total
apps/web test: Test Files 2 passed (2) | Tests 7 passed (7)
```

**Gates arquiteturais** — `bash scripts/gates/gates_runner.sh` → `EXIT=0`
```
✓ gates: limpos (árvore completa, 229 arquivo(s) considerados).
```

**Suítes do harness** (rodadas antes e depois dos critérios, com resultado idêntico):
- `bash scripts/gates/__tests__/medir.test.sh` → `EXIT=0` — 15 asserções, `✓ medir.sh: todas as asserções mordem.`
- `bash scripts/gates/__tests__/bloqueio.test.sh` → `EXIT=0` — 11 asserções, `✓ bloqueio: a trava morde o rótulo indentado e reprova quando não mede.`
- `bash scripts/gates/__tests__/fronteira-de-agent.test.sh` → `EXIT=0` — 10 asserções, `✓ fronteira de agent: toda chave nomeia um agent, todo agent tem chave.`

## Critérios de aceite

**[x] 1 — `comando`: `grep -rn "node-version" .github/workflows | grep -cv "\"24\""` imprime `0`.**
Saída impressa: `0`. (O código de saída do pipe é 1, que é o comportamento normal de `grep -c` quando a contagem é zero; o critério mede o que é impresso, e o impresso é `0`.) As seis declarações existentes, todas fixadas:
```
.github/workflows/ci-react.yml:70:  node-version: "24"
.github/workflows/ci-react.yml:121: node-version: "24"
.github/workflows/ci-nestjs.yml:79: node-version: "24"
.github/workflows/ci-nestjs.yml:132:node-version: "24"
.github/workflows/ci-nestjs.yml:185:node-version: "24"
.github/workflows/ci-site.yml:36:   node-version: "24"
```
`portoes.yml` e `bloqueio.yml` não declaram `node-version` porque não executam Node — só scripts bash. **Cumprido.**

**[x] 2 — `comando`: cada um dos três fluxos tem gatilho `push`.**
`bash -c 'for f in ci-nestjs ci-react ci-site; do grep -q "^  push:" ".github/workflows/$f.yml" || exit 1; done'` → `EXIT=0`. Confirmado na leitura: `ci-nestjs.yml:4`, `ci-react.yml:4`, `ci-site.yml:4`. **Cumprido.**

**[x] 3 — `comando`: nenhum lockfile por app referenciado.**
`bash -c '! grep -rq "apps/[a-z]*/pnpm-lock.yaml" .github/workflows'` → `EXIT=0`. Corroborado: `find . -name pnpm-lock.yaml -not -path "*/node_modules/*"` devolve só `./pnpm-lock.yaml`, e os seis blocos `setup-node` apontam para ele (`cache-dependency-path: "pnpm-lock.yaml"` em ci-react:72,123; ci-nestjs:81,134,187; ci-site:38), com `pnpm install --frozen-lockfile` nos seis jobs correspondentes. **Cumprido.**

**[x] 4 — `estrutural`: os jobs declarados em ci-nestjs.yml e ci-react.yml, e nenhum outro.**
Enumeração das chaves de primeiro nível sob `jobs:` de cada arquivo:
```
ci-nestjs: ["guarda","contrato","qualidade","integracao","gates"]
ci-react:  ["guarda","qualidade","comportamental","gates"]
```
Os conjuntos são exatamente os exigidos, sem excedente. **Cumprido.**

**[x] 5 — `estrutural`: os três comandos em ci-site.yml.**
```
.github/workflows/ci-site.yml:50:  run: pnpm --filter site typecheck
.github/workflows/ci-site.yml:53:  run: pnpm --filter site build
.github/workflows/ci-site.yml:60:  run: bash scripts/gates/gates_runner.sh --all
```
Verifiquei também que o flag existe de fato: `bash scripts/gates/gates_runner.sh --all` → `EXIT=0`, `✓ gates: limpos (árvore completa, 229 arquivo(s) considerados).` **Cumprido.**

**[x] 6 — `comando`: sem `continue-on-error` nem `|| true`.**
`bash -c '! grep -rqE "continue-on-error|\|\| true" .github/workflows'` → `EXIT=0`. Inspecionei todas as ocorrências de `||` para descartar equivalentes funcionais que o regex não pega:
```
ci-react.yml:159   HARNESS_DIFF_BASE: origin/${{ github.base_ref || 'develop' }}...HEAD   (default de expressão)
ci-nestjs.yml:104  git diff --exit-code apps/api/openapi.json || {  ... exit 1 }           (reergue a falha)
ci-nestjs.yml:108  git diff --exit-code .../generated || { ... exit 1 }                     (reergue a falha)
ci-nestjs.yml:201  if [ ! -d apps/api/test ] || [ -z "$(find ...)" ]                        (condição)
ci-nestjs.yml:219  prisma migrate diff ... --exit-code || codigo=$?                         (captura para julgar: 2 → exit 1; outro → exit 1)
ci-nestjs.yml:243  HARNESS_DIFF_BASE: origin/${{ github.base_ref || 'develop' }}...HEAD     (default de expressão)
```
Nenhuma engole falha. **Cumprido.**

**[x] 7 — `comportamental`: o typecheck do hotsite morde o erro de tipo e volta a passar depois da restauração.**
*Dado* — linha inserida após `export default function HomePage() {` em `apps/site/src/app/page.tsx:2`:
```
export default function HomePage() {
  const numero: number = 'texto';
  return (
```
*Quando* — `pnpm --filter site typecheck` na raiz. *Então* — `EXIT=2` (diferente de zero):
```
src/app/page.tsx(2,9): error TS2322: Type 'string' is not assignable to type 'number'.
src/app/page.tsx(2,9): error TS6133: 'numero' is declared but its value is never read.
[ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] site@0.0.0 typecheck: `tsc --noEmit` / Exit status 2
```
Depois de `git checkout -- apps/site/src/app/page.tsx`, o mesmo comando → `EXIT=0`, saída apenas `$ tsc --noEmit`. `git status --porcelain` vazio em seguida. **Cumprido.**

**[x] 8 — `estrutural`: o job `contrato` confere os dois pares e é pré-requisito de `qualidade` e `integracao`.**
Dentro do bloco `contrato:` (linhas 69–119 de `.github/workflows/ci-nestjs.yml`):
```
104:  git diff --exit-code apps/api/openapi.json || { ... exit 1 }
108:  git diff --exit-code apps/web/src/shared/api/generated || { ... exit 1 }
```
Arestas de dependência:
```
69:  contrato:      70: needs: guarda
121: qualidade:    122: needs: contrato
153: integracao:   154: needs: contrato
232: gates:        233: needs: guarda
```
Os dois `git diff --exit-code` exigidos estão no job certo, e ambos os jobs exigidos declaram `needs: contrato` — o contrato reprova antes de lint, tipos, unidade e integração rodarem. **Cumprido.**

**[x] 9 — `comportamental`: contrato divergente do código reprova e nomeia a rota.**
*Dado* — método acrescentado em `apps/api/src/health/health.controller.ts:14`, com `apps/api/openapi.json` intacto (`git status --porcelain` mostrava só `M apps/api/src/health/health.controller.ts`, e `git diff --stat apps/api/openapi.json` vazio):
```
  @Get('version') version(): { version: string } { return { version: '1' }; }
```
*Quando* — `bash -c 'pnpm --filter api run openapi:generate && git diff --exit-code apps/api/openapi.json'`. *Então* — `EXIT=1`, e a saída contém `/version`:
```
+    "/health/version": {
+      "get": {
+        "operationId": "HealthController_version",
```
Restaurado com `git checkout -- apps/api/openapi.json apps/api/src/health/health.controller.ts`; `git status --porcelain` vazio em seguida. **Cumprido.**

**[x] 10 — `comportamental`: cliente divergente do contrato reprova e nomeia o símbolo.**
*Dado* — `export type Divergente = string;` acrescentado ao fim de `apps/web/src/shared/api/generated/types.gen.ts` e registrado no índice (`git status --porcelain` → `M  apps/web/src/shared/api/generated/types.gen.ts`). *Quando* — `bash -c 'pnpm --filter web run api:generate && git diff --exit-code apps/web/src/shared/api/generated'`. *Então* — `EXIT=1`, e a saída contém `Divergente`:
```
@@ -20,4 +20,3 @@ export type GetHealthResponses = {
 export type GetHealthResponse = GetHealthResponses[keyof GetHealthResponses];
-export type Divergente = string;
```
Índice restaurado com `git reset HEAD -- apps/web/src/shared/api/generated/types.gen.ts`; `git status --porcelain` e `git status --porcelain --untracked-files=all` sobre os caminhos gerados voltaram vazios. **Cumprido.**

## Higiene da árvore

`git status --porcelain` foi conferido depois de cada um dos critérios 7, 9 e 10, e ao final de tudo: **vazio nas quatro vezes**. Também conferi `--untracked-files=all` sobre `apps/web/src/shared/api/generated`, `apps/api/openapi.json` e `apps/site/src` — sem arquivo órfão deixado pelos geradores. As quatro suítes da DoD, reexecutadas depois dos critérios, deram o mesmo resultado da primeira rodada.

## Instrumentos do implementer

Nenhum. Os dez critérios foram medidos por execução própria: comandos rodados na raiz, leitura direta dos arquivos de workflow e enumeração programática das chaves de `jobs:`. Os três critérios comportamentais foram provocados por mim — injetei o erro de tipo, o endpoint e o símbolo divergente, executei os comandos e restaurei a árvore. Nenhum critério se apoiou em teste escrito pelo avaliado.

## Apontamentos

Nenhum defeito. Duas observações objetivas que **não** alteram o veredicto — não há critério que as cubra, e o critério é a régua:

- `.github/workflows/ci-nestjs.yml:5`, `ci-react.yml:5`, `ci-site.yml:5` — os três gatilhos de `push` são restritos a `branches: [main, develop]`. O critério 2 pede apenas a presença de `push:`, e ela está lá; mas na prática um push em branch de trabalho não dispara fluxo nenhum, e a primeira verificação só acontece quando o PR abre (via `pull_request:`, que não tem filtro de branch). Se a intenção era verificação a cada push em qualquer branch, o filtro precisa cair; se a intenção era economizar minutos e verificar no PR, está como deveria — é decisão de quem escreveu, não erro que eu possa afirmar.
- `.github/workflows/ci-site.yml` — o fluxo do hotsite não tem o job `guarda` que ci-nestjs e ci-react têm para o caso de pacote ainda vazio. Não é problema hoje: `apps/site/src/app/page.tsx` existe e o typecheck e o build passam. Registro só porque a assimetria entre os três fluxos é intencional ou não, e quem ler o veredicto depois merece saber que ela foi vista.

VEREDICTO: APROVADO
