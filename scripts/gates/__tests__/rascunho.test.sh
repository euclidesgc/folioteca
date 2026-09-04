#!/usr/bin/env bash
# Prova que o portão do rascunho MORDE nas duas asserções.
#
# A segunda é a que importa mais e a que se esquece: um fluxo com a guarda em
# todos os jobs e sem `ready_for_review` nos types passa a nunca rodar — sair do
# rascunho não dispara evento nenhum, e o PR fica pronto e sem CI para sempre.
# Trocar "roda demais" por "não roda nunca" é pior que o defeito original, e
# nenhum sintoma acusa: o PR simplesmente não tem check, e a tranca o recusa por
# um motivo que parece outro.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
alvo="$raiz/scripts/gates/rascunho.sh"
falhas=0

[ -f "$alvo" ] || {
  printf '✗ rascunho: o alvo %s não existe — não há o que medir.\n' "$alvo" >&2
  exit 2
}

caso() { # caso <nome> <esperado 0|1> <trecho na saída> <conteúdo do fluxo>
  local nome="$1" esperado="$2" trecho="$3" corpo="$4" casa saida obtido
  casa="$(mktemp -d)"
  mkdir -p "$casa/.github/workflows" "$casa/scripts/gates"
  cp "$raiz/scripts/gates/medir.sh" "$casa/scripts/gates/medir.sh"
  cp "$alvo" "$casa/scripts/gates/rascunho.sh"
  printf '%s' "$corpo" > "$casa/.github/workflows/ci.yml"
  saida="$(env GITHUB_WORKSPACE="$casa" bash "$casa/scripts/gates/rascunho.sh" 2>&1)"
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" != "$esperado" ]; then
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
    return
  fi
  if [ -n "$trecho" ] && ! printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  FALHA %s — a saída não contém %s\n' "$nome" "$trecho"
    falhas=$((falhas + 1))
    return
  fi
  printf '  ok    %s\n' "$nome"
}

COMPLETO='name: X
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
jobs:
  a:
    if: github.event.pull_request.draft != true
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
SEM_GUARDA='name: X
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
SEM_READY='name: X
on:
  pull_request:
    types: [opened, reopened, synchronize]
jobs:
  a:
    if: github.event.pull_request.draft != true
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
UM_JOB_SEM='name: X
on:
  pull_request:
    types: [opened, reopened, synchronize, ready_for_review]
jobs:
  a:
    if: github.event.pull_request.draft != true
    runs-on: ubuntu-latest
    steps:
      - run: "true"
  b:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
SO_PUSH='name: X
on:
  push:
    branches: [main]
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: "true"
'
QUEBRADO='name: X
on: [: isto não é YAML
'

printf 'portão do rascunho\n'
caso 'fluxo completo passa'                      0 'nenhum job roda em PR rascunho' "$COMPLETO"
caso 'job sem a guarda REPROVA'                  1 'sem a guarda de rascunho'       "$SEM_GUARDA"
caso 'job sem a guarda ensina a linha que falta' 1 'draft != true'                  "$SEM_GUARDA"
caso 'types sem ready_for_review REPROVA'        1 'ready_for_review'               "$SEM_READY"
caso 'types sem ready explica o que acontece'    1 'pronto e sem CI'                "$SEM_READY"
caso 'UM job sem a guarda entre dois REPROVA'    1 'ci.yml:b'                       "$UM_JOB_SEM"
caso 'fluxo só de push não é cobrado'            0 '0 fluxo(s) com gatilho'         "$SO_PUSH"
caso 'YAML ilegível REPROVA por não ter medido'  1 'não consegui medir'             "$QUEBRADO"

[ "$falhas" -eq 0 ] && { printf '✓ rascunho: as duas asserções mordem\n'; exit 0; }
printf '✗ rascunho: %s caso(s) falharam\n' "$falhas" >&2
exit 1
