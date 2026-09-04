#!/usr/bin/env bash
# Derruba os processos gravados pelo service-up.sh. Aceita mais de um pid, e
# arquivo ausente é caso normal — o serviço já não estava de pé.
set -euo pipefail

for pid_file in "$@"; do
  [[ -f "$pid_file" ]] || continue

  service_pid="$(tr -cd '0-9' < "$pid_file")"

  if [[ -n "$service_pid" ]] && kill -0 "$service_pid" 2>/dev/null; then
    kill -TERM "-$service_pid" 2>/dev/null || kill -TERM "$service_pid" 2>/dev/null || true

    for _ in {1..20}; do
      kill -0 "$service_pid" 2>/dev/null || break
      sleep 0.1
    done

    if kill -0 "$service_pid" 2>/dev/null; then
      kill -KILL "-$service_pid" 2>/dev/null || kill -KILL "$service_pid" 2>/dev/null || true
    fi
  fi

  rm -f "$pid_file"
done
