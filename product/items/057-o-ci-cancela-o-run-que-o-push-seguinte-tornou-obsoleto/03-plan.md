# Plano — 057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto · O CI cancela o run que o push seguinte tornou obsoleto

**Item:** `057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto` ·
**Trilha:** rápida · **Brief:** `01-brief.md` (aprovado em 04/09/2026 por
autonomia registrada, `RF-01` a `RF-21`, funde PRD e spec) ·
**Decisões fixadas:** `decisoes-autonomas.md` (`D1` a `D12`, `A1`)

## Objetivo

Ao fim das duas fases, os cinco fluxos de `.github/workflows/` que têm gatilho de
evento declaram `concurrency` numa forma literal única — grupo por
`${{ github.workflow }}-${{ github.ref }}`, cancelamento condicionado a a
referência não ser `refs/heads/main` nem `refs/heads/develop` —, as quatro suítes
chamadas por `workflow_call` seguem sem declaração nenhuma, e um portão
versionado cobra as duas metades em todo pull request e em todo push para `main`
e `develop`, reprovando nos dois sentidos e imprimindo as duas populações
contadas antes do veredicto. Junto do portão vai o teste que prova que ele morde,
e as duas linhas que o executam: a do agregador local e a do job `medir` da suíte
de portões.

## Por que duas fases, nesta ordem

O corte é por **contrato**, e o contrato aqui é a forma literal do bloco
`concurrency`. A fase 1 escreve essa forma nos cinco arquivos e é onde o valor do
item chega: o push seguinte passa a matar o run obsoleto, e ninguém mais cancela
com o mouse. A fase 2 constrói o portão que compara a árvore com uma constante —
e a constante é a forma que a fase 1 fixou.

A ordem é forçada por dependência, não por conveniência: o portão da fase 2
reprova enquanto os cinco fluxos não declararem, e o critério que mede a linha
`medido:` sobre a árvore real só pode ser satisfeito depois que a fase 1 estiver
na árvore. Inverter produziria uma fase 2 vermelha por construção.

Não foi cortado em três — portão, teste e registro em fases separadas —
justamente porque portão que ninguém chama fica verde por não ser executado, que
é a forma de aprovação sem medição que este repositório já pagou três vezes. O
script, o teste que o exercita e as duas linhas que o invocam nascem do mesmo
contrato e vão juntos.

---

## Fase 1 — Os cinco fluxos de gatilho declaram a forma única

**Branch:**
`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto/fase-1-concurrency-nos-cinco-fluxos`,
nascida de `develop`.

**Objetivo da fase:** `bloqueio.yml`, `ci-nestjs.yml`, `ci-react.yml`,
`ci-site.yml` e `portoes.yml` declaram o mesmo bloco `concurrency` de três
linhas no nível do documento, as quatro suítes `_suite-*.yml` seguem sem
declaração, e um push novo numa branch de trabalho passa a cancelar o run que ele
tornou obsoleto sem tocar nos runs dos demais fluxos.

**Arquivos tocados:** `.github/workflows/bloqueio.yml`,
`.github/workflows/ci-nestjs.yml`, `.github/workflows/ci-react.yml`,
`.github/workflows/ci-site.yml`, `.github/workflows/portoes.yml`,
`.github/workflows/_suite-portoes.yml` (só o comentário que ficou falso).

**Arquivos explicitamente não tocados:** `.github/workflows/_suite-nestjs.yml`,
`.github/workflows/_suite-react.yml`, `.github/workflows/_suite-site.yml`,
`scripts/merge-se-liberado.sh`, `pnpm-workspace.yaml`,
`scripts/gates/quarentena.sh`, e as chaves `on:`, `permissions:` e `jobs:` dos
nove fluxos.

**Risco de execução — a medição do cancelamento precisa de CI vivo e de PR fora
do rascunho.** Numa branch de trabalho, o único gatilho dos cinco fluxos é
`pull_request`, e todo job traz `if: github.event.pull_request.draft != true`.
Com o pull request em rascunho o run nasce e termina em segundos com os jobs
pulados, e não há run em progresso para cancelar — o critério comportamental
desta fase mediria a ausência de trabalho, não a ausência de cancelamento. Por
isso o *Dado* dele exige o pull request já promovido para pronto para revisão. Se
o repositório estiver sem executar Actions — aconteceu em 04/09/2026 e a causa
provável, cota de minutos, está fora da máquina —, esse critério não é
mensurável, e portão que não conseguiu medir reprova: o veredicto é aguardar o CI
voltar, nunca dar por observado.

**Critérios de aceite:**

- [ ] `estrutural` — `RF-01`, `RF-04` — cada um dos cinco arquivos
      `.github/workflows/bloqueio.yml`, `.github/workflows/ci-nestjs.yml`,
      `.github/workflows/ci-react.yml`, `.github/workflows/ci-site.yml` e
      `.github/workflows/portoes.yml` traz as três linhas abaixo, inteiras e sem
      variação de caractere, em três linhas consecutivas do arquivo. A medição é
      feita na raiz do repositório, escrevendo antes a forma esperada num arquivo
      literal — o delimitador entre aspas simples é o que impede o shell de
      expandir `${{ … }}`:

      ```
      cat > /tmp/057-forma.txt <<'FIM'
      concurrency:
        group: ${{ github.workflow }}-${{ github.ref }}
        cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}
      FIM
      ```

      Para cada um dos cinco arquivos,
      `grep -c -x -F -f /tmp/057-forma.txt <arquivo>` imprime `3`, e os três
      números que `grep -n -x -F -f /tmp/057-forma.txt <arquivo>` imprime são
      consecutivos (`n`, `n+1`, `n+2`). O `-x` exige linha inteira, então a linha
      `concurrency:` só casa sem recuo nenhum — é o que prova que a declaração
      está no nível do documento e não dentro de um job. Arquivo ausente faz o
      `grep` terminar sem imprimir número, e o critério reprova por não ter
      conseguido medir, não por ter medido e achado outra coisa.
