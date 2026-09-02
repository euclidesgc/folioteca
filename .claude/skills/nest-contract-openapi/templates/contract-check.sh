#!/usr/bin/env bash
#
# O documento commitado precisa ser exatamente o que o código gera, e a mudança
# em relação à base precisa ser aditiva. Roda no CI e no contract-guardian.

set -euo pipefail

BASE="${1:-openapi/base.json}"
CURRENT="openapi/openapi.json"

pnpm openapi:generate

if ! git diff --exit-code -- "$CURRENT"; then
  echo "contrato: openapi.json commitado difere do gerado pelo código" >&2
  exit 1
fi

if [ -f "$BASE" ]; then
  oasdiff breaking "$BASE" "$CURRENT" --fail-on ERR
fi

pnpm openapi:clients

if ! git diff --exit-code -- packages/api-client; then
  echo "contrato: cliente gerado difere do commitado — regenere no mesmo PR" >&2
  exit 1
fi

echo "contrato: documento e clientes coerentes, nenhuma quebra detectada"
