#!/usr/bin/env bash
# Prova que o portão da quarentena distingue as três respostas que
# `pnpm config get` dá com o mesmo código de saída zero: o número certo, o
# `undefined` de quem não configurou, e o número errado de quem baixou a espera.
# Sem este teste, os dois caminhos de reprovação só são exercidos à mão no dia em
# que foram escritos — e um portão que parou de morder tem exatamente a mesma
# cara de um repositório configurado.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a variável
# vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
portao="$raiz/scripts/gates/quarentena.sh"
tmp="${TMPDIR:-/tmp}/quarentena-test-$$"
bash_absoluto="$(command -v bash)"
falhas=0

monta_fixture() { # monta_fixture <diretório> <corpo do pnpm-workspace.yaml>
  local casa="$1" corpo="$2"
  mkdir -p "$casa"
  printf 'packages:\n  - "apps/*"\n%s' "$corpo" > "$casa/pnpm-workspace.yaml"
}

caso() { # caso <nome> <esperado 0|1> <trecho na saída> <diretório da fixture> [PATH]
  local nome="$1" esperado="$2" trecho="$3" casa="$4" caminho="${5:-$PATH}" saida obtido
  saida="$(env GITHUB_WORKSPACE="$casa" PATH="$caminho" "$bash_absoluto" "$portao" 2>&1)"
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" != "$esperado" ]; then
    printf '  FALHA %s — esperava saída %s, obteve %s\n' "$nome" "$esperado" "$obtido"
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

configurada="$tmp/configurada"
monta_fixture "$configurada" 'minimumReleaseAge: 10080
'
caso "espera de sete dias declarada passa" 0 "minimumReleaseAge = 10080" "$configurada"

# A chave com um caractere trocado é o caso que o portão existe para separar:
# `pnpm config get` sai 0 e imprime `undefined`, igualzinho a quem nunca
# configurou nada. Um portão que só verificasse ausência de erro aprovaria os
# dois.
trocada="$tmp/chave-trocada"
monta_fixture "$trocada" 'minimumReleaseAg: 10080
'
caso "chave com um caractere trocado REPROVA" 1 "undefined" "$trocada"
caso "chave trocada nomeia o número esperado" 1 "esperado 10080" "$trocada"

ausente="$tmp/sem-a-chave"
monta_fixture "$ausente" ''
caso "chave ausente REPROVA" 1 "undefined" "$ausente"

# Baixar a espera é a forma que passa despercebida em revisão: o arquivo continua
# declarando a chave, e só o número mudou.
baixada="$tmp/espera-baixada"
monta_fixture "$baixada" 'minimumReleaseAge: 60
'
caso "espera baixada para uma hora REPROVA declarando o valor medido" 1 \
  "minimumReleaseAge = 60" "$baixada"

sem_arquivo="$tmp/sem-workspace"
mkdir -p "$sem_arquivo"
caso "pnpm-workspace.yaml ausente REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$sem_arquivo"

# Um PATH sem pnpm, e não um PATH vazio: sem `dirname` o script morre antes de
# chegar à asserção, e um erro de shell aprovaria este caso pelo motivo errado —
# o teste mediria a ausência do shell, não a do pnpm.
sem_pnpm="$tmp/path-sem-pnpm"
mkdir -p "$sem_pnpm"
for essencial in dirname git tr printf cat; do
  caminho_do_essencial="$(command -v "$essencial")" || continue
  ln -sf "$caminho_do_essencial" "$sem_pnpm/$essencial"
done
caso "pnpm fora do PATH REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$configurada" "$sem_pnpm"
caso "pnpm fora do PATH nomeia a ferramenta que falta" 1 "pnpm" "$configurada" "$sem_pnpm"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ quarentena.sh: separa o número certo do undefined e do número errado.\n'
else
  printf '\n✗ %s caso(s) do portão da quarentena não se comportaram como deviam.\n' "$falhas" >&2
  exit 1
fi
