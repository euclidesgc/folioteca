# Plano — 027-vulnerabilidade-conhecida-reprova-no-ci · O CI reprova quando uma dependência do lockfile tem vulnerabilidade conhecida

**Item:** `027-vulnerabilidade-conhecida-reprova-no-ci` · **Trilha:** rápida ·
**Brief:** `01-brief.md` (aprovado em 04/09/2026, `RF-01` a `RF-20`, funde PRD e
spec) · **Decisões fixadas:** `decisoes-autonomas.md` (`D1` a `D37`)

## Objetivo

Ao fim da fase única, um portão versionado audita o `pnpm-lock.yaml` da raiz em
todo pull request e em todo push para `main` e `develop`, imprime quantos pacotes
mediu e quantos avisos de cada severidade encontrou, reprova por aviso `high` ou
`critical` que não tenha isenção nominal com prazo em vigor, e reprova dizendo
`não consegui auditar` quando não conseguiu falar com o registro — nunca `0
achados`. Junto dele vem o teste que prova que ele morde, cobrado como passo
próprio do CI.

A quebra é **uma fase só** porque não há contrato entre partes a fixar antes: o
portão, o teste que o exercita e as três linhas que o invocam nascem do mesmo
arquivo de shell e do mesmo formato de JSON. Um segundo corte só produziria uma
fase que entrega portão sem executor — verde por não ser chamado, que é a forma
exata de aprovação sem medição que este item existe para fechar.

---

## Fase 1 — O portão audita o lockfile e o CI o cobra (raiz + CI)

**Branch:** `027-vulnerabilidade-conhecida-reprova-no-ci/fase-1-portao-de-vulnerabilidade`,
nascida de `develop`.

**Objetivo da fase:** `scripts/gates/vulnerabilidade.sh` audita o
`pnpm-lock.yaml` da raiz, reprova achado `high` ou `critical` fora de isenção
vigente, falha fechada quando não conseguiu medir, e é cobrado pelo
`gates_runner.sh` e por dois passos de `.github/workflows/portoes.yml`.

**Arquivos tocados:** `scripts/gates/vulnerabilidade.sh`,
`scripts/gates/__tests__/vulnerabilidade.test.sh`,
`scripts/gates/__tests__/fixtures/*.json`, `scripts/gates/gates_runner.sh`,
`.github/workflows/portoes.yml`, `.github/dependabot.yml`.

**Risco de execução — vermelho que não é desta fase.** A isenção nominal de `qs`
na quarentena de sete dias vence em `2026-09-05`. A partir desse dia
`scripts/gates/quarentena.sh` reprova por vencimento em **todo** PR do
repositório, não só nos que mexem em dependência — o que deixa
`bash scripts/gates/gates_runner.sh --sem-artefatos` vermelho por um portão
vizinho. Fechar isso é o item `049-a-isencao-de-qs-vence-e-alguem-precisa-fecha-la`
do roadmap, fora deste escopo; por isso nenhum critério desta fase mede o código
de saída do agregador, só a linha que o portão novo imprime. Quem executar esta
fase depois de `2026-09-05` vai ver esse vermelho, e ele não é seu.

**Segundo risco — `jq` no runner.** O portão passa a depender de `jq` para
filtrar o JSON (`D3`), e nenhum portão de produção depende dele hoje. A imagem
`ubuntu-latest` do runner traz `jq` instalado, então não entra passo de
instalação; a rede de segurança é `exige_comando jq` dentro do portão, que
transforma uma mudança futura da imagem em reprovação nomeando o binário ausente,
em vez de erro de parse silencioso.

**Critérios de aceite:**

- [ ] `estrutural` — `RF-01`, `RF-11` — existe `scripts/gates/vulnerabilidade.sh`
      contendo a cadeia `pnpm audit --audit-level=high --json`, a linha
      `ISENCOES_DECLARADAS=()` com a lista vazia, e a linha
      `source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"`.
- [ ] `estrutural` — `RF-09`, `RF-10` — `scripts/gates/vulnerabilidade.sh` contém
      `exige_comando pnpm`, `exige_comando jq`, `exige_comando timeout`,
      `exige_comando mktemp` e `exige_caminho pnpm-lock.yaml`; a linha com
      `exige_comando pnpm` aparece antes da linha com `exige_comando jq` e antes
      de qualquer outra linha que comece com `exige_comando` ou `exige_caminho`.
- [ ] `estrutural` — `RF-03`, `RF-05`, `RF-07`, `RF-19` — existem, em
      `scripts/gates/__tests__/fixtures/`, os nove arquivos
      `pnpm-audit-limpo.json`, `pnpm-audit-qs-alto.json`,
      `pnpm-audit-moderado.json`, `pnpm-audit-dev.json`,
      `pnpm-audit-sem-pacote.json`, `pnpm-audit-podado.json`,
      `pnpm-audit-forma-desconhecida.json`, `pnpm-audit-erro-de-rede.json` e
      `pnpm-audit-erro-com-quebra.json`; sobre `pnpm-audit-qs-alto.json`,
      `jq -r '.advisories | keys | join(",")'` imprime
      `GHSA-4mjr-xmp4-gh2g,GHSA-x5fp-wj9c-mxmx`,
      `jq -r '.metadata.totalDependencies'` imprime `923` e
      `jq -r '.metadata.vulnerabilities.high'` imprime `2`; sobre
      `pnpm-audit-dev.json`, `jq -r '.metadata.vulnerabilities.critical'` imprime
      `1` e `jq -r '[.advisories[].findings[].paths[]] | join(" ")'` imprime uma
      cadeia que contém `pacote-de-desenvolvimento-de-mentira`; sobre
      `pnpm-audit-podado.json`, `jq -r '.advisories | length'` imprime `0` e
      `jq -r '.metadata.vulnerabilities.high'` imprime `2`; sobre
      `pnpm-audit-forma-desconhecida.json`, `jq -r '.advisories | type'` imprime
      `string` e `jq -r '.metadata.vulnerabilities.high'` imprime `1`; sobre
      `pnpm-audit-erro-de-rede.json`, `jq -r '.error.message'` imprime
      `The operation was aborted due to timeout` e `jq -r 'has("metadata")'`
      imprime `false`; e sobre `pnpm-audit-erro-com-quebra.json`,
      `jq -r '.error.message | contains("\n::stop-commands::")'` imprime `true`.
      Cada `jq` recebe o arquivo por argumento e corre na raiz do repositório: o
      arquivo que não existe, ou que não é JSON, faz o comando sair com erro em
      vez de imprimir o valor esperado, e aí o critério reprova por não ter
      conseguido medir, não por ter medido e achado outra coisa.
- [ ] `estrutural` — `RF-16` — cada uma das quatro cadeias
      `bash "$ROOT/scripts/gates/quarentena.sh" || VEREDICTO=1`,
      `bash "$ROOT/scripts/gates/acoes_em_sha.sh" || VEREDICTO=1`,
      `bash "$ROOT/scripts/gates/vulnerabilidade.sh" || VEREDICTO=1` e
      `if [ "$SEM_ARTEFATOS" -eq 1 ]; then` aparece exatamente uma vez em
      `scripts/gates/gates_runner.sh`, medido por
      `grep -c -F '<a cadeia>' scripts/gates/gates_runner.sh`, que imprime `1`
      para cada uma das quatro — arquivo ausente ou cadeia que não está lá faz o
      comando terminar sem imprimir `1`, e o critério reprova por não ter
      conseguido medir. E, nos números de linha que
      `grep -n -F '<a cadeia>' scripts/gates/gates_runner.sh` imprime, o da linha
      de `vulnerabilidade.sh` é **maior** que o da linha de `quarentena.sh` e
      **maior** que o da linha de `acoes_em_sha.sh`, e **menor** que o da linha
      `if [ "$SEM_ARTEFATOS" -eq 1 ]; then`: é a vizinhança dessas duas
      invocações, antes do `if`, que faz do lugar o bloco de portões diretos.
