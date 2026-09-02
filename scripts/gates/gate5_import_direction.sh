#!/usr/bin/env bash
#
# G5 — fluxo de import unidirecional: shared → features → app.
#
# Duas violações, e as duas quebram a mesma coisa: a possibilidade de mover uma
# feature sem arrastar o resto do aplicativo junto.
#
#   1. `shared/` importando de `features/` ou `app/` — o compartilhado passa a
#      depender do específico, e deixa de ser compartilhável.
#   2. uma feature importando o interior de outra feature — a fronteira que
#      existia some, e as duas viram uma só sem ninguém ter decidido isso.
#      Feature acessa feature apenas pelo barril público (`features/x`), nunca
#      por caminho interno (`features/x/api/algo`).
#
# Recebe a lista de arquivos por stdin. Imprime arquivo:linha:trecho.

set -uo pipefail

while IFS= read -r file || [ -n "$file" ]; do
  [ -f "$file" ] || continue

  case "$file" in
    */shared/*|*/lib/*)
      grep -nE "from ['\"][^'\"]*(features|app)/" "$file" 2>/dev/null |
        while IFS=: read -r line content; do
          case "$content" in *"// gate5-ok"*) continue ;; esac
          printf '%s:%s:%s (shared não depende de features nem de app)\n' \
            "$file" "$line" "$(printf '%s' "$content" | sed 's/^[[:space:]]*//')"
        done
      ;;
  esac

  feature_atual="$(printf '%s' "$file" | sed -nE 's#.*/features/([^/]+)/.*#\1#p')"
  [ -z "$feature_atual" ] && continue
  grep -nE "from ['\"][^'\"]*features/[^'\"]+/[^'\"]+" "$file" 2>/dev/null |
    while IFS=: read -r line content; do
      case "$content" in *"// gate5-ok"*) continue ;; esac
      alvo="$(printf '%s' "$content" | sed -nE "s#.*features/([^/'\"]+)/.*#\1#p")"
      [ -z "$alvo" ] && continue
      [ "$alvo" = "$feature_atual" ] && continue
      printf '%s:%s:%s (importe o barril `features/%s`, não o interior dela)\n' \
        "$file" "$line" "$(printf '%s' "$content" | sed 's/^[[:space:]]*//')" "$alvo"
    done
done

exit 0
