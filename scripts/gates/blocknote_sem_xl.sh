#!/usr/bin/env bash
# Portão da decisão 3 (`docs/refactor/00-fundamentos/decisoes.md`): nenhum
# pacote `@blocknote/xl-*` entra no lockfile. Esses oito pacotes são
# "GPL-3.0 OR PROPRIETARY" — a conta de um deles num produto fechado é a
# licença comercial do fabricante, não um `pnpm add` de alguém apressado.
#
# POR QUE O LOCKFILE, E NÃO O `package.json` DE CADA PACOTE
#
# `package.json` declara o que foi pedido; `pnpm-lock.yaml` declara o que foi
# de fato resolvido — inclusive dependência transitiva, que nenhum
# `package.json` do repositório lista. Um `@blocknote/xl-*` podia entrar sem
# ninguém escrever o nome dele em lugar nenhum, só porque um pacote MPL
# passou a depender de um `xl-*` numa versão nova. O portão mede a árvore
# resolvida, não a intenção declarada.
set -uo pipefail

_raiz="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=medir.sh
source "$_raiz/scripts/gates/medir.sh"

exige_caminho pnpm-lock.yaml "a árvore de dependências resolvida"

LOCKFILE="$(medir_raiz)/pnpm-lock.yaml"

OCORRENCIAS="$(grep -n '@blocknote/xl-' "$LOCKFILE" || true)"
QUANTIDADE="$(printf '%s\n' "$OCORRENCIAS" | grep -c . || true)"
[ -z "$OCORRENCIAS" ] && QUANTIDADE=0

echo "medido: $QUANTIDADE ocorrência(s) de '@blocknote/xl-' em pnpm-lock.yaml"

if [ "$QUANTIDADE" -gt 0 ]; then
  printf '::error::@blocknote/xl-* entrou no lockfile — são "GPL-3.0 OR PROPRIETARY", incompatíveis com produto fechado (decisão 3). Remova a dependência que arrastou e confira se não há caminho sem ela.\n' >&2
  printf '%s\n' "$OCORRENCIAS" >&2
  exit 1
fi

echo "✓ blocknote_sem_xl: nenhum @blocknote/xl-* em pnpm-lock.yaml."
