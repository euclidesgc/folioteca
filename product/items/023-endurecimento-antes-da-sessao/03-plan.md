# Plano — 023-endurecimento-antes-da-sessao · Endurecimento antes da sessão

**Item:** `023-endurecimento-antes-da-sessao` · **Spec:** `02-spec.md` (aprovada
em 03/09/2026, RF-01 a RF-25) · **PRD:** `01-prd.md` · **Decisões fixadas:**
`decisoes-autonomas.md` (D1 a D14) · **Divergência ratificada:**
`04-divergencias/D-001.md`

## Objetivo

Ao fim das cinco fases, a API atende uma lista de origens declarada em
`WEB_ORIGIN` e ecoa só a origem que está nela; as duas frentes de navegador
respondem com o conjunto declarado de cabeçalhos, o hotsite com política de
conteúdo por nonce e o app com a política dentro do artefato de build; um portão
versionado varre segredo nas fontes rastreadas e nos três artefatos de build e
reprova nomeando o que não conseguiu medir; e a cadeia de suprimentos espera sete
dias por versão nova e fixa toda ação do CI em SHA, com rotina que as atualiza.

A quebra é **por frente e por contrato de dado**, nesta ordem: cada uma das três
primeiras fases fecha uma superfície inteira num diretório só — `apps/api`,
`apps/site`, `apps/web` —, porque são três decisões de política independentes que
não compartilham arquivo; a quarta vem depois das três porque o portão de segredo
varre exatamente os artefatos que elas produzem, e um portão escrito antes de
haver o que varrer se verifica contra o vazio; a quinta vem por último porque
edita os mesmos dois arquivos que a quarta — `scripts/gates/gates_runner.sh` e
`.github/workflows/portoes.yml` — e porque fixar as 27 referências `uses:` em SHA
depois de o passo do portão de segredo já estar escrito evita fixar duas vezes o
mesmo fluxo.

---

## Fase 1 — A API decide a origem e recebe `helmet` (api)

**Branch:** `023-endurecimento-antes-da-sessao/fase-1-origens-e-helmet`, nascida
de `develop`.

**Objetivo da fase:** a API interpreta `WEB_ORIGIN` como lista, valida cada item
antes de abrir a porta, ecoa apenas a origem que está na lista e responde com o
subconjunto de cabeçalhos que vale para resposta JSON.

**Arquivos tocados:** `apps/api/**`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-01.1 e RF-01.2 — existe
      `apps/api/src/config/web-origins.ts` exportando a função
      `parseWebOrigins(value: string): string[]` e a função
      `isWebOriginList(value: string): boolean`;
      `apps/api/src/config/environment.schema.ts` importa `isWebOriginList` desse
      arquivo, aplica-a à chave `WEB_ORIGIN` dentro de um `.custom(`, mantém o
      valor padrão `http://localhost:5173`, e não contém mais nenhuma ocorrência
      de `.pattern(`; `apps/api/src/cors.ts` importa `parseWebOrigins` e passa o
      resultado dela em `origin:`.
- [ ] `estrutural` — RF-09.1 — `apps/api/package.json` declara `helmet` em
      `dependencies` com versão exata (sem `^` e sem `~`);
      `apps/api/src/bootstrap.ts` importa `helmet` e a linha que contém
      `app.use(helmet(` aparece **antes** da linha que contém `configureCors(`.
- [ ] `estrutural` — RF-02, RF-03 e RF-09 — existe
      `apps/api/test/cors.e2e-spec.ts` contendo as strings
      `https://app.folioteca.exemplo`, `https://intruso.exemplo` e
      `access-control-allow-origin`; existe
      `apps/api/test/security-headers.e2e-spec.ts` contendo as strings
      `x-content-type-options`, `nosniff`, `x-powered-by`,
      `content-security-policy` e `strict-transport-security`.
- [ ] `comportamental` — RF-02.1 e RF-02.2
      *Dado* `apps/api` construído por `pnpm --filter api build`, e a
      API de pé por
      `NODE_ENV=test DATABASE_URL=postgresql://localhost/x PORT=3000 WEB_ORIGIN='http://localhost:5173,https://app.folioteca.exemplo' node apps/api/dist/main.js &`
      executado na raiz do repositório, com 5 segundos de espera
      *Quando*
      `curl -sD- -o /dev/null -H 'Origin: https://app.folioteca.exemplo' http://localhost:3000/health`
      é executado
      *Então* a primeira linha da saída contém `200`, a saída contém — sem
      distinguir maiúscula de minúscula — a linha
      `access-control-allow-origin: https://app.folioteca.exemplo`, e nenhuma
      linha de `access-control-allow-origin` contém `*`
- [ ] `comportamental` — RF-03.1
      *Dado* a mesma API de pé em `http://localhost:3000` com
      `WEB_ORIGIN='http://localhost:5173,https://app.folioteca.exemplo'`
      *Quando*
      `curl -sD- -o /dev/null -H 'Origin: https://intruso.exemplo' http://localhost:3000/health`
      é executado
      *Então* a primeira linha da saída contém `200` e a saída não contém nenhuma
      linha começando por `access-control-allow-origin`, em qualquer combinação
      de maiúscula e minúscula
- [ ] `comportamental` — RF-01.3
      *Dado* `apps/api` construído e a API de pé por
      `NODE_ENV=test DATABASE_URL=postgresql://localhost/x PORT=3000 WEB_ORIGIN='http://localhost:5173' node apps/api/dist/main.js &`,
      com 5 segundos de espera
      *Quando*
      `curl -sD- -o /dev/null -H 'Origin: http://localhost:5173' http://localhost:3000/health`
      e
      `curl -sD- -o /dev/null -H 'Origin: https://app.folioteca.exemplo' http://localhost:3000/health`
      são executados em seguida
      *Então* a saída do primeiro contém a linha
      `access-control-allow-origin: http://localhost:5173` e a saída do segundo
      não contém nenhuma linha começando por `access-control-allow-origin`
- [ ] `comando` — RF-04.1 e RF-04.2 — com `apps/api` construído por
      `pnpm --filter api build`, o comando
      `NODE_ENV=test DATABASE_URL=postgresql://localhost/x WEB_ORIGIN='http://localhost:5173,https://app.exemplo/' node apps/api/dist/main.js`
      termina com código de saída diferente de zero, a saída contém `WEB_ORIGIN`,
      e `curl -s -o /dev/null http://localhost:3000/health` executado em
      seguida termina com código de saída `7`
- [ ] `comportamental` — RF-09.2, RF-09.3 e RF-09.4
      *Dado* `apps/api` construído e a API de pé por
      `NODE_ENV=test DATABASE_URL=postgresql://localhost/x PORT=3000 WEB_ORIGIN='http://localhost:5173' node apps/api/dist/main.js &`,
      com 5 segundos de espera
      *Quando* `curl -sD- -o /dev/null http://localhost:3000/health` é
      executado
      *Então* a saída contém, sem distinguir maiúscula de minúscula, a linha
      `x-content-type-options: nosniff`, e não contém nenhuma linha começando por
      `x-powered-by` nem nenhuma linha começando por `content-security-policy`
- [ ] `comportamental` — decisão autônoma registrada em `decisoes-autonomas.md`:
      a API não emite HSTS fora de produção
      *Dado* `apps/api` construído e a API de pé por
      `NODE_ENV=test DATABASE_URL=postgresql://localhost/x PORT=3000 WEB_ORIGIN='http://localhost:5173' node apps/api/dist/main.js &`,
      com 5 segundos de espera
      *Quando* `curl -sD- -o /dev/null http://localhost:3000/health` é
      executado
      *Então* a saída não contém nenhuma linha começando por
      `strict-transport-security`, em qualquer combinação de maiúscula e minúscula

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 1.1 Criar `apps/api/src/config/web-origins.ts` com duas funções exportadas.
      Assinaturas: `export function parseWebOrigins(value: string): string[]` —
      separa por vírgula, apara espaço de cada item e descarta item vazio;
      `export function isWebOriginList(value: string): boolean` — devolve
      verdadeiro quando a lista tem ao menos um item e **todo** item casa
      `/^https?:\/\/[^/]+$/`.
      Justificativa: o schema de configuração e o CORS passam a ler a mesma
      regra a partir de um arquivo só; escrever a separação em dois lugares é
      exatamente o que faz o schema aprovar um valor que o CORS depois não
      entende, e a origem que nunca casa em silêncio é o defeito que RF-04
      recusa.