- [ ] `estrutural` — `RF-17` — em `.github/workflows/portoes.yml`, o passo cujo
      corpo é `run: bash scripts/gates/vulnerabilidade.sh` é o passo
      imediatamente seguinte ao passo cujo corpo é
      `run: bash scripts/gates/acoes_em_sha.sh`; existe também um passo cujo
      corpo é `run: bash scripts/gates/__tests__/vulnerabilidade.test.sh`, e ele
      aparece antes do passo cujo corpo é `run: bash scripts/gates/quarentena.sh`;
      o bloco `on:` do arquivo declara `push:` com `branches: [main, develop]` e
      declara `pull_request:`, medido por
      `grep -c -F '  pull_request:' .github/workflows/portoes.yml`, que imprime
      `1` — arquivo ausente faz o comando terminar sem imprimir `1`, e o critério
      reprova por não ter conseguido medir. O bloco `pull_request:` são as linhas
      seguintes a essa com recuo maior que o dela, até a primeira linha de recuo
      igual ou menor: nele não aparece nenhuma das quatro chaves `branches:`,
      `branches-ignore:`, `paths:` e `paths-ignore:`, e, se aparecer a chave
      `types:`, o conjunto de valores dela é exatamente `opened`, `reopened` e
      `synchronize`, em qualquer ordem — esses três são o conjunto que o GitHub
      Actions aplica quando `types:` é omitido, então declará-lo à mão não
      estreita gatilho nenhum. E o arquivo inteiro não traz nenhuma das duas
      chaves `paths:` e `paths-ignore:`, medido por
      `grep -c -E '^[[:space:]]*paths(-ignore)?:' .github/workflows/portoes.yml`,
      que imprime `0`.
- [ ] `estrutural` — `RF-18` — `.github/dependabot.yml` contém a cadeia
      `041-a-rotina-alcanca-os-pacotes-de-javascript` e não contém a cadeia
      `027-vulnerabilidade-conhecida-reprova-no-ci`.
- [ ] `comando` — `RF-01`, `RF-11` — o portão fixa em si mesmo o piso de
      severidade e o alcance da auditoria, e a lista de isenções é a constante do
      próprio arquivo. Executados na raiz do repositório, os quatro comandos, e o
      primeiro é o que separa *não achei* de *não consegui procurar*:
      `grep -cvE '^[[:space:]]*#' scripts/gates/vulnerabilidade.sh`
      imprime um número **maior que** `0`, que é a prova de que
      `scripts/gates/vulnerabilidade.sh` existe, foi lido e tem linha de código —
      sem ela, um arquivo ausente ou ilegível faria os dois comandos seguintes
      saírem mudos e passarem pelo mesmo teste por que passa o arquivo correto;
      `grep -vE '^[[:space:]]*#' scripts/gates/vulnerabilidade.sh | grep -E -- 'pnpm config|--prod|--dev|--no-optional'`
      não imprime nenhuma linha;
      `grep -vE '^[[:space:]]*#' scripts/gates/vulnerabilidade.sh | grep -E -- 'pnpm audit|auditConfig|ignoreGhsas|audit\.ignore' | grep -vE -- '_reprova|--audit-level=high'`
      não imprime nenhuma linha — toda linha de código que invoca a auditoria traz
      `--audit-level=high` na própria invocação, e as chaves de isenção da
      configuração do pnpm só aparecem em linha que também é uma reprovação, que é
      onde nomeá-las torna o log acionável; e
      `grep -c '^ISENCOES_DECLARADAS=' scripts/gates/vulnerabilidade.sh` imprime
      o número `1`.
- [ ] `comando` — `RF-02`, `RF-03`, `RF-04`, `RF-05`, `RF-07`, `RF-08`, `RF-12`,
      `RF-14`, `RF-15` — `bash scripts/gates/__tests__/vulnerabilidade.test.sh`,
      executado na raiz do repositório, termina com código de saída `0`, imprime
      uma linha que contém `✓ vulnerabilidade.sh:` e não imprime nenhuma linha
      que contenha `FALHA`.
- [ ] `comando` — `RF-06` — `bash scripts/gates/vulnerabilidade.sh`, executado na
      raiz do repositório, imprime uma linha que contém `pacote(s) auditado(s)`
      junto de `critical:`, `high:`, `moderate:` e `low:` — ou, quando a máquina
      não alcança o registro npm, uma linha que contém `não consegui auditar`,
      caso em que o código de saída é diferente de `0` e a saída não contém
      `✓ vulnerabilidade:` nem `critical:`. As duas linhas nunca aparecem na
      mesma execução.
- [ ] `comando` — `RF-16` — `bash scripts/gates/gates_runner.sh --sem-artefatos`,
      executado na raiz do repositório, imprime uma linha que contém
      `✓ vulnerabilidade:` ou uma linha que contém `não consegui auditar`. O
      código de saída deste comando não entra neste critério: ele soma outros
      portões do repositório, e a isenção de `qs` da quarentena vence em
      `2026-09-05`.
- [ ] `comportamental` — `RF-02`, `RF-13`
      *Dado* a fixture montada na raiz do repositório por
      `d=/tmp/vuln-limpo; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-limpo.json"\nexit 0\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-limpo PATH=/tmp/vuln-limpo/bin:$PATH bash scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `0`, a saída contém a linha
      `medido: 0 isenção(ões) declarada(s)` e a saída contém a cadeia
      `923 pacotes auditados, 0 achados de severidade alta ou crítica, 0 isenções`
- [ ] `comportamental` — `RF-03`, `RF-06`
      *Dado* a fixture montada na raiz do repositório por
      `d=/tmp/vuln-qs; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-qs-alto.json"\nexit 1\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-qs PATH=/tmp/vuln-qs/bin:$PATH bash scripts/gates/vulnerabilidade.sh > /tmp/vuln-qs.saida 2> /tmp/vuln-qs.erro`
      é executado na raiz do repositório
      *Então* o código de saída é diferente de `0`; `/tmp/vuln-qs.saida` contém
      uma linha com `qs@6.15.3`, `GHSA-4mjr-xmp4-gh2g`, `high` e `6.16.0` juntos;
      contém outra linha com `qs@6.15.3`, `GHSA-x5fp-wj9c-mxmx`, `high` e
      `6.16.0` juntos; contém uma linha com `923`, `critical: 0`, `high: 2`,
      `moderate: 0` e `low: 0` juntos; o número de linha que
      `grep -n -- 'pacote(s) auditado(s)' /tmp/vuln-qs.saida` imprime é **menor**
      que o primeiro número de linha que
      `grep -n 'achado:' /tmp/vuln-qs.saida` imprime — as duas linhas comparadas
      saem na mesma saída padrão, então a ordem no arquivo é a ordem em que o
      portão as escreveu; e `/tmp/vuln-qs.erro` contém a cadeia
      `::error::vulnerabilidade conhecida no lockfile`
