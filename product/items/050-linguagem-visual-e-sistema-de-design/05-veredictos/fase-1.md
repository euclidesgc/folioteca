# Veredicto — fase 1 de `050-linguagem-visual-e-sistema-de-design`

**VEREDICTO: APROVADO**

- **Item:** `050-linguagem-visual-e-sistema-de-design`
- **Fase:** 1 — tokens, fonte e política
- **Commit julgado:** `45b4d38` — branch
  `050-linguagem-visual-e-sistema-de-design/fase-1-tokens-fonte-e-politica`
- **Data da validação:** 2026-09-09

Toda evidência foi colhida com `rtk proxy <comando>`. `.harness/config.json`,
campo `command_quirks`, registra que um hook global reescreve toda chamada de
Bash como `rtk <comando>` e corta até 90% da saída, e manda julgar pela saída
bruta. A saída transcrita abaixo é a bruta.

O validador não abriu `00-discovery.md`, `01-prd.md`, `02-spec.md` nem
`03-plan.md`. O `03-plan.md` aparece no diff sob julgamento e o
`gates_runner.sh` imprime avisos sobre ele; nem um nem outro o fez lê-lo.

## Portões

**lint/analyze: OK**

```
pnpm --filter web run lint      → $ eslint .        LINT_EXIT=0
pnpm --filter web run typecheck → $ tsc --noEmit    TYPECHECK_EXIT=0
pnpm --filter api run lint                          API_LINT_EXIT=0
pnpm --filter api run typecheck                     API_TYPECHECK_EXIT=0
```

**testes: OK**

```
$ pnpm --filter web run test
  $ vitest run
  RUN  v4.1.11 /home/euclidesgc/development/folioteca/apps/web
  Test Files  4 passed (4)
  Tests  21 passed (21)
  TEST_EXIT=0

$ pnpm --filter api run test
  $ jest
  Test Suites: 2 passed, 2 total
  Tests:       40 passed, 40 total
  API_TEST_EXIT=0

$ bash scripts/e2e/relatorio.sh rodar
  Running 8 tests using 6 workers
  ✓  1 e2e/health.spec.ts:3:1 › mostra o status da API na página inicial (386ms)
  ✓  2 e2e/politica-de-conteudo.spec.ts:8:3 › … › declara a política de conteúdo no documento (400ms)
  ✓  6 e2e/politica-de-conteudo.spec.ts:23:3 › … › restringe estilo à própria origem (298ms)
  ✓  3 e2e/pagina-viva.spec.ts:5:1 › a página viva usa a face auto-hospedada (583ms)
  ✓  4 e2e/pagina-viva.spec.ts:67:1 › a rota /design sobrevive à abertura direta e à recarga (600ms)
  ✓  8 e2e/politica-de-conteudo.spec.ts:54:3 › … › responde com os cabeçalhos de segurança do servidor (220ms)
  ✓  5 e2e/pagina-viva.spec.ts:26:1 › a página viva não busca nada fora do próprio artefato (939ms)
  ✓  7 e2e/politica-de-conteudo.spec.ts:33:3 › … › não carrega folha de estilo nem fonte de outra origem (709ms)
  8 passed (5.8s)
  medido: 8 caso(s) numa subida — 8 passou(aram), 0 falhou(aram), 0 pulado(s), 0 sem resultado.
```

**gates: OK** — `bash scripts/gates/gates_runner.sh` → `EXIT=0`

```
✓ gates: limpos (árvore completa, 384 arquivo(s) considerados).
medido: minimumReleaseAge = 10080 (esperado 10080 minutos, sete dias)
medido: minimumReleaseAgeExclude = [] (esperado [], hoje é 2026-09-09)
✓ quarentena: versão publicada há menos de 10080 minutos não entra na resolução, com as isenções [] dentro do prazo.
medido: 29 referência(s) 'uses:' externa(s) e 8 local(is) em 9 fluxo(s) de .github/workflows (piso 27)
✓ ações do CI: as 29 referência(s) estão fixadas em SHA de 40 hexadecimais, com a versão ao lado.
medido: 953 pacote(s) auditado(s) — critical: 0, high: 0, moderate: 0, low: 0
✓ vulnerabilidade: 953 pacotes auditados, 0 achados de severidade alta ou crítica, 0 isenções.
✓ fluxos: nada roda em rascunho, e a nuvem só confirma o que esta máquina aprovou.
✓ pnpm isolado: nenhuma instalação de pnpm escreve no HOME compartilhado dos runners.
✓ concorrencia: todo fluxo de gatilho declara a forma esperada, e nenhuma suíte chamada declara.
medido: 213 arquivo(s) versionados varridos, 0 marcador(es) atalho:
✓ e2e uma subida: a suíte roda inteira numa subida, e o relatório responde por cada critério.
✓ critérios: forma válida (4 aviso(s)).
✓ plano: os critérios de 050-linguagem-visual-e-sistema-de-design têm forma válida.
✓ segredo: os quatro universos varridos, nenhum achado.
```