- [ ] 1.2 Modificar `apps/api/src/config/environment.schema.ts`: trocar
      `.pattern(ORIGIN_PATTERN)` por `.custom()` que reprova o valor quando
      `isWebOriginList` devolve falso, remover a constante local
      `ORIGIN_PATTERN`, e manter `.default("http://localhost:5173")`.
      Justificativa: RF-01.2 manda validar **item a item**, e o padrão aplicado à
      string inteira reprova qualquer lista com vírgula; o `.custom()` de Joi cai
      no ramo que `apps/api/src/main.ts` já imprime como `<nome> is invalid`,
      montado de `detail.path`, e é isso que faz a saída nomear `WEB_ORIGIN` sem
      vazar o valor validado (RF-04.2).
- [ ] 1.3 Modificar `apps/api/src/cors.ts` para passar
      `origin: parseWebOrigins(config.get("WEB_ORIGIN", { infer: true }))`, e
      reescrever no presente o comentário de decisão que já está no arquivo, para
      que ele explique o array de N origens em vez do array de um elemento.
      Justificativa: é o array que faz o pacote `cors` comparar o `Origin`
      recebido, ecoá-lo quando bate e omitir o cabeçalho quando não bate (RF-02.2
      e RF-03.1); a string faria o pacote devolver sempre o mesmo valor sem olhar
      a requisição. Regra 7: documento canônico não tem cicatriz, e comentário de
      decisão é documento.
- [ ] 1.4 Modificar `apps/api/package.json` acrescentando `helmet` a
      `dependencies`, em versão exata, e rodar `pnpm install` na raiz para
      atualizar `pnpm-lock.yaml`.
      Justificativa: regra 15 — sem dependência não declarada; e RF-09.1 cobra a
      declaração, não o efeito. A versão exata segue a forma das outras onze
      dependências já declaradas no mesmo arquivo.
- [ ] 1.5 Modificar `apps/api/src/bootstrap.ts` registrando
      `app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: config.get("NODE_ENV", { infer: true }) === "production" ? { maxAge: 31536000, includeSubDomains: true } : false }))`
      imediatamente antes da chamada a `configureCors(app, config)`, com um
      comentário de decisão de uma linha sobre a HSTS condicional.
      Justificativa: `contentSecurityPolicy: false` porque a API não serve HTML e
      RF-09.4 proíbe o cabeçalho; a HSTS fica ligada só em produção porque,
      emitida em `http://localhost:3000`, ela fixa no navegador de quem
      desenvolve uma regra que persiste em cache — é a mesma razão que RF-06.2
      escreve para o hotsite, e a spec não a proíbe na API, então a escolha é
      deste plano e precisa ficar legível no arquivo (regra 11: o porquê que o
      código não mostra). O registro vem antes do CORS porque a resposta de
      `OPTIONS` que o `enableCors` encerra também precisa dos cabeçalhos.
- [ ] 1.6 Criar `apps/api/test/cors.e2e-spec.ts` com Supertest e três casos:
      `WEB_ORIGIN` com duas origens ecoando `https://app.folioteca.exemplo`;
      `WEB_ORIGIN` com duas origens sem devolver cabeçalho para
      `https://intruso.exemplo`; e `WEB_ORIGIN` com uma origem só, sem vírgula,
      ecoando `http://localhost:5173` e recusando
      `https://app.folioteca.exemplo`. Cada caso define `process.env.WEB_ORIGIN`
      antes de chamar `createApp()`.
      Justificativa: `apps/api/test/health.e2e-spec.ts` já usa `createApp()`, que
      é a mesma fábrica que `main.ts` chama, então o teste exercita a montagem de
      produção e não uma réplica dela; `process.env` tem precedência sobre o
      `envFilePath` que `apps/api/src/app.module.ts` declara, o que permite variar
      a lista por caso sem tocar o `.env` da raiz.
- [ ] 1.7 Criar `apps/api/test/security-headers.e2e-spec.ts` com Supertest,
      afirmando em `GET /health`: `x-content-type-options` igual a `nosniff`,
      `x-powered-by` ausente, `content-security-policy` ausente e
      `strict-transport-security` ausente com `NODE_ENV` diferente de
      `production`.
      Justificativa: o CI já roda `pnpm --filter api run test:integration` no job
      `integracao` de `.github/workflows/ci-nestjs.yml`, então o subconjunto de
      RF-09 continua cobrado depois que esta fase fechar, sem passo novo de
      fluxo.
- [ ] 1.8 Modificar `apps/api/test/health.e2e-spec.ts` removendo os dois casos de
      CORS que passam a viver em `apps/api/test/cors.e2e-spec.ts`.
      Justificativa: a suíte de saúde volta a medir saúde; manter os dois casos
      nos dois arquivos duplicaria a asserção e faria a mudança seguinte de CORS
      exigir edição em dois lugares, que é como um dos dois começa a mentir.

---

## Fase 2 — O hotsite responde com o conjunto constante e com política por nonce (site)

**Branch:** `023-endurecimento-antes-da-sessao/fase-2-hotsite-nonce`, nascida da
branch da Fase 1.

**Objetivo da fase:** o hotsite emite os quatro cabeçalhos constantes em toda
resposta, acrescenta HSTS só em build de produção, e emite uma política de
conteúdo com nonce novo a cada requisição, estampado nos `<script>` embutidos da
mesma resposta.

**Arquivos tocados:** `apps/site/**` e `.github/workflows/ci-site.yml`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-05.1 e RF-06.1 — `apps/site/next.config.ts` exporta uma
      configuração com a chave `headers`, e o arquivo contém as strings
      `X-Content-Type-Options`, `nosniff`, `Referrer-Policy`,
      `strict-origin-when-cross-origin`, `X-Frame-Options`, `DENY`,
      `Permissions-Policy`, `camera=(), microphone=(), geolocation=()`,
      `Strict-Transport-Security`, `max-age=31536000; includeSubDomains` e
      `process.env.NODE_ENV === "production"`; e não contém a string `preload`.
- [ ] `estrutural` — RF-08.1 — existe `apps/site/src/middleware.ts` exportando
      `export function middleware(request: NextRequest): NextResponse` e
      `export const config` com a chave `matcher`; o arquivo contém as strings
      `Content-Security-Policy`, `crypto.getRandomValues` e `nonce-`.
- [ ] `comando` — RF-08.3, RF-24.2 e RF-24.3 —
      `grep -nE "NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_SITE_URL|unsafe-inline|unsafe-eval" apps/site/src/middleware.ts apps/site/next.config.ts`
      não imprime nenhuma linha e termina com código de saída `1`.
- [ ] `comportamental` — RF-05.1, RF-06.1 e RF-06.3
      *Dado* `pnpm --filter site build` executado com código de saída
      zero na raiz do repositório, e `pnpm --filter site start &` em execução com
      10 segundos de espera, respondendo em `http://localhost:3001`
      *Quando* `curl -sD- -o /dev/null http://localhost:3001/` é
      executado
      *Então* a saída contém, sem distinguir maiúscula de minúscula, as linhas
      `x-content-type-options: nosniff`,
      `referrer-policy: strict-origin-when-cross-origin`,
      `x-frame-options: DENY`,
      `permissions-policy: camera=(), microphone=(), geolocation=()` e
      `strict-transport-security: max-age=31536000; includeSubDomains`, e nenhuma
      linha da saída contém a palavra `preload`
- [ ] `comportamental` — RF-06.2
      *Dado* `pnpm --filter site dev &` em execução na raiz do repositório, com
      15 segundos de espera, respondendo em `http://localhost:3001`
      *Quando* `curl -sD- -o /dev/null http://localhost:3001/` é
      executado
      *Então* a saída contém a linha `x-content-type-options: nosniff` e não
      contém nenhuma linha começando por `strict-transport-security`, em qualquer
      combinação de maiúscula e minúscula
- [ ] `comportamental` — RF-08.2, RF-24.1, RF-24.2 e RF-24.3
      *Dado* `pnpm --filter site build` executado com código de saída
      zero e `pnpm --filter site start &` em execução, respondendo em
      `http://localhost:3001`
      *Quando*
      `curl -sD- -o /dev/null http://localhost:3001/ | grep -i '^content-security-policy:'`
      é executado
      *Então* a linha impressa contém `default-src 'self'`, `style-src 'self'`,
      `img-src 'self' data:`, `connect-src 'self'`, `object-src 'none'`,
      `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'` e
      `script-src 'self' 'nonce-`, e não contém `'unsafe-inline'` nem
      `'unsafe-eval'`
