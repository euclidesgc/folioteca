#!/usr/bin/env bash
# Prova que o portão da concorrência MORDE nas duas metades, que falham em
# sentidos opostos.
#
# Um fluxo de gatilho SEM declaração paga dois runs por dois pushes; uma suíte
# chamada COM declaração produz impasse, com o job do pai esperando o filho que
# está enfileirado atrás do pai. Um teste que só exercitasse uma delas deixaria a
# outra passar a aprovar em silêncio — e portão sem teste que morde é a forma
# pela qual este repositório já foi enganado.
#
# Os casos de impossibilidade verificam também o que a saída NÃO tem: a linha
# `medido:` ausente é o que separa "reprovou" de "reprovou depois de contar
# errado". Com as duas cadeias na saída, um portão que classificasse antes de
# reprovar passaria por um teste que só procurasse a mensagem de erro.
#
# Diferente de `fluxos.test.sh`, este teste não copia o portão nem o `medir.sh`
# para a sandbox: o portão resolve o `source` pelo caminho do próprio arquivo e a
# árvore por `medir_raiz()`, então apontar `GITHUB_WORKSPACE` para a sandbox mede
# a árvore de mentira com o script de verdade — e é uma cópia a menos para ficar
# velha sem ninguém notar.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
alvo="$raiz/scripts/gates/concorrencia.sh"
falhas=0

[ -f "$alvo" ] || {
  printf '✗ concorrencia: o alvo %s não existe — não há o que medir.\n' "$alvo" >&2
  exit 2
}

avalia() { # avalia <nome> <esperado 0|1> <obtido> <saída> <trecho exigido> <trecho proibido>
  local nome="$1" esperado="$2" obtido="$3" saida="$4" trecho="$5" proibido="$6"
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" != "$esperado" ]; then
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
    return
  fi
  if [ -n "$trecho" ] && ! printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  FALHA %s — a saída não contém %s\n' "$nome" "$trecho"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
    return
  fi
  if [ -n "$proibido" ] && printf '%s' "$saida" | grep -qF "$proibido"; then
    printf '  FALHA %s — a saída contém %s, e não deveria\n' "$nome" "$proibido"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
    return
  fi
  printf '  ok    %s\n' "$nome"
}

caso() { # caso <nome> <esperado 0|1> <trecho na saída> <árvore> [<trecho proibido>]
  local nome="$1" esperado="$2" trecho="$3" casa="$4" proibido="${5:-}" saida obtido
  saida="$(env GITHUB_WORKSPACE="$casa" bash "$alvo" 2>&1)"
  obtido=$?
  avalia "$nome" "$esperado" "$obtido" "$saida" "$trecho" "$proibido"
}

arvore() { # arvore [<nome do arquivo> <conteúdo>]... → imprime o caminho da sandbox
  local casa; casa="$(mktemp -d)"
  mkdir -p "$casa/.github/workflows"
  while [ "$#" -ge 2 ]; do
    printf '%s' "$2" > "$casa/.github/workflows/$1"
    shift 2
  done
  printf '%s' "$casa"
}

GATILHO_OK='name: X
on:
  pull_request:
    types: [opened]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != '"'"'refs/heads/main'"'"' && github.ref != '"'"'refs/heads/develop'"'"' }}
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
GATILHO_SEM='name: X
on:
  pull_request:
    types: [opened]
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
CANCEL_CRU='name: X
on:
  push:
    branches: [main]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
GRUPO_OUTRO='name: X
on:
  pull_request:
    types: [opened]
concurrency:
  group: ${{ github.ref }}
  cancel-in-progress: ${{ github.ref != '"'"'refs/heads/main'"'"' && github.ref != '"'"'refs/heads/develop'"'"' }}
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
SUITE_OK='name: Y (suíte)
on:
  workflow_call:
    inputs:
      runner:
        required: true
        type: string
jobs:
  b:
    runs-on: ${{ inputs.runner }}
    steps:
      - run: "true"
'
SUITE_DECLARA='name: Y (suíte)
on:
  workflow_call:
    inputs:
      runner:
        required: true
        type: string
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
jobs:
  b:
    runs-on: ${{ inputs.runner }}
    steps:
      - run: "true"