Os 4 avisos do portão de critérios são de forma, nas fases 2, 4 e 5 — fora do
escopo desta fase, e o portão termina em 0.

## Critérios de aceite

### [x] 1 — `estrutural` — `RNF-03` — dependências em versão fixa, presentes no lock, quarentena ainda declarada

```
grep -c '' pnpm-workspace.yaml                                → 51 (maior que 0)
grep -c -E '^minimumReleaseAge:\s*10080\s*$' pnpm-workspace.yaml → 1
grep -c '' apps/web/package.json                              → 42 (maior que 0)

script python do critério → PY_EXIT=0, três linhas:
  tailwindcss 4.3.3
  @tailwindcss/vite 4.3.3
  react-router 8.3.1

grep -c -F "$nome" pnpm-lock.yaml, uma por pacote:
  tailwindcss        50
  @tailwindcss/vite   3
  react-router        3
```

As três contagens são maiores ou iguais a 1; nenhuma versão traz `^`, `~` ou `*`.

### [x] 2 — `estrutural` — `RF-02.a`, `RF-04.a`, `RF-04.b` — seis tokens de cor nos dois blocos, com contraste AA medido

```
script python do critério → PY_EXIT=0, quatro linhas na ordem exigida:
  True
  True
  claro  {'--color-tinta': 16.06, '--color-grafite': 5.72, '--color-verdete': 8.89, '--color-carimbo': 7.75} True
  escuro {'--color-tinta': 14.95, '--color-grafite': 5.7,  '--color-verdete': 7.0,  '--color-carimbo': 7.02} True
```

Primeira linha `True`: os nomes de `.tema-claro`, de `.tema-escuro` e do conjunto
fixado coincidem. Segunda linha `True`: os seis valores do bloco claro são os que
a direção fixou. Terceira e quarta: as quatro razões de cada bloco, ambas
terminando em `True`. O menor valor medido é 5,70, acima do mínimo 4,5.

### [x] 3 — `estrutural` — `RF-03.a`, `RF-03.b`, `RF-03.c` — as três faces chegam pelo token, e nenhum outro arquivo as nomeia

```
grep -c -E '^\s*--font-(display|body|mono)\s*:' apps/web/src/shared/styles/theme.css → 3
grep -E '^\s*--font-display\s*:' … | grep -c -F Fraunces                             → 1
grep -E '^\s*--font-body\s*:'    … | grep -c -F 'Atkinson Hyperlegible Next'         → 1
grep -E '^\s*--font-mono\s*:'    … | grep -c -F 'IBM Plex Mono'                      → 1
```

Linhas lidas no arquivo de tema:

```css
  --font-display: "Fraunces", Georgia, "Times New Roman", serif;
  --font-body: "Atkinson Hyperlegible Next", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
```

```
find apps/web/src -type f | wc -l → 32 (maior que 0, houve onde procurar)

grep -rlE 'Fraunces|Atkinson Hyperlegible|IBM Plex Mono' apps/web/src (lista bruta):
  apps/web/src/shared/styles/fonts/atkinson-hyperlegible-next/OFL.txt
  apps/web/src/shared/styles/fonts/fraunces/OFL.txt
  apps/web/src/shared/styles/theme.css

… | grep -vE '^apps/web/src/shared/styles/fonts/[^/]+/(OFL|LICENSE)[^/]*$' |
    grep -vc '^apps/web/src/shared/styles/theme.css$'                        → 0

controle positivo:
… | grep -cE '^apps/web/src/shared/styles/fonts/[^/]+/(OFL|LICENSE)[^/]*$'   → 2 (maior que 0)
  apps/web/src/shared/styles/fonts/atkinson-hyperlegible-next/OFL.txt
  apps/web/src/shared/styles/fonts/fraunces/OFL.txt
```

