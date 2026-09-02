#!/usr/bin/env bash
# Recusa mergear um PR que tenha bloqueio pendente ou verificação vermelha.
#
#   merge-se-liberado.sh <numero-do-pr> [--squash|--merge|--rebase]
#
# gate3-ok: o parágrafo abaixo é o porquê de o script existir, não a mecânica.
#
# POR QUE ELE EXISTE
# O rótulo `blocked-on-*` deveria ser tranca, e o workflow `bloqueio.yml` o faz
# reprovar. Mas verificação obrigatória exige GitHub Pro em repositório
# privado, e sem isso o botão de merge continua clicável com a verificação
# vermelha. A tranca então mora aqui: no ator que mergeia. Vale para quem roda
# à mão e para o motor autônomo, que é quem mergeia de madrugada.
#
# O que ele NUNCA faz: mergear com bloqueio, mergear com check vermelho, e
# empurrar com --force.
set -uo pipefail

pr="${1:-}"
metodo="${2:---squash}"
[ -n "$pr" ] || { printf 'uso: merge-se-liberado.sh <numero-do-pr> [--squash|--merge|--rebase]\n' >&2; exit 2; }

command -v gh >/dev/null 2>&1 || { printf 'gh não encontrado.\n' >&2; exit 2; }

rotulos="$(gh pr view "$pr" --json labels --jq '.labels[].name' 2>/dev/null)"
bloqueios="$(printf '%s\n' "$rotulos" | grep '^blocked-on-' || true)"
if [ -n "$bloqueios" ]; then
  printf 'RECUSADO: o PR #%s está travado por: %s\n' "$pr" "$(printf '%s' "$bloqueios" | tr '\n' ' ')" >&2
  printf 'A trava sai quando o problema for resolvido, nunca quando alguém tirar o rótulo.\n' >&2
  exit 1
fi

vermelhos="$(gh pr checks "$pr" 2>/dev/null | awk -F'\t' '$2=="fail"{print $1}')"
if [ -n "$vermelhos" ]; then
  printf 'RECUSADO: o PR #%s tem verificação vermelha:\n' "$pr" >&2
  printf '%s\n' "$vermelhos" | sed 's/^/  /' >&2
  exit 1
fi

estado="$(gh pr view "$pr" --json mergeStateStatus --jq .mergeStateStatus 2>/dev/null)"
case "$estado" in
  CLEAN|UNSTABLE|HAS_HOOKS) ;;
  *) printf 'RECUSADO: o PR #%s está em estado %s.\n' "$pr" "$estado" >&2; exit 1 ;;
esac

printf 'PR #%s liberado: sem bloqueio, sem check vermelho, estado %s.\n' "$pr" "$estado"

# PR que pertence a uma pilha não mergeia por `gh pr merge`: o GitHub exige a
# via assíncrona e recusa o caminho normal. `gh stack merge` é atômico — tudo
# até o PR escolhido entra junto, ou nada entra —, e é por isso que a checagem
# acima precisa valer para toda a pilha abaixo, não só para este PR.
if gh stack view >/dev/null 2>&1; then
  for abaixo in $(gh pr list --state open --json number --jq '.[].number' | sort -n); do
    [ "$abaixo" -le "$pr" ] || continue
    r="$(gh pr view "$abaixo" --json labels --jq '.labels[].name' 2>/dev/null | grep '^blocked-on-' || true)"
    [ -z "$r" ] || { printf 'RECUSADO: o PR #%s, abaixo na pilha, está travado por %s.\n' "$abaixo" "$r" >&2; exit 1; }
    v="$(gh pr checks "$abaixo" 2>/dev/null | awk -F'\t' '$2=="fail"{print $1}')"
    [ -z "$v" ] || { printf 'RECUSADO: o PR #%s, abaixo na pilha, tem check vermelho.\n' "$abaixo" >&2; exit 1; }
  done
  printf 'A pilha inteira até o #%s está limpa. Merge atômico.\n' "$pr"
  gh stack merge "$pr" --yes --merge-method "${metodo#--}"
else
  gh pr merge "$pr" "$metodo"
fi
