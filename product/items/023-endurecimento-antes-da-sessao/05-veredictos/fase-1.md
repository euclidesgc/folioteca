VEREDICTO: APROVADO

**Nota sobre o envelope.** O despacho não me enviou plano, spec nem histórico — recebi objetivo, critérios e ponteiro para o trabalho, como deve ser. Registro apenas que a árvore sob verificação contém `product/items/023-endurecimento-antes-da-sessao/03-plan.md` e `decisoes-autonomas.md` modificados: **não os abri**. O critério 9 cita `decisoes-autonomas.md` no rótulo, mas seu *Dado/Quando/Então* é autossuficiente e foi verificado sem consultar o arquivo.

```
Portões
  lint/analyze: OK — pnpm --filter api run lint → EXIT=0, saída vazia
  typecheck:    OK — pnpm --filter api run typecheck → EXIT=0, saída vazia
  build:        OK — pnpm --filter api build → EXIT=0
  testes:       OK — jest: 2 suítes / 40 testes passaram
                     jest e2e: 4 suítes / 13 testes passaram
  gates:        OK — "✓ gates: limpos (árvore completa, 239 arquivo(s))"
                     + G3/G4/G7 rodados à mão sobre os 5 arquivos novos
                       não rastreados: 0 violações
```

## Sobre o `TS5011` — a premissa não se reproduziu

Medi, não aceitei. `pnpm --filter api run typecheck` → `EXIT=0`, saída só com o eco `$ tsc --noEmit`. Descartei cache incremental (`rm dist/tsconfig.tsbuildinfo` + `npx tsc --noEmit --incremental false`, direto, sem wrapper) → `EXIT=0`, **zero linhas de saída**. Depois `git stash push -u` e a mesma medição na árvore pré-mudança → também `EXIT=0`, zero saída.

**Não há `TS5011` em nenhum dos dois estados.** Não é pré-existente nem introduzido: não existe. A causa provável do relato está no item 1 dos apontamentos.

Árvore restaurada e conferida byte a byte: `git status --short` e `git diff` idênticos ao estado inicial.

## Critérios de aceite

- [x] **C1 `estrutural` RF-01.1/01.2** — `apps/api/src/config/web-origins.ts:5` `export function parseWebOrigins(value: string): string[]`; `:26` `export function isWebOriginList(value: string): boolean`. `environment.schema.ts:2` importa `isWebOriginList` de `"./web-origins"`; `:10-13` aplica dentro de `.custom(` na chave `WEB_ORIGIN`; `:14` `.default("http://localhost:5173")`. `grep -n '\.pattern(' environment.schema.ts` → exit 1, nenhuma ocorrência. `cors.ts:4` importa `parseWebOrigins`; `:12` `origin: parseWebOrigins(config.get("WEB_ORIGIN", { infer: true }))`.
- [x] **C2 `estrutural` RF-09.1** — `apps/api/package.json:24` `"helmet": "8.3.0"` em `dependencies`, sem `^` nem `~`. `bootstrap.ts:3` `import helmet from "helmet"`. **Ressalva medida:** `grep -n 'app.use(helmet(' bootstrap.ts` → **exit 1, nenhuma linha**. O Prettier quebrou a chamada (`:20` `app.use(` / `:21` `helmet({`). Verifiquei com o runner primário que `.harness/config.json` declara para critério `estrutural` (`ast-grep`, lang typescript; grep é o *fallback*): `ast-grep --pattern 'app.use(helmet($$$ARGS))'` casa em `bootstrap.ts:20`, e `configureCors(` está em `:30` — **20 < 30, a ordem que o critério afirma se sustenta**. Dou por cumprido pela relação, não pelo literal; ver apontamento 3.
- [x] **C3 `estrutural` RF-02/03/09** — `test/cors.e2e-spec.ts`: `https://app.folioteca.exemplo` (4×), `https://intruso.exemplo` (1×), `access-control-allow-origin` (8×). `test/security-headers.e2e-spec.ts`: `x-content-type-options` (2×), `nosniff` (2×), `x-powered-by` (2×), `content-security-policy` (2×), `strict-transport-security` (4×).
- [x] **C4 `comportamental` RF-02.1/02.2** — API subida por mim com `WEB_ORIGIN='http://localhost:5173,https://app.folioteca.exemplo'`. `curl -sD- -H 'Origin: https://app.folioteca.exemplo'` → 1ª linha `HTTP/1.1 200 OK`; `Access-Control-Allow-Origin: https://app.folioteca.exemplo`. Ancorado (`^…$`, CR removido) → PRESENTE. `grep -i '^access-control-allow-origin.*\*'` → exit 1: nenhum `*`.
- [x] **C5 `comportamental` RF-03.1** — mesma API, `Origin: https://intruso.exemplo` → 1ª linha `HTTP/1.1 200 OK`; `grep -ic '^access-control-allow-origin'` → **0**. O único `access-control-*` na resposta é `Access-Control-Allow-Credentials: true`, que não começa por `access-control-allow-origin`.
- [x] **C6 `comportamental` RF-01.3** — API com `WEB_ORIGIN='http://localhost:5173'`. 1º curl → `Access-Control-Allow-Origin: http://localhost:5173` (ancorado, PRESENTE). 2º curl com `Origin: https://app.folioteca.exemplo` → nenhuma linha começando por `access-control-allow-origin` (AUSENTE).
- [x] **C7 `comando` RF-04.1/04.2** — `WEB_ORIGIN='http://localhost:5173,https://app.exemplo/'` → **exit 1**, saída `WEB_ORIGIN is invalid` (contém `WEB_ORIGIN`). `curl -s -o /dev/null http://localhost:3000/health` em seguida → **exit 7**.
- [x] **C8 `comportamental` RF-09.2/09.3/09.4** — `curl -sD-` sem Origin, `NODE_ENV=test`: `X-Content-Type-Options: nosniff` (ancorado, PRESENTE); nenhuma linha começando por `x-powered-by`; nenhuma começando por `content-security-policy`.
- [x] **C9 `comportamental` (HSTS fora de produção)** — mesma resposta: nenhuma linha começando por `strict-transport-security`, case-insensitive.
- [x] **C10 `comportamental` (frame-options / CORP)** — mesma resposta: `X-Frame-Options: DENY` e `Cross-Origin-Resource-Policy: same-origin`, ambos PRESENTE.
- [x] **C11 `comportamental` (HSTS em produção sem preload)** — `NODE_ENV=production WEB_ORIGIN='https://app.folioteca.exemplo'` → `Strict-Transport-Security: max-age=31536000; includeSubDomains`. Casou com `$` ancorado: não há sufixo. `grep -i 'preload'` em toda a saída → AUSENTE.
- [x] **C12 `comando` (`NODE_ENV` fora do domínio)** — `NODE_ENV=prod …` → **exit 1**, saída `NODE_ENV is invalid`.
- [x] **C13 `comando` (produção sem `WEB_ORIGIN`)** — `NODE_ENV=production` sem `WEB_ORIGIN` → **exit 1**, saída `WEB_ORIGIN is required`. Verifiquei antes que o `.env` da raiz (lido por `main.ts:8`) declara só `NODE_ENV`, `PORT` e `DATABASE_URL` — o caso negativo é genuíno, não mascarado por arquivo.
- [x] **C14 `comando` (erro não vaza o valor)** — `WEB_ORIGIN='https://admin:hunter2@app.folioteca.exemplo'` → **exit 1**, saída `WEB_ORIGIN is invalid`; `grep -c 'hunter2'` → **0**.
- [x] **C15 `estrutural`** — `apps/api/src/main.ts:46` `bootstrap().catch((error: unknown) => {`; `process.exit(1)` em `:35` e `:48`.