Nenhum componente, `.ts` ou `.tsx` nomeia uma das três faces.

### [x] 4 — `estrutural` — `RF-01.a`, `RF-07.a`, `RF-24.a` — escala de espaço, raio e sombra, movimento e ponto de quebra

Sobre `apps/web/src/shared/styles/theme.css`:

```
grep -c ''                                          → 144 (maior que 0)
grep -c -E '^\s*--duracao-rapida\s*:'               → 1
grep -c -E '^\s*--duracao-padrao\s*:'               → 1
grep -c -E '^\s*--curva-padrao\s*:'                 → 1
grep -c -E '^\s*--breakpoint-telefone\s*:\s*768px\s*;' → 1
grep -c -E '^\s*--radius-[a-z0-9-]+\s*:'            → 3 (maior ou igual a 3)
grep -c -E '^\s*--shadow-[a-z0-9-]+\s*:'            → 2 (maior ou igual a 2)
grep -c -E '^\s*--spacing\s*:'                      → 1
```

### [x] 5 — `estrutural` — `RF-08.a`, `RF-08.c`, `RF-09.a`, `RF-09.b`, `RF-09.c` — `.woff2` versionados, licença OFL por família, `@font-face` sem host

```
script python do critério → PY_EXIT=0:
  atkinson-hyperlegible-next 1
  fraunces 1
  ibm-plex-mono 2
  []
```

A varredura é sobre toda pasta presente, não sobre uma lista fechada: só as três
esperadas existem, cada uma tem ao menos um `.woff2` e um arquivo de licença cujo
texto contém `SIL Open Font License`. A última linha é exatamente `[]` — nenhum
`src: url()` do arquivo de tema traz esquema ou host, então todos resolvem na
origem do documento.

`git ls-files apps/web/src/shared/styles/fonts` confirma que tudo está versionado:

```
…/atkinson-hyperlegible-next/OFL.txt
…/atkinson-hyperlegible-next/atkinson-hyperlegible-next-latin-wght-normal.woff2
…/fraunces/OFL.txt
…/fraunces/fraunces-latin-opsz-normal.woff2
…/ibm-plex-mono/OFL.txt
…/ibm-plex-mono/ibm-plex-mono-latin-400-normal.woff2
…/ibm-plex-mono/ibm-plex-mono-latin-600-normal.woff2
```

### [x] 6 — `comando` — `RF-08.b`, `RNF-02` — fonte com hash no nome e folha `.css` estática no artefato

```
mkdir -p apps/web/dist && find apps/web/dist -mindepth 1 -delete → LIMPEZA_EXIT=0
find apps/web/dist -mindepth 1 | wc -l → 0   (a limpeza foi medida, não presumida)

VITE_API_URL=http://localhost:3000 pnpm --filter web run build → BUILD_EXIT=0
  vite v8.2.2 building client environment for production...
  ✓ 187 modules transformed.
  dist/index.html                                                            0.65 kB │ gzip:   0.38 kB
  dist/assets/ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2                 14.70 kB
  dist/assets/ibm-plex-mono-latin-600-normal-BgSNZQsw.woff2                 15.62 kB
  dist/assets/atkinson-hyperlegible-next-latin-wght-normal-BcXVPD7q.woff2   33.99 kB
  dist/assets/fraunces-latin-opsz-normal-DihXLNYH.woff2                     67.30 kB
  dist/assets/index-COQzNfN3.css                                            12.52 kB │ gzip:   3.49 kB
  dist/assets/index-jSaysT7m.js                                            581.36 kB │ gzip: 180.64 kB
  ✓ built in 206ms

find apps/web/dist/assets -name '*.woff2' | wc -l                        → 4 (maior ou igual a 3)
find apps/web/dist/assets -name '*.woff2' | grep -cE '\-[A-Za-z0-9_-]{6,}\.woff2$' → 4 (mesmo número)
find apps/web/dist/assets -name '*.css' | wc -l                          → 1 (maior ou igual a 1)
grep -lc Fraunces apps/web/dist/assets/*.css | wc -l                     → 1 (maior ou igual a 1)
```