- [ ] `estrutural` — `RF-05` — nenhum dos quatro arquivos
      `.github/workflows/_suite-nestjs.yml`, `.github/workflows/_suite-react.yml`,
      `.github/workflows/_suite-site.yml` e
      `.github/workflows/_suite-portoes.yml` menciona concorrência: para cada um,
      `grep -c '' <arquivo>` imprime um número **maior que** `0` — que é a prova
      de que o arquivo existe e foi lido, sem a qual um arquivo ausente passaria
      pelo mesmo teste por que passa o arquivo correto — e
      `grep -c -i concurrency <arquivo>` imprime `0`. E, no mesmo
      `.github/workflows/_suite-portoes.yml`,
      `grep -c -F 'o run anterior seguia' .github/workflows/_suite-portoes.yml`
      imprime `0`: o parágrafo que afirmava, no presente, que o run anterior
      seguia até o fim medindo um commit substituído deixou de descrever o
      repositório.
- [ ] `comando` — `RF-01`, `RF-03` — a expressão de `cancel-in-progress` dos
      cinco fluxos é a mesma constante e, avaliada com a semântica de `!=` e `&&`
      do GitHub Actions, dá `False` para `refs/heads/main`, `False` para
      `refs/heads/develop` e `True` para uma referência de trabalho. Executado na
      raiz do repositório:

      ```
      python3 - <<'PY'
      import pathlib
      ESPERADA = "${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}"
      def avalia(expr, ref):
          corpo = expr.strip()[3:-2].strip()
          comparacoes = []
          for parte in corpo.split('&&'):
              esquerda, direita = parte.split('!=')
              assert esquerda.strip() == 'github.ref', esquerda
              comparacoes.append(ref != direita.strip().strip("'"))
          assert comparacoes, corpo
          return all(comparacoes)
      d = pathlib.Path('.github/workflows')
      for nome in ['bloqueio.yml', 'ci-nestjs.yml', 'ci-react.yml', 'ci-site.yml', 'portoes.yml']:
          linhas = (d / nome).read_text().splitlines()
          achadas = [l.split('cancel-in-progress:', 1)[1].strip()
                     for l in linhas if l.strip().startswith('cancel-in-progress:')]
          assert len(achadas) == 1, (nome, achadas)
          assert achadas[0] == ESPERADA, (nome, achadas[0])
          print(nome,
                avalia(achadas[0], 'refs/heads/main'),
                avalia(achadas[0], 'refs/heads/develop'),
                avalia(achadas[0], 'refs/pull/57/merge'))
      PY
      ```

      termina com código de saída `0` e imprime exatamente cinco linhas:
      `bloqueio.yml False False True`, `ci-nestjs.yml False False True`,
      `ci-react.yml False False True`, `ci-site.yml False False True` e
      `portoes.yml False False True`. Arquivo ausente, expressão diferente da
      constante, `cancel-in-progress: true` cru ou duas ocorrências no mesmo
      arquivo fazem o comando terminar com código diferente de `0` sem imprimir
      as cinco linhas.
- [ ] `comando` — `RF-06` — a tranca de merge decide por dois baldes que não
      incluem o cancelado, e nada nela foi alterado. Executados na raiz do
      repositório, os quatro comandos, e o primeiro é o que separa *não achei* de
      *não consegui procurar*: `grep -c '' scripts/merge-se-liberado.sh` imprime
      um número **maior que** `0`;
      `grep -cE '\$2=="fail"' scripts/merge-se-liberado.sh` imprime um número
      **maior ou igual a** `2`;
      `grep -cE '\$2=="pending"' scripts/merge-se-liberado.sh` imprime um número
      **maior ou igual a** `1`; e
      `grep -c -i cancel scripts/merge-se-liberado.sh` imprime `0` — o arquivo
      inteiro não contém a cadeia `cancel` em nenhuma caixa, então nenhum dos dois
      filtros que decidem o merge enxerga uma verificação cancelada, nem como
      vermelha nem como pendente.
- [ ] `comportamental` — `RF-02`, `RF-04`
      *Dado* o repositório na branch corrente, medida por
      `git rev-parse --abbrev-ref HEAD`, com um pull request aberto para essa
      branch e já promovido de rascunho para pronto para revisão — condição sem a
      qual todo job é pulado, o run termina em segundos e não há execução em
      progresso para cancelar —, e com o GitHub Actions criando runs, provado por
      `gh run list --branch "$(git rev-parse --abbrev-ref HEAD)" --workflow "Portões" --limit 1`
      devolver ao menos uma linha
      *Quando* dois commits vazios são empurrados para essa branch com
      `git commit --allow-empty -m "medicao 1" && git push` e, entre 30 e 90
      segundos depois — enquanto
      `gh run list --branch "$(git rev-parse --abbrev-ref HEAD)" --workflow "Portões" --limit 1 --json status`
      ainda responde `in_progress` ou `queued` —,
      `git commit --allow-empty -m "medicao 2" && git push`
      *Então*
      `gh run list --branch "$(git rev-parse --abbrev-ref HEAD)" --workflow "Portões" --limit 10 --json headSha,conclusion,status`
      traz a entrada cujo `headSha` é o SHA do primeiro commit com `conclusion`
      igual a `cancelled`, e a entrada cujo `headSha` é o SHA do segundo commit
      com `status` igual a `in_progress` ou `queued`; e
      `gh run list --branch "$(git rev-parse --abbrev-ref HEAD)" --workflow "Bloqueio" --limit 10 --json headSha,conclusion`
      traz a entrada cujo `headSha` é o SHA do **primeiro** commit com
      `conclusion` igual a `success` — o cancelamento alcançou só o fluxo do mesmo
      grupo, e ninguém clicou em nada.

**Etapas:**

