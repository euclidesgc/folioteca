# Veredicto — fase 2 de 023-endurecimento-antes-da-sessao

Item:    023-endurecimento-antes-da-sessao
Fase:    2 — hotsite: cabeçalhos constantes, HSTS de produção e política com nonce
Branch:  023-endurecimento-antes-da-sessao/fase-2-hotsite-nonce
Commit:  22665795749ef909b0ccf48602b8a3447f7521ab
Data:    2026-09-03

Nota de despacho: o despacho não trouxe plano, spec nem PRD. A validação usou os
critérios como única régua. O quirk `rtk-output-proxy` de `.harness/config.json`
foi respeitado: todo comando cuja saída é evidência rodou sob `rtk proxy`, e todo
código de saída foi capturado dentro de `bash -c` (a shell da sessão é zsh, onde
`PIPESTATUS` não sobrevive à forma usada num primeiro ensaio — refeito).

VEREDICTO: APROVADO

## Portões

lint/analyze: OK
  $ pnpm --filter site lint        -> EXIT=0   ($ eslint .)
  $ pnpm --filter site typecheck   -> EXIT=0   ($ tsc --noEmit)

testes:       OK
  $ bash apps/site/scripts/__tests__/verificar-politica.test.sh  -> EXIT=0
    20 casos ok, incluindo "exige_nonces_distintos REPROVA com valores iguais",
    "exige_nonce_imprevisivel REPROVA um contador" e "a política canônica não
    contém curinga".
    ✓ verificar-politica.sh: as asserções sobre o nonce mordem.
  (apps/site não declara runner de teste; a suíte da frente é este script. O
  diff não toca apps/api nem apps/web.)

gates:        OK
  $ bash scripts/gates/gates_runner.sh   -> EXIT=0
    ✓ gates: limpos (árvore completa, 253 arquivo(s) considerados).

portões extras nomeados no despacho: OK
  $ bash apps/site/scripts/verificar-politica.sh producao        -> EXIT=0
    medido: a porta 3001 estava livre antes de subir o hotsite
    medido: 4 de 4 cabeçalhos constantes presentes
    medido: X-Powered-By ausente
    medido: HSTS presente no build de produção
    medido: 1 linha(s) de Content-Security-Policy na resposta
    medido: a política é exatamente a declarada — nove diretivas, e nada além delas
    medido: 8 <script> do corpo carregam o nonce da própria resposta
    APROVADO: a política e os cabeçalhos do hotsite conferem no modo producao.
  $ bash apps/site/scripts/verificar-politica.sh desenvolvimento -> EXIT=0
    medido: HSTS ausente fora do build de produção
    medido: a política é exatamente a declarada — nove diretivas, e nada além delas
    medido: 16 <script> do corpo carregam o nonce da própria resposta
    APROVADO: a política e os cabeçalhos do hotsite conferem no modo desenvolvimento.

## Critérios de aceite