- [ ] `comportamental` — RF-23.1
      *Dado* `pnpm --filter site build` executado com código de saída
      zero e `pnpm --filter site start &` em execução, respondendo em
      `http://localhost:3001`
      *Quando*
      `curl -sD- -o /dev/null http://localhost:3001/ | grep -io "nonce-[A-Za-z0-9+/=_-]*"`
      é executado duas vezes seguidas
      *Então* cada execução imprime ao menos uma linha, e o valor impresso na
      primeira execução é diferente do valor impresso na segunda
- [ ] `comportamental` — RF-23.2
      *Dado* `pnpm --filter site build` executado com código de saída
      zero e `pnpm --filter site start &` em execução, respondendo em
      `http://localhost:3001`
      *Quando*
      `curl -s -D /tmp/politica-cabecalho.txt -o /tmp/politica-corpo.html http://localhost:3001/`
      é executado uma única vez
      *Então* `/tmp/politica-cabecalho.txt` contém uma ocorrência de
      `'nonce-<valor>'` na linha de `content-security-policy`, e
      `/tmp/politica-corpo.html` contém `nonce="<valor>"` com exatamente esse
      mesmo `<valor>`, em pelo menos uma tag `<script`
- [ ] `comando` — RF-23.3 — existe `apps/site/scripts/verificar-politica.sh`, e
      `bash -c 'source apps/site/scripts/verificar-politica.sh; exige_nonces_distintos abc123 abc123'`
      termina com código de saída diferente de zero e imprime uma saída que
      contém `abc123`; enquanto
      `bash -c 'source apps/site/scripts/verificar-politica.sh; exige_nonces_distintos abc123 def456'`
      termina com código de saída zero.
- [ ] `comando` — RF-25.1 — `pnpm --filter site build > /tmp/site-build.log 2>&1`
      termina com código de saída zero — a redireção é direta, e não
      `| tee`, porque num pipeline sem `pipefail` o código de saída é o do `tee`,
      que sai zero por ter conseguido escrever o arquivo mesmo quando o build
      quebrou; em seguida,
      `grep -E 'ƒ[[:space:]]+/[[:space:]]*$' /tmp/site-build.log` imprime ao menos
      uma linha e termina com código de saída zero; e
      `grep -E '○[[:space:]]+\(Static\)' /tmp/site-build.log` não imprime nenhuma
      linha e termina com código de saída `1`. A segunda asserção é a que morde o
      plural: o Next só imprime a legenda `○  (Static)` quando sobrou ao menos uma
      rota prerenderizada estaticamente, e a tabela de hoje tem duas linhas — `/`
      e `/_not-found` —, as duas alcançadas pelo `matcher` do middleware.

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 2.1 Modificar `apps/site/next.config.ts` acrescentando `async headers()`
      que devolve uma única entrada com `source: "/:path*"` e a lista de
      cabeçalhos: os quatro constantes sempre, e
      `Strict-Transport-Security: max-age=31536000; includeSubDomains`
      acrescentado apenas quando `process.env.NODE_ENV === "production"`.
      Justificativa: os quatro não variam com a requisição, então continuam onde
      o PRD os pôs — só a política mudou de lugar (D-001); a HSTS é condicional
      porque emitida em `http://localhost` ela fixa no navegador de quem
      desenvolve uma regra que persiste em cache (RF-06.2), e `preload` fica fora
      porque entra na lista embutida dos navegadores, é caro de desfazer e não há
      domínio escolhido (RF-06.3).
- [ ] 2.2 Criar `apps/site/src/middleware.ts` com
      `export function middleware(request: NextRequest): NextResponse` e
      `export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }`.
      A função gera 16 bytes com `crypto.getRandomValues(new Uint8Array(16))`,
      codifica em base64, monta a política com
      `script-src 'self' 'nonce-<valor>'` e as oito diretivas de RF-24.1,
      constrói `const requestHeaders = new Headers(request.headers)` gravando
      nele `x-nonce` **e** `Content-Security-Policy`, devolve
      `NextResponse.next({ request: { headers: requestHeaders } })` e grava
      `Content-Security-Policy` também na resposta.
      Justificativa: o nonce precisa chegar ao renderizador, e o cabeçalho
      `Content-Security-Policy` **de requisição** é o mecanismo pelo qual o Next
      estampa o atributo `nonce` nos `<script>` embutidos que o App Router usa
      para hidratar; gravá-lo só na resposta produz um nonce que existe no
      cabeçalho e não existe no HTML, que é exatamente o defeito oposto que
      RF-23.2 morde e que quebra a hidratação do mesmo jeito que a política sem
      nonce quebraria (D-001). O `matcher` alcança as duas rotas da tabela de
      hoje, `/` e `/_not-found`, e é o que faz a legenda `○  (Static)` sumir da
      saída do build.
- [ ] 2.3 Modificar `apps/site/src/app/layout.tsx` acrescentando
      `export const dynamic = "force-dynamic";`, com comentário de decisão de uma
      linha.
      Justificativa: o nonce muda a cada requisição, e o HTML de uma rota
      prerenderizada é gerado uma vez no build — serviria o nonce de outra
      requisição, que é o mesmo que nonce ausente. Renderizar por requisição é o
      custo aceito de D-001, e RF-25.1 existe justamente para que esse custo
      apareça na tabela de rotas do build em vez de ser descoberto por quem
      cuidar de desempenho depois. A configuração de segmento no layout raiz
      alcança todas as rotas abaixo dele.
- [ ] 2.4 Criar `apps/site/scripts/verificar-politica.sh`, que recebe o modo
      (`producao` | `desenvolvimento`) como primeiro argumento, carrega
      `source scripts/gates/medir.sh`, sobe o servidor correspondente
      (`pnpm --filter site build && pnpm --filter site start`, ou
      `pnpm --filter site dev`), espera a porta `3001` responder, faz duas
      requisições a `GET /` guardando cabeçalho e corpo de cada uma, e verifica:
      os quatro cabeçalhos constantes presentes; `Strict-Transport-Security`
      presente somente no modo `producao` e sem `preload`; as oito diretivas de
      RF-24.1 na política; ausência de `'unsafe-inline'` e de `'unsafe-eval'`;
      os dois nonces distintos; e o nonce do cabeçalho estampado no atributo
      `nonce` de ao menos um `<script>` do corpo da mesma resposta. O script
      imprime o que mediu — quantos cabeçalhos conferiu, os dois nonces e quantos
      `<script>` do corpo carregam o atributo — e derruba o servidor num `trap`.
      A comparação dos nonces mora na função
      `exige_nonces_distintos <primeiro> <segundo>`, e o corpo executável do
      script fica atrás de uma guarda `[ "${BASH_SOURCE[0]}" = "$0" ]`.
      Justificativa: `apps/site` não tem pack nem runner de teste, e tudo o que a
      spec cobra aqui é observável na resposta HTTP — acrescentar um runner só
      para este item traria dependência e configuração que nenhuma outra frente
      usa. `medir.sh` já é onde moram as asserções que reprovam por não ter
      conseguido medir, e a guarda de `BASH_SOURCE` é o que permite provar a
      função de comparação sem subir servidor, que é o único jeito de provocar o
      caso de nonce repetido que RF-23.3 descreve.
- [ ] 2.5 Criar `apps/site/scripts/__tests__/verificar-politica.test.sh` cobrindo
      `exige_nonces_distintos`: dois valores iguais reprovam nomeando o valor;
      dois valores diferentes aprovam; argumento vazio reprova.
      Justificativa: mesma forma de `scripts/gates/__tests__/medir.test.sh`, que
      é a convenção já estabelecida aqui para provar que uma asserção morde — sem
      ela, a verificação da política é uma peça que ninguém verificou.
- [ ] 2.6 Modificar `.github/workflows/ci-site.yml` acrescentando, depois do
      passo `Build`, um passo que roda
      `bash apps/site/scripts/verificar-politica.sh producao` e um passo que roda
      `bash apps/site/scripts/__tests__/verificar-politica.test.sh`.
      Justificativa: RF-23.3 fala de "a verificação da política" como algo que
      **reprova**, e verificação que nunca roda de novo não reprova nada; o fluxo
      já constrói o hotsite neste job, então o custo é subir o servidor que o
      build acabou de produzir. Nenhum passo novo acrescenta `uses:`, e a
      contagem de RNF-01 continua 27.