- [ ] 1.1 Modificar `.github/workflows/bloqueio.yml`,
      `.github/workflows/ci-nestjs.yml`, `.github/workflows/ci-react.yml`,
      `.github/workflows/ci-site.yml` e `.github/workflows/portoes.yml`
      acrescentando, no nível do documento, o bloco de três linhas com
      `concurrency:` sem recuo, `  group: ${{ github.workflow }}-${{ github.ref }}`
      e
      `  cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}`,
      idêntico caractere por caractere nos cinco, sem aspas acrescentadas em volta
      das expressões e sem quebra de linha diferente. A posição é logo depois do
      fim do bloco `on:`: nos quatro que têm `permissions:`, entre o fim do `on:`
      e o comentário que precede `permissions:`; em `bloqueio.yml`, que não
      declara `permissions:`, entre o fim do `on:` e o comentário que precede
      `jobs:`. Nenhuma outra chave é tocada — `on:` fica como está nos cinco,
      nenhum `paths` muda, nenhum `types` muda, nenhum job muda. Junto vai um
      comentário curto e idêntico nos cinco, de no máximo quatro linhas, com o
      porquê que a configuração não mostra: `main` e `develop` recebem commit sem
      pull request, e uma medição cancelada nessas duas nunca é refeita; e
      `${{ github.workflow }}` está na chave de grupo para que o fluxo longo do
      mesmo push não mate o curto. O comentário não repete a forma esperada em
      prosa — quem a cobra é o portão da fase 2, e prosa que duplica constante
      apodrece sozinha.
      Justificativa: `RF-01`, `RF-03` e `RF-04`, com `D1`, `D2` e `D4`.
      `cancel-in-progress` é campo de fluxo: resolver a polaridade por `if:`
      dentro do job deixaria o job condicionado enfileirado no mesmo grupo, sem
      cancelar nada. Nomear as duas branches em vez de testar
      `github.event_name != 'push'` dá o mesmo resultado hoje e continua dando o
      certo no dia em que alguém acrescentar `push` numa branch de trabalho.
      Inclusive em `bloqueio.yml`, onde a expressão avalia `true` de qualquer
      jeito: uma forma só é uma forma só, e é o que permite ao portão comparar com
      uma constante em vez de interpretar expressão.
- [ ] 1.2 Modificar o parágrafo de `.github/workflows/_suite-portoes.yml` que hoje
      afirma, no presente, que cada push redisparava tudo e que o run anterior
      seguia até o fim medindo um commit que ninguém ia mergear. Ele passa a
      dizer, também no presente, que o run obsoleto morre no instante do push
      seguinte, e que a declaração de `concurrency` mora no fluxo chamador e não
      nesta suíte — porque suíte chamada por `workflow_call` não produz run
      próprio, e chamador e chamado no mesmo grupo é a forma documentada de
      produzir impasse, com o job do pai esperando o filho enfileirado atrás do
      pai. A chave `on:` do arquivo não é tocada, e nenhuma linha de
      `concurrency:` entra aqui.
      Justificativa: `RF-05`, com `D10`. Documento canônico não tem cicatriz e se
      reescreve no presente (regra 7), na mesma mudança que o tornou falso (regra
      8). E este é o único ponto do repositório onde alguém que edite uma suíte lê
      por que ela não declara o bloco que os cinco fluxos declaram: sem a frase, a
      próxima sessão copia a declaração para cá por simetria, e o impasse chega
      antes do portão que o reprova.

---

## Fase 2 — O portão `concorrencia.sh` cobra as duas metades, e o CI o cobra

**Branch:**
`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto/fase-2-portao-de-concorrencia`,
empilhada sobre a branch da fase 1 com `gh stack`.

**Objetivo da fase:** `scripts/gates/concorrencia.sh` classifica os arquivos de
`.github/workflows` nas duas populações, compara a declaração dos fluxos de
gatilho com uma constante do próprio script, imprime a linha `medido:` com as
duas populações contadas, reprova nos dois sentidos e falha fechada quando não
conseguiu medir; o teste que prova que ele morde existe; e as duas linhas que o
executam estão no agregador local e no job `medir` da suíte de portões.

**Arquivos tocados:** `scripts/gates/concorrencia.sh`,
`scripts/gates/__tests__/concorrencia.test.sh`, `scripts/gates/gates_runner.sh`,
`.github/workflows/_suite-portoes.yml`.

**Arquivos explicitamente não tocados:** `scripts/gates/medir.sh`,
`scripts/gates/fluxos.sh`, `scripts/gates/pnpm_isolado.sh`,
`scripts/gates/quarentena.sh`, `scripts/merge-se-liberado.sh`, os cinco fluxos de
gatilho e as outras três suítes.

**Dependência de execução.** O critério que mede a linha `medido:` sobre a árvore
real só fecha com a fase 1 dentro da árvore. Por isso a branch nasce empilhada
sobre a da fase 1, com `gh stack`, e nunca com `--base` à mão.

**Risco de execução — PyYAML no runner e na máquina.** `scripts/gates/fluxos.sh`
e `scripts/gates/pnpm_isolado.sh` já leem estes mesmos arquivos com `python3` e
`import yaml`, e rodam como passos vizinhos no mesmo job, então nenhum passo de
instalação entra. A rede de segurança é a asserção do módulo dentro do portão:
uma imagem de runner que mude transforma-se em reprovação nomeando PyYAML, em vez
de traceback que reprova sem dizer o que faltou.

**Critérios de aceite:**

- [ ] `estrutural` — `RF-11`, `RF-13`, `RF-14` — `scripts/gates/concorrencia.sh`
      existe, tem código, guarda a forma esperada em si mesmo, afirma as duas
      pontas da ferramenta de leitura e não usa `yq`. Executados na raiz do
      repositório: `grep -cvE '^[[:space:]]*#' scripts/gates/concorrencia.sh`
      imprime um número **maior que** `0`, que é a prova de que o arquivo existe e
      foi lido; `grep -c -F 'exige_comando python3' scripts/gates/concorrencia.sh`
      imprime um número **maior ou igual a** `1`;
      `grep -c -F "python3 -c 'import yaml'" scripts/gates/concorrencia.sh`
      imprime um número **maior ou igual a** `1` — é a sondagem do módulo, que
      `exige_comando python3` não cobre;
      `grep -vE '^[[:space:]]*#' scripts/gates/concorrencia.sh | grep -c -w yq`
      imprime `0`; e, escrita antes a forma esperada num arquivo literal com

      ```
      cat > /tmp/057-esperado.txt <<'FIM'
      ${{ github.workflow }}-${{ github.ref }}
      ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}
      FIM
      ```

      o comando `grep -c -F -f /tmp/057-esperado.txt scripts/gates/concorrencia.sh`
      imprime um número **maior ou igual a** `2`: as duas cadeias da forma
      esperada moram no próprio script, e não são lidas do arquivo sob medição.
