#!/bin/sh
# Sem `API_UPSTREAM` o proxy de `/api` e `/collab` não tem destino: a subida
# falha aqui, antes do nginx, com a variável nomeada.
set -eu

if [ -z "${API_UPSTREAM:-}" ]; then
  echo "API_UPSTREAM é obrigatória." >&2
  exit 1
fi
