#!/usr/bin/env bash
# Prova que toda chave de .harness/tool-matrix.json nomeia um agent que existe,
# e que todo agent do projeto tem chave.
#
# Os dois guards do harness resolvem a política por igualdade exata da chave e
# liberam quando não acham nada: `if not policy: return allow`. Uma chave que
# não casa com nome nenhum não reprova — ela desliga a fronteira daquele agent
# em silêncio, escrita e escada de ferramentas juntas. Foi o que aconteceu com
# os nove agents do plugin, cujo nome real chega prefixado com `harness:`
# enquanto a matriz os listava nus.
#
# Os agents do plugin moram fora do repositório e num caminho com versão, então
# o CI não os enumera. A matriz declara a origem de cada chave desde a versão
# 0.6.1 do harness — `nucleo` para os que vivem no plugin, `pack` para os que
# são copiados para .claude/agents. A simetria que dá para afirmar aqui é a dos
# de pack: chave `pack` exige arquivo, e arquivo exige chave.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
matriz="$raiz/.harness/tool-matrix.json"
agents="$raiz/.claude/agents"
falhas=0

if [ ! -f "$matriz" ]; then
  printf '  FALHA %s não existe — a fronteira de agent não tem política.\n' "$matriz" >&2
  exit 1
fi

if [ ! -d "$agents" ]; then
  printf '  FALHA %s não existe — nada a comparar com a matriz.\n' "$agents" >&2
  exit 1
fi

chaves="$(python3 -c "
import json, sys
with open('$matriz', encoding='utf-8') as f:
    agents = json.load(f).get('agents') or {}
# Sem o campo, a matriz é anterior à 0.6.1: trata tudo como de pack, que é o
# comportamento antigo, em vez de deixar de cobrar o que dá para cobrar.
print('\n'.join(n for n, p in agents.items() if (p or {}).get('origem', 'pack') != 'nucleo'))
")" || {
  printf '  FALHA %s não é JSON legível.\n' "$matriz" >&2
  exit 1
}

if [ -z "$chaves" ]; then
  printf '  FALHA a matriz não declara agent nenhum.\n' >&2
  exit 1
fi

while IFS= read -r chave; do
  case "$chave" in
    harness:*) continue ;;
  esac
  if [ -f "$agents/$chave.md" ]; then
    printf '  ok    chave `%s` tem agent em .claude/agents\n' "$chave"
  else
    printf '  FALHA chave `%s` não nomeia agent nenhum — a política dela nunca é aplicada\n' "$chave"
    falhas=$((falhas + 1))
  fi
done <<< "$chaves"

for arquivo in "$agents"/*.md; do
  [ -e "$arquivo" ] || continue
  nome="$(basename "$arquivo" .md)"
  if grep -qx "$nome" <<< "$chaves"; then
    printf '  ok    agent `%s` tem chave na matriz\n' "$nome"
  else
    printf '  FALHA agent `%s` não tem chave na matriz — ele escreve onde quiser\n' "$nome"
    falhas=$((falhas + 1))
  fi
done

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ fronteira de agent: toda chave nomeia um agent, todo agent tem chave.\n'
else
  printf '\n✗ %s incoerência(s) entre a matriz e os agents.\n' "$falhas" >&2
  exit 1
fi
