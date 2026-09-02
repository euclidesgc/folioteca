#!/usr/bin/env bash
#
# G7 — o controller não fala com o banco.
#
# Controller traduz HTTP; serviço decide; repositório persiste. Quando o
# controller injeta o cliente de banco direto, a regra de negócio passa a morar
# na camada que também cuida de código de status e cabeçalho — e ela deixa de
# ser testável sem levantar o servidor inteiro.
#
# Recebe a lista de arquivos por stdin. Imprime arquivo:linha:trecho.

set -uo pipefail

while IFS= read -r file || [ -n "$file" ]; do
  [ -f "$file" ] || continue
  case "$file" in *.controller.ts) ;; *) continue ;; esac

  grep -nE '(PrismaService|PrismaClient|DataSource|EntityManager|getRepository|createQueryBuilder|\bknex\b)' "$file" 2>/dev/null |
    while IFS=: read -r line content; do
      case "$content" in *"// gate7-ok"*) continue ;; esac
      printf '%s:%s:%s (controller não acessa persistência; passe pelo serviço)\n' \
        "$file" "$line" "$(printf '%s' "$content" | sed 's/^[[:space:]]*//')"
    done
done

exit 0
