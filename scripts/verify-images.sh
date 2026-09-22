#!/usr/bin/env bash
# Prova local das imagens da API e da web: builda as duas, sobe a API contra
# um banco descartável no Postgres do `docker compose`, sobe a web na frente
# dela e confere o que o Coolify vai precisar. Não faz parte do `pnpm test`.
#
# Uso: bash scripts/verify-images.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMMIT="local-test"
DATABASE_NAME="folioteca_image_check"
API_IMAGE="folioteca-api:image-check"
WEB_IMAGE="folioteca-web:image-check"
SUFFIX="$$"
API_CONTAINER="folioteca-image-check-api-$SUFFIX"
WEB_CONTAINER="folioteca-image-check-web-$SUFFIX"
WEB_NO_UPSTREAM_CONTAINER="folioteca-image-check-web-no-upstream-$SUFFIX"

fail() {
  echo "FALHA: $*" >&2
  exit 1
}

psql_admin() {
  docker compose exec -T postgres psql -U folioteca -d folioteca -v ON_ERROR_STOP=1 -q -c "$1"
}

cleanup() {
  docker rm -f "$API_CONTAINER" "$WEB_CONTAINER" "$WEB_NO_UPSTREAM_CONTAINER" >/dev/null 2>&1 || true
  psql_admin "DROP DATABASE IF EXISTS $DATABASE_NAME WITH (FORCE);" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_healthy() {
  local container="$1"
  local status=""
  for _ in $(seq 1 60); do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "missing")"
    if [ "$status" = "healthy" ]; then
      return 0
    fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$container" 2>/dev/null)" != "true" ]; then
      docker logs "$container" >&2 || true
      fail "o contêiner $container parou antes de ficar saudável."
    fi
    sleep 2
  done
  docker logs "$container" >&2 || true
  fail "o contêiner $container não ficou saudável (último estado: $status)."
}

host_port() {
  docker port "$1" "$2" | head -n 1 | sed 's/.*://'
}

echo "==> Build da imagem da API"
docker build -f apps/api/Dockerfile --build-arg SOURCE_COMMIT="$COMMIT" -t "$API_IMAGE" .

echo "==> Build da imagem da web"
docker build -f apps/web/Dockerfile --build-arg SOURCE_COMMIT="$COMMIT" -t "$WEB_IMAGE" .

echo "==> Postgres do docker compose e banco descartável"
docker compose up -d --wait postgres
POSTGRES_CONTAINER="$(docker compose ps -q postgres)"
POSTGRES_HOST="$(docker inspect --format '{{.Name}}' "$POSTGRES_CONTAINER" | sed 's#^/##')"
NETWORK="$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' "$POSTGRES_CONTAINER" | head -n 1)"
psql_admin "DROP DATABASE IF EXISTS $DATABASE_NAME WITH (FORCE);"
psql_admin "CREATE DATABASE $DATABASE_NAME;"

echo "==> API"
docker run -d --name "$API_CONTAINER" --network "$NETWORK" -p 127.0.0.1::3000 \
  -e DATABASE_URL="postgresql://folioteca@$POSTGRES_HOST:5432/$DATABASE_NAME" \
  "$API_IMAGE" >/dev/null
wait_healthy "$API_CONTAINER"
API_PORT="$(host_port "$API_CONTAINER" 3000)"

API_HEALTH="$(curl -fsS "http://127.0.0.1:$API_PORT/api/health")"
echo "$API_HEALTH" | grep -q "\"commit\":\"$COMMIT\"" \
  || fail "/api/health não devolveu commit $COMMIT: $API_HEALTH"

echo "==> Web com API_UPSTREAM"
docker run -d --name "$WEB_CONTAINER" --network "$NETWORK" -p 127.0.0.1::8080 \
  -e API_UPSTREAM="http://$API_CONTAINER:3000" \
  "$WEB_IMAGE" >/dev/null
wait_healthy "$WEB_CONTAINER"
WEB_PORT="$(host_port "$WEB_CONTAINER" 8080)"
WEB_URL="http://127.0.0.1:$WEB_PORT"

curl -fsS "$WEB_URL/" | grep -q '<div id="root">' \
  || fail "/ não devolveu o index.html."
curl -fsS "$WEB_URL/qualquer/rota" | grep -q '<div id="root">' \
  || fail "a rota profunda não devolveu o index.html."
WEB_HEALTH="$(curl -fsS "$WEB_URL/api/health")"
echo "$WEB_HEALTH" | grep -q '"status":"ok"' \
  || fail "/api/health via web não devolveu status: $WEB_HEALTH"

echo "==> Web sem API_UPSTREAM"
set +e
NO_UPSTREAM_OUTPUT="$(docker run --name "$WEB_NO_UPSTREAM_CONTAINER" "$WEB_IMAGE" 2>&1)"
NO_UPSTREAM_STATUS=$?
set -e
[ "$NO_UPSTREAM_STATUS" -ne 0 ] \
  || fail "a web subiu sem API_UPSTREAM."
echo "$NO_UPSTREAM_OUTPUT" | grep -q "API_UPSTREAM" \
  || fail "a falha sem API_UPSTREAM não nomeou a variável: $NO_UPSTREAM_OUTPUT"

echo "OK: imagens verificadas"
