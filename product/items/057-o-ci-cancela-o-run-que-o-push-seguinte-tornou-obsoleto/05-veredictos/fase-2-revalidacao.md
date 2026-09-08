# Fase 2 — revalidação sobre a árvore mergeada

**Veredicto: APROVADO.** Quinze critérios, todos verificados por evidência
executada sobre `573a6fe`, o topo de `develop` depois de a fase ter mergeado.

## Por que esta revalidação existe

Depois do veredicto de 04/09/2026, o conteúdo de `apps/web` mudou: outro trabalho
trouxe uma suíte comportamental nova e alterou `playwright.config.ts`,
`package.json` e `e2e/`. O `state.py check` reprovou com "o que está sob
julgamento não é o que foi julgado; revalide", e estava certo em reprovar — a
árvore registrada no veredicto não era mais a árvore do repositório.

`git log 5c09744..573a6fe -- scripts/gates/concorrencia.sh
scripts/gates/__tests__/concorrencia.test.sh scripts/gates/gates_runner.sh
.github/workflows/` volta **vazio**: nenhum dos arquivos que esta fase entrega
mudou. A remedição confirma isso por execução, e não por dedução.

## O que foi medido

| Critério | Tipo | Resultado |
|---|---|---|
| C1 — `concorrencia.sh` guarda a forma esperada em si mesmo | estrutural | ✓ 151 linhas úteis, `exige_comando python3` presente, sondagem de `import yaml` presente, zero `yq` |
| C2 — `gates_runner.sh` o invoca no bloco de portões diretos | estrutural | ✓ linha 275, entre `fluxos.sh` (273) e a guarda de `--sem-artefatos` (279) |
| C3 — `_suite-portoes.yml` carrega os dois passos no job `medir` | estrutural | ✓ teste na linha 86, portão na 116, ambos antes de `pnpm install` (130); zero passo de instalação de ferramenta |
| C4 — o portão sai zero e imprime a linha de medição | comando | ✓ `medido: 9 fluxo(s) … 5 de gatilho (5 com concurrency na forma esperada, 0 sem) e 4 chamado(s) por workflow_call (0 com concurrency)`, casamento de linha inteira |
| C5 — o teste do portão morde | comando | ✓ saída `0`, 20 casos `ok`, zero `FALHA` |
| C6 — gatilho sem declaração REPROVA | comportamental | ✓ saída `1`, nomeia `ci-novo.yml` e a linha esperada |
| C7 — forma errada REPROVA dizendo o que leu | comportamental | ✓ saída `1`, imprime o lido e o esperado |
| C8 — suíte chamada que declara REPROVA | comportamental | ✓ saída `1`, nomeia o arquivo e diz que a declaração é do chamador |
| C9 — sem PyYAML RECUSA por não medir | comportamental | ✓ saída `1`, `não conseguiu medir`, sem linha `medido:` |
| C10 — fluxo fora das duas populações REPROVA | comportamental | ✓ saída `1`, nomeia o órfão e imprime as chaves de `on:` que leu |
| C11 — diretório ausente e diretório vazio | comportamental | ✓ os dois saem `1`; o vazio imprime `0 fluxo(s)` e nunca `0 sem` |
| C12 — YAML ilegível RECUSA sem medir | comportamental | ✓ saída `1`, `não consegui medir`, sem linha `medido:` |
| I1 — a forma vale sobre a árvore de verdade | comando | ✓ mesma linha de C4 |
| I2 — o agregador sai zero | comando | ✓ `gates_runner.sh` saída `0`, com os três artefatos construídos |
| I3 — `_suite-portoes.yml` lido por `yaml.safe_load` | comando | ✓ `['workflow_call'] / False / True / True` |

Toda evidência foi colhida com `rtk proxy`, que executa sem o filtro de saída que
um hook global impõe — está registrado em `command_quirks` de
`.harness/config.json`, e sem ele a saída resumida esconderia o que reprovaria.

## Correção de fato sobre o despacho

O despacho supôs que vários critérios comportamentais observariam o GitHub
Actions cancelando runs, e pediu que os não medíveis fossem nomeados. **Nenhum
critério da fase 2 está nessa condição.** Os sete comportamentais são locais:
montam árvores de mentira em diretório temporário e rodam o portão contra elas.
Os dois que tocam o CI são estruturais sobre o texto de `_suite-portoes.yml`, não
execução de job. Zero critério exigiu runner hospedado.