- [ ] `comportamental` — `RF-04`
      *Dado* a fixture montada na raiz do repositório por
      `d=/tmp/vuln-moderado; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-moderado.json"\nexit 0\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-moderado PATH=/tmp/vuln-moderado/bin:$PATH bash scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `0`, a saída contém uma linha com `moderate: 3`
      e `low: 5` juntos, e a saída contém a cadeia
      `0 achados de severidade alta ou crítica`
- [ ] `comportamental` — `RF-01`, `RF-05`
      *Dado* a fixture cujo único aviso é alcançado por um caminho de
      `devDependencies`, montada na raiz do repositório por
      `d=/tmp/vuln-dev; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-dev.json"\nexit 1\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-dev PATH=/tmp/vuln-dev/bin:$PATH bash scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório
      *Então* o código de saída é diferente de `0`, a saída contém uma linha com
      `pacote-de-desenvolvimento-de-mentira@1.0.0`, `GHSA-fals-odev-1111` e
      `critical` juntos, e a saída contém uma linha com `923` e `critical: 1`
      juntos
- [ ] `comportamental` — `RF-06`, `RF-07`, `RF-08`
      *Dado* duas fixtures montadas na raiz do repositório, a primeira em que a
      ferramenta não devolve JSON nenhum, por
      `d=/tmp/vuln-sem-json; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\necho "TypeError: fetch failed" >&2\nexit 1\n' > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      e a segunda em que ela devolve JSON com nenhum pacote, por
      `z=/tmp/vuln-zero; rm -rf "$z"; mkdir -p "$z/bin"; printf "lockfileVersion: '9.0'\n" > "$z/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-sem-pacote.json"\nexit 0\n' "$PWD" > "$z/bin/pnpm"; chmod +x "$z/bin/pnpm"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-sem-json PATH=/tmp/vuln-sem-json/bin:$PATH bash scripts/gates/vulnerabilidade.sh`
      e
      `env GITHUB_WORKSPACE=/tmp/vuln-zero PATH=/tmp/vuln-zero/bin:$PATH bash scripts/gates/vulnerabilidade.sh`
      são executados em seguida na raiz do repositório, cada um com as duas
      saídas capturadas juntas
      *Então* os dois terminam com código de saída diferente de `0`, as duas
      saídas contêm a cadeia `não consegui auditar`, as duas contêm
      `REPROVADO por impossibilidade de medição, não por resultado.`, nenhuma das
      duas contém a cadeia `0 achados de severidade alta ou crítica`, e nenhuma
      das duas contém a cadeia `critical:` — sem `metadata.totalDependencies`
      lido não existe contagem de severidade a imprimir, e imprimir zeros aqui
      seria dizer `0 achados` por outro nome
- [ ] `comportamental` — `RF-11`
      *Dado* a fixture em que a auditoria devolve os dois avisos altos e termina
      com código de saída `0`, e em que o diretório de quem executa declara os
      dois identificadores como ignorados, montada na raiz do repositório por
      `d=/tmp/vuln-config; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf 'auditConfig:\n  ignoreGhsas:\n    - GHSA-4mjr-xmp4-gh2g\n    - GHSA-x5fp-wj9c-mxmx\n' > "$d/pnpm-workspace.yaml"; printf 'audit-level=critical\n' > "$d/.npmrc"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-qs-alto.json"\nexit 0\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      *Quando*
      `env HOME=/tmp/vuln-config GITHUB_WORKSPACE=/tmp/vuln-config PATH=/tmp/vuln-config/bin:$PATH bash scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório
      *Então* o código de saída é diferente de `0` e a saída contém
      `GHSA-4mjr-xmp4-gh2g` e `GHSA-x5fp-wj9c-mxmx` em linhas de achado
- [ ] `comportamental` — `RF-11`, `RF-19`
      *Dado* o relatório que a ferramenta devolve quando a isenção está na
      configuração do pnpm — a contagem inteira em `metadata`, com
      `vulnerabilities.high` igual a `2` e `totalDependencies` igual a `923`, e
      `advisories` vazio —, montado na raiz do repositório por
      `d=/tmp/vuln-podado; rm -r "$d" 2>/dev/null; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-podado.json"\nexit 0\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-podado PATH=/tmp/vuln-podado/bin:$PATH bash scripts/gates/vulnerabilidade.sh 2>&1`
      é executado na raiz do repositório, com as duas saídas capturadas juntas
      *Então* o código de saída é diferente de `0`; a saída contém a cadeia
      `não consegui auditar` e a cadeia
      `REPROVADO por impossibilidade de medição, não por resultado.`; nomeia os
      dois números divergentes, na cadeia
      `a contagem do relatório diz 2 aviso(s) de severidade alta ou crítica` e na
      cadeia `a lista de avisos traz 0`; contém a cadeia
      `ISENCOES_DECLARADAS de scripts/gates/vulnerabilidade.sh`; e não contém nem
      a cadeia `0 achados de severidade alta ou crítica` nem a cadeia `critical:`
- [ ] `comportamental` — `RF-20`
      *Dado* quatro raízes auditadas iguais, cada uma com o `pnpm` de mentira que
      registra em `chamou-audit` que foi chamado, diferindo só na declaração de
      registro: a primeira com `registry=https://espelho.exemplo/` no `.npmrc`, a
      segunda com `registry = https://espelho.exemplo/` — com o espaço em volta
      do `=` que o `ini` do pnpm apara e uma peneira ingênua não —, a terceira
      com `registry: https://espelho.exemplo/` no `pnpm-workspace.yaml`, e a
      quarta com `@empresa:registry=https://espelho.exemplo/` no `.npmrc`, que é
      a declaração com escopo, montadas na raiz do repositório por
      `for i in 1 2 3 4; do d=/tmp/vuln-registro-$i; rm -r "$d" 2>/dev/null; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\n: > "%s/chamou-audit"\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-limpo.json"\nexit 0\n' "$d" "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"; done; printf 'registry=https://espelho.exemplo/\n' > /tmp/vuln-registro-1/.npmrc; printf 'registry = https://espelho.exemplo/\n' > /tmp/vuln-registro-2/.npmrc; printf 'registry: https://espelho.exemplo/\nminimumReleaseAge: 10080\n' > /tmp/vuln-registro-3/pnpm-workspace.yaml; printf '@empresa:registry=https://espelho.exemplo/\n' > /tmp/vuln-registro-4/.npmrc`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-registro-1 PATH=/tmp/vuln-registro-1/bin:$PATH bash scripts/gates/vulnerabilidade.sh 2>&1`
      é executado na raiz do repositório, e o mesmo comando trocando
      `/tmp/vuln-registro-1` por `/tmp/vuln-registro-2`, por
      `/tmp/vuln-registro-3` e por `/tmp/vuln-registro-4`, cada um com as duas
      saídas capturadas juntas
      *Então* as quatro terminam com código de saída diferente de `0`; as quatro
      saídas contêm a cadeia `não consegui auditar`, a cadeia
      `medido: 1 registro(s) declarado(s) fora de https://registry.npmjs.org`, a
      cadeia `aponta o registro para fora de https://registry.npmjs.org` — que
      nomeia o registro esperado — e a cadeia
      `REPROVADO por impossibilidade de medição, não por resultado.`; e nenhum
      dos arquivos `/tmp/vuln-registro-1/chamou-audit`,
      `/tmp/vuln-registro-2/chamou-audit`, `/tmp/vuln-registro-3/chamou-audit` e
      `/tmp/vuln-registro-4/chamou-audit` existe