## Instrumentos do implementer

**Nenhum.** Todos os quinze critérios foram verificados por instrumento próprio: `grep`/`ast-grep`/leitura para os `estrutural`, `curl` contra o binário de `apps/api/dist/main.js` que eu mesmo subi e derrubei para os `comportamental`, e execução direta do binário com captura de exit code para os `comando`. As suítes `jest` do avaliado foram executadas apenas como portão da DoD, e não sustentam a evidência de critério nenhum.

## Apontamentos

1. **`apps/api/tsconfig.json:19` — `"exclude": ["node_modules","dist","test","scripts","**/*.spec.ts"]`.** `pnpm --filter api run typecheck` **não typechecka** os quatro arquivos de teste que esta fase criou (`src/config/web-origins.spec.ts`, `test/cors.e2e-spec.ts`, `test/security-headers.e2e-spec.ts`, `test/environment-validation.e2e-spec.ts`) nem os pré-existentes. Erro de tipo nesses arquivos passa pelo portão em silêncio — só o `ts-jest` os compila, e ele isola por arquivo. É a explicação mais provável do `TS5011` relatado: qualquer tentativa de incluir `test/**` no `tsconfig` faz o `rootDir` comum subir de `src/` para `apps/api/`, e é aí que `tsc` reclama. Condição pré-existente do config, mas a fase acabou de colocar quatro arquivos dentro do ponto cego.

2. **`scripts/gates/gates_runner.sh:~70` — `tracked_files()` usa `git ls-files`.** Em modo greenfield/árvore completa o runner só enxerga arquivos **rastreados**. Os cinco arquivos novos desta fase estão como `??` e ficaram **invisíveis** ao `bash scripts/gates/gates_runner.sh` (os 239 considerados são todos rastreados). Rodei G3, G4 e G7 à mão alimentando os caminhos novos por stdin e estão limpos — mas, como está, o portão dá sinal verde sobre trabalho não commitado que ele nunca leu. Vale o alerta para a thread principal antes de confiar no runner em árvore suja.

3. **`apps/api/src/bootstrap.ts:20-21` — o literal do critério C2 é frágil.** `app.use(helmet(` não existe em nenhuma linha porque o formatador quebrou a chamada. A relação que o critério afirma é verdadeira, mas um critério `estrutural` cujo sonda é um literal dependente de formatação reprova no próximo `prettier --write` sem que nada de real mude. Devolver ao autor do critério para reescrever como padrão `ast-grep` (`app.use(helmet($$$))`) ou como comparação de posição de nó — não é tarefa do implementer.

4. **Contagem do despacho.** O despacho anuncia "catorze critérios"; o arquivo `criterios-fase-1.md` tem **quinze** itens. Validei os quinze. Se a intenção era catorze, um deles entrou ou saiu sem que o despacho registrasse.

5. **Efeito colateral do meu próprio `git stash` (já corrigido, mas registre-se).** Rodar `pnpm` com a árvore revertida fez o pnpm **podar `helmet` do `node_modules`** (`Packages: -1`). Restaurei com `pnpm install --frozen-lockfile` (`helmet@8.3.0` de volta) e reconstruí antes de qualquer medição de critério. Todas as evidências acima foram colhidas depois da restauração, e `git status`/`git diff` finais são idênticos ao estado inicial. Nada ficou escutando a porta 3000 (`ss -ltn | grep :3000` → vazio) e nenhum processo `dist/main.js` sobrou.
