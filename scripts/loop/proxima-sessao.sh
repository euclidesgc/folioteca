#!/usr/bin/env bash
# O motor do laço autônomo. Casca fina: a decisão mora em
# scripts/decide-next-action.mjs, que é uma função pura sobre o estado.
#
# Não acrescente decisão aqui.
#
#   proxima-sessao.sh            uma rodada: decide, invoca a sessão, empilha o PR
#   proxima-sessao.sh --dry-run  imprime a decisão e sai, sem invocar nada
#   proxima-sessao.sh --ate N    no máximo N rodadas encadeadas (padrão: 1)
#
# O QUE ELE NUNCA FAZ: mergear PR, e empurrar com --force. A pilha existe para
# o merge ser uma decisão do dev, tomada de uma vez, acordado.
#
# CADA RODADA É UMA SESSÃO NOVA. `claude -p` abre processo novo e o prompt é a
# única entrada — é daí que vem a economia de contexto: o custo de uma sessão
# acompanha o tempo que ela fica aberta vezes o contexto que já acumulou.
#
# ⚠️ A sessão roda com --dangerously-skip-permissions, porque não há ninguém
# acordado para aprovar cada escrita. Isso vale enquanto o repositório for o
# alvo e não houver segredo de produção nele. Reveja antes do primeiro deploy.
set -uo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz" || exit 2

seco=0
ate=1
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) seco=1 ;;
    --ate) shift; ate="${1:-1}" ;;
    *) printf 'argumento desconhecido: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

for ferramenta in node claude gh git; do
  command -v "$ferramenta" >/dev/null 2>&1 || {
    printf 'motor: %s não encontrado no PATH; nada foi decidido.\n' "$ferramenta" >&2
    exit 2
  }
done

if [ "$seco" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  printf 'motor: a árvore tem mudança não commitada. Rodar assim varreria trabalho\n' >&2
  printf '       alheio para dentro de um commit de fase. Comite ou guarde antes.\n' >&2
  git status --short >&2
  exit 2
fi

rodada=0
while [ "$rodada" -lt "$ate" ]; do
  rodada=$((rodada + 1))
  printf '\n═══ rodada %s de %s ═══\n' "$rodada" "$ate"

  decisao="$(node scripts/decide-next-action.mjs)"
  codigo=$?
  printf '%s\n' "$decisao"

  if [ "$codigo" -ne 0 ]; then
    printf '\nmotor: parando na rodada %s.\n' "$rodada"
    exit 0
  fi

  prompt="$(printf '%s' "$decisao" | node -e 'let e="";process.stdin.on("data",d=>e+=d).on("end",()=>process.stdout.write(JSON.parse(e).prompt??""))')"

  if [ "$seco" -eq 1 ]; then
    printf '\nmotor: --dry-run, nada foi invocado.\n'
    exit 0
  fi

  [ -f "$prompt" ] || {
    printf 'motor: %s não existe.\n' "$prompt" >&2
    exit 2
  }

  claude -p "$(cat "$prompt")" --dangerously-skip-permissions || {
    printf '\nmotor: a sessão da rodada %s saiu com erro.\n' "$rodada" >&2
    exit 2
  }

  gh stack submit --auto || printf 'motor: gh stack submit falhou; os commits continuam locais.\n' >&2
done

printf '\nmotor: %s rodada(s) concluída(s).\n' "$rodada"