- [ ] `comportamental` — `RF-09`
      *Dado* o diretório sem `pnpm-lock.yaml` cujo `pnpm` de mentira registra em
      `/tmp/vuln-sem-lock/chamou-audit` que foi chamado, montado na raiz do
      repositório por
      `d=/tmp/vuln-sem-lock; rm -rf "$d"; mkdir -p "$d/bin"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\n: > /tmp/vuln-sem-lock/chamou-audit\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-limpo.json"\nexit 0\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-sem-lock PATH=/tmp/vuln-sem-lock/bin:$PATH bash scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório
      *Então* o código de saída é diferente de `0`, a saída contém
      `pnpm-lock.yaml` e
      `REPROVADO por impossibilidade de medição, não por resultado.`, e o arquivo
      `/tmp/vuln-sem-lock/chamou-audit` não existe
- [ ] `comportamental` — `RF-10`
      *Dado* o PATH mínimo que tem tudo de que o portão precisa menos `pnpm`,
      montado na raiz do repositório por
      `d=/tmp/vuln-sem-pnpm; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; for e in dirname git tr cat date jq; do c="$(command -v "$e")" && ln -sf "$c" "$d/bin/$e"; done`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-sem-pnpm PATH=/tmp/vuln-sem-pnpm/bin "$(command -v bash)" scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório — o `bash` por caminho absoluto porque o
      PATH mínimo não o contém
      *Então* o código de saída é diferente de `0` e a saída contém
      `o comando 'pnpm' não está no PATH` e
      `REPROVADO por impossibilidade de medição, não por resultado.`
- [ ] `comportamental` — `RF-02`, `RF-12`, `RF-13`
      *Dado* a fixture com os dois avisos altos, montada por
      `d=/tmp/vuln-qs; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-qs-alto.json"\nexit 1\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`,
      e uma cópia do portão com a lista de isenções preenchida com prazo no
      futuro, montada por
      `c=/tmp/vuln-vigente; rm -rf "$c"; mkdir -p "$c/scripts/gates"; cp scripts/gates/medir.sh "$c/scripts/gates/"; sed 's|^ISENCOES_DECLARADAS=()$|ISENCOES_DECLARADAS=("GHSA-4mjr-xmp4-gh2g:2099-01-01" "GHSA-x5fp-wj9c-mxmx:2099-01-01")|' scripts/gates/vulnerabilidade.sh > "$c/scripts/gates/vulnerabilidade.sh"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-qs PATH=/tmp/vuln-qs/bin:$PATH bash /tmp/vuln-vigente/scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `0`; a saída contém
      `medido: 2 isenção(ões) declarada(s)`; contém uma linha com
      `GHSA-4mjr-xmp4-gh2g` e `2099-01-01` juntos; contém outra linha com
      `GHSA-x5fp-wj9c-mxmx` e `2099-01-01` juntos; e contém a cadeia
      `0 achados de severidade alta ou crítica, 2 isenções`
- [ ] `comportamental` — `RF-14`
      *Dado* a fixture com os dois avisos altos, montada por
      `d=/tmp/vuln-qs; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-qs-alto.json"\nexit 1\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`,
      e uma cópia do portão com as duas isenções ainda escritas no arquivo e com
      prazo no passado, montada por
      `c=/tmp/vuln-vencida; rm -rf "$c"; mkdir -p "$c/scripts/gates"; cp scripts/gates/medir.sh "$c/scripts/gates/"; sed 's|^ISENCOES_DECLARADAS=()$|ISENCOES_DECLARADAS=("GHSA-4mjr-xmp4-gh2g:2020-01-01" "GHSA-x5fp-wj9c-mxmx:2020-01-01")|' scripts/gates/vulnerabilidade.sh > "$c/scripts/gates/vulnerabilidade.sh"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/vuln-qs PATH=/tmp/vuln-qs/bin:$PATH bash /tmp/vuln-vencida/scripts/gates/vulnerabilidade.sh`
      é executado na raiz do repositório
      *Então* o código de saída é diferente de `0`; a saída contém uma linha com
      `GHSA-4mjr-xmp4-gh2g` e `VENCIDA em 2020-01-01` juntos; e a saída contém
      `GHSA-4mjr-xmp4-gh2g` e `GHSA-x5fp-wj9c-mxmx` em linhas de achado que
      reprovam
- [ ] `comportamental` — `RF-11`, `RF-14`, `RF-15`
      *Dado* o diretório cujo `pnpm` de mentira registra a chamada em
      `/tmp/vuln-isencao-larga/chamou-audit`, montado por
      `d=/tmp/vuln-isencao-larga; rm -rf "$d"; mkdir -p "$d/bin"; printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; printf '#!/bin/sh\n[ "$1" = "audit" ] || exit 0\n: > /tmp/vuln-isencao-larga/chamou-audit\ncat "%s/scripts/gates/__tests__/fixtures/pnpm-audit-limpo.json"\nexit 0\n' "$PWD" > "$d/bin/pnpm"; chmod +x "$d/bin/pnpm"`,
      e três cópias do portão, a primeira com a isenção `qs:2099-01-01`, que
      nomeia um pacote e não um aviso, a segunda com `*:2099-01-01`, que casa com
      qualquer aviso, e a terceira com `GHSA-4mjr-xmp4-gh2g:amanha`, que nomeia um
      aviso e põe no lugar da data de vencimento algo que não é uma data — esta
      terceira é falha de `RF-14`, e não de `RF-15`: ela nomeia um aviso só, que é
      o que o `RF-15` cobra, mas um vencimento que não é data nunca chega, e a
      isenção que não vence sozinha é o que o `RF-14` proíbe —, montadas por
      `i=0; for entrada in 'qs:2099-01-01' '*:2099-01-01' 'GHSA-4mjr-xmp4-gh2g:amanha'; do i=$((i+1)); c=/tmp/vuln-larga-$i; rm -rf "$c"; mkdir -p "$c/scripts/gates"; cp scripts/gates/medir.sh "$c/scripts/gates/"; sed "s|^ISENCOES_DECLARADAS=()\$|ISENCOES_DECLARADAS=(\"$entrada\")|" scripts/gates/vulnerabilidade.sh > "$c/scripts/gates/vulnerabilidade.sh"; done`
      *Quando* as três cópias são executadas em seguida na raiz do repositório
      com
      `env GITHUB_WORKSPACE=/tmp/vuln-isencao-larga PATH=/tmp/vuln-isencao-larga/bin:$PATH bash /tmp/vuln-larga-1/scripts/gates/vulnerabilidade.sh`
      e o mesmo comando trocando `/tmp/vuln-larga-1` por `/tmp/vuln-larga-2` e
      por `/tmp/vuln-larga-3`
      *Então* as três terminam com código de saída diferente de `0`; a primeira
      saída contém `qs:2099-01-01`, a segunda contém `*:2099-01-01` e a terceira
      contém `GHSA-4mjr-xmp4-gh2g:amanha`; as três contêm a cadeia
      `não nomeia um aviso com prazo`; e o arquivo
      `/tmp/vuln-isencao-larga/chamou-audit` não existe depois das três

> A DoD global é do CI e não se repete aqui.

### Etapas