[x] 1 — estrutural: next.config.ts com a chave `headers` e as onze strings, sem `preload`
    $ grep -F em apps/site/next.config.ts, string a string
      PRESENTE: X-Content-Type-Options / nosniff / Referrer-Policy /
                strict-origin-when-cross-origin / X-Frame-Options / DENY /
                Permissions-Policy / camera=(), microphone=(), geolocation=() /
                Strict-Transport-Security / max-age=31536000; includeSubDomains /
                process.env.NODE_ENV === "production"
      (as onze presentes, nenhuma ausente)
    $ grep -nE "headers" apps/site/next.config.ts
      30:  async headers() {
      31:    return [{ source: "/:path*", headers: seguranca }];
      A configuração é exportada em apps/site/next.config.ts:35 (`export default nextConfig`).
    $ grep -nF "preload" apps/site/next.config.ts
      (sem saída)  EXIT=1

[x] 2 — estrutural: middleware.ts com a assinatura, o `config.matcher` e as três strings
    $ grep -nF em apps/site/src/middleware.ts
      19:export function middleware(request: NextRequest): NextResponse {
      38:export const config = {
      39:  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
      PRESENTE: Content-Security-Policy / crypto.getRandomValues / nonce-

[x] 3 — comando: nenhuma variável de origem nem diretiva insegura nos dois arquivos
    $ grep -nE "NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_SITE_URL|unsafe-inline|unsafe-eval" \
        apps/site/src/middleware.ts apps/site/next.config.ts
      (sem saída)  EXIT=1

[x] 4 — comportamental: os quatro constantes mais HSTS no build de produção, sem `preload`
    Dado:  $ pnpm --filter site build   -> BUILD_EXIT=0
           $ pnpm --filter site start & (10s)  -> "✓ Ready in 73ms", ouvindo em :3001
    Quando: $ curl -sD- -o /dev/null http://localhost:3001/
    Então (saída real):
      HTTP/1.1 200 OK
      X-Content-Type-Options: nosniff
      Referrer-Policy: strict-origin-when-cross-origin
      X-Frame-Options: DENY
      Permissions-Policy: camera=(), microphone=(), geolocation=()
      Strict-Transport-Security: max-age=31536000; includeSubDomains
      content-security-policy: script-src 'self' 'nonce-OBECjAeZg9TMOaS+qxRAnw=='; ...
      As cinco linhas exigidas conferidas com grep -iF: todas PRESENTE.
    $ grep -i "preload" <saída>   -> (sem saída)  EXIT=1

[x] 5 — comportamental: em desenvolvimento há nosniff e não há HSTS
    Dado:  $ pnpm --filter site dev & (15s)  -> "✓ Ready in 200ms", ouvindo em :3001
    Quando: $ curl -sD- -o /dev/null http://localhost:3001/
    Então (saída real):
      X-Content-Type-Options: nosniff        <- grep -i "^x-content-type-options: nosniff" EXIT=0
      Referrer-Policy: strict-origin-when-cross-origin
      X-Frame-Options: DENY
      Permissions-Policy: camera=(), microphone=(), geolocation=()
      content-security-policy: script-src 'self' 'nonce-P06NqGe2Xve7otPiT5900A=='; ...
    $ grep -i "^strict-transport-security" <saída>  -> (sem saída)  EXIT=1

[x] 6 — comportamental: as nove diretivas da política, sem 'unsafe-inline' nem 'unsafe-eval'
    $ curl -sD- -o /dev/null http://localhost:3001/ | grep -i '^content-security-policy:'
      content-security-policy: script-src 'self' 'nonce-KRBAAnIuBybw/ZUn1gM8WQ=='; default-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
      Conferidas uma a uma com grep -F: default-src 'self', style-src 'self',
      img-src 'self' data:, connect-src 'self', object-src 'none', base-uri 'self',
      form-action 'self', frame-ancestors 'none' e script-src 'self' 'nonce-  -> todas PRESENTE.
    $ grep -F "unsafe-inline" -> EXIT=1     $ grep -F "unsafe-eval" -> EXIT=1

[x] 7 — comportamental: nonce novo a cada requisição
    $ curl -sD- -o /dev/null http://localhost:3001/ | grep -io "nonce-[A-Za-z0-9+/=_-]*"
      1ª execução: nonce-lmATkVqWKINkm23UhsSXbA==   EXIT=0
      2ª execução: nonce-bibJux1pg3y31aNGTVCX0g==   EXIT=0
      Cada execução imprimiu uma linha, e os valores diferem.

[x] 8 — comportamental: o nonce do cabeçalho é o estampado no <script> da mesma resposta
    $ curl -s -D /tmp/politica-cabecalho.txt -o /tmp/politica-corpo.html http://localhost:3001/
      (uma única execução)
    Cabeçalho:
      content-security-policy: script-src 'self' 'nonce-tFGf3vH9KhSLwUdIz1Rezg=='; default-src 'self'; ...
      ocorrências de "nonce-" na linha da política: 1
    Corpo (mesmo valor, 9 casamentos de nonce="tFGf3vH9KhSLwUdIz1Rezg=="), recorte:
      <script src="/_next/static/chunks/2xgzr9owyzj9y.js" async="" nonce="tFGf3vH9KhSLwUdIz1Rezg==">
      <script src="/_next/static/chunks/turbopack-27r8elb91lk2s.js" async="" nonce="tFGf3vH9KhSLwUdIz1Rezg==">
      <script nonce="tFGf3vH9KhSLwUdIz1Rezg==">        (embutido, sem src)

[x] 9 — comando: exige_nonces_distintos reprova iguais citando o valor, e passa com diferentes
    $ ls -l apps/site/scripts/verificar-politica.sh
      -rwxrwxr-x 1 euclidesgc euclidesgc 13180 set  3 09:46 apps/site/scripts/verificar-politica.sh
    $ bash -c 'source apps/site/scripts/verificar-politica.sh; exige_nonces_distintos abc123 abc123'
      EXIT=1
      stdout: medido: nonce da primeira resposta = 'abc123', da segunda = 'abc123'
      stderr: ::error::duas requisições consecutivas receberam o mesmo nonce: abc123
      (a saída contém abc123)
    $ bash -c 'source apps/site/scripts/verificar-politica.sh; exige_nonces_distintos abc123 def456'
      EXIT=0
      medido: nonce da primeira resposta = 'abc123', da segunda = 'def456'
      Sourcing não sobe servidor: apps/site/scripts/verificar-politica.sh:307 guarda
      `principal` atrás de [ "${BASH_SOURCE[0]}" = "$0" ].

[x] 10 — comando: build zero, rota dinâmica presente, nenhuma rota estática
    $ pnpm --filter site build > /tmp/site-build.log 2>&1   -> EXIT=0  (redireção direta, sem tee)
    $ grep -E 'ƒ[[:space:]]+/[[:space:]]*$' /tmp/site-build.log
      ┌ ƒ /
      EXIT=0
    $ grep -E '○[[:space:]]+\(Static\)' /tmp/site-build.log
      (sem saída)  EXIT=1
      Recorte do log: "Route (app) / ┌ ƒ / / └ ƒ /_not-found / ƒ (Dynamic) server-rendered on demand".

## Instrumentos do implementer

Nenhum critério dependeu da suíte escrita pelo avaliado. Os critérios 4 a 8 foram
medidos com curl próprio contra servidores que eu subi e derrubei, e não pela
saída de `verificar-politica.sh`. O critério 9 tem o script do avaliado como
objeto sob verificação, não como prova: executei as duas invocações exatas do
critério e li código de saída e saída de texto diretamente.
`verificar-politica.sh` (nos dois modos) e `verificar-politica.test.sh` rodaram
como portões nomeados no despacho, em acréscimo à verificação própria, e não
como evidência de nenhum critério.

Higiene de ambiente: a porta 3001 estava livre no início, cada servidor subido foi
derrubado antes do próximo, e a porta ficou livre ao fim. `git status --porcelain`
saiu vazio depois de todas as execuções — o build não sujou a árvore.

## Apontamentos

Nenhum bloqueia a fase. Os três são observações objetivas, fora da régua dos critérios.

apps/site/src/middleware.ts:19 — o build e o dev imprimem, em toda execução:
  ⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
  (Next.js 16.3.4). O critério 2 exige nomeadamente `src/middleware.ts`, então o
  arquivo está certo para esta fase; o aviso é dívida datada, que vira quebra de
  build quando a convenção sair numa major. Vale item de roadmap, não correção aqui.

.gitignore:14 — a linha `.playwright-mcp/` entrou no diff da fase sem relação com
  o objetivo (cabeçalhos e política do hotsite). Não quebra nada e não fere critério;
  registro porque alarga o diff de um PR de endurecimento com ruído de ferramenta.

apps/site — observação, não defeito: hoje a política declara `style-src 'self'` e o
  projeto não tem folha de estilo nenhuma (`find apps/site/src -name '*.css'` volta
  vazio; o HTML servido tem 0 tags <style> e 0 atributos `style="`). A política
  não reserva nonce para estilo, então quando a primeira folha de estilo chegar vale
  reverificar esta diretiva na mesma fase que a introduzir. Não afirmo quebra futura:
  não é verificável hoje, e não pesa no veredicto.

APROVADO
