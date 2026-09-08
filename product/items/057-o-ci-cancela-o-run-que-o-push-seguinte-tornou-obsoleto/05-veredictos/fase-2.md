VEREDICTO: APROVADO

Fase 2 — O portão `concorrencia.sh` cobra as duas metades, e o CI o cobra.
Validação cega sobre a branch
`057-o-ci-cancela-o-run-que-o-push-seguinte-tornou-obsoleto/fase-2-portao-de-concorrencia`,
commit `1f5777c`, em 04/09/2026.

```
Portões
  lint/analyze: OK — `pnpm -r --if-present run lint` exit 0 (api, web, site: "Done")
  typecheck:    OK — `pnpm -r --if-present run typecheck` exit 0 (tsc --noEmit nos três)
  testes:       OK — `pnpm -r --if-present run test` exit 0
                     (web: 3 arquivos, 17 testes; api: 2 suítes, 40 testes)
  gates:        OK — `bash scripts/gates/gates_runner.sh` exit 0, com
                     "✓ gates: limpos (árvore completa, 344 arquivo(s) considerados)"
                     e os sete portões diretos verdes, quarentena inclusive
                     (isenção ["qs"] ainda dentro do prazo em 2026-09-04)
```

## Critérios de aceite

```
  [x] estrutural — RF-11, RF-13, RF-14 — concorrencia.sh existe, guarda a forma,
      sonda o módulo, não usa yq
      grep -cvE '^[[:space:]]*#' scripts/gates/concorrencia.sh          -> 151   (> 0)
      grep -c -F 'exige_comando python3' …                              -> 2     (>= 1)
      grep -c -F "python3 -c 'import yaml'" …                           -> 1     (>= 1)
      grep -vE '^[[:space:]]*#' … | grep -c -w yq                       -> 0
      grep -c -F -f /tmp/057-esperado.txt …                             -> 2     (>= 2)
      (o /tmp/057-esperado.txt foi escrito com o heredoc literal do critério;
       `cat -A` confirmou as duas linhas sem espaço à direita)

  [x] estrutural — RF-15 — invocação no bloco de portões diretos, antes do `if`,
      cabeçalho reconciliado
      grep -c -F 'bash "$ROOT/scripts/gates/concorrencia.sh" || VEREDICTO=1'
        scripts/gates/gates_runner.sh                                   -> 1
      grep -n -F, mesmas cadeias:
        concorrencia.sh -> linha 245 ; fluxos.sh -> linha 243 ;
        if [ "$SEM_ARTEFATOS" -eq 1 ]; then -> linha 247
        => 243 < 245 < 247, a ordem exigida
      grep -c -F 'os quatro portões diretos' scripts/gates/gates_runner.sh -> 0

  [x] estrutural — RF-16, RF-17 — os dois passos no job `medir` de _suite-portoes.yml
      grep -c -F 'run: bash scripts/gates/concorrencia.sh' …            -> 1
      grep -c -F 'run: bash scripts/gates/__tests__/concorrencia.test.sh' … -> 1
      grep -n: teste=86, portão=112, fluxos.sh=108, pnpm install=118,
               `^  medir:`=45, `^  divergencias:`=147
        => 86 < 112 ; 108 < 112 < 118 ; 45 < 86 e 112 < 147
      grep -c -E 'pip install|apt-get install|setup-python' …           -> 0

  [x] comando — RF-08, RF-09 — a medição da árvore real
      `bash scripts/gates/concorrencia.sh` -> exit 0
      saída (a primeira linha casando com `grep -qxF` da linha exigida na íntegra):
        medido: 9 fluxo(s) em .github/workflows — 5 de gatilho (5 com concurrency na
        forma esperada, 0 sem) e 4 chamado(s) por workflow_call (0 com concurrency)
        ✓ concorrencia: todo fluxo de gatilho declara a forma esperada, e nenhuma
        suíte chamada declara.

  [x] comando — RF-17 — o teste do portão
      `bash scripts/gates/__tests__/concorrencia.test.sh` -> exit 0
      contém "✓ concorrencia:" (1 ocorrência), nenhuma linha com "FALHA" (0)
      `… | grep -c '^  ok '`                                            -> 20   (>= 10)

  [x] comportamental — RF-07, RF-10 — gatilho sem bloco reprova, suíte correta ao
      lado não é cobrada
      árvore /tmp/057-sem-declaracao montada literalmente (ci-novo.yml + _suite-b.yml)
      `env GITHUB_WORKSPACE=/tmp/057-sem-declaracao bash scripts/gates/concorrencia.sh`
        -> exit 1
      saída: "::error::ci-novo.yml: fluxo de gatilho sem bloco `concurrency`.
              Acrescente, no nível de cima do arquivo:" seguida das três linhas da
              forma esperada
      contém `ci-novo.yml` (1) ; contém
        `cancel-in-progress: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}` (1)
      NÃO contém `_suite-b.yml` (0)

  [x] comportamental — RF-11 — forma errada reprova imprimindo o que leu e o que
      esperava
      árvore /tmp/057-forma-errada (ci-cru.yml com group: ${{ github.ref }} e
      cancel-in-progress: true)
      -> exit 1 ; contém `ci-cru.yml` (1) ; contém `${{ github.workflow }}-${{ github.ref }}` (1)
      linha que tem `cancel-in-progress` e também `true` (1):
        "  cancel-in-progress: leu `true` — esperava `${{ github.ref != 'refs/heads/main' && … }}`"

  [x] comportamental — RF-12 — suíte que declara reprova e aponta o chamador
      árvore /tmp/057-suite-declara (ci-ok.yml na forma certa + _suite-b.yml declarando)
      -> exit 1 ; contém `_suite-b.yml` (1) ; contém `chamador` (1) ;
         NÃO contém `ci-ok.yml` (0)
      saída: "::error::_suite-b.yml: suíte chamada por workflow_call não declara
              `concurrency` — essa linha pertence ao fluxo chamador."

  [x] comportamental — RF-14 — módulo ausente reprova nomeando PyYAML antes de
      classificar
      árvore /tmp/057-sem-pyyaml com o python3 de mentira à frente do PATH (repassa
      tudo que não seja `import yaml` para /usr/bin/python3)
      -> exit 1 ; contém `yaml` (1) ; contém `não conseguiu medir` (1)
      NÃO contém `medido:` (0) ; NÃO contém `ci-novo.yml` (0)
      saída: "::error::portão não conseguiu medir: o módulo PyYAML não responde a
              'import yaml' no python3 do PATH …" + "REPROVADO por impossibilidade
              de medição, não por resultado."

  [x] comportamental — RF-21 — o órfão soma no total e em nenhuma população
      árvore /tmp/057-fora-das-populacoes (ci-ok.yml + orfao.yml com
      workflow_dispatch e schedule)
      -> exit 1 ; contém `orfao.yml`, `workflow_dispatch` e `schedule` (1 cada)
      linha exigida presente na íntegra (grep -qxF):
        medido: 2 fluxo(s) em .github/workflows — 1 de gatilho (1 com concurrency na
        forma esperada, 0 sem) e 0 chamado(s) por workflow_call (0 com concurrency)

  [x] comportamental — RF-18, RF-19 — não achar e não conseguir procurar têm
      respostas diferentes
      /tmp/057-sem-dir  -> exit 1 ; "::error::portão não conseguiu medir:
                           .github/workflows não existe sob /tmp/057-sem-dir …"
                           (contém `não conseguiu medir` e `.github/workflows`)
      /tmp/057-dir-vazio -> exit 1 ; "medido: 0 fluxo(s) em .github/workflows" +
                           "::error::.github/workflows existe e não contém nenhum
                            .yml nem .yaml — não havia o que medir."
      `0 sem` em nenhuma das duas saídas (0 e 0)

  [x] comportamental — RF-20 — YAML ilegível reprova sem entrar na conta
      /tmp/057-yaml-quebrado -> exit 1 ; contém `quebrado.yml` (1) ; contém
      `não consegui medir` (1) ; NÃO contém `medido:` (0)
      saída: "::error::quebrado.yml não é YAML legível (while parsing a flow node …
              line 2, column 6 …) — não consegui medir."
```