- [ ] 1.1 Criar `scripts/gates/vulnerabilidade.sh`, no molde de
      `scripts/gates/quarentena.sh`: cabeçalho de comentário longo explicando o
      **porquê** em cinco blocos — o veredicto vem do conteúdo do JSON e não do
      código de saída de `pnpm audit`; a lista de isenções mora no script e não
      em `auditConfig.ignoreGhsas`; o piso é `high`, ele cobre `critical` junto e
      `moderate` e `low` aparecem só na contagem; a contagem de `metadata` é
      confrontada com a lista de avisos lida de `.advisories`; e o motor é uma
      função só, com teto de tempo porque ele fala com a rede —, `set -uo
      pipefail` sem `-e`, e o carregamento verbatim
      `RAIZ_DO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"`
      seguido de `source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"`.
      **As constantes:** `ISENCOES_DECLARADAS=()`, que nasce vazia, uma entrada
      por `identificador:AAAA-MM-DD`, com o motivo de cada entrada futura em
      comentário logo acima dela e nunca como terceiro campo — toda iteração
      sobre ela usa `${ISENCOES_DECLARADAS[@]+"${ISENCOES_DECLARADAS[@]}"}`;
      `PADRAO_DE_ISENCAO`, o predicado que valida a entrada;
      `TETO_DA_AUDITORIA=600`, em segundos, que é limite superior e não alvo — uma
      auditoria que passa daqui não está medindo, está pendurada; e
      `ARQUIVO_DE_ERRO=""` junto da função `limpar_arquivo_de_erro()`, que o
      `trap limpar_arquivo_de_erro EXIT` arma ali mesmo.
      **As três funções:** `auditar_lockfile()`, o motor, que executa
      `(cd "$RAIZ" && timeout -k 30 "$TETO_DA_AUDITORIA" pnpm audit --audit-level=high --json 2>"$ARQUIVO_DE_ERRO")`
      e imprime a saída padrão crua, **sem** ler o código de saída da ferramenta;
      `em_uma_linha()`, que passa `tr '\n\r\t' '   '` em toda mensagem vinda de
      fora antes de ela chegar ao log; e `conta_registros() <arquivo>
      <separador>`, que lê o arquivo linha a linha em bash puro — sem `grep` —,
      pula linha vazia e linha iniciada por `#` ou `;`, apara o espaço em volta do
      separador, apara aspas e barra final do valor, conta as chaves `registry` e
      `*:registry` cujo valor **não** é `$REGISTRO_ESPERADO`, e imprime `0` quando
      o arquivo não existe.
      **Todo caminho de impossibilidade sai por `_reprova`**, de `medir.sh`, que é
      quem imprime `::error::portão não conseguiu medir: <razão>` e
      `REPROVADO por impossibilidade de medição, não por resultado.` e sai `1`; o
      portão não repete essas duas cadeias à mão, e cada razão que ele passa a
      `_reprova` começa por `não consegui auditar o pnpm-lock.yaml`.
      A ordem das checagens é:
      (a) validar cada entrada de `ISENCOES_DECLARADAS` contra
      `^(GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|[0-9]+):[0-9]{4}-[0-9]{2}-[0-9]{2}$`
      e, na primeira que não casar,
      `printf '::error::isenção que não nomeia um aviso com prazo: %s. A entrada é <identificador do aviso>:<AAAA-MM-DD>, e o identificador é um GHSA ou o número do aviso — nome de pacote ou curinga casaria com mais de um aviso e esconderia o próximo, que ninguém decidiu aceitar.\n' "$entrada" >&2`
      seguido de `exit 1`;
      (b) `exige_comando pnpm`;
      (c) `exige_comando jq`;
      (d) `exige_comando timeout`, porque o motor envolve a chamada de rede em
      `timeout -k 30 "$TETO_DA_AUDITORIA"`. Justificativa: chamada de rede sem
      teto não reprova nem aprova — ela pendura o job até o limite de seis horas
      do runner, e medido nesta máquina uma execução levou 242 segundos e a
      anterior não respondeu em 180 —, e com o teto o processo morre, a saída
      padrão fica vazia e o portão cai no mesmo `não consegui auditar` de (k); o
      `-k 30` existe para o processo que ignora o `SIGTERM`, que é o cenário que o
      teto existe para eliminar (`D19`, `D24`);
      (e) `exige_comando mktemp`, porque a saída de erro da auditoria é lida de um
      arquivo criado por `mktemp` em (g). Justificativa: descartar a saída de erro
      com `2>/dev/null` esconde se foi proxy, TLS ou registro fora do ar, e o
      portão reprovaria certo sem dizer o que consertar (`D24`); o arquivo vem de
      `mktemp` e não de nome derivado do PID porque nome previsível em diretório
      compartilhado é arquivo que outro usuário planta como link antes, e o `2>`
      do shell segue link — o `trap` cobre a interrupção, que o `rm` do caminho
      feliz não cobre (`D28`);
      (f) `exige_caminho pnpm-lock.yaml "o lockfile da raiz que a auditoria lê"`;
      (g) `ARQUIVO_DE_ERRO="$(mktemp)"`, e o `mktemp` que não cria o arquivo cai
      em `_reprova "não consegui auditar o pnpm-lock.yaml: mktemp não criou o arquivo onde a saída de erro da auditoria seria lida"`;
      (h) `RAIZ="$(medir_raiz)"` e `HOJE="$(date -u +%Y-%m-%d)"`;
      (i) a peneira de registro: a constante
      `REGISTRO_ESPERADO='https://registry.npmjs.org'`,
      `REDIRECIONAMENTOS=$(( $(conta_registros "$RAIZ/.npmrc" '=') + $(conta_registros "$RAIZ/pnpm-workspace.yaml" ':') ))`,
      a linha
      `medido: <n> registro(s) declarado(s) fora de https://registry.npmjs.org em .npmrc e pnpm-workspace.yaml`
      e, com `<n>` diferente de zero,
      `_reprova "não consegui auditar o pnpm-lock.yaml: a configuração da raiz sob $RAIZ aponta o registro para fora de $REGISTRO_ESPERADO, e quem responde a auditoria passa a ser escolhido pelo arquivo do pull request — a contagem de pacotes é local e continuaria dizendo o número certo sobre uma resposta que ninguém verificou"`.
      Justificativa: quem responde a auditoria é escolhido pela configuração da
      raiz, que é arquivo do PR, e um espelho que devolva `{"advisories":{}}` é
      internamente coerente — passa pelo confronto de (o), faria o portão imprimir
      os pacotes do lockfile, que são contados localmente, e aprovar com zero
      achados, de quebra entregando a árvore de dependências ao servidor que o
      autor do PR escolheu (`D22`). As duas casas valem porque o `ini` que o npm e
      o pnpm leem apara o espaço em volta do `=` — uma peneira que só casasse
      `registry=` seria derrotada por um espaço, e a linha `medido:` passaria a
      afirmar zero com um redirecionamento em vigor — e porque o
      `pnpm-workspace.yaml` é onde este repositório já guarda `minimumReleaseAge`
      e `overrides`; e o que se compara é **para onde** o registro aponta, e não a
      existência da declaração, porque fixar o registro oficial à mão é
      endurecimento (`D27`). A leitura é em bash puro para não acrescentar binário
      à lista que os critérios de PATH mínimo fixam (`D22`). Esta checagem vem
      antes de `auditar_lockfile`, e é ela que faz `RF-20` reprovar antes de
      qualquer chamada de rede;
      (j) `ISENCOES_VIGENTES=()`, a linha `medido: <n> isenção(ões) declarada(s)`
      e uma linha por isenção — `  isenção: <id> vigente até <data>` quando
      `[[ "$HOJE" < "$vence" ]]`, caso em que o `<id>` entra em
      `ISENCOES_VIGENTES`, e
      `  isenção: <id> VENCIDA em <data> — o aviso volta a reprovar` quando não;
      (k) `JSON="$(auditar_lockfile)"`; a razão que a ferramenta escreveu é lida
      do arquivo de erro por
      `RAZAO_DA_FERRAMENTA="$(em_uma_linha "$(head -c 400 "$ARQUIVO_DE_ERRO" 2>/dev/null)")"`
      — os 400 primeiros bytes — e o arquivo é removido em seguida; com `$JSON`
      vazio ou que não passe em `jq -e 'type == "object"'`,
      `_reprova "não consegui auditar o pnpm-lock.yaml: 'pnpm audit --audit-level=high --json' não devolveu JSON sob $RAIZ — registro inalcançável e vulnerabilidade encontrada saem as duas com código 1, e só o conteúdo do JSON as separa. A ferramenta disse: ${RAZAO_DA_FERRAMENTA:-nada}"`.
      Justificativa: a mensagem atravessa `em_uma_linha` porque ela vem de fora, e
      uma quebra de linha no meio dela poria `::stop-commands::` ou `::add-mask::`
      no começo de uma linha do log, que o runner obedeceria — comando de fluxo só
      vale no começo da linha (`D24`);
      (l) `ERRO_DA_FERRAMENTA`, lido por `jq -r '.error.message // empty'` e
      também passado por `em_uma_linha`, e com ele não vazio
      `_reprova "não consegui auditar o pnpm-lock.yaml: a ferramenta devolveu erro em vez de auditoria sob $RAIZ — $ERRO_DA_FERRAMENTA"`.
      Justificativa: medido contra o registro de verdade, quando ele não responde
      `pnpm audit --json` **não** fica sem saída — devolve JSON válido cujo corpo
      inteiro é
      `{"error": {"code": 23, "message": "The operation was aborted due to timeout"}}`,
      que passa por qualquer teste de forma e cairia no `// 0` do filtro de (m),
      fazendo o portão reprovar pelo caminho certo dizendo a razão errada,
      *auditoria de nenhum pacote*, que manda quem lê procurar um lockfile vazio
      que não existe (`D20`);
      (m) as contagens por
      `jq -r '[.metadata.vulnerabilities.critical // 0, .metadata.vulnerabilities.high // 0, .metadata.vulnerabilities.moderate // 0, .metadata.vulnerabilities.low // 0, .metadata.totalDependencies // 0] | @tsv'`,
      com o código de saída do `jq` lido —
      `|| _reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria sob $RAIZ não respondeu ao filtro de contagem — o relatório mudou de forma, e ler zero de um formato que este portão já não conhece é dizer 0 achados por outro nome"` —,
      `IFS=$'\t' read -r CRITICAS ALTAS MODERADAS BAIXAS TOTAL`, `TOTAL` vazio ou
      não numérico normalizado para `0`, e com `TOTAL` igual a zero
      `_reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria traz metadata.totalDependencies = 0 sob $RAIZ — auditoria de nenhum pacote não é lockfile limpo"`.
      Justificativa: sem ler o código de saída do `jq`, a atribuição engole o erro,
      a variável fica vazia, e vazio é indistinguível de lockfile limpo;
      (n) os achados por
      `jq -r '(.advisories // {}) | to_entries[] | .value as $a | ($a.github_advisory_id // .key) as $id | select($a.severity == "high" or $a.severity == "critical") | [$id, ($a.module_name // "?"), ((($a.findings // [])[0]).version // "?"), $a.severity, ($a.patched_versions // "?")] | @tsv'`,
      com o código de saída lido pelo mesmo motivo —
      `|| _reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria sob $RAIZ não respondeu ao filtro de achados — sem a lista, vazio é indistinguível de lockfile limpo"` —
      e `LIDOS` contando as linhas não vazias que o filtro devolveu;
      (o) o confronto: `GRAVES=$((CRITICAS + ALTAS))` e, com `LIDOS` diferente de
      `GRAVES`,
      `_reprova "não consegui auditar o pnpm-lock.yaml: a contagem do relatório diz $GRAVES aviso(s) de severidade alta ou crítica sob $RAIZ e a lista de avisos traz $LIDOS — 'pnpm audit --json' poda .advisories pela isenção da configuração (audit.ignore ou auditConfig.ignoreGhsas, que 'pnpm audit --ignore' grava sozinho no pnpm-workspace.yaml) e pelo piso de nível, sem tocar em metadata, e a diferença é exatamente o que ficaria escondido. Se a isenção é legítima, ela se declara em ISENCOES_DECLARADAS de scripts/gates/vulnerabilidade.sh, com prazo"`.
      Justificativa: medido em `pnpm@11.25.0` (`dist/pnpm.mjs`), `pnpm audit
      --json` poda `.advisories` duas vezes antes de serializar — pela isenção da
      configuração e pelo piso de nível — e serializa `metadata` intacta, e a
      contagem sobe uma vez por aviso no mesmo laço que preenche `.advisories`,
      então a diferença entre os dois números é exatamente o aviso escondido: sem
      o confronto, um `pnpm-workspace.yaml` com quatro linhas de `audit.ignore`
      faz o portão imprimir `high: 2` e aprovar dizendo `0 achados` na linha
      seguinte (`D21`);
      (p) a linha
      `medido: <total> pacote(s) auditado(s) — critical: <c>, high: <h>, moderate: <m>, low: <l>`;
      (q) uma passagem por `$ACHADOS` que descarta o `$id` presente em
      `ISENCOES_VIGENTES`, contando-o em `ESCONDIDOS`, e imprime uma linha por
      achado restante —
      `  achado: <pacote>@<versão> <id> <severidade> — corrigido em <patched_versions>` —,
      contando-o em `RESTANTES`;
      (r) com `RESTANTES` maior que zero,
      `printf '::error::vulnerabilidade conhecida no lockfile: %s achado(s) de severidade alta ou crítica fora de isenção vigente. Atualize a dependência ou escreva a isenção nominal com prazo em ISENCOES_DECLARADAS de scripts/gates/vulnerabilidade.sh.\n' … >&2`
      e `exit 1`;
      (s) sem achado restante,
      `✓ vulnerabilidade: <total> pacotes auditados, <RESTANTES> achados de severidade alta ou crítica, <ESCONDIDOS> isenções.`
      A ordem de (p) antes de (q) e (r) é parte do requisito, não estética: é a
      linha de contagem que torna a reprovação acionável para quem executa o
      portão à mão, e ela vem **antes** dos achados e do `::error::` na mesma
      saída padrão. A linha de contagem de severidades **não** sai em nenhum
      caminho que reprove antes dela: (i), (k), (l), (m), (n) e (o) saem com a
      razão nomeada e a frase `não consegui auditar`, nunca com zeros.
      Justificativa: `RF-07` mediu que `pnpm audit` sai `1` tanto para "achei
      vulnerabilidade" quanto para "não consegui falar com o registro", então ler
      o código de saída funde as duas — e uma delas tem de reprovar dizendo `não
      consegui auditar`, que é a regra 19 do `CLAUDE.md` e o motivo de `medir.sh`
      existir. `RF-06` pede o número de pacotes lido de
      `metadata.totalDependencies`, e nos caminhos (k) e (m) esse campo não existe
      ou é zero: imprimir zeros ali seria dizer `0 achados` por outro nome, que é
      exatamente o que `RF-07` proíbe e o defeito que `medir.sh` existe para
      matar — por isso o caminho de impossibilidade sai com a razão nomeada e a
      frase `não consegui auditar`, e sem contagem nenhuma (`D13`). O motor
      isolado numa função é o que torna a troca por `osv-scanner` reversível sem
      mexer em quem chama o portão nem no que ele imprime (`D1`). A constante no
      script, e não `auditConfig.ignoreGhsas`, porque a configuração **fundida**
      do pnpm soma o `.npmrc` da máquina de quem executa ao arquivo do
      repositório — é o buraco que o item `044` existe para tapar na quarentena, e
      repeti-lo de propósito criaria a segunda ocorrência do mesmo defeito (`D3`);
      o portão **lê** `.npmrc` e `pnpm-workspace.yaml` em (i), e lê para recusar,
      nunca para honrar. A expansão
      `${ISENCOES_DECLARADAS[@]+"${ISENCOES_DECLARADAS[@]}"}` existe porque a
      lista **nasce vazia**: `"${arr[@]}"` sobre array vazio sob `set -u` aborta
      em bash antigo, e o estado de entrega é justamente o caminho que roda em
      todo PR desde o primeiro dia. Validar a entrada antes de auditar custa nada
      — é leitura da própria constante, sem rede — e é falha fechada no padrão do
      `exige_caminho`: a lista mal escrita é acusada mesmo no dia em que a
      auditoria não encontra nada para ela esconder (`D8`). O predicado cobra o
      prazo junto do identificador porque o formato da entrada é o que o `RF-11`
      declara — identificador do aviso mais data de vencimento —, e uma entrada
      cujo vencimento não é uma data nunca vence, contra o que o `RF-14` afirma:
      a isenção vence sozinha, e ninguém precisa lembrar de removê-la (`D14`).
      Isenção vencida deixa de proteger e nada mais: reprovar também pela linha
      morta faria este portão ficar vermelho por higiene de arquivo, que é assunto
      de outro portão (`D15`).