---

## Fase 3 — O app carrega a política no artefato e endurece os dois servidores (web)

**Branch:** `023-endurecimento-antes-da-sessao/fase-3-app-politica-e-servidores`,
nascida da branch da Fase 2.

**Objetivo da fase:** os dois servidores do Vite respondem com os quatro
cabeçalhos constantes e sem HSTS, e o build grava no `index.html` uma política de
conteúdo cujo `connect-src` é derivado de `VITE_API_URL` no instante do build.

**Arquivos tocados:** `apps/web/**` e `.github/workflows/ci-react.yml`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-07.1, RF-07.2 e RF-07.3 — `apps/web/vite.config.ts`
      declara uma única constante com os quatro pares de cabeçalho
      (`X-Content-Type-Options: nosniff`,
      `Referrer-Policy: strict-origin-when-cross-origin`,
      `X-Frame-Options: DENY`,
      `Permissions-Policy: camera=(), microphone=(), geolocation=()`), e essa
      mesma constante é referenciada pelo nome tanto em `server:` quanto em
      `preview:`, na chave `headers`; o arquivo não contém a string
      `Strict-Transport-Security`.
- [ ] `comando` — RF-07.1 e RF-07.3 — a sequência abaixo, executada na raiz do
      repositório, imprime as quatro linhas de cabeçalho constante e nenhuma
      linha de `strict-transport-security`:
      `pnpm --filter web exec vite --port 5173 --strictPort > /tmp/web-dev.log 2>&1 &`
      seguido de `sleep 8`, de
      `curl -sD- -o /dev/null http://localhost:5173/ | grep -iE 'x-content-type-options|referrer-policy|x-frame-options|permissions-policy|strict-transport-security'`
      e de `pkill -f 'vite --port 5173'`. A saída do `grep` contém
      `x-content-type-options: nosniff`,
      `referrer-policy: strict-origin-when-cross-origin`,
      `x-frame-options: DENY` e
      `permissions-policy: camera=(), microphone=(), geolocation=()`, e não
      contém `strict-transport-security`.
- [ ] `comando` — RF-07.2 e RF-07.3 — com
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
      executado com código de saída zero, a sequência
      `pnpm --filter web exec vite preview --port 4173 --strictPort > /tmp/web-preview.log 2>&1 &`
      seguida de `sleep 6`, de
      `curl -sD- -o /dev/null http://localhost:4173/ | grep -iE 'x-content-type-options|referrer-policy|x-frame-options|permissions-policy|strict-transport-security'`
      e de `pkill -f 'vite preview --port 4173'` imprime
      `x-content-type-options: nosniff`,
      `referrer-policy: strict-origin-when-cross-origin`,
      `x-frame-options: DENY` e
      `permissions-policy: camera=(), microphone=(), geolocation=()`, e não
      imprime nenhuma linha de `strict-transport-security`.
- [ ] `comando` — RF-07.4 — com `rm -rf apps/web/dist` e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
      executados nessa ordem,
      `grep -rlE 'X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy' apps/web/dist`
      não imprime nenhum caminho e termina com código de saída `1`.
- [ ] `comando` — RF-10.1, RF-11.1, RF-11.2, RF-11.3 e RF-12.1 — com
      `rm -rf apps/web/dist` e
      `VITE_API_URL=https://api.folioteca.exemplo pnpm --filter web build`
      executados nessa ordem,
      `grep -o '<meta http-equiv="Content-Security-Policy"[^>]*>' apps/web/dist/index.html`
      imprime exatamente uma linha, e essa linha contém `default-src 'self'`,
      `script-src 'self'`, `style-src 'self'`, `img-src 'self' data:`,
      `connect-src 'self' https://api.folioteca.exemplo`, `object-src 'none'`,
      `base-uri 'self'`, `form-action 'self'` e `frame-ancestors 'none'`, e não
      contém `unsafe-inline` nem `unsafe-eval`.
- [ ] `comando` — RF-11.1, metade da exclusividade — o comando
      `python3 -c "import re,sys; h=open('apps/web/dist/index.html',encoding='utf-8').read(); m=re.search(r'<meta http-equiv=\"Content-Security-Policy\" content=\"([^\"]*)\"', h); d=[p.strip() for p in m.group(1).split(';') if p.strip()]; print(len(d)); sys.exit(0 if len(d)==9 else 1)"`,
      executado na raiz do repositório depois de `rm -rf apps/web/dist` e
      `VITE_API_URL=https://api.folioteca.exemplo pnpm --filter web build`,
      imprime `9` e termina com código de saída zero. A spec exige **exatamente**
      as nove diretivas, e a asserção de inclusão do critério anterior aprovaria
      uma décima diretiva acrescentada em silêncio.
- [ ] `comando` — RF-12.2 — com `rm -rf apps/web/dist` e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
      executados nessa ordem,
      `grep -c "connect-src 'self' http://localhost:3000" apps/web/dist/index.html`
      imprime `1`.
- [ ] `comportamental` — RF-10.2
      *Dado* `apps/web` com o servidor de desenvolvimento de pé por
      `pnpm --filter web exec vite --port 5173 --strictPort &` na raiz do
      repositório, com 8 segundos de espera
      *Quando* `curl -s http://localhost:5173/` é executado
      *Então* a saída não contém a string `http-equiv="Content-Security-Policy"`
- [ ] `comportamental` — RF-12.3
      *Dado* o arquivo `.env` da raiz do repositório movido para `.env.guardado`
      por `mv .env .env.guardado`, nenhuma variável `VITE_API_URL` no ambiente, e
      `rm -rf apps/web/dist` executado
      *Quando* `pnpm --filter web build` é executado na raiz
      *Então* o comando termina com código de saída diferente de zero, a saída
      contém `VITE_API_URL is required to build apps/web`, e
      `apps/web/dist/index.html` não existe — desfeito em seguida por
      `mv .env.guardado .env`

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 3.1 Modificar `apps/web/vite.config.ts` declarando uma constante única
      `const SECURITY_HEADERS = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY", "Permissions-Policy": "camera=(), microphone=(), geolocation=()" }`
      e usando-a em `server.headers` e em `preview.headers`; acrescentar
      `preview: { port: 4173, strictPort: true, headers: SECURITY_HEADERS }`.
      Justificativa: uma constante só porque duas listas divergem na primeira
      alteração, e a divergência entre desenvolvimento e pré-visualização é
      invisível até alguém abrir o segundo; `strictPort` no `preview` pela mesma
      razão que ele já está no `server` — sem ele o Vite escorrega para a porta
      seguinte, e um `curl` na porta nomeada mediria ausência de cabeçalho onde
      não há servidor, que é aprovar por não ter medido.
- [ ] 3.2 Criar, no mesmo `apps/web/vite.config.ts` e ao lado de
      `requireApiUrlOnBuild`, o plugin local
      `function injectContentSecurityPolicyOnBuild(): Plugin`, que guarda
      `config.command` e `config.env.VITE_API_URL` em `configResolved` e, em
      `transformIndexHtml`, injeta em `<head>` a tag
      `<meta http-equiv="Content-Security-Policy" content="…">` **apenas** quando
      `command === "build"`; registrá-lo em `plugins` depois de
      `requireApiUrlOnBuild()`.
      Justificativa: a política de produção proíbe o script embutido de que o
      recarregamento a quente do Vite depende, e uma meta válida nos dois lugares
      seria uma política frouxa nos dois (RF-10.2); ler a origem de
      `config.env.VITE_API_URL` é ler a mesma fonte que `requireApiUrlOnBuild` já
      lê, de modo que a política e a guarda não possam divergir — que é a razão
      de RF-12 existir. Registrar depois da guarda garante que o build com a
      variável ausente morre antes de haver política para injetar (RF-12.3).
- [ ] 3.3 Escrever o valor da política como as nove diretivas de RF-11.1
      separadas por `; `, com `connect-src 'self' ${apiUrl}` interpolado da
      variável lida no passo anterior, e nenhuma décima diretiva.
      Justificativa: a lista literal é o contrato de D2 e a spec diz
      **exatamente** nove, o que faz de cada diretiva a mais uma permissão que
      ninguém pediu; `frame-ancestors` fica na meta mesmo sem efeito de
      enquadramento porque RF-11.1 a nomeia e porque o cabeçalho equivalente
      depende do host de produção, que é não-escopo deste item — a diretiva
      escrita hoje é o que a fase de deploy encontra pronta.