Todo arquivo de fonte emitido leva hash no nome, e a folha estática carrega a
declaração da face.

### [x] 7 — `comando` — `RF-10.a`, `RF-10.b`, `RF-10.c`, `RF-10.d` — nove diretivas, sem `font-src`, sem termo perigoso, e as asserções mordem

Sobre o `dist` recém-construído pelo build limpo do critério 6, com as portas
medidas livres antes (`ss -ltnp` → `portas 3000/4173/5173/8080 livres`):

```
bash apps/web/scripts/verificar-politica.sh http://localhost:3000 → POLITICA_EXIT=0
  medido: 1 tag(s) <meta http-equiv="Content-Security-Policy">
  medido: 9 diretiva(s) na política
  medido: a política é exatamente a declarada — nove diretivas, e nada além delas
  medido: connect-src = 'connect-src 'self' http://localhost:3000'
  medido: 'unsafe-inline' ausente da política
  medido: 'unsafe-eval' ausente da política
  medido: o servidor de pré-visualização — 4 de 4 cabeçalhos constantes presentes
  APROVADO: a política e os cabeçalhos de apps/web conferem.

bash apps/web/scripts/__tests__/verificar-politica.test.sh → TESTE_POLITICA_EXIT=0
  33 casos, todos ok, entre eles os três que o critério nomeia:
  ok    exige_politica_com_nove_diretivas REPROVA dez diretivas
  ok    exige_politica_sem_termo REPROVA 'unsafe-inline'
  ok    exige_politica_sem_termo REPROVA 'unsafe-eval'
  ✓ verificar-politica.sh: as asserções da política de apps/web mordem.

grep -c '' apps/web/dist/index.html            → 14 (maior que 0)
grep -c -F 'font-src' apps/web/dist/index.html → 0
```

Política lida no artefato: `default-src 'self'; script-src 'self'; style-src
'self'; img-src 'self' data:; connect-src 'self' http://localhost:3000;
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'` —
nove diretivas, nenhuma delas `font-src`.

### [x] 8 — `comportamental` — `RF-11.a`, `RF-11.b`, `RF-11.d` — a face auto-hospedada carregou, e não a de reserva

```
bash scripts/e2e/relatorio.sh criterio "a página viva usa a face auto-hospedada" → C8_EXIT=0
  passou	pagina-viva.spec.ts > a página viva usa a face auto-hospedada
  ✓ e2e: "a página viva usa a face auto-hospedada" passou, na execução única desta árvore.
```

Verificação de que o caso exerce o *Então* declarado, lida em
`apps/web/e2e/pagina-viva.spec.ts:5`: o `font-family` computado do `heading` de
nível 1 é afirmado com `expect(familia).toContain("Fraunces")`, e depois de
`await page.evaluate(() => document.fonts.ready)` o caso afirma
`expect(carregou).toBe(true)` sobre `document.fonts.check("16px Fraunces")` — a
asserção que separa a face carregada da de reserva.

*Dado* confirmado em `apps/web/playwright.config.ts:70`: o servidor da suíte é
`pnpm --filter web run build && pnpm --filter web exec vite preview --port
${WEB_PORT}`, isto é, o artefato construído, não o servidor de desenvolvimento.

### [x] 9 — `comportamental` — `RF-08.d`, `RF-11.c`, `RF-26.d` — a página não busca nada fora do próprio artefato

```
bash scripts/e2e/relatorio.sh criterio "a página viva não busca nada fora do próprio artefato" → C9_EXIT=0
  passou	pagina-viva.spec.ts > a página viva não busca nada fora do próprio artefato
  ✓ e2e: "a página viva não busca nada fora do próprio artefato" passou, na execução única desta árvore.
```

Verificação em `apps/web/e2e/pagina-viva.spec.ts:26`: coletor de `request` e
coletor de `console` instalados antes do `page.goto("/design")`, seguido de
`waitForLoadState("networkidle")`. As asserções, na ordem:
`expect(requisicoes.length).toBeGreaterThan(0)` — o controle positivo, sem o qual
uma página que não subiu passaria; lista de requisições de `resourceType`
`stylesheet` ou `font` com origem diferente de `new URL(page.url()).origin`
afirmada `toEqual([])`; lista de requisições começando em `http://localhost:3000`
afirmada `toEqual([])`; e lista de mensagens do console contendo `Refused to load
the stylesheet` ou `Applying inline style violates` afirmada `toEqual([])`. As
três listas entram na mensagem de falha.

