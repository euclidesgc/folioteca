#!/usr/bin/env bash
#
# G3 — comentário só para o porquê que o código não mostra.
#
# O que este gate persegue é o comentário que repete a linha seguinte, o
# cabeçalho decorativo de seção e a nota de histórico ("antes era X",
# "adicionado na fase 12") — para isso existe o git. Legibilidade se conquista
# extraindo função ou variável com nome descritivo, não com prosa ao lado.
#
# Um comentário que começa por uma marca de justificativa passa: `por quê:`,
# `motivo:`, `decisão:`, `contorno:`, `invariante:`, `limitação:`. A marca é o
# custo de dizer que aquilo é uma razão, e não uma descrição.
#
# Recebe a lista de arquivos por stdin. Imprime arquivo:linha:trecho.

set -uo pipefail

JUSTIFICATIVA='(por ?qu[êe]|motivo|decis[ãa]o|contorno|workaround|invariante|limita[çc][ãa]o|restri[çc][ãa]o|ignore:|gate[0-9]-ok|coverage:ignore)'
DIRETIVA='(ignore_for_file|dart format|coverage:|@|https?:|eslint-|prettier-|ts-ignore|ts-expect-error|#!|#region|#endregion)'

while IFS= read -r file || [ -n "$file" ]; do
  [ -f "$file" ] || continue
  grep -nE '^[[:space:]]*(//|///|#[^!])' "$file" 2>/dev/null |
    while IFS=: read -r line content; do
      trecho="$(printf '%s' "$content" | sed 's/^[[:space:]]*//')"
      case "$content" in *"gate3-ok"*) continue ;; esac
      printf '%s' "$trecho" | grep -qiE "$JUSTIFICATIVA" && continue
      printf '%s' "$trecho" | grep -qE "$DIRETIVA" && continue
      # Licença e cabeçalho de copyright no topo do arquivo não são mecânica.
      [ "$line" -le 3 ] && printf '%s' "$trecho" | grep -qiE '(copyright|license|licen[çc]a)' && continue
      printf '%s:%s:%s\n' "$file" "$line" "$trecho"
    done
done

exit 0