- [ ] 3.4 Modificar `.github/workflows/ci-react.yml` acrescentando, logo depois
      do passo `Build` do job `qualidade`, um passo que afirma sobre
      `apps/web/dist/index.html`: a tag `<meta http-equiv="Content-Security-Policy">`
      presente com `connect-src 'self' http://localhost:3000`, com exatamente
      nove diretivas separadas por `;`, sem `unsafe-inline` e sem `unsafe-eval`,
      e nenhum dos quatro cabeçalhos constantes declarado em arquivo nenhum de
      `apps/web/dist`.
      Justificativa: o build do CI já roda com `VITE_API_URL=http://localhost:3000`
      neste job; sem a asserção, RF-10.1, RF-11 e RF-07.4 valem só no dia da fase
      e deixam de valer no primeiro PR que mexer no `index.html` ou no plugin.
      Nenhum passo novo acrescenta `uses:`, e a contagem de RNF-01 continua 27.

---

## Fase 4 — O portão de segredo mede fontes e artefatos (raiz + CI)

**Branch:** `023-endurecimento-antes-da-sessao/fase-4-portao-de-segredo`, nascida
da branch da Fase 3.

**Objetivo da fase:** um portão versionado varre com `gitleaks` os quatro
universos — fontes rastreadas e os três artefatos de build —, declara a contagem
de cada um e a versão que usou, reprova nomeando o que não conseguiu medir, e é
cobrado no runner local e no CI a cada push.

**Arquivos tocados:** `scripts/gates/`, `scripts/ci/`, `.gitleaks.toml`,
`.github/workflows/portoes.yml`, `.github/workflows/ci-nestjs.yml`,
`.github/workflows/ci-react.yml`, `.github/workflows/ci-site.yml`.

**Nota de leitura dos critérios:** onde um critério fala em "os três artefatos
construídos", isso significa os três diretórios `apps/api/dist`,
`apps/site/.next` e `apps/web/dist` existindo com arquivos dentro, produzidos na
raiz do repositório por `pnpm --filter api build`, `pnpm --filter site build` e
`VITE_API_URL=http://localhost:3000 pnpm --filter web build`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-13.2 e RF-13.3 — existe `scripts/gates/segredo.sh`
      contendo a string `source` seguida de `scripts/gates/medir.sh`, a string
      `gitleaks` e a string `--config`; existe `.gitleaks.toml` na raiz do
      repositório, e `git ls-files --error-unmatch .gitleaks.toml`
      termina com código de saída zero.
- [ ] `comando` — RF-13.1, RF-14.1, RF-14.2 e RF-15.1 — com `gitleaks` no `PATH`,
      o `.env` da raiz existindo e ignorado, a árvore sem alteração pendente, e
      `pnpm --filter api build`,
      `pnpm --filter site build` e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
      executados, `bash scripts/gates/segredo.sh` termina com código de
      saída zero e a saída contém uma linha de contagem para cada um dos quatro
      universos, nomeando `git ls-files`, `apps/web/dist`, `apps/site/.next` e
      `apps/api/dist`, com um número maior que zero em cada uma, e uma linha que
      contém a versão de `gitleaks` no formato `<major>.<minor>.<patch>`.
- [ ] `comportamental` — RF-15.2
      *Dado* `gitleaks` no `PATH`, os diretórios `apps/api/dist`,
      `apps/site/.next` e `apps/web/dist` construídos por
      `pnpm --filter api build`, `pnpm --filter site build` e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`, e
      `git add -f .env` executado na raiz do repositório
      *Quando* `bash scripts/gates/segredo.sh` é executado
      *Então* o comando termina com código de saída diferente de zero e a saída
      contém `.env` — desfeito em seguida por `git reset -- .env`
- [ ] `comportamental` — RF-15.3
      *Dado* `gitleaks` no `PATH`, os diretórios `apps/api/dist` e
      `apps/site/.next` construídos, e a sequência
      `openssl genrsa -out /tmp/chave-fixture.pem 2048`, seguida de
      `printf 'const CHAVE = "%s";\n' "$(awk '{printf "%s\\n", $0}' /tmp/chave-fixture.pem)" >> apps/web/src/shared/config/env.ts`,
      executada na raiz do repositório — a chave nasce no instante do teste, e
      nenhum bloco PEM permanece escrito neste documento —, e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
      executado com código de saída zero depois disso
      *Quando* `bash scripts/gates/segredo.sh` é executado
      *Então* o comando termina com código de saída diferente de zero e a saída
      contém ao menos um caminho que começa por `apps/web/dist/` — desfeito em
      seguida por
      `git checkout -- apps/web/src/shared/config/env.ts` e
      `rm -rf apps/web/dist`
- [ ] `comportamental` — RF-16.1 e RF-16.4
      *Dado* os diretórios `apps/api/dist`, `apps/site/.next` e `apps/web/dist`
      construídos por `pnpm --filter api build`, `pnpm --filter site build` e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
      *Quando*
      `env PATH=/usr/bin:/bin bash scripts/gates/segredo.sh` é
      executado numa máquina em que `gitleaks` não está sob `/usr/bin` nem sob
      `/bin`
      *Então* o comando termina com código de saída diferente de zero, e a saída
      contém `gitleaks` e a linha
      `REPROVADO por impossibilidade de medição, não por resultado.`
- [ ] `comportamental` — RF-16.2 e RF-16.4
      *Dado* `gitleaks` no `PATH`, `apps/web/dist` e `apps/api/dist` construídos
      por `VITE_API_URL=http://localhost:3000 pnpm --filter web build` e
      `pnpm --filter api build`, e `rm -rf apps/site/.next` executado
      *Quando* `bash scripts/gates/segredo.sh` é executado
      *Então* o comando termina com código de saída diferente de zero, e a saída
      contém `apps/site/.next`, contém `pnpm --filter site build` e contém a
      linha `REPROVADO por impossibilidade de medição, não por resultado.`
- [ ] `comportamental` — RF-16.3 e RF-16.4
      *Dado* `gitleaks` no `PATH`, `apps/web/dist` e `apps/site/.next`
      construídos por `VITE_API_URL=http://localhost:3000 pnpm --filter web build`
      e `pnpm --filter site build`, e
      `rm -rf apps/api/dist && mkdir -p apps/api/dist` executado — um diretório
      que existe e não tem nenhum arquivo dentro
      *Quando* `bash scripts/gates/segredo.sh` é executado
      *Então* o comando termina com código de saída diferente de zero, e a saída
      contém a linha
      `::error::portão não conseguiu medir: o universo apps/api/dist terminou com 0 arquivo varrido`
      e a linha `REPROVADO por impossibilidade de medição, não por resultado.`
- [ ] `comando` — RF-17.1 — com `gitleaks` no `PATH` e os diretórios
      `apps/api/dist`, `apps/site/.next` e `apps/web/dist` construídos por
      `pnpm --filter api build`, `pnpm --filter site build` e
      `VITE_API_URL=http://localhost:3000 pnpm --filter web build`,
      `bash scripts/gates/gates_runner.sh` termina com código de saída
      zero e a saída contém as quatro linhas de contagem por universo que nomeiam
      `git ls-files`, `apps/web/dist`, `apps/site/.next` e `apps/api/dist`; e,
      com `rm -rf apps/site/.next` executado antes,
      `bash scripts/gates/gates_runner.sh` termina com código de saída
      diferente de zero e a saída contém `apps/site/.next`.
- [ ] `comando` — RF-17.2 — o comando
      `awk '/^  push:/{p=1;next} p && /^  [a-z_]+:/{p=0} p && /branches:/ && /main/ && /develop/{f=1} END{exit !f}' .github/workflows/portoes.yml`
      termina com código de saída zero. Ele só considera as linhas entre a chave
      `  push:` e a próxima chave de mesmo nível de indentação, o que impede que
      a palavra `branches` encontrada sob `  pull_request:` — que existe no mesmo
      arquivo — satisfaça a asserção. Exige que a lista esteja escrita em linha,
      na forma `branches: [main, develop]`.