- [ ] `estrutural` — `RF-15` — `scripts/gates/gates_runner.sh` invoca o portão no
      bloco de portões diretos, com o código de saída propagado, e o cabeçalho do
      arquivo não conta mais os portões diretos errado. Executados na raiz do
      repositório:
      `grep -c -F 'bash "$ROOT/scripts/gates/concorrencia.sh" || VEREDICTO=1' scripts/gates/gates_runner.sh`
      imprime `1`; nos números de linha que `grep -n -F` imprime para essa cadeia,
      para `bash "$ROOT/scripts/gates/fluxos.sh" || VEREDICTO=1` e para
      `if [ "$SEM_ARTEFATOS" -eq 1 ]; then`, o da invocação de
      `concorrencia.sh` é **maior** que o da invocação de `fluxos.sh` e **menor**
      que o do `if` — é a vizinhança dessa invocação, antes do `if`, que faz do
      lugar o bloco de portões diretos, e é a posição antes do `if` que mantém o
      portão cobrado no modo `--sem-artefatos`; e
      `grep -c -F 'os quatro portões diretos' scripts/gates/gates_runner.sh`
      imprime `0`.
- [ ] `estrutural` — `RF-16`, `RF-17` — `.github/workflows/_suite-portoes.yml`
      executa o portão e o teste do portão como dois passos próprios do job
      `medir`. Executados na raiz do repositório:
      `grep -c -F 'run: bash scripts/gates/concorrencia.sh' .github/workflows/_suite-portoes.yml`
      imprime `1`;
      `grep -c -F 'run: bash scripts/gates/__tests__/concorrencia.test.sh' .github/workflows/_suite-portoes.yml`
      imprime `1`; e, nos números de linha que `grep -n` devolve para essas duas
      cadeias, para `run: bash scripts/gates/fluxos.sh`, para
      `run: pnpm install --frozen-lockfile`, para `^  medir:` e para
      `^  divergencias:`, vale: o do passo do teste é **menor** que o do passo do
      portão; o do passo do portão é **maior** que o de `fluxos.sh` e **menor**
      que o de `pnpm install --frozen-lockfile`; e os dois estão entre o de
      `medir:` e o de `divergencias:`. Nenhum passo novo de instalação de
      ferramenta aparece entre eles, medido por
      `grep -c -E 'pip install|apt-get install|setup-python' .github/workflows/_suite-portoes.yml`,
      que imprime `0`.
- [ ] `comando` — `RF-08`, `RF-09` — `bash scripts/gates/concorrencia.sh`,
      executado na raiz do repositório, termina com código de saída `0` e imprime
      a linha, inteira e sem variação:
      `medido: 9 fluxo(s) em .github/workflows — 5 de gatilho (5 com concurrency na forma esperada, 0 sem) e 4 chamado(s) por workflow_call (0 com concurrency)`.
      Os números são a árvore medida em 04/09/2026: nove arquivos de fluxo, cinco
      de gatilho e quatro chamados por `workflow_call`. Um fluxo novo, um fluxo a
      menos ou uma declaração fora da forma mudam a linha, e é isso que o critério
      existe para acusar.
- [ ] `comando` — `RF-17` — `bash scripts/gates/__tests__/concorrencia.test.sh`,
      executado na raiz do repositório, termina com código de saída `0`, imprime
      uma linha que contém `✓ concorrencia:`, não imprime nenhuma linha que
      contenha `FALHA`, e
      `bash scripts/gates/__tests__/concorrencia.test.sh | grep -c '^  ok '`
      imprime um número **maior ou igual a** `10` — um teste que passasse sem
      exercitar caso nenhum imprimiria menos que isso, e teste vazio é a forma
      mais barata de um portão parar de morder em silêncio.
