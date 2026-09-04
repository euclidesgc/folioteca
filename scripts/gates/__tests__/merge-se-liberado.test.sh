#!/usr/bin/env bash
# Prova que a tranca de merge trata verificação PENDENTE como não medida.
#
# O caso que importa é o segundo. A primeira versão do script recusava só o
# check `fail`, e um PR cujo CI ainda roda não tem nenhum `fail` — tem quatro
# `pending`. Ele passava, e o merge acontecia antes de o CI dizer qualquer
# coisa: a ausência de vermelho lida como verde, quando o certo era ler como
# ainda não medido. Numa corrida autônoma de trinta merges, é trinta merges sem
# CI. Sem este caso, a próxima reescrita reintroduz o silêncio.
#
# O segundo caso que importa é a via do merge. A pilha do GitHub só nasce com
# dois PRs, e a tranca perguntava "esta branch está numa pilha local?" — que
# responde sim para o PR único de um estágio de documento. Ela então chamava
# `gh stack merge`, que recusa o número por não ser PR empilhado, e o merge
# liberado não saía. Os dois casos de via abaixo prendem a contagem: com um PR
# aberto o merge é o do PR, com dois é o da pilha.
#
# O `gh` é dublo: um script no PATH que responde por argumento. Sem ele o teste
# mediria a rede e o repositório de verdade, e não o que a tranca decide.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
alvo="$raiz/scripts/merge-se-liberado.sh"
falhas=0

caso() { # caso <nome> <esperado> <checks-tsv> [rótulos]
  local nome="$1" esperado="$2" checks="$3" rotulos="${4:-}" obtido dublo saida
  dublo="$(mktemp -d)"
  cat > "$dublo/gh" <<GH
#!/usr/bin/env bash
case "\$*" in
  *"--json labels"*)        printf '%s' "$rotulos" ;;
  *"pr checks"*)            printf '%b' "$checks"; exit 0 ;;
  *mergeStateStatus*)       printf 'CLEAN\n' ;;
  *"stack view"*)           exit 1 ;;
  *"stack merge"*)          printf 'MERGEADO\n' ;;
  *"pr merge"*)             printf 'MERGEADO\n' ;;
  *)                        printf '\n' ;;
esac
GH
  chmod +x "$dublo/gh"
  saida="$(PATH="$dublo:$PATH" MERGE_ESPERA_SEGUNDOS=1 bash "$alvo" 42 2>&1)"
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
  fi
}

printf 'merge-se-liberado: a tranca\n'
caso 'tudo verde libera'            0 'ci\tpass\t1s\turl\n'
caso 'pendente recusa'              1 'ci\tpass\t1s\turl\nportoes\tpending\t0\turl\n'
caso 'vermelho recusa'              1 'ci\tfail\t1s\turl\n'
caso 'rótulo de bloqueio recusa'    1 'ci\tpass\t1s\turl\n' 'blocked-on-D-007'
caso 'pendente recusa mesmo com o resto verde' 1 'a\tpass\t1s\turl\nb\tpass\t1s\turl\nc\tpending\t0\turl\n'

# caso_via <nome> <via esperada: pr-merge|stack-merge> <json da pilha>
#
# O `gh stack view --json` do dublo devolve a pilha inteira, e o rastro grava
# qual comando de merge o script escolheu. Sem o rastro o teste só saberia que
# o script saiu 0 — que é verdade nas duas vias, e não distingue a que funciona
# da que o GitHub recusa.
caso_via() {
  local nome="$1" esperada="$2" json="$3" dublo rastro obtida saida rc
  dublo="$(mktemp -d)"; rastro="$dublo/via"
  cat > "$dublo/gh" <<GH
#!/usr/bin/env bash
case "\$*" in
  *"--json labels"*)        printf '' ;;
  *"pr checks"*)            printf 'ci\tpass\t1s\turl\n'; exit 0 ;;
  *mergeStateStatus*)       printf 'CLEAN\n' ;;
  *"stack view"*)           printf '%s' '$json' ;;
  *"pr list"*)              printf '41\n42\n' ;;
  *"stack merge"*)          printf 'stack-merge' > "$rastro"; printf 'MERGEADO\n' ;;
  *"pr merge"*)             printf 'pr-merge' > "$rastro"; printf 'MERGEADO\n' ;;
  *)                        printf '\n' ;;
esac
GH
  chmod +x "$dublo/gh"
  saida="$(PATH="$dublo:$PATH" MERGE_ESPERA_SEGUNDOS=1 bash "$alvo" 42 2>&1)"; rc=$?
  obtida="$(cat "$rastro" 2>/dev/null || printf 'nenhuma')"
  if [ "$rc" -eq 0 ] && [ "$obtida" = "$esperada" ]; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — esperava a via %s, obteve %s (saída %s)\n' "$nome" "$esperada" "$obtida" "$rc"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
  fi
}

# caso_pilha_ilegivel: a pilha responde, a contagem não sai, e a tranca recusa
# por não ter medido — nunca cai no merge do PR "porque deu para ler alguma
# coisa". É a mesma regra do cabeçalho, aplicada ao ramo novo.
caso_pilha_ilegivel() {
  local dublo saida rc
  dublo="$(mktemp -d)"
  cat > "$dublo/gh" <<'GH'
#!/usr/bin/env bash
case "$*" in
  *"--json labels"*)        printf '' ;;
  *"pr checks"*)            printf 'ci	pass	1s	url
'; exit 0 ;;
  *mergeStateStatus*)       printf 'CLEAN
' ;;
  *"stack view"*)           printf 'nao sou json
' ;;
  *"pr merge"*)             printf 'MERGEADO
' ;;
  *)                        printf '
' ;;
esac
GH
  chmod +x "$dublo/gh"
  saida="$(PATH="$dublo:$PATH" MERGE_ESPERA_SEGUNDOS=1 bash "$alvo" 42 2>&1)"; rc=$?
  if [ "$rc" -ne 0 ] && printf '%s' "$saida" | grep -q 'impossibilidade de medição'; then
    printf '  ok    %s\n' 'pilha ilegível recusa por não ter medido'
  else
    printf '  FALHA %s — esperava recusa por não medir, obteve %s\n' 'pilha ilegível recusa por não ter medido' "$rc"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
  fi
}

if command -v jq >/dev/null 2>&1; then
  caso_via 'pilha de um PR mergeia como PR comum'  pr-merge \
    '{"branches":[{"name":"a","pr":{"number":42,"state":"OPEN"}}]}'
  caso_via 'pilha de dois PRs mergeia pela pilha'  stack-merge \
    '{"branches":[{"name":"a","pr":{"number":41,"state":"OPEN"}},{"name":"b","pr":{"number":42,"state":"OPEN"}}]}'
  caso_pilha_ilegivel
else
  printf '  FALHA %s\n' 'jq ausente: os casos de via do merge não puderam ser medidos'
  falhas=$((falhas + 1))
fi

[ "$falhas" -eq 0 ] && { printf '✓ merge-se-liberado: %s\n' 'pendente não é verde, e a via do merge segue a pilha que existe'; exit 0; }
printf '✗ merge-se-liberado: %s caso(s) falharam\n' "$falhas" >&2
exit 1