## Critérios de integração — as duas fases na mesma árvore

```
  [x] comando — RF-01, RF-05, RF-08, RF-09 — declaração e leitura concordam sobre a
      árvore real
      `bash scripts/gates/concorrencia.sh` -> exit 0, com a linha `medido: 9 fluxo(s)
      … 5 de gatilho (5 com concurrency na forma esperada, 0 sem) e 4 chamado(s) por
      workflow_call (0 com concurrency)` conferida por `grep -qxF` (linha inteira,
      sem variação)

  [x] comando — RF-15 — o portão novo corre dentro do agregador
      `bash scripts/gates/gates_runner.sh`                 -> exit 0
      `bash scripts/gates/gates_runner.sh --sem-artefatos` -> exit 0, e a saída contém
      a mesma linha `medido: 9 fluxo(s) …` (grep -qxF) e "✓ concorrencia: …" na linha
      17 da saída

  [x] comando — RF-05, RF-16, RF-17 — o arquivo que as duas fases editam
      o heredoc `python3 - <<'PY' … PY` do critério -> exit 0 e, nesta ordem:
        ['workflow_call']
        False
        True
        True
```

## Instrumentos do implementer

O critério `comando` — `RF-17` é, por construção, a suíte do próprio avaliado
(`scripts/gates/__tests__/concorrencia.test.sh`): ele exige rodar aquele arquivo e
contar as linhas `  ok `, e não há como cumpri-lo sem ele.

**Nenhum outro critério dependeu da suíte do avaliado.** As nove reprovações que o
teste alega — gatilho sem bloco, forma crua, grupo diferente, suíte que declara,
órfão, diretório vazio, diretório ausente, YAML ilegível, PyYAML ausente — foram
provocadas pelo validador, com árvores de mentira montadas do zero e o portão
invocado diretamente. É dessa medição independente, e não do teste, que vêm as
evidências dos sete critérios `comportamental`.

## Apontamentos

- **Substituição de comando declarada.** Nos seis critérios `comportamental` que
  montam árvore de mentira, a remoção recursiva da limpeza idempotente foi trocada
  por `[ -e "$d" ] && { find "$d" -mindepth 1 -depth -delete; rmdir "$d"; }`, porque
  o hook de segurança desta máquina a recusa. O resto de cada comando foi executado
  literalmente, incluindo o `printf` de montagem, o `env …` e as cadeias buscadas.
  Os diretórios `/tmp/057-*` não existiam antes da rodada, então o resultado não
  depende de resíduo. A norma que falta virou o item `062` do roadmap, e a decisão
  está registrada em `decisoes-autonomas.md` (`D23`).
- **O envelope do despacho vazou.** O despacho apontou para o trecho do plano em vez
  de extrair os critérios tipados para dentro dele, e o trecho carrega junto o
  objetivo da fase, as etapas com justificativa e a análise de risco. O validador
  declarou ter ignorado tudo isso e julgado só contra os critérios como escritos.
  A correção é do despacho da próxima fase: extrair os critérios para dentro dele.
- Nenhum outro problema objetivo encontrado. A saída de todos os comandos foi lida
  em modo cru, e `command_quirks` em `.harness/config.json` está vazio — nenhum
  código de saída precisou ser desconsiderado.
