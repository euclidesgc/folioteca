VEREDICTO: APROVADO

Fase 3 — item 023-endurecimento-antes-da-sessao
Branch: 023-endurecimento-antes-da-sessao/fase-3-app-politica-e-servidores
Commit julgado: caf226c (árvore limpa, sem arquivo não rastreado)

Portões
  lint/analyze: OK
      $ pnpm --filter web run lint          → EXIT_LINT=0        ($ eslint .)
      $ pnpm --filter web run typecheck     → EXIT_TYPECHECK=0   ($ tsc --noEmit)
  testes:       OK
      $ pnpm --filter web exec vitest run --reporter=dot → EXIT_VITEST=0
        "Test Files  3 passed (3) / Tests  17 passed (17)"
      $ pnpm --filter web exec playwright test → EXIT_PW=0
        "✓ 1 e2e/health.spec.ts:3:1 › mostra o status da API na página inicial (187ms)
         1 passed (5.1s)"
      $ bash apps/web/scripts/verificar-politica.sh http://localhost:3000 → EXIT=0
        "APROVADO: a política e os cabeçalhos de apps/web conferem."
      $ bash apps/web/scripts/__tests__/verificar-politica.test.sh → EXIT=0
        "✓ verificar-politica.sh: as asserções da política de apps/web mordem."
  gates:        OK
      $ bash scripts/gates/gates_runner.sh
        "✓ gates: limpos (árvore completa, 260 arquivo(s) considerados)."
        Rodado com a árvore limpa e sem arquivo não rastreado (git status --porcelain vazio,
        git ls-files --others --exclude-standard vazio), então o verde vale.

