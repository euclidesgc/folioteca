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

[ "$falhas" -eq 0 ] && { printf '✓ merge-se-liberado: %s\n' 'pendente não é verde'; exit 0; }
printf '✗ merge-se-liberado: %s caso(s) falharam\n' "$falhas" >&2
exit 1
