#!/usr/bin/env bash
# Sobe um processo de desenvolvimento em grupo próprio e grava o pid, para o
# postDebugTask conseguir derrubar a árvore inteira: `nest start --watch` e o
# Vite criam filhos que sobrevivem a um kill no processo pai.
set -euo pipefail

pid_file="${1:?uso: service-up.sh <arquivo-de-pid> <diretório> <comando...>}"
service_dir="${2:?uso: service-up.sh <arquivo-de-pid> <diretório> <comando...>}"
shift 2

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# motivo: a janela do VS Code herda o PATH de quem a abriu, e nem sempre isso
# passou pelo shell de login que carrega o nvm e o pnpm — sem isto a task morre
# em "command not found" longe da causa.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  cd "$repo_root"
  nvm use >/dev/null 2>&1 || nvm install >/dev/null 2>&1 || true
fi

pnpm_home="${PNPM_HOME:-$HOME/.local/share/pnpm}"
case ":$PATH:" in
  *":$pnpm_home:"*) ;;
  *) export PATH="$pnpm_home:$PATH" ;;
esac

cd "$repo_root/$service_dir"
rm -f "$pid_file"

stop_service() {
  if [[ -n "${service_pid:-}" ]] && kill -0 "$service_pid" 2>/dev/null; then
    kill -TERM "-$service_pid" 2>/dev/null || kill -TERM "$service_pid" 2>/dev/null || true
    wait "$service_pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

stop_service_and_exit() {
  trap - EXIT INT TERM
  stop_service
  exit 0
}

trap stop_service EXIT
trap stop_service_and_exit INT TERM

if command -v setsid >/dev/null 2>&1; then
  setsid "$@" &
else
  "$@" &
fi

service_pid="$!"
echo "$service_pid" > "$pid_file"
wait "$service_pid" || exit_code="$?"
rm -f "$pid_file"

# motivo: 130 e 143 são o encerramento pedido pelo próprio VS Code ao terminar a
# sessão de depuração, e task vermelha aí acusa falha onde não houve nenhuma.
if [[ "${exit_code:-0}" == "130" || "${exit_code:-0}" == "143" ]]; then
  exit 0
fi

exit "${exit_code:-0}"