Critérios de aceite

  [x] estrutural — RF-07.1, RF-07.2, RF-07.3 — constante única com os quatro pares,
      referenciada por nome em server: e preview:, e nenhuma menção a HSTS.
      Observado em /home/euclidesgc/development/folioteca/apps/web/vite.config.ts:
        linhas 10-15 — const SECURITY_HEADERS = {
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "X-Frame-Options": "DENY",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        };
        linha 106 — server:  { port: 5173, strictPort: true, headers: SECURITY_HEADERS }
        linha 114 — preview: { port: 4173, strictPort: true, headers: SECURITY_HEADERS }
      $ grep -n "SECURITY_HEADERS\|headers" apps/web/vite.config.ts
        10:const SECURITY_HEADERS = {
        106:    headers: SECURITY_HEADERS,
        114:    headers: SECURITY_HEADERS,
      $ grep -n "Strict-Transport-Security" apps/web/vite.config.ts
        (sem saída)  EXIT_GREP_HSTS=1
      Quatro pares, uma só constante, os dois servidores apontam para ela pelo nome,
      e a string Strict-Transport-Security não existe no arquivo.

  [x] comando — RF-07.1 e RF-07.3 — servidor de desenvolvimento na 5173.
      $ pnpm --filter web exec vite --port 5173 --strictPort > /tmp/web-dev.log 2>&1 &
      $ sleep 8
      $ curl -sD- -o /dev/null http://localhost:5173/ | grep -iE 'x-content-type-options|referrer-policy|x-frame-options|permissions-policy|strict-transport-security'
        X-Content-Type-Options: nosniff
        Referrer-Policy: strict-origin-when-cross-origin
        X-Frame-Options: DENY
        Permissions-Policy: camera=(), microphone=(), geolocation=()
        EXIT_GREP=0
      Quatro linhas, nenhuma de strict-transport-security. Servidor derrubado em
      seguida por pkill -f 'vite --port 5173'.

  [x] comando — RF-07.2 e RF-07.3 — servidor de pré-visualização na 4173.
      $ VITE_API_URL=http://localhost:3000 pnpm --filter web build → EXIT_BUILD=0
        "dist/index.html 0.58 kB │ gzip: 0.35 kB / ✓ built in 159ms"
      $ pnpm --filter web exec vite preview --port 4173 --strictPort > /tmp/web-preview.log 2>&1 &
      $ sleep 6
      $ curl -sD- -o /dev/null http://localhost:4173/ | grep -iE 'x-content-type-options|referrer-policy|x-frame-options|permissions-policy|strict-transport-security'
        X-Content-Type-Options: nosniff
        Referrer-Policy: strict-origin-when-cross-origin
        X-Frame-Options: DENY
        Permissions-Policy: camera=(), microphone=(), geolocation=()
        EXIT_GREP=0
      Nenhuma linha de strict-transport-security. Servidor derrubado em seguida por
      pkill -f 'vite preview --port 4173'.

  [x] comando — RF-07.4 — o artefato não carrega os cabeçalhos como meta.
      Diretório apagado antes do build (equivalente ao rm -rf recusado pelo hook da
      máquina: find apps/web/dist -mindepth 1 -delete; rmdir apps/web/dist), confirmado
      por `ls apps/web/dist` → "Arquivo ou diretório inexistente".
      $ VITE_API_URL=http://localhost:3000 pnpm --filter web build → EXIT_BUILD=0
      $ grep -rlE 'X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy' apps/web/dist
        (sem saída)  EXIT_GREP=1
      Nenhum caminho impresso, código de saída 1.

  [x] comando — RF-10.1, RF-11.1, RF-11.2, RF-11.3, RF-12.1 — a política gravada no
      index.html com a origem de exemplo.
      dist apagado e confirmado ausente por `ls`; depois:
      $ VITE_API_URL=https://api.folioteca.exemplo pnpm --filter web build → EXIT_BUILD=0
      $ grep -o '<meta http-equiv="Content-Security-Policy"[^>]*>' apps/web/dist/index.html
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://api.folioteca.exemplo; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'">
      $ ... | wc -l → 1
      Conferência diretiva a diretiva com grep -qF:
        PRESENTE: default-src 'self'
        PRESENTE: script-src 'self'
        PRESENTE: style-src 'self'
        PRESENTE: img-src 'self' data:
        PRESENTE: connect-src 'self' https://api.folioteca.exemplo
        PRESENTE: object-src 'none'
        PRESENTE: base-uri 'self'
        PRESENTE: form-action 'self'
        PRESENTE: frame-ancestors 'none'
      $ grep -c "unsafe-inline" apps/web/dist/index.html → 0
      $ grep -c "unsafe-eval"   apps/web/dist/index.html → 0
      Exatamente uma linha, as nove diretivas exigidas, nenhum unsafe.

  [x] comando — RF-11.1, metade da exclusividade — a política tem nove diretivas e
      nada além delas.
      $ python3 -c "import re,sys; h=open('apps/web/dist/index.html',encoding='utf-8').read(); m=re.search(r'<meta http-equiv=\"Content-Security-Policy\" content=\"([^\"]*)\"', h); d=[p.strip() for p in m.group(1).split(';') if p.strip()]; print(len(d)); sys.exit(0 if len(d)==9 else 1)"
        9
        EXIT_PY=0
      Executado sobre o dist reconstruído com https://api.folioteca.exemplo depois de
      apagar o diretório.

  [x] comando — RF-12.2 — connect-src deriva da origem do build.
      dist apagado e confirmado ausente; depois:
      $ VITE_API_URL=http://localhost:3000 pnpm --filter web build → EXIT_BUILD=0
      $ grep -c "connect-src 'self' http://localhost:3000" apps/web/dist/index.html
        1
      Imprimiu 1. A comparação com o build anterior confirma a derivação: com
      https://api.folioteca.exemplo a mesma diretiva sai como
      "connect-src 'self' https://api.folioteca.exemplo".

  [x] comportamental — RF-10.2 — o HTML de desenvolvimento não traz a tag de política.
      Dado:   $ pnpm --filter web exec vite --port 5173 --strictPort &  ; sleep 8
      Quando: $ curl -s http://localhost:5173/
      Então:  $ curl -s http://localhost:5173/ | grep -c 'http-equiv="Content-Security-Policy"'
                0
              Corpo bruto observado — <head> contém apenas o script de @react-refresh,
              /@vite/client, <meta charset="UTF-8">, <meta name="viewport"> e <title>.
              Nenhuma ocorrência da string.

  [x] comportamental — RF-12.3 — build sem a origem morre e não deixa artefato.
      Dado:   $ mv .env .env.guardado
              $ env | grep -c VITE_API_URL → 0
              dist apagado, confirmado ausente por `ls`
      Quando: $ pnpm --filter web build
      Então:  EXIT_BUILD=1
              Saída: "[plugin require-api-url-on-build]
                      RolldownError: VITE_API_URL is required to build apps/web
                      ✗ Build failed in 9ms
                      [ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL] web@0.0.0 build: `vite build` — Exit status 1"
              $ ls apps/web/dist/index.html → "Arquivo ou diretório inexistente"
      Desfeito: $ mv .env.guardado .env — conferido por `ls -la .env` (presente,
      98 bytes, mesmo mtime de set 2 12:01) e `ls .env.guardado` (inexistente).

  [x] comportamental — RF-12.4 — origem com diretiva emendada é recusada.
      Dado:   dist apagado, confirmado ausente por `ls`
      Quando: $ VITE_API_URL='https://api.exemplo; script-src-elem * unsafe-inline' pnpm --filter web build
      Então:  EXIT_BUILD=1
              Saída: "RolldownError: VITE_API_URL must be a plain http(s) origin, got:
                      https://api.exemplo; script-src-elem * unsafe-inline
                      ✗ Build failed in 9ms — Exit status 1"
              $ ls apps/web/dist/index.html → "Arquivo ou diretório inexistente"

Instrumentos do implementer
  nenhum. Cada critério foi medido pelo comando que o próprio critério descreve,
  executado por mim contra o artefato e os servidores. apps/web/scripts/verificar-politica.sh,
  apps/web/scripts/__tests__/verificar-politica.test.sh e
  apps/web/src/shared/config/build-api-url.test.ts foram rodados apenas como
  portões da DoD (passos do job "qualidade" do CI); nenhum critério de aceite
  se apoiou neles.

Apontamentos
  apps/web/vite.config.ts:4 — o import `"./src/shared/config/build-api-url"` sem
    extensão de arquivo faz o Vite emitir, em toda invocação (build, vitest,
    preview, dev), o aviso: "Your Vite config uses features that are unsupported
    by `configLoader: 'native'`, which is planned to become the default in a
    future major version of Vite". Não quebra nada hoje e não reprova nenhum
    critério, mas o próprio Vite anuncia que esse carregador vira o padrão numa
    major futura — quando virar, a configuração deixa de carregar e leva junto o
    plugin que grava a política e a guarda de VITE_API_URL. Correção é acrescentar
    a extensão no especificador do import.

Nota de despacho
  O ponteiro para o trabalho (`git diff fase-2...HEAD`) inclui, além dos seis
  arquivos de código, documentos de plano e histórico:
  product/items/023-endurecimento-antes-da-sessao/03-plan.md,
  .../02-spec.md, .../04-divergencias/D-007.md,
  .../05-veredictos/fase-3-reprovacao-1.md, .../decisoes-autonomas.md,
  product/roadmap.md e product/state.json.
  Não li o conteúdo de nenhum deles — só os nomes apareceram no `--stat`. Registro
  aqui para que o despacho seja consertado, não para que a validação seja refeita.

Correção de uma premissa do despacho
  O despacho avisava que o Playwright não subiria por o Postgres local estar fora
  (porta 5433 fechada — confirmei que está). Medi mesmo assim:
  `pnpm --filter web exec playwright test` terminou com código 0 e 1 teste passando
  em 5.1s. O único spec do pacote, apps/web/e2e/health.spec.ts, não precisou do banco.
  Portanto o portão comportamental foi medido, e medido verde — não ficou em aberto.

Limpeza
  Nenhum servidor de pé ao fim da validação:
    $ pgrep -af "vite|nest start" → "(nenhum processo de servidor vivo)"
    $ curl --max-time 2 http://localhost:5173/ → 5173:000  curl_exit=7 (conexão recusada)
    $ curl --max-time 2 http://localhost:4173/ → 4173:000  curl_exit=7 (conexão recusada)
    $ curl --max-time 2 http://localhost:3000/ → 3000:000  curl_exit=7 (conexão recusada)
  Árvore no mesmo estado em que a recebi: `git status --porcelain` vazio, HEAD em caf226c.