'
ORFAO='name: Órfão
on:
  workflow_dispatch:
  schedule:
    - cron: "0 3 * * 1"
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
QUEBRADO='name: X
on: [: isto não é YAML
'

printf 'portão da concorrência\n'

# A árvore do repositório em miniatura: cinco de gatilho, quatro suítes.
COMPLETA="$(arvore \
  ci-um.yml "$GATILHO_OK" ci-dois.yml "$GATILHO_OK" ci-tres.yml "$GATILHO_OK" \
  ci-quatro.yml "$GATILHO_OK" ci-cinco.yml "$GATILHO_OK" \
  _suite-a.yml "$SUITE_OK" _suite-b.yml "$SUITE_OK" _suite-c.yml "$SUITE_OK" \
  _suite-d.yml "$SUITE_OK")"
caso 'cinco de gatilho e quatro suítes passam' 0 \
  'medido: 9 fluxo(s) em .github/workflows — 5 de gatilho (5 com concurrency na forma esperada, 0 sem) e 4 chamado(s) por workflow_call (0 com concurrency)' \
  "$COMPLETA"

SEM_BLOCO="$(arvore ci-novo.yml "$GATILHO_SEM" _suite-b.yml "$SUITE_OK")"
caso 'gatilho SEM bloco REPROVA nomeando o arquivo' 1 'ci-novo.yml' "$SEM_BLOCO"
caso 'gatilho sem bloco ensina a linha que falta' 1 \
  "cancel-in-progress: \${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}" \
  "$SEM_BLOCO"
caso 'a suíte correta ao lado não é cobrada' 1 'ci-novo.yml' "$SEM_BLOCO" '_suite-b.yml'

CRU="$(arvore ci-cru.yml "$CANCEL_CRU")"
caso 'cancel-in-progress: true cru REPROVA' 1 'fora da forma esperada' "$CRU"
caso 'a reprovação do cru imprime o que leu' 1 'cancel-in-progress: leu `true`' "$CRU"

OUTRO_GRUPO="$(arvore ci-grupo.yml "$GRUPO_OUTRO")"
caso 'chave de grupo diferente REPROVA' 1 'group: leu `${{ github.ref }}`' "$OUTRO_GRUPO"
caso 'a reprovação do grupo imprime o que esperava' 1 \
  'esperava `${{ github.workflow }}-${{ github.ref }}`' "$OUTRO_GRUPO"

SUITE_COM="$(arvore ci-ok.yml "$GATILHO_OK" _suite-b.yml "$SUITE_DECLARA")"
caso 'suíte que declara REPROVA nomeando o arquivo' 1 '_suite-b.yml' "$SUITE_COM"
caso 'a reprovação da suíte diz para onde a linha vai' 1 'chamador' "$SUITE_COM"
caso 'o gatilho correto ao lado não é cobrado' 1 '_suite-b.yml' "$SUITE_COM" 'ci-ok.yml'

FORA="$(arvore ci-ok.yml "$GATILHO_OK" orfao.yml "$ORFAO")"
caso 'on: que não cai nas duas populações REPROVA' 1 'orfao.yml' "$FORA"
caso 'a reprovação do órfão imprime as chaves que leu' 1 'workflow_dispatch, schedule' "$FORA"
caso 'o órfão soma no total e em nenhuma população' 1 \
  'medido: 2 fluxo(s) em .github/workflows — 1 de gatilho (1 com concurrency na forma esperada, 0 sem) e 0 chamado(s) por workflow_call (0 com concurrency)' \
  "$FORA"

VAZIA="$(arvore)"
caso 'diretório vazio REPROVA dizendo que não havia o que medir' 1 \
  'não havia o que medir' "$VAZIA" '0 sem'

AUSENTE="$(mktemp -d)"
caso 'diretório ausente REPROVA nomeando o diretório' 1 \
  '.github/workflows não existe' "$AUSENTE" 'medido:'

ILEGIVEL="$(arvore quebrado.yml "$QUEBRADO")"
caso 'YAML ilegível REPROVA sem contar nada' 1 'quebrado.yml' "$ILEGIVEL" 'medido:'
caso 'o ilegível diz que não conseguiu medir' 1 'não consegui medir' "$ILEGIVEL"

# O `python3` de mentira à frente do PATH é o único jeito determinístico de
# medir a ausência do MÓDULO sem desinstalar PyYAML da máquina de quem trabalha.
# Ele repassa ao interpretador de verdade tudo o que não é a sondagem, para o
# caso não medir, por acidente, a ausência do interpretador.
SEM_MODULO="$(arvore ci-novo.yml "$GATILHO_SEM")"
mkdir -p "$SEM_MODULO/bin"
real="$(command -v python3)"
printf '#!/bin/sh\ncase "$*" in\n  *"import yaml"*) echo "ModuleNotFoundError: No module named '"'"'yaml'"'"'" >&2; exit 1 ;;\nesac\nexec %s "$@"\n' "$real" > "$SEM_MODULO/bin/python3"
chmod +x "$SEM_MODULO/bin/python3"
saida="$(env GITHUB_WORKSPACE="$SEM_MODULO" PATH="$SEM_MODULO/bin:$PATH" bash "$alvo" 2>&1)"
obtido=$?
avalia 'módulo yaml ausente REPROVA nomeando PyYAML' 1 "$obtido" "$saida" 'PyYAML' 'medido:'
avalia 'a ausência do módulo vem antes de classificar arquivo' 1 "$obtido" "$saida" \
  'não conseguiu medir' 'ci-novo.yml'

[ "$falhas" -eq 0 ] && {
  printf '✓ concorrencia: reprova o fluxo sem declaração, a forma errada, a suíte que declara e o que não conseguiu medir.\n'
  exit 0
}
printf '✗ concorrencia: %s caso(s) falharam\n' "$falhas" >&2
exit 1