### [x] 10 — `comportamental` — `RF-19.a`, `RF-19.b`, `RF-19.c`, `RF-26.b` — a rota sobrevive à abertura direta e à recarga

```
bash scripts/e2e/relatorio.sh criterio "a rota /design sobrevive à abertura direta e à recarga" → C10_EXIT=0
  passou	pagina-viva.spec.ts > a rota /design sobrevive à abertura direta e à recarga
  ✓ e2e: "a rota /design sobrevive à abertura direta e à recarga" passou, na execução única desta árvore.
```

Verificação em `apps/web/e2e/pagina-viva.spec.ts:67`:
`expect(abertura?.status()).toBe(200)` na navegação direta e
`expect(recarga?.status()).toBe(200)` no `page.reload()`, e nas duas
`expect(page.getByRole("heading", { level: 1 })).toHaveText("Página viva")` —
consulta por papel e texto acessível, não por classe CSS. O contexto do
Playwright é novo por caso, sem cookie, credencial ou cabeçalho de autorização.

### [x] 11 — `estrutural` — `RF-26.a` — a rota existe e nenhuma condição de ambiente a remove

```
grep -c '' apps/web/src/app/routes/design.tsx                → 280 (maior que 0)
grep -c -F 'path: "/design"' apps/web/src/app/routes/index.tsx → 1
grep -c '' apps/web/src/app/routes/index.tsx                 → 8 (maior que 0)

grep -cE 'import\.meta\.env|process\.env|NODE_ENV' \
  apps/web/src/app/routes/index.tsx apps/web/src/app/routes/design.tsx
  apps/web/src/app/routes/index.tsx:0
  apps/web/src/app/routes/design.tsx:0
```

Com dois arquivos, o GNU grep prefixa cada contagem com o nome do arquivo; as
duas contagens são `0`, que é o que o critério cobra. Nenhuma leitura de ambiente
cerca a rota. Conteúdo lido de `index.tsx`: `createBrowserRouter` com
`{ path: "/", element: <HealthStatus /> }` e
`{ path: "/design", element: <PaginaViva /> }`, sem condicional.

### [x] 12 — `estrutural` — `RNF-05` — a skill descreve a camada que o repositório passa a usar

```
grep -c '' .claude/skills/react-styling/SKILL.md                              → 199 (maior que 0)
grep -c -F 'tailwind.config.ts' .claude/skills/react-styling/SKILL.md         → 0
grep -c -F '@theme' .claude/skills/react-styling/SKILL.md                     → 3 (maior ou igual a 1)
grep -c -F 'apps/web/src/shared/styles/theme.css' .claude/skills/react-styling/SKILL.md → 1
```

## Instrumentos do implementer

Critérios 8, 9 e 10. Os três saem de `apps/web/e2e/pagina-viva.spec.ts`, arquivo
criado nesta fase pelo avaliado, e o próprio critério amarra o veredicto ao
relatório da execução única — não havia caminho de verificação própria que não
fosse subir a mesma aplicação outra vez, que é o que
`scripts/gates/e2e_uma_subida.sh` existe para impedir.

Para reduzir a dependência, o validador fez três coisas: executou ele mesmo a
suíte (`bash scripts/e2e/relatorio.sh rodar`, 8 de 8 numa subida); leu o código
dos três casos e confirmou que as asserções são exatamente as do
*Dado/Quando/Então* de cada critério, incluindo os controles positivos; e
confirmou em `apps/web/playwright.config.ts` que o alvo é o artefato de build
servido por `vite preview`, não o servidor de desenvolvimento — onde a política
de conteúdo nem existe.

Os fatos que sustentam esses casos e que podiam ser medidos fora dele foram
medidos fora dele: política de nove diretivas e ausência de `font-src` no
critério 7, fonte com hash no artefato no critério 6, `src: url()` sem esquema ou
host no critério 5.

Os critérios 1 a 7, 11 e 12 não dependeram de instrumento do avaliado.