- [ ] `comando` — RNF-02 — o comando
      `grep -nE 'pnpm --filter (api|site|web) (run )?build|bash scripts/gates/segredo.sh' .github/workflows/portoes.yml | awk -F: '/segredo\.sh/{s=$1; next} /build/{n++; if($1>b) b=$1} END{exit !(s && n==3 && s>b)}'`
      termina com código de saída zero. Ele reprova se faltar o passo do portão,
      se não houver exatamente três passos de build, ou se o portão vier antes de
      qualquer um dos três.
- [ ] `estrutural` — RF-17.3 — existe `scripts/ci/gitleaks.lock` contendo uma
      versão no formato `<major>.<minor>.<patch>` e um `sha256` de 64 caracteres
      hexadecimais; existe `scripts/ci/instalar-gitleaks.sh`, que lê
      `scripts/ci/gitleaks.lock` e contém a string `sha256sum`;
      `.github/workflows/portoes.yml` contém a string
      `bash scripts/ci/instalar-gitleaks.sh`.
- [ ] `comportamental` — RF-17.4
      *Dado* `scripts/ci/gitleaks.lock` com o valor de `sha256` substituído por
      `0000000000000000000000000000000000000000000000000000000000000000`
      *Quando* `bash scripts/ci/instalar-gitleaks.sh` é executado na
      raiz do repositório
      *Então* o comando termina com código de saída diferente de zero, a saída
      contém `sha256`, e nenhuma linha da saída relata achado de varredura —
      desfeito em seguida por
      `git checkout -- scripts/ci/gitleaks.lock`
- [ ] `comando` — RNF-01 —
      `grep -rhoE '^[[:space:]]*-?[[:space:]]*uses:' .github/workflows/`
      imprime exatamente `27` linhas.
- [ ] `comando` — decisão do plano registrada em `decisoes-autonomas.md`: o modo
      `--sem-artefatos` do runner —
      `bash scripts/gates/gates_runner.sh --sem-artefatos` termina com código de
      saída zero mesmo com `apps/web/dist`, `apps/site/.next` e `apps/api/dist`
      inexistentes, e a saída não contém nenhuma das quatro linhas de contagem
      por universo do portão de segredo. Nenhuma frase da spec autoriza o modo:
      ele existe para que os três jobs de gates por frente, que não constroem as
      outras duas, não reprovem por artefato ausente em todo PR. Quem rastreia
      RF-17.1 é o critério da execução sem flag, acima.

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 4.1 Criar `.gitleaks.toml` na raiz, estendendo o conjunto de regras padrão
      de `gitleaks` (`[extend] useDefault = true`) e declarando um `allowlist`
      global com exatamente duas entradas, cada uma com o motivo escrito na linha
      acima: o caminho `.env.example`, cujos valores são exemplo de máquina local
      já publicados no repositório desde o primeiro commit; e a linha de
      `POSTGRES_PASSWORD` de `.github/workflows/ci-nestjs.yml`, que é credencial
      descartável de um banco que só o runner efêmero alcança, com a justificativa
      já escrita no próprio fluxo.
      Justificativa: RF-15.1 exige código zero sobre repositório limpo, e as duas
      entradas são os únicos valores hoje rastreados que a varredura acusa sem
      haver segredo. Toda entrada de `allowlist` é permissão concedida: escrevê-la
      com o motivo ao lado é o que permite a quem revisa julgar se ela ainda vale
      — permissão sem motivo é herdada sem revisão. Nenhuma entrada nova entra
      sem o mesmo tratamento.
- [ ] 4.2 Criar `scripts/gates/segredo.sh`, carregando
      `source scripts/gates/medir.sh`. Antes de varrer: `exige_comando gitleaks`
      (RF-16.1) e, para cada um dos três diretórios de artefato, `exige_caminho`
      nomeando o caminho e o comando de build que o produz — `apps/web/dist` com
      `pnpm --filter web build`, `apps/site/.next` com `pnpm --filter site build`
      e `apps/api/dist` com `pnpm --filter api build` (RF-16.2).
      Justificativa: `medir.sh` é onde as asserções que fazem a pergunta "consegui
      medir?" falhar fechada já moram, e a `_reprova` dele já imprime a linha
      `REPROVADO por impossibilidade de medição, não por resultado.` que RF-16.4
      cobra — reescrevê-la aqui criaria uma segunda mensagem que diverge da
      primeira no primeiro ajuste.
- [ ] 4.3 No mesmo `scripts/gates/segredo.sh`, materializar cada universo num
      diretório temporário fora da árvore do repositório (`mktemp -d`), copiando
      os arquivos de `git ls-files` e o conteúdo dos três diretórios de artefato,
      contar os arquivos de cada universo, varrer cada diretório temporário com
      `gitleaks` apontando `--config` para o `.gitleaks.toml` da raiz, e reescrever
      o prefixo temporário na saída de modo que todo caminho impresso seja
      relativo à raiz do repositório. Limpar os temporários num `trap`.
      Justificativa: dois motivos, e os dois valem sozinhos. Primeiro, RF-14.1
      cobra a contagem de arquivos varridos por universo, e a contagem só é honesta
      se a lista é a que o script construiu — a contagem que a ferramenta declara
      depende de heurística dela. Segundo, três dos quatro universos são caminhos
      que o `.gitignore` da raiz ignora (`apps/web/dist`, `apps/site/.next`,
      `apps/api/dist`), e o quarto inclui o `.env` que RF-15.2 força a rastrear:
      varrer in loco faz o resultado depender de a ferramenta consultar ou não o
      `.gitignore`, dependência que não se lê no diff e muda com a versão dela. A
      reescrita do prefixo existe porque RF-15.2 e RF-15.3 cobram que a saída
      **nomeie** o arquivo, e um caminho sob `/tmp` nomeia o temporário.
- [ ] 4.4 No mesmo `scripts/gates/segredo.sh`, ao fim da execução: para cada
      universo que terminou com zero arquivo varrido, chamar a `_reprova` de
      `scripts/gates/medir.sh` passando exatamente
      `o universo <caminho> terminou com 0 arquivo varrido` (RF-16.3), onde
      `<caminho>` é `git ls-files`, `apps/web/dist`, `apps/site/.next` ou
      `apps/api/dist`; imprimir a contagem por universo (RF-14.1) e imprimir a
      saída de `gitleaks version` (RF-14.2).
      Justificativa: sair pela `_reprova` é o que faz esta reprovação carregar a
      mesma linha `REPROVADO por impossibilidade de medição, não por resultado.`
      que RF-16.4 exige dos outros dois cenários — universo vazio é medição
      impossível, não resultado limpo, e imprimir uma mensagem própria aqui
      deixaria um dos três caminhos de RF-16 falando outra língua. A frase é
      literal porque o critério de aceite a cobra letra por letra: mensagem que
      só o autor sabe reconhecer não é medição de ninguém. E um contador que
      chega a zero por não haver o que contar é a forma de portão que mente que
      este repositório já catalogou.
- [ ] 4.5 Criar `scripts/ci/gitleaks.lock` com a versão de `gitleaks` e o `sha256`
      do binário de release para `linux_x64`, copiados do arquivo
      `gitleaks_<versão>_checksums.txt` publicado na mesma release.
      Justificativa: D6 — a ação oficial exige licença para organização e
      acrescentaria ao item a dívida que ele está pagando; o binário fixado por
      versão e checksum é a instalação que não acrescenta `uses:` e não confia na
      tag móvel de ninguém (RNF-01).
- [ ] 4.6 Criar `scripts/ci/instalar-gitleaks.sh`: baixa a release fixada em
      `scripts/ci/gitleaks.lock`, confere o `sha256` com `sha256sum -c`, e só
      então extrai e instala o binário num diretório do `PATH`; checksum diferente
      encerra com código de saída diferente de zero, antes de qualquer extração.
      Justificativa: RF-17.4 — falhar barato antes de falhar caro; um binário de
      procedência não confirmada rodando sobre a árvore inteira do repositório é
      pior que portão nenhum, porque roda depois do `checkout` que já gravou o
      token no disco.