- [ ] 1.2 Criar as nove fixtures em `scripts/gates/__tests__/fixtures/`,
      reproduzindo a forma real de `pnpm audit --audit-level=high --json`:
      `advisories` indexado por identificador do aviso, e `metadata` com as
      severidades e as quatro contagens de pacote. A forma exata, na fixture com
      achado — `pnpm-audit-qs-alto.json`, os dois avisos que o brief mediu sobre
      `qs@6.15.3`, corrigidos em `6.16.0`:
      ```json
      {
        "actions": [],
        "advisories": {
          "GHSA-4mjr-xmp4-gh2g": {
            "module_name": "qs",
            "severity": "high",
            "github_advisory_id": "GHSA-4mjr-xmp4-gh2g",
            "url": "https://github.com/advisories/GHSA-4mjr-xmp4-gh2g",
            "title": "aviso de severidade alta em qs",
            "vulnerable_versions": "<6.16.0",
            "patched_versions": ">=6.16.0",
            "findings": [
              { "version": "6.15.3", "paths": ["api>@nestjs/platform-express>express>qs"] }
            ]
          },
          "GHSA-x5fp-wj9c-mxmx": {
            "module_name": "qs",
            "severity": "high",
            "github_advisory_id": "GHSA-x5fp-wj9c-mxmx",
            "url": "https://github.com/advisories/GHSA-x5fp-wj9c-mxmx",
            "title": "aviso de severidade alta em qs",
            "vulnerable_versions": "<6.16.0",
            "patched_versions": ">=6.16.0",
            "findings": [
              { "version": "6.15.3", "paths": ["api>@nestjs/platform-express>express>qs"] }
            ]
          }
        },
        "muted": [],
        "metadata": {
          "vulnerabilities": { "info": 0, "low": 0, "moderate": 0, "high": 2, "critical": 0 },
          "dependencies": 199,
          "devDependencies": 686,
          "optionalDependencies": 95,
          "totalDependencies": 923
        }
      }
      ```
      Quatro delas repetem esse esqueleto e mudam só o que o caso mede:
      `pnpm-audit-limpo.json` com `"advisories": {}` e as cinco severidades em
      `0`; `pnpm-audit-moderado.json` com `"advisories": {}`, `"moderate": 3` e
      `"low": 5`; `pnpm-audit-dev.json` com um único aviso `GHSA-fals-odev-1111`
      de severidade `critical` em `pacote-de-desenvolvimento-de-mentira@1.0.0`,
      `patched_versions` `>=2.0.0`, `paths`
      `[".>pacote-de-desenvolvimento-de-mentira"]` e `"critical": 1`;
      `pnpm-audit-sem-pacote.json` com `"advisories": {}`, as severidades em `0` e
      `"totalDependencies": 0`. Dessas quatro, as três primeiras mantêm
      `"totalDependencies": 923`, e só a última traz `0`.
      As quatro restantes são os relatórios que **não** são auditoria utilizável,
      uma por caminho de impossibilidade: `pnpm-audit-podado.json` repete o
      esqueleto com `"advisories": {}` sobre `"high": 2` e
      `"totalDependencies": 923` — a contagem inteira sobre a lista podada, que é
      o que `pnpm audit --json` devolve quando a isenção mora na configuração do
      pnpm (`D21`); `pnpm-audit-forma-desconhecida.json` repete o esqueleto com
      `"advisories": "nenhum"` — uma cadeia no lugar do objeto —, `"high": 1` e
      `"totalDependencies": 923`, que é o relatório cuja forma mudou e faz o
      filtro de achados devolver lista vazia sobre uma contagem que acusa aviso
      (`D21`); `pnpm-audit-erro-de-rede.json` não tem esqueleto nenhum, e seu
      corpo inteiro é
      `{"error": {"code": 23, "message": "The operation was aborted due to timeout"}}`
      — JSON válido, sem `metadata`, medido contra o registro de verdade quando
      ele não responde (`D20`); e `pnpm-audit-erro-com-quebra.json` repete esse
      corpo de erro com `message` igual a
      `falhou\n::stop-commands::marcador-plantado\nfim`, que é a quebra de linha
      capaz de pôr um comando de fluxo no começo de uma linha do log do runner
      (`D24`).
      Justificativa: é a forma do JSON que amarra o parser do portão ao formato
      real — fixture inventada por conveniência faria o teste morder um contrato
      que o `pnpm` não devolve, e o portão passaria verde contra o mundo. As
      contagens `199`, `686`, `95` e `923` são as medidas em 03/09/2026 e provam
      `RF-01`: `totalDependencies` soma as três listas, então o número que o
      portão imprime é o do lockfile inteiro. Em `pnpm-audit-moderado.json`
      `advisories` vem vazio de propósito: `--audit-level=high` filtra o que o
      pnpm **imprime**, e `metadata.vulnerabilities` continua contando as quatro
      severidades — é essa assimetria que faz `RF-04` e `RF-06` conviverem, e uma
      fixture com aviso `moderate` listado mediria um pnpm que não existe. O
      identificador `GHSA-fals-odev-1111` e o nome
      `pacote-de-desenvolvimento-de-mentira` são sintéticos, no idioma que
      `acoes-em-sha.test.sh` já usa em `SHA_DE_MENTIRA`, para ninguém sair
      procurando um aviso real que não existe. `title` e `url` não são lidos pelo
      portão e estão ali só pela forma; se a página do aviso estiver ao alcance,
      copie o resumo dela. As quatro últimas são lidas pelos casos de
      impossibilidade de `scripts/gates/__tests__/vulnerabilidade.test.sh`, que a
      etapa 1.3 cria e o passo de `portoes.yml` da etapa 1.5 executa: fixture que
      nenhum caso lê é arquivo que a sessão seguinte apaga sem ninguém notar, e
      caminho de impossibilidade sem entrada real é o que volta a aprovar por não
      ter medido.