- [ ] `comportamental` — `RF-07`, `RF-10`
      *Dado* a árvore de mentira montada na raiz do repositório por
      `d=/tmp/057-sem-declaracao; rm -rf "$d"; mkdir -p "$d/.github/workflows"; printf 'name: A\non:\n  pull_request:\n    types: [opened]\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/ci-novo.yml"; printf 'name: B (suíte)\non:\n  workflow_call:\n    inputs:\n      runner:\n        required: true\n        type: string\njobs:\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/_suite-b.yml"`
      *Quando* `env GITHUB_WORKSPACE=/tmp/057-sem-declaracao bash scripts/gates/concorrencia.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `1`, a saída contém a cadeia `ci-novo.yml`, a
      saída contém a cadeia
      `cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}`,
      e a saída **não** contém a cadeia `_suite-b.yml` — a suíte sem declaração
      está correta, e cobrar dela seria cobrar o impasse
- [ ] `comportamental` — `RF-11`
      *Dado* a árvore de mentira montada na raiz do repositório por
      `d=/tmp/057-forma-errada; rm -rf "$d"; mkdir -p "$d/.github/workflows"; printf 'name: A\non:\n  pull_request:\n    types: [opened]\nconcurrency:\n  group: ${{ github.ref }}\n  cancel-in-progress: true\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/ci-cru.yml"`
      *Quando* `env GITHUB_WORKSPACE=/tmp/057-forma-errada bash scripts/gates/concorrencia.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `1`, a saída contém a cadeia `ci-cru.yml`, a
      saída contém a cadeia `${{ github.workflow }}-${{ github.ref }}` — o que
      esperava — e a saída contém a cadeia `true` numa linha que também contém
      `cancel-in-progress` — o que leu
- [ ] `comportamental` — `RF-12`
      *Dado* a árvore de mentira montada na raiz do repositório por
      `d=/tmp/057-suite-declara; rm -rf "$d"; mkdir -p "$d/.github/workflows"; printf 'name: A\non:\n  pull_request:\n    types: [opened]\nconcurrency:\n  group: ${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: ${{ github.ref != '"'"'refs/heads/main'"'"' && github.ref != '"'"'refs/heads/develop'"'"' }}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/ci-ok.yml"; printf 'name: B (suíte)\non:\n  workflow_call:\n    inputs:\n      runner:\n        required: true\n        type: string\nconcurrency:\n  group: ${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true\njobs:\n  b:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/_suite-b.yml"`
      *Quando* `env GITHUB_WORKSPACE=/tmp/057-suite-declara bash scripts/gates/concorrencia.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `1`, a saída contém a cadeia `_suite-b.yml`, a
      saída contém a cadeia `chamador`, e a saída **não** contém a cadeia
      `ci-ok.yml` — o fluxo de gatilho está na forma certa, e a reprovação diz
      para onde a linha da suíte vai em vez de mandar apagá-la dos dois lugares
- [ ] `comportamental` — `RF-14`
      *Dado* a árvore de mentira e o interpretador sem o módulo, montados na raiz
      do repositório por
      `d=/tmp/057-sem-pyyaml; rm -rf "$d"; mkdir -p "$d/.github/workflows" "$d/bin"; printf 'name: A\non:\n  pull_request:\n    types: [opened]\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/ci-novo.yml"; real="$(command -v python3)"; printf '#!/bin/sh\ncase "$*" in\n  *"import yaml"*) echo "ModuleNotFoundError: No module named '"'"'yaml'"'"'" >&2; exit 1 ;;\nesac\nexec %s "$@"\n' "$real" > "$d/bin/python3"; chmod +x "$d/bin/python3"`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/057-sem-pyyaml PATH=/tmp/057-sem-pyyaml/bin:$PATH bash scripts/gates/concorrencia.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `1`, a saída contém a cadeia `yaml`, a saída
      contém a cadeia `não conseguiu medir`, e a saída **não** contém a cadeia
      `medido:` nem a cadeia `ci-novo.yml` — a reprovação nomeia a ferramenta
      ausente antes de classificar arquivo nenhum, em vez de terminar em traceback
      que reprova sem dizer o que faltou
- [ ] `comportamental` — `RF-21`
      *Dado* a árvore de mentira montada na raiz do repositório por
      `d=/tmp/057-fora-das-populacoes; rm -rf "$d"; mkdir -p "$d/.github/workflows"; printf 'name: A\non:\n  pull_request:\n    types: [opened]\nconcurrency:\n  group: ${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: ${{ github.ref != '"'"'refs/heads/main'"'"' && github.ref != '"'"'refs/heads/develop'"'"' }}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/ci-ok.yml"; printf 'name: Órfão\non:\n  workflow_dispatch:\n  schedule:\n    - cron: "0 3 * * 1"\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: "true"\n' > "$d/.github/workflows/orfao.yml"`
      *Quando* `env GITHUB_WORKSPACE=/tmp/057-fora-das-populacoes bash scripts/gates/concorrencia.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `1`, a saída contém a cadeia `orfao.yml`, a
      saída contém as cadeias `workflow_dispatch` e `schedule` — a chave `on:` que
      o portão leu, impressa para quem corrige saber por que o arquivo ficou de
      fora —, e a saída contém a linha
      `medido: 2 fluxo(s) em .github/workflows — 1 de gatilho (1 com concurrency na forma esperada, 0 sem) e 0 chamado(s) por workflow_call (0 com concurrency)`:
      os dois arquivos entram no total, e o órfão não entra em nenhuma das duas
      populações — contá-lo em qualquer uma delas seria o portão inventar uma
      classificação que não conseguiu fazer
- [ ] `comportamental` — `RF-18`, `RF-19`
      *Dado* as duas árvores de mentira montadas na raiz do repositório por
      `rm -rf /tmp/057-sem-dir /tmp/057-dir-vazio; mkdir -p /tmp/057-sem-dir /tmp/057-dir-vazio/.github/workflows`
      *Quando*
      `env GITHUB_WORKSPACE=/tmp/057-sem-dir bash scripts/gates/concorrencia.sh`
      e depois
      `env GITHUB_WORKSPACE=/tmp/057-dir-vazio bash scripts/gates/concorrencia.sh`
      são executados na raiz do repositório
      *Então* a primeira execução termina com código de saída `1` e imprime uma
      saída que contém `não conseguiu medir` e `.github/workflows`; a segunda
      termina com código de saída `1` e imprime uma saída que contém
      `medido: 0 fluxo(s) em .github/workflows`, `não havia o que medir` e
      `.github/workflows`; e nenhuma das duas imprime a cadeia `0 sem` —
      procurar e não achar e não conseguir procurar têm respostas diferentes, e
      nenhuma das duas é uma linha verde com populações que ninguém contou
- [ ] `comportamental` — `RF-20`
      *Dado* a árvore de mentira montada na raiz do repositório por
      `d=/tmp/057-yaml-quebrado; rm -rf "$d"; mkdir -p "$d/.github/workflows"; printf 'name: X\non: [: isto não é YAML\n' > "$d/.github/workflows/quebrado.yml"`
      *Quando* `env GITHUB_WORKSPACE=/tmp/057-yaml-quebrado bash scripts/gates/concorrencia.sh`
      é executado na raiz do repositório
      *Então* o código de saída é `1`, a saída contém a cadeia `quebrado.yml`, a
      saída contém a cadeia `não consegui medir`, e a saída **não** contém a
      cadeia `medido:` — o arquivo ilegível reprova nomeando o erro de leitura, e
      nunca entra na conta como fluxo de gatilho sem declaração

**Critérios de integração — as duas fases na mesma árvore:**

Estes três são julgados com a fase 1 e a fase 2 juntas na árvore, e nenhum deles
é provável por qualquer uma das duas sozinha: os dois primeiros medem o portão da
fase 2 lendo a declaração da fase 1, e o terceiro mede o único arquivo que as
duas fases editam.

- [ ] `comando` — `RF-01`, `RF-05`, `RF-08`, `RF-09` — a declaração escrita nos
      cinco fluxos e a leitura feita pelo portão concordam sobre a mesma árvore:
      `bash scripts/gates/concorrencia.sh`, executado na raiz do repositório,
      termina com código de saída `0` e imprime a linha, inteira e sem variação:
      `medido: 9 fluxo(s) em .github/workflows — 5 de gatilho (5 com concurrency na forma esperada, 0 sem) e 4 chamado(s) por workflow_call (0 com concurrency)`.
      É a única medição em que o `5 com … 0 sem` e o `4 chamado(s) … 0 com` são
      lidos da árvore de verdade: sobre a árvore anterior à declaração o mesmo
      comando imprime `0 com` e `5 sem` e sai `1`, e sobre qualquer árvore de
      mentira ele conta outra coisa.
- [ ] `comando` — `RF-15` — o portão novo corre dentro do agregador que quem
      trabalha executa antes de dar por pronto. Executados na raiz do
      repositório: `bash scripts/gates/gates_runner.sh` termina com código de
      saída `0`; e a saída de `bash scripts/gates/gates_runner.sh --sem-artefatos`
      contém a linha
      `medido: 9 fluxo(s) em .github/workflows — 5 de gatilho (5 com concurrency na forma esperada, 0 sem) e 4 chamado(s) por workflow_call (0 com concurrency)`
      — que é o portão novo tendo sido chamado e tendo medido, e não apenas
      existindo no disco.
- [ ] `comando` — `RF-05`, `RF-16`, `RF-17` — o único arquivo que as duas fases
      editam continua sendo YAML legível, continua sendo suíte chamada sem
      declaração de concorrência, e carrega os dois passos novos. Executado na
      raiz do repositório:

      ```
      python3 - <<'PY'
      import yaml
      d = yaml.safe_load(open('.github/workflows/_suite-portoes.yml'))
      gatilhos = d.get('on', d.get(True))
      passos = [p.get('run', '') for p in d['jobs']['medir']['steps']]
      print(sorted(gatilhos))
      print('concurrency' in d)
      print('bash scripts/gates/concorrencia.sh' in passos)
      print('bash scripts/gates/__tests__/concorrencia.test.sh' in passos)
      PY
      ```

      termina com código de saída `0` e imprime, nesta ordem, as quatro linhas
      `['workflow_call']`, `False`, `True` e `True`. A reescrita do comentário
      pela fase 1 e os dois passos da fase 2 caem no mesmo arquivo, e um recuo
      errado em qualquer uma das duas mudanças faz este comando terminar com erro
      em vez de imprimir as quatro linhas.

**Etapas:**

- [ ] 2.1 Criar `scripts/gates/concorrencia.sh`, no molde de
      `scripts/gates/fluxos.sh`: `set -uo pipefail`, `aqui="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"`,
      `. "$aqui/medir.sh"`, `RAIZ="$(medir_raiz)"`,
      `exige_caminho ".github/workflows" "o diretório de fluxos do GitHub Actions"`
      e `exige_comando python3`. Antes de qualquer classificação, e depois de
      `exige_comando python3`, sondar o módulo com `python3 -c 'import yaml'` e,
      no código de saída diferente de zero, chamar `_reprova` nomeando PyYAML e o
      que ele serve para ler. Só então o corpo, num `python3 - "$DIR" <<'PY'`,
      onde mora a constante da forma esperada como um dicionário com as duas
      chaves `group` e `cancel-in-progress` e os dois valores literais do brief. O
      corpo enumera `*.yml` e `*.yaml` do diretório — só essas duas extensões
      entram no total. Quando a lista sai vazia, imprime a forma curta
      `medido: 0 fluxo(s) em .github/workflows` e reprova dizendo que não havia o
      que medir, sem a linha das seis contagens, que sobre zero arquivo diria `0
      sem` e pareceria árvore limpa. Lê cada arquivo com `yaml.safe_load` dentro
      de `try/except yaml.YAMLError`, e no erro imprime `::error::` nomeando o
      arquivo e o erro, diz `não consegui medir` e sai `1` sem imprimir a linha
      `medido:`. Classifica cada arquivo pela chave de gatilhos — que o PyYAML
      devolve em `doc.get("on", doc.get(True))`, porque `on:` vira booleano `True`
      no YAML 1.1 — como fluxo de gatilho quando declara `push` ou
      `pull_request`, e como suíte chamada quando declara apenas `workflow_call`;
      o arquivo que não cai em nenhuma das duas fica **fora das duas contagens**,
      e o portão reprova nomeando o arquivo e imprimindo as chaves de `on:` que
      leu. Compara o bloco `concurrency` de cada fluxo de gatilho com a constante
      pelos **valores já interpretados**, e, para cada divergência, nomeia o
      arquivo, imprime o que leu e o que esperava; para cada suíte com
      `concurrency`, nomeia o arquivo e diz que a declaração pertence ao fluxo
      chamador. Imprime, antes de todo veredicto que venha de classificação —
      inclusive o do arquivo fora das duas populações —, a linha exata
      `medido: <N> fluxo(s) em .github/workflows — <G> de gatilho (<C> com concurrency na forma esperada, <S> sem) e <W> chamado(s) por workflow_call (<D> com concurrency)`.
      Justificativa: `RF-07` a `RF-14` e `RF-21`, com `D3`, `D5` e `D11`. A
      classificação é o que torna a cobrança direcional: um portão que só contasse
      quantos arquivos declaram aprovaria a declaração posta no arquivo errado,
      que é exatamente o defeito de impasse que o item existe para impedir. A
      constante mora no script de propósito, no padrão de `ISENCOES_ESPERADAS` de
      `scripts/gates/quarentena.sh` — ler o esperado do arquivo sob medição faria
      qualquer valor casar consigo mesmo. A comparação é por valor interpretado, e
      não por texto: a exatidão caractere por caractere da declaração é cobrada
      pelo critério estrutural da fase 1, e comparar texto aqui faria o portão
      reprovar por recuo ou por aspas, que não mudam o que o GitHub executa.
      `python3` com PyYAML porque `yq` está ausente da máquina de
      desenvolvimento e trazer binário de terceiro para conferir três linhas
      levaria o item à trilha completa por causa da ferramenta, e não do problema;
      a sondagem separada do módulo existe porque `exige_comando python3` cobre o
      binário e não cobre o `import`, e `import yaml` sem guarda termina em
      traceback, que reprova sem dizer o que faltou. O arquivo fora das duas
      populações reprova em vez de ser somado a uma delas por chute (`RF-21`): a
      linha `medido:` mostra o total e as duas contagens que não o incluem, e é
      essa diferença — e não a boa memória de quem revisa — que denuncia o dia em
      que um fluxo novo nasce com um gatilho que o portão não sabe julgar.
- [ ] 2.2 Criar `scripts/gates/__tests__/concorrencia.test.sh`, no molde de
      `scripts/gates/__tests__/fluxos.test.sh`: `set -uo pipefail`, `raiz` pelo
      caminho do próprio arquivo, `alvo="$raiz/scripts/gates/concorrencia.sh"`,
      guarda que sai `2` quando o alvo não existe, contador `falhas`, e uma função
      `caso <nome> <esperado 0|1> <trecho na saída> <árvore>` que roda
      `env GITHUB_WORKSPACE="$casa" bash "$alvo"`, normaliza a saída não-zero para
      `1`, compara o código **e** faz `grep -qF` do trecho, imprimindo
      `  ok    <nome>` no acerto. Diferente de `fluxos.test.sh`, o teste **não**
      copia o portão nem o `medir.sh` para a sandbox: o portão resolve o `source`
      pelo caminho do próprio arquivo e a árvore por `medir_raiz()`, então apontar
      `GITHUB_WORKSPACE` para a sandbox mede a árvore de mentira com o script de
      verdade — e é uma cópia a menos para ficar velha sem ninguém notar. Os casos
      são, no mínimo: árvore correta com cinco de gatilho e quatro suítes passa e
      imprime a linha `medido:`; fluxo de gatilho sem bloco reprova nomeando o
      arquivo; a mesma reprovação imprime a forma esperada; `cancel-in-progress:
      true` cru reprova; chave de grupo diferente reprova imprimindo o que leu e o
      que esperava; suíte com declaração reprova nomeando o arquivo; a mesma
      reprovação diz `chamador`; diretório vazio reprova dizendo que não havia o
      que medir; diretório ausente reprova nomeando o diretório; YAML ilegível
      reprova nomeando o arquivo sem imprimir `medido:`; módulo `yaml` ausente,
      com o `python3` de mentira à frente do `PATH`, reprova nomeando PyYAML sem
      imprimir `medido:`; e arquivo com `on:` de `workflow_dispatch` e `schedule`
      reprova nomeando o arquivo e as chaves lidas, com a linha `medido:` contando
      esse arquivo no total e em nenhuma das duas populações. Fecha com
      `✓ concorrencia: reprova o fluxo sem declaração, a forma errada, a suíte que declara e o que não conseguiu medir.`
      Justificativa: `RF-10`, `RF-12`, `RF-14`, `RF-17` a `RF-21`. Portão sem
      teste que morde é a forma pela qual este repositório já foi enganado, e as
      duas metades da cobrança — gatilho sem declaração e suíte com declaração —
      falham em sentidos opostos: um teste que só exercitasse uma delas deixaria a
      outra passar a aprovar em silêncio. O `python3` de mentira à frente do
      `PATH` é o único jeito determinístico de provar `RF-14` sem desinstalar
      PyYAML da máquina de quem trabalha, e ele repassa tudo o que não é a
      sondagem para o interpretador de verdade, para o caso medir a ausência do
      módulo e não a ausência do interpretador. O caso do arquivo fora das duas
      populações é o que prova `RF-21` na direção que importa: não basta o portão
      reprovar, ele precisa reprovar **com** a linha `medido:` mostrando o total
      maior que a soma das duas contagens — sem essa asserção, um portão que
      somasse o órfão aos fluxos de gatilho e reprovasse por outro motivo passaria
      pelo teste. A verificação de que a linha `medido:` **não** aparece nos
      caminhos de impossibilidade é o que separa "reprovou" de "reprovou depois de
      contar errado": com as duas cadeias na saída, um portão que classificasse
      antes de reprovar passaria por um teste que só procura a mensagem de erro.
- [ ] 2.3 Modificar `scripts/gates/gates_runner.sh` acrescentando
      `bash "$ROOT/scripts/gates/concorrencia.sh" || VEREDICTO=1` no bloco de
      portões diretos, depois da invocação de `fluxos.sh` e **antes** do
      `if [ "$SEM_ARTEFATOS" -eq 1 ]`, e reescrevendo no presente as duas
      passagens do cabeçalho que enumeram os portões diretos: o parágrafo que os
      lista por assunto e a linha de modos que diz `os quatro portões diretos`.
      Depois desta fase são sete — quarentena de dependência, ações do CI em SHA,
      vulnerabilidade conhecida no lockfile, desenho dos fluxos, isolamento do
      pnpm, concorrência declarada e segredo —, e a contagem do cabeçalho já
      estava errada antes desta mudança.
      Justificativa: `RF-15`. A acumulação por `|| VEREDICTO=1` nunca zera de
      volta, e é ela que faz um portão vermelho sobreviver aos que rodam depois
      dele; declarar o portão em `.harness/gates.json` em vez de invocá-lo aqui
      transformaria a reprovação por medição impossível em aprovação silenciosa,
      porque lá o código de saída é ignorado. A posição antes do `if` é o que
      mantém o portão cobrado no modo `--sem-artefatos`, por onde passam os três
      fluxos por frente e quase todo pull request — e a concorrência declarada não
      lê artefato de build nenhum. O cabeçalho é reconciliado no mesmo PR porque
      documento canônico não tem cicatriz (regras 7 e 8), e uma lista que já não
      confere é a forma mais barata de um arquivo mentir sobre si mesmo.
- [ ] 2.4 Modificar `.github/workflows/_suite-portoes.yml` com dois passos no job
      `medir`: no bloco dos testes de portão, depois do passo cujo corpo é
      `run: bash scripts/gates/__tests__/pnpm-isolado.test.sh`,
      `- name: o portão da concorrência reprova o fluxo sem declaração e a suíte que declara`
      com `run: bash scripts/gates/__tests__/concorrencia.test.sh`; e,
      imediatamente depois do passo cujo corpo é
      `run: bash scripts/gates/pnpm_isolado.sh`,
      `- name: Todo fluxo de gatilho declara concurrency, e nenhuma suíte declara`
      com `run: bash scripts/gates/concorrencia.sh`. Nenhum passo de instalação de
      ferramenta entra: `python3` e PyYAML já são exercitados pelos passos
      vizinhos de `fluxos.sh` e `pnpm_isolado.sh` no mesmo job e no mesmo runner.
      O comentário que hoje explica por que **estes dois** portões que medem o
      próprio `.github/workflows` pertencem a esta suíte passa a falar de três,
      reescrito no presente. A chave `on:` do arquivo não é tocada, e nenhum dos
      dois passos novos recebe `if:`.
      Justificativa: `RF-16` e `RF-17`. É esta suíte, e não os três fluxos por
      frente: aqueles têm filtro de `paths`, e um pull request que mexa só em
      `.github/workflows/bloqueio.yml` não dispara nenhum deles — que é
      exatamente o pull request em que um fluxo sem `concurrency` entra. Não há
      runner que descubra testes: cada um é nomeado à mão neste arquivo, então o
      passo do teste é a única coisa que impede o portão de parar de morder em
      silêncio, e é a peça que some quando alguém escreve o portão e o teste sem
      lembrar de quem os executa. O comentário é reconciliado no mesmo PR pelas
      regras 7 e 8.

**Risco sobre o critério de integração que mede o agregador inteiro.** O código
de saída de `bash scripts/gates/gates_runner.sh` soma todos os portões do
repositório, e a isenção nominal de `qs` na quarentena de sete dias vence em
`2026-09-06`: a partir desse dia `scripts/gates/quarentena.sh` reprova por
vencimento em **todo** pull request, e o agregador sai `1` por um portão vizinho.
Fechar isso é o item `049-a-isencao-de-qs-vence-e-alguem-precisa-fecha-la`, fora
deste escopo. Se esse critério ficar vermelho, a primeira medição é qual portão
reprovou: vermelho isolado na quarentena é o `049` chegando, e o item `057` está
atrás dele na fila.

---

## Execução sugerida

1. **Fase 1**, sozinha, sobre `develop`. Ela é o contrato: a forma literal que os
   cinco fluxos passam a declarar, e a única coisa que o item precisa para o
   valor chegar — o push seguinte mata o run obsoleto a partir do merge dela.
2. **Fase 2**, empilhada sobre a fase 1 com `gh stack`, nunca com `--base` à mão.
   Os critérios de integração são julgados nela, que é a última.

**Nada corre em paralelo, e a razão é medida.** As duas fases escrevem em
`.github/workflows/_suite-portoes.yml` — a fase 1 no parágrafo que ficou falso, a
fase 2 nos dois passos do job `medir` —, então os conjuntos de arquivos não são
disjuntos e um `git worktree` simultâneo terminaria em conflito de merge no mesmo
arquivo. Some-se a isso a dependência dura: o critério da fase 2 que mede a linha
`medido:` sobre a árvore real espera `5 de gatilho (5 com concurrency na forma
esperada, 0 sem)`, e sem a fase 1 dentro da árvore ele mede `0 com` e `5 sem`. A
fase 2 é, por construção, vermelha antes da fase 1.

Nenhuma frente de produto entra em nenhuma das duas: `apps/api`, `apps/web`,
`apps/site` e `packages/editor` ficam intactos, e `apps/api/openapi.json` não
muda. O item inteiro vive em `.github/workflows/` e `scripts/gates/`.

## Validações de campo pendentes

Migram para a seção homônima de `product/roadmap.md` quando o item fechar.

- **Fase 1 — `main` e `develop` não cancelam, confirmado em ambiente real.** O
  que fica provado por critério é a expressão: os cinco fluxos declaram a mesma
  cadeia literal, e essa cadeia, avaliada com a semântica de `!=` e `&&` do
  GitHub Actions num avaliador determinístico, dá `false` para `refs/heads/main`,
  `false` para `refs/heads/develop` e `true` para uma referência de trabalho. O
  que **não** fica provado é o GitHub avaliando a mesma expressão do mesmo jeito
  sobre um push de verdade nessas duas branches. A observação exigiria empurrar
  dois commits direto para `develop` com trinta segundos de intervalo e conferir
  que os dois runs de `Portões` chegam ao fim — e ninguém deve empurrar commit em
  `develop` só para medir, ainda mais quando o defeito que se procura é
  justamente uma medição perdida. Fica para a primeira ocorrência natural: no
  próximo merge que puser dois commits em `develop` em menos de três minutos,
  conferir em `gh run list --branch develop --workflow "Portões" --json
  headSha,conclusion` que nenhuma das duas entradas traz `cancelled`. Enquanto
  isso não acontece, o risco coberto é a expressão errada, e não a plataforma se
  comportando de outro jeito.
- **Fase 1 — o cancelado diante da tranca de merge, num pull request de
  verdade.** O que fica provado por critério é que `scripts/merge-se-liberado.sh`
  filtra `$2=="fail"` e `$2=="pending"` e não contém a cadeia `cancel` em caixa
  nenhuma, e que a tranca não foi tocada. O que **não** fica provado é um pull
  request com verificação `cancelled` no próprio head passando por ela: não
  existe um assim no repositório — varridos os PRs #34 a #42 em 04/09/2026 —, e o
  cancelamento por `cancel-in-progress` sempre tem run sucessor, então a condição
  não é fabricável sem cancelar à mão. A classe de falha vizinha — check
  cancelado no head **sem** sucessor lido como não-vermelho — é anterior a este
  item e tem dono: `059-a-tranca-nao-le-check-cancelado-como-verde`.