- [ ] 4.7 Modificar `scripts/gates/gates_runner.sh`: aceitar a flag
      `--sem-artefatos`, e acrescentar, depois do bloco Python, uma seção que
      invoca `bash scripts/gates/segredo.sh` e propaga o código de saída dele,
      pulando essa invocação quando `--sem-artefatos` estiver presente. Reescrever
      no presente o cabeçalho de documentação do arquivo, incluindo o novo modo na
      lista de modos.
      Justificativa: o molde de `.harness/gates.json` — arquivos por stdin,
      violações por stdout, código de saída ignorado — não comporta um portão que
      precisa reprovar por **não ter conseguido medir**, que é metade do que RF-16
      pede; declará-lo ali faria a reprovação por medição impossível virar
      aprovação silenciosa. A flag existe porque os três jobs de gates dos fluxos
      por frente rodam o runner sem ter construído as outras duas frentes, e sem
      ela reprovariam por artefato ausente em todo PR — reprovação verdadeira
      sobre uma pergunta que aquele job não deveria estar fazendo. Nenhuma frase
      da spec autoriza o modo, então ele é decisão deste plano e vai registrada em
      `decisoes-autonomas.md`. Regra 7: o cabeçalho do arquivo é documento
      canônico e não recebe cicatriz.
- [ ] 4.8 Modificar os passos `Gates` de `.github/workflows/ci-react.yml` e
      `.github/workflows/ci-nestjs.yml` para
      `bash scripts/gates/gates_runner.sh --sem-artefatos`, e o passo
      `Portões arquiteturais` de `.github/workflows/ci-site.yml` para
      `bash scripts/gates/gates_runner.sh --all --sem-artefatos`.
      Justificativa: são os três jobs que não constroem as outras frentes; o
      portão de segredo continua cobrado na execução sem flag, que é a que RF-17.1
      nomeia e a que `portoes.yml` passa a rodar.
- [ ] 4.9 Modificar `.github/workflows/portoes.yml`: acrescentar o gatilho
      `push` com `branches: [main, develop]` escrito em linha; acrescentar ao job
      `medir`, nesta ordem, os passos `pnpm install --frozen-lockfile`, os três
      builds (`pnpm --filter api build`, `pnpm --filter site build` e
      `pnpm --filter web run build` com `VITE_API_URL: http://localhost:3000`),
      `bash scripts/ci/instalar-gitleaks.sh` e, por último,
      `bash scripts/gates/segredo.sh`. Reescrever no presente o comentário que
      hoje justifica a ausência de `pnpm install` neste job.
      Justificativa: RF-17.2 cobra o portão a cada push e o fluxo hoje dispara só
      em `pull_request`; RNF-02 exige que a varredura venha depois dos builds,
      porque os três universos de artefato não existem antes deles. A lista de
      branches em linha é o que o critério de RF-17.2 consegue distinguir da
      palavra `branches` que já existe sob `pull_request:` no mesmo arquivo. O
      portão entra como passos do job existente, e não como job novo, porque um
      job novo traria `actions/checkout`, `actions/setup-node` e
      `pnpm/action-setup` e a contagem de referências deixaria de ser 27, contra
      RNF-01. O comentário sobre a ausência de `pnpm install` deixou de ser
      verdade no mesmo PR em que a instalação entra (regra 8).

---

## Fase 5 — A cadeia de suprimentos espera e se fixa (raiz + CI)

**Branch:** `023-endurecimento-antes-da-sessao/fase-5-cadeia-de-suprimentos`,
nascida da branch da Fase 4.

**Objetivo da fase:** versão publicada há menos de sete dias não entra na
resolução, as 27 referências `uses:` dos cinco fluxos passam a SHA de 40
hexadecimais com a versão legível ao lado, e dois portões novos cobram os dois
números.

**Arquivos tocados:** `pnpm-workspace.yaml`, `scripts/gates/`,
`.github/workflows/*.yml`, `.github/dependabot.yml`.

**Critérios de aceite:**

- [ ] `estrutural` — RF-18.1 — `pnpm-workspace.yaml` na raiz do repositório
      contém a linha `minimumReleaseAge: 10080`.
- [ ] `comando` — RF-18.2 — `pnpm config get minimumReleaseAge`,
      executado na raiz do repositório, imprime `10080`.
- [ ] `comando` — RF-18.3 — `pnpm install --frozen-lockfile`, executado
      na raiz, termina com código de saída zero, e
      `git diff --exit-code pnpm-lock.yaml` executado em seguida termina
      com código de saída zero.
- [ ] `comando` — RF-19.1 — existe `scripts/gates/quarentena.sh`, e
      `bash scripts/gates/quarentena.sh` termina com código de saída
      zero e a saída contém `10080`.
- [ ] `comportamental` — RF-19.2
      *Dado* a chave `minimumReleaseAge` de `pnpm-workspace.yaml` renomeada para
      `minimumReleaseAg`, de modo que
      `pnpm config get minimumReleaseAge` passe a imprimir `undefined`
      *Quando* `bash scripts/gates/quarentena.sh` é executado na raiz
      do repositório
      *Então* o comando termina com código de saída diferente de zero e a saída
      contém `undefined` — desfeito em seguida por
      `git checkout -- pnpm-workspace.yaml`
- [ ] `comando` — RF-20.1 —
      `grep -rn 'uses:' .github/workflows/ | grep -vE '@[0-9a-f]{40}'`
      não imprime nenhuma linha e termina com código de saída `1`.
- [ ] `comando` — RF-20.2 —
      `grep -rn 'uses:' .github/workflows/ | grep -vE '@[0-9a-f]{40}[[:space:]]+#[[:space:]]*v[0-9]+\.[0-9]+\.[0-9]+'`
      não imprime nenhuma linha e termina com código de saída `1`.
- [ ] `comando` — RF-21.3 e RNF-01 — existe `scripts/gates/acoes_em_sha.sh`, e
      `bash scripts/gates/acoes_em_sha.sh` termina com código de saída
      zero e imprime uma linha que contém o número `27` junto da palavra
      `referência` ou `referências`.
- [ ] `comportamental` — RF-21.1
      *Dado* a linha `      - uses: actions/checkout@v4` acrescentada ao fim do
      último passo do job `medir` de `.github/workflows/portoes.yml`
      *Quando* `bash scripts/gates/acoes_em_sha.sh` é executado na raiz
      do repositório
      *Então* o comando termina com código de saída diferente de zero e a saída
      contém `portoes.yml` e o número da linha acrescentada — desfeito em seguida
      por `git checkout -- .github/workflows/portoes.yml`
- [ ] `comportamental` — RF-21.2
      *Dado* o diretório `.github/workflows` esvaziado por
      `mkdir -p /tmp/fluxos-guardados && mv .github/workflows/*.yml /tmp/fluxos-guardados/`
      *Quando* `bash scripts/gates/acoes_em_sha.sh` é executado na raiz
      do repositório
      *Então* o comando termina com código de saída diferente de zero e a saída
      diz que não encontrou fluxo para medir — desfeito em seguida por
      `mv /tmp/fluxos-guardados/*.yml .github/workflows/`
- [ ] `estrutural` — RF-22.1, RF-22.2, RF-22.3 e RF-22.4 — existe
      `.github/dependabot.yml` declarando `version: 2` e exatamente uma entrada em
      `updates`, com `package-ecosystem: "github-actions"`, `directory: "/"`,
      `schedule:` contendo `interval: "weekly"` e `target-branch: "develop"`; o
      arquivo não contém a string `npm`.
- [ ] `comando` — RF-19.1 e RF-21.3 —
      `bash scripts/gates/gates_runner.sh --sem-artefatos` termina com
      código de saída zero, e a saída contém `10080` e contém o número `27`.

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 5.1 Modificar `pnpm-workspace.yaml` acrescentando
      `minimumReleaseAge: 10080`, com o comentário do porquê no estilo dos três
      blocos que já estão no arquivo.
      Justificativa: D4 — sete dias é a janela em que as campanhas recentes de
      publicação maliciosa em npm foram detectadas e as versões despublicadas; o
      comentário existe porque o número sozinho não diz de onde veio, e quem for
      tentado a baixá-lo precisa encontrar o argumento no mesmo lugar.
- [ ] 5.2 Criar `scripts/gates/quarentena.sh`, carregando
      `source scripts/gates/medir.sh`, com `exige_comando pnpm`, comparando a
      saída de `pnpm config get minimumReleaseAge` com `10080` e reprovando em
      qualquer outro valor, `undefined` incluído; imprimir o valor medido.
      Justificativa: RF-19.2 — `undefined` não distingue "não configurei" de
      "configurei com um caractere trocado", e um portão que só verifica ausência
      de erro aprova as duas. Comparar com o número é o que separa as duas
      respostas.