- [ ] 1.3 Criar `scripts/gates/__tests__/vulnerabilidade.test.sh`, no molde de
      `scripts/gates/__tests__/quarentena.test.sh`: `set -uo pipefail`, sandbox em
      `${TMPDIR:-/tmp}/vulnerabilidade-test-$$` sem faxina por `trap`,
      `bash_absoluto="$(command -v bash)"`, contador `falhas` e `exit 1` no fim.
      Três funções: `monta_stub <diretório> <fixture> <código de saída>`, que
      escreve um `pnpm-lock.yaml` de mentira e um `bin/pnpm` executável que
      responde só ao subcomando `audit`, imprime a fixture, registra a chamada num
      arquivo marcador e sai com o código pedido; `copia_portao <diretório>
      <conteúdo da constante>`, que espelha `scripts/gates/medir.sh` numa árvore
      com a mesma forma da de verdade e reescreve a linha `ISENCOES_DECLARADAS=()`
      por `sed`; e `caso <nome> <esperado 0|1> <trecho na saída> <diretório>
      [PATH]`, que roda
      `env GITHUB_WORKSPACE="$casa" PATH="$caminho" "$bash_absoluto" "$portao"`,
      normaliza a saída não-zero para `1`, compara o código de saída **e** faz
      `grep -qF` do trecho contra a saída capturada. Os casos são os dos critérios
      comportamentais desta fase — incluindo a ordem entre a linha de contagem e a
      primeira linha `achado:`, medida por `grep -n` sobre a saída padrão
      capturada em arquivo, e a **ausência** de `critical:` nas duas saídas do
      caminho de impossibilidade —, mais o PATH mínimo com
      `dirname git tr cat date jq` sem `pnpm` e o PATH mínimo com o `pnpm` de
      mentira e sem `jq`. `jq` ausente na máquina que roda o teste é **falha** do
      teste, nomeando `jq`, nunca caso pulado. Fecha com
      `✓ vulnerabilidade.sh: reprova o achado alto, a isenção vencida e o que não conseguiu medir.`
      Justificativa: não existe lockfile vulnerável no repositório, e instalar
      `qs@6.15.3` de propósito para provar `RF-03` trocaria um risco medido por um
      risco real dentro do PR que instala a medição. O `pnpm` de mentira à frente
      do `PATH` é o que dá acesso a `RF-03`, `RF-04`, `RF-05`, `RF-07`, `RF-08`,
      `RF-12` e `RF-14` sem rede e sem dependência vulnerável — e portão sem teste
      que morde é a forma pela qual este repositório já foi enganado três vezes. A
      cópia física com a constante reescrita por `sed` é o que cobra o vencimento
      sem abrir no portão de produção uma variável de ambiente que desligue a
      cobrança sem aparecer em revisão; e ela mora numa árvore com a mesma forma
      da de verdade porque o portão resolve o `source` de `medir.sh` pelo próprio
      caminho, e uma cópia solta morreria antes da primeira asserção, aprovando o
      caso pelo motivo errado. O marcador de chamada é a única forma de provar que
      `RF-09` e `RF-15` reprovam **antes** de qualquer chamada de rede: sem ele,
      "reprovou" e "reprovou depois de auditar" têm a mesma cara. A ordem entre a
      contagem e o primeiro achado é medida por número de linha porque presença
      não é ordem: com as duas linhas na saída, um portão que imprimisse a
      contagem depois do `::error::` passaria por um teste que só procura as
      cadeias. `jq` ausente reprovando em vez de pulando é a regra 19 — teste que
      pula não mediu, e não medir nunca aprova.