## Apontamentos — fora do escopo dos critérios

**`.harness/gates.json:14,28,43`** — a isenção
`apps/web/src/shared/styles/fonts/**` foi acrescentada a G3, G4 e G5 no mesmo PR
que criou a pasta que ela isenta. Para G3 ela é necessária, e foi medido:
`git ls-files apps/web/src/shared/styles/fonts | bash
scripts/gates/gate3_no_comments.sh` acusa os binários
(`…/fraunces/fraunces-latin-opsz-normal.woff2:11:#c…`), porque bytes comprimidos
casam com o padrão de comentário. Para G4 e G5 a mesma medição não acusa nada —
os dois saem limpos sobre esses arquivos mesmo sem a isenção. O problema não é o
excesso: é que a isenção é **por pasta**, e o próprio critério 3 desta fase
argumenta que a exclusão precisa ser por arquivo justamente para que "um `.tsx`
guardado ali continue reprovando". Como está, um `.tsx` colocado em
`apps/web/src/shared/styles/fonts/` escapa de G3, G4 e G5 — o buraco que o
critério 3 fecha na sua própria régua fica aberto na régua global.

> **Fechado nesta mesma fase.** A isenção passou a ser por arquivo (`**/*.woff2`)
> nos três gates, e o controle positivo foi medido: com um `.tsx` versionado
> dentro da pasta de fontes, o G3 acusa `controle.tsx:1` e o runner sai com
> código `1`. Ver `D26` em `decisoes-autonomas.md`.

**`apps/web/src/app/main.tsx:14`** — `document.documentElement.classList.add("tema-claro")`
fixa o tema claro no boot, sem ler `prefers-color-scheme` nem qualquer
preferência salva. Consequência: o bloco `.tema-escuro` de
`apps/web/src/shared/styles/theme.css:112` não é alcançado por nenhum caminho do
artefato construído, e o contraste que o critério 2 aprova nele é aritmética
sobre o CSS, nunca pixel renderizado por navegador. Registrado para que a fase
que trouxer o alternador saiba que o tema escuro entra em produção sem nunca ter
passado por medição de navegador.

> **Previsto pelo plano.** A etapa 1.5 fixa a classe em `tema-claro` nesta fase e
> põe a leitura de `localStorage` e de `prefers-color-scheme` na fase 4, junto do
> alternador que a torna observável. O apontamento não é defeito desta fase; é a
> medição que a fase 4 passa a dever.

**`apps/web/src/shared/styles/theme.css:70`** — `--breakpoint-telefone: 768px`
dentro de `@theme` gera, no Tailwind v4, uma variante `telefone:` de
**min-width** 768px, isto é, que se aplica de tablet para cima e nunca em
telefone. `apps/web/src/app/routes/design.tsx:105` já usa
`grid-cols-2 telefone:grid-cols-3`, que entrega 2 colunas no telefone e 3 acima
de 768px: o comportamento é o desejado, mas o nome diz o oposto do que a variante
faz. Com quatro fases de layout pela frente, um nome invertido é fonte previsível
de erro de leitura.

> Registrado como divergência `D-004`.

**`apps/web/src/shared/styles/theme.css:50-56` contra `:76-82`** — os seis valores
do tema claro estão escritos duas vezes: no bloco `@theme`, que gera as
utilitárias (`bg-papel`, `text-tinta`), e no bloco `.tema-claro`, que permite a
troca de tema. A duplicação é inerente à abordagem, mas nada amarra as duas
cópias, e o critério 2 só lê `.tema-claro`: mudar uma e esquecer a outra diverge
em silêncio, sem que portão ou critério acuse.

> Registrado como divergência `D-005`.

## Nota sobre a gravação deste arquivo

O `phase-validator` não gravou este veredicto, embora a skill
`harness-orchestrator` o instrua a gravá-lo: `.harness/tool-matrix.json` declara
`writes: []` e nega `Write` nas ferramentas do agent. Ele recusou o caminho
canônico por escopo e um caminho em `/tmp` por ferramenta, e não contornou por
`Bash` — corretamente. O texto acima foi reproduzido por ele no retorno e
gravado pela thread principal, sem edição de conteúdo. A contradição entre a
skill e a matriz está na proposta `.harness/proposals/2026-09-09-003.md`.
