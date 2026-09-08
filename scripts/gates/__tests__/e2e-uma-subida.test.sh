#!/usr/bin/env bash
#
# Prova que o portão morde cada uma das formas de multiplicar a subida da
# aplicação, e que ele separa três coisas que a leitura ingênua confunde: não
# ter suíte (passa), ter suíte declarada como deve (passa) e ter suíte que
# mente sobre como é medida (recusa).
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a
# variável vem vazia.
set -uo pipefail

raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
alvo="$raiz/scripts/gates/e2e_uma_subida.sh"
tmp="${TMPDIR:-/tmp}/e2e-uma-subida-test-$$"
falhas=0

# O teste falha FECHADO: sem o alvo, todo caso que espera recusa passaria por
# acidente, e um teste que aprova a maior parte por não ter o que medir é o
# mesmo defeito que o portão existe para matar.
[ -f "$alvo" ] || {
  printf '✗ e2e uma subida: o alvo %s não existe — não há o que medir.\n' "$alvo" >&2
  exit 2
}

CONFIG_BOA='import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  maxFailures: 0,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e-resultado.json" }]],
});
'

monta() { # monta <dir> <config|-> <linha de invocação|->
  local dir="$1" config="$2" invocacao="$3"
  mkdir -p "$dir/apps/web" "$dir/.github/workflows" "$dir/scripts/gates"
  cp "$raiz/scripts/gates/medir.sh" "$dir/scripts/gates/medir.sh"
  cp "$alvo" "$dir/scripts/gates/e2e_uma_subida.sh"
  [ "$config" = "-" ] || printf '%s' "$config" > "$dir/apps/web/playwright.config.ts"
  printf 'name: X\non: [push]\njobs:\n  a:\n    steps:\n' > "$dir/.github/workflows/ci.yml"
  [ "$invocacao" = "-" ] || printf '      - run: %s\n' "$invocacao" >> "$dir/.github/workflows/ci.yml"
  ( cd "$dir" && git init -q && git add -A &&
    git -c user.email=t@t -c user.name=t commit -qm x ) >/dev/null 2>&1
}

caso() { # caso <nome> <esperado 0|1> <config> <invocação> [trecho da recusa]
  local nome="$1" esperado="$2" config="$3" invocacao="$4" trecho="${5:-}"
  local dir="$tmp/$(printf '%s' "$nome" | tr -c 'a-zA-Z0-9' '-')"
  monta "$dir" "$config" "$invocacao"
  local saida obtido
  # `GITHUB_WORKSPACE` é FIXADO na sandbox, e não herdado. `medir_raiz()` o
  # prefere ao `git rev-parse`, então dentro do CI ele aponta para o checkout de
  # verdade: sem esta linha, todo caso mede o repositório real — que está limpo —
  # e os seis que esperam recusa passam a aprovar. O teste ficou verde nesta
  # máquina, onde a variável não existe, e vermelho no runner, onde existe. É a
  # convenção que os outros seis testes de portão desta pasta já seguem.
  saida="$(cd "$dir" && env GITHUB_WORKSPACE="$dir" bash scripts/gates/e2e_uma_subida.sh 2>&1)"
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" = "$esperado" ] && { [ -z "$trecho" ] || printf '%s' "$saida" | grep -qF "$trecho"; }; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
  fi
}

printf 'e2e uma subida: o portão\nsandbox em %s\n\n' "$tmp"

caso 'sem configuração de Playwright PASSA'  0 '-' '-'
# A contagem é a asserção que denuncia a âncora escorregando: a sandbox tem UMA
# invocação e este repositório tem outra. Sem ela, o teste volta a ficar verde
# medindo o lugar errado, que é pior que reprovar.
caso 'configuração completa PASSA, medindo a sandbox e não este repositório' 0 \
  "$CONFIG_BOA" 'pnpm --filter web exec playwright test' 'medido: 1 invocação(ões)'

caso 'sem reporter json RECUSA' 1 \
  "${CONFIG_BOA/\[\[\"list\"\], \[\"json\", \{ outputFile: \"e2e-resultado.json\" \}\]\]/[[\"list\"]]}" \
  'pnpm --filter web exec playwright test' 'não declara o reporter'

caso 'maxFailures diferente de zero RECUSA' 1 \
  "${CONFIG_BOA/maxFailures: 0/maxFailures: 5}" \
  'pnpm --filter web exec playwright test' 'maxFailures: 0'

caso 'retries acima de zero RECUSA' 1 \
  "${CONFIG_BOA/retries: 0/retries: 2}" \
  'pnpm --filter web exec playwright test' 'retries: 0'

caso 'invocação com --max-failures RECUSA' 1 "$CONFIG_BOA" \
  'pnpm --filter web exec playwright test --max-failures=1' 'desistindo cedo'

caso 'invocação fatiada com -g RECUSA' 1 "$CONFIG_BOA" \
  'pnpm --filter web exec playwright test -g "um critério só"' 'fatia a suíte'

caso 'invocação com --shard RECUSA' 1 "$CONFIG_BOA" \
  'pnpm --filter web exec playwright test --shard=1/4' 'fatia a suíte'

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ e2e uma subida: fatiar e desistir cedo recusam, e a ausência de suíte passa.\n'
else
  printf '\n✗ %s caso(s) não se comportaram como deveriam.\n' "$falhas" >&2
  exit 1
fi