- [ ] 1.4 Modificar `scripts/gates/gates_runner.sh` acrescentando
      `bash "$ROOT/scripts/gates/vulnerabilidade.sh" || VEREDICTO=1` junto das
      duas invocações que já estão no bloco de portões diretos — depois da de
      `acoes_em_sha.sh` e **antes** do `if [ "$SEM_ARTEFATOS" -eq 1 ]` — e
      reescrevendo o cabeçalho do arquivo, que hoje fala de três portões diretos e
      os nomeia.
      Justificativa: `RF-16` — a acumulação por `|| VEREDICTO=1` nunca zera de
      volta, e é ela que faz um portão vermelho sobreviver aos que rodam depois
      dele. A posição antes do `if` é o que mantém o portão cobrado no modo
      `--sem-artefatos`, usado pelos três fluxos por frente por onde quase todo PR
      passa: a auditoria não lê artefato de build, e tirá-la de lá deixaria a
      maioria dos PRs sem a conta. O cabeçalho é reconciliado no mesmo PR porque
      documento canônico não tem cicatriz (regras 7 e 8).
- [ ] 1.5 Modificar `.github/workflows/portoes.yml` com dois passos no job
      `medir`: no bloco dos testes de portão, depois do de `acoes-em-sha.test.sh`,
      `- name: o portão de vulnerabilidade reprova o achado alto e o que não conseguiu auditar`
      com `run: bash scripts/gates/__tests__/vulnerabilidade.test.sh`; e
      imediatamente depois do passo `Toda ação do CI está fixada em SHA`,
      `- name: Nenhuma dependência do lockfile com aviso de severidade alta` com
      `run: bash scripts/gates/vulnerabilidade.sh`. Os gatilhos do fluxo não são
      tocados: `push:` segue com `branches: [main, develop]`, `pull_request:`
      segue sem `branches:` e sem `paths:`, e nenhum dos dois passos novos recebe
      `if:`. Nenhum passo de instalação de `jq` entra. O comentário que hoje
      explica por que os **dois** portões da cadeia de suprimentos são cobrados
      neste fluxo passa a falar de três.
      Justificativa: `RF-17` — é este fluxo, e não os três por frente, porque
      aqueles têm filtro de `paths` e um aviso novo aparece **sem o lockfile
      mudar**; condicionado ao arquivo, o portão nunca acusaria a vulnerabilidade
      publicada depois do último PR que mexeu no lockfile, que é o caso mais comum
      e é a falha que o item existe para fechar (`D5`). Pelo mesmo motivo o bloco
      `pull_request:` não pode ganhar `branches:`: um filtro de branch de destino
      tiraria da cobrança os PRs que não vão para `main` nem para `develop`, e
      "todo pull request" é o que o requisito diz. Não há runner que descubra os
      testes: cada um é nomeado à mão no fluxo, então o passo do teste é o que
      impede o portão de parar de morder em silêncio. `jq` já vem na imagem
      `ubuntu-latest`, e `exige_comando jq` dentro do portão é a rede de segurança
      que transforma uma mudança futura da imagem em reprovação nomeada em vez de
      erro de parse — instalar por precaução acrescentaria um passo de rede a todo
      PR para resolver um problema que o portão já acusa.
- [ ] 1.6 Modificar o comentário de `.github/dependabot.yml`: o parágrafo que
      deixa o ecossistema npm de fora passa a dizer que a auditoria de
      vulnerabilidade é `scripts/gates/vulnerabilidade.sh`, e que quem falta é a
      rotina, do item `041-a-rotina-alcanca-os-pacotes-de-javascript`; a menção a
      `027-vulnerabilidade-conhecida-reprova-no-ci` sai, e o argumento — PR
      semanal que ninguém sabe aprovar ou recusar por critério escrito ensina a
      ignorar PR de robô — fica, reescrito no presente.
      Justificativa: `RF-18` e `D9` — o comentário nomeia hoje `027` como dono da
      conta que falta a quem julga um PR de robô, e ponteiro apontando para item
      fechado é a forma mais barata de um documento mentir. Reescrever no presente,
      sem marca de "antes era assim", é a regra 7; no mesmo PR da mudança, é a
      regra 8.

---

## Execução sugerida

1. **Fase 1**, sozinha, sobre `develop`. Fase única: o portão, o teste que o
   exercita, as fixtures que ele lê e as três linhas que o invocam são o mesmo
   contrato — o formato do JSON de `pnpm audit` — e cortar em duas entregaria
   primeiro um portão que ninguém chama, verde por não ser executado. Não há
   junção entre fases a provar, e não há frente paralela a montar em
   `git worktree`: os seis arquivos tocados estão todos em `scripts/gates/` e
   `.github/`, e qualquer corte teria interseção quase total com o outro lado.

## Validações de campo pendentes

Nenhuma. O item inteiro é shell executável e JSON versionado: cada requisito é
provocável por fixture e observável na saída padrão, sem aparelho, permissão de
plataforma ou navegador real. A única dependência de mundo externo — o registro
npm — é substituída no teste pelo `pnpm` de mentira, e reprovada em voz alta pelo
portão quando falta.