- [ ] 5.3 Criar `scripts/gates/acoes_em_sha.sh`, carregando
      `source scripts/gates/medir.sh`, com
      `exige_caminho .github/workflows "os fluxos do CI"` e reprovando quando o
      diretório não contém nenhum arquivo de fluxo (RF-21.2); percorrer toda linha
      `uses:` dos fluxos, reprovar a que não casa `@[0-9a-f]{40}` nomeando arquivo
      e número da linha (RF-21.1), reprovar a que não traz na mesma linha um
      comentário de versão legível no formato `# vX.Y.Z` (RF-20.2), e imprimir ao
      fim quantas referências mediu (RF-21.3).
      Justificativa: RF-21.3 é a fonte da métrica de sucesso do PRD — o número
      impresso em todo push —, e a asserção de diretório vazio é o que impede o
      portão de imprimir `0 referências` e aprovar num dia em que o caminho mudar.
- [ ] 5.4 Modificar `scripts/gates/gates_runner.sh` acrescentando à seção de
      portões diretos, ao lado do portão de segredo, as invocações de
      `bash scripts/gates/quarentena.sh` e `bash scripts/gates/acoes_em_sha.sh`,
      com propagação do código de saída, executadas também no modo
      `--sem-artefatos`; atualizar o cabeçalho de documentação do arquivo.
      Justificativa: nenhum dos dois depende de artefato de build, então
      excluí-los do modo sem artefatos deixaria os três fluxos por frente sem
      cobrança sobre os dois números — e é neles que quase todo PR passa.
- [ ] 5.5 Substituir as 27 referências `uses:` dos cinco fluxos
      (`bloqueio.yml`, `ci-nestjs.yml`, `ci-react.yml`, `ci-site.yml`,
      `portoes.yml`) pelo SHA de 40 hexadecimais da tag correspondente, com
      `# vX.Y.Z` na mesma linha. O SHA de cada tag se resolve com
      `gh api repos/<owner>/<repo>/commits/<tag> --jq .sha` — por exemplo
      `gh api repos/actions/checkout/commits/v4.2.2 --jq .sha`. As quatro ações em
      uso são `actions/checkout` (12 ocorrências), `actions/setup-node` (7),
      `pnpm/action-setup` (7) e `actions/upload-artifact` (1).
      Justificativa: com tag móvel, quem comprometer uma ação de terceiro
      repointa a tag e roda no runner **depois** de o `checkout` já ter gravado o
      token no disco; o comentário de versão existe porque um SHA sozinho não diz
      o que está fixado, e sem ele a atualização vira arqueologia. Resolver pela
      API em vez de copiar da interface evita fixar o SHA de uma tag anotada, que
      não é o commit que a ação executa.
- [ ] 5.6 Criar `.github/dependabot.yml` com `version: 2` e uma única entrada em
      `updates`: `package-ecosystem: "github-actions"`, `directory: "/"`,
      `schedule: { interval: "weekly" }` e `target-branch: "develop"`.
      Justificativa: D5 — SHA sem rotina congela o repositório em versão com
      defeito conhecido, e as duas metades são inseparáveis. O ecossistema `npm`
      fica fora por D14: quem julga um PR de dependência precisa da auditoria de
      vulnerabilidade que o item `027-vulnerabilidade-conhecida-reprova-no-ci`
      traz, e antes disso o robô abriria PRs que ninguém sabe aprovar ou recusar
      por critério escrito (RF-22.4).

---

## Execução sugerida

1. **Fase 1** (`apps/api`): a lista de origens e o `helmet` não dependem de nada
   das outras frentes.
2. **Fase 2** (`apps/site` + `ci-site.yml`), sobre a branch da Fase 1.
3. **Fase 3** (`apps/web` + `ci-react.yml`), sobre a branch da Fase 2.
4. **Fase 4**, sobre a branch da Fase 3: o portão de segredo varre os três
   artefatos que as Fases 1, 2 e 3 produzem, e um portão escrito antes de haver o
   que varrer se verifica contra o vazio — exatamente a forma de aprovação por
   não ter medido que ele existe para matar.
5. **Fase 5**, sobre a branch da Fase 4: as duas fases editam
   `scripts/gates/gates_runner.sh` e `.github/workflows/portoes.yml`, e a Fase 5
   reescreve as linhas `uses:` de todos os cinco fluxos — inclusive as do
   `portoes.yml` que a Fase 4 acabou de mexer.

**As Fases 1, 2 e 3 são paralelizáveis por `git worktree`.** Os conjuntos de
arquivos são disjuntos: `apps/api/**` na primeira, `apps/site/**` mais
`.github/workflows/ci-site.yml` na segunda, `apps/web/**` mais
`.github/workflows/ci-react.yml` na terceira. Nenhuma delas toca
`scripts/gates/`, `portoes.yml`, `pnpm-workspace.yaml` nem os fluxos das outras
duas. O único arquivo em comum é `pnpm-lock.yaml`, que a Fase 1 altera ao
declarar `helmet` e que se resolve regenerando com `pnpm install`, nunca editando
o conflito à mão.

**A corrida autônoma as executa em sequência**, empilhando um PR por fase com
`gh stack` (regra 9). O paralelismo por worktree é a opção de quem tiver três
frentes de trabalho simultâneas; a ordem da pilha continua sendo 1 → 2 → 3 → 4 →
5 em qualquer dos dois caminhos, porque as Fases 4 e 5 precisam das três
anteriores na mesma árvore.

## Validações de campo pendentes

O que só o navegador real, o robô da plataforma ou o evento do GitHub provam. Não
vira tipo de critério nem fase bloqueante; registra-se aqui e migra para a seção
homônima de `product/roadmap.md` quando o item fechar.

- **Fase 2 — a hidratação do hotsite num navegador real, com a política ativa.**
  O que fica provado é que o nonce do cabeçalho `Content-Security-Policy` é o
  mesmo que aparece no atributo `nonce` de um `<script>` do HTML da mesma
  resposta, e que ele muda entre duas requisições. Nada disso prova que o React
  hidrata: um navegador real avalia a política inteira, e uma diretiva
  incidentalmente restritiva — `style-src 'self'` diante de um estilo embutido
  que o Next passe a emitir, ou um segundo `<script>` sem o atributo — aparece
  como página que não reage, sem erro no servidor. Fica sem verificação
  automatizada: abrir `http://localhost:3001/` num navegador com o console aberto
  e confirmar ausência de violação de política. Cai em `015-hotsite`, que é quem
  dá conteúdo e interatividade ao hotsite.

- **Fase 3 — a `<meta>` do app diante da aplicação real carregada.** O que fica
  provado é que a tag existe no `apps/web/dist/index.html`, com exatamente as
  nove diretivas e o `connect-src` derivado de `VITE_API_URL`. O inventário de
  recursos do app hoje é uma página, um bundle e uma origem de API, e a política
  foi escrita para ele — mas não há endpoint de relatório de violação e o
  report-only foi recusado (D2), então uma diretiva apertada demais aparece como
  recurso que não carrega, no navegador de quem usa. Fica sem verificação
  automatizada: servir o `dist/` por `vite preview`, carregar a aplicação num
  navegador real e confirmar que a chamada a `GET /health` completa e que o
  console não registra violação. Cai no primeiro item que puser interface diante
  de gente, `002-conta-e-organizacao`.

- **Fase 4 — a instalação do `gitleaks` no runner do GitHub.** O checksum
  divergente reprovando está provado na máquina, e o caminho feliz também. O que
  não está é o binário `linux_x64` da release fixada rodando no runner
  `ubuntu-latest`, com o `PATH` que o passo seguinte enxerga — a diferença entre
  a máquina de quem desenvolve e o runner é justamente o risco que o PRD
  registra. Verifica-se sozinho na primeira execução do fluxo `Portões` depois do
  merge da Fase 4; se o passo reprovar por não achar a ferramenta, é o próprio
  portão dizendo que não mediu.

- **Fase 5 — o Dependabot abrindo o primeiro PR contra `develop`.** Que o arquivo
  declara `github-actions`, semanal, contra `develop` e sem `npm` é estrutural e
  fica provado. Que o robô lê o arquivo, roda no intervalo declarado e abre o PR
  na branch certa depende de a plataforma agendar a execução, que nenhum comando
  local produz — é a mesma classe do evento `unlabeled` já registrada no
  `roadmap.md`. Verifica-se sozinho na primeira semana depois do merge; se nenhum
  PR aparecer em quatorze dias e houver ação desatualizada, o arquivo está sendo
  ignorado e a rotina que destrava os SHAs não existe.
