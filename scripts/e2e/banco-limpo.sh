#!/usr/bin/env bash
#
# Recria o banco de dados da suíte comportamental antes de cada execução: a
# etapa de setup do Playwright cria pessoa e documento de verdade pela API, e
# sem recriar o banco cada execução acumula conta sobre conta da anterior.
#
# contorno: só age quando `CI=true` ou quando o nome do banco termina em
# `_e2e` — o mesmo Postgres do compose local também guarda o banco de
# desenvolvimento (`folioteca`), e um script que derruba banco por engano não
# tem desfazer. Fora desses dois casos ele falha alto, em vez de seguir calado
# contra o banco errado.
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://folioteca:senha@localhost:5433/folioteca_e2e}"

NOME_DO_BANCO="${DATABASE_URL##*/}"
NOME_DO_BANCO="${NOME_DO_BANCO%%\?*}"

if [ "${CI:-}" != "true" ] && [[ "$NOME_DO_BANCO" != *_e2e ]]; then
  echo "recusado: '$NOME_DO_BANCO' não termina em _e2e e CI não está definido — não recrio banco fora deste padrão." >&2
  exit 1
fi

ENDERECO_DE_MANUTENCAO="${DATABASE_URL%/*}/postgres"

echo "recriando $NOME_DO_BANCO…"
psql "$ENDERECO_DE_MANUTENCAO" -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$NOME_DO_BANCO\";" \
  -c "CREATE DATABASE \"$NOME_DO_BANCO\";"
# motivo: o banco de desenvolvimento ganha esta extensão no init do contêiner
# (`docker/postgres/init/01-vector.sql`), que só roda na primeira subida; um
# banco criado depois, na mesma instância, não a herda.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"

DATABASE_URL="$DATABASE_URL" pnpm --filter api run db:migrate

echo "banco $NOME_DO_BANCO recriado e migrado."
