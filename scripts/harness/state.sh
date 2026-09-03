#!/usr/bin/env bash
# Porta única de chamada ao `state.py` do plugin. Nunca chame o
# `python3 "$CLAUDE_PLUGIN_ROOT/scripts/state/state.py"` cru.
#
# A CAUSA RAIZ QUE ISTO EXISTE PARA MATAR
#
# O `state.py` resolve o `product/state.json` a partir do diretório corrente
# quando não recebe `--root`. O diretório corrente de uma sessão sobrevive entre
# chamadas, e os critérios de aceite deste projeto mandam medir dentro de um
# clone temporário — então basta um `cd` para que toda gravação seguinte caia no
# state.json errado, com saída de sucesso. Aconteceu duas vezes na fase 4 do
# item 001: um `git hash-object` de caminho relativo leu o arquivo do clone e
# concluiu que um agent não havia escrito o que escreveu, e um
# `state.py diverge --id D-014` gravou a divergência no clone, onde ninguém a
# leria.
#
# É a mesma forma que `scripts/gates/medir.sh` existe para matar nos portões: o
# comando respondeu como se tivesse medido, e mediu outra coisa. Este wrapper
# leva a mesma âncora ao estado.
set -uo pipefail

# Código 2, e não 1: o `state.py` já usa 1 para "transição recusada", e o
# orquestrador precisa distinguir estado que recusou de estado que nem rodou.
_recusa() {
  printf 'state: recusado — %s\n' "$1" >&2
  exit 2
}

# A âncora é o diretório deste script, nunca o corrente: é o corrente que muda
# debaixo de você, e um clone temporário também responde a `git rev-parse`.
aqui="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
[ -n "$aqui" ] || _recusa "não consegui resolver o diretório do próprio script"

raiz="$(git -C "$aqui" rev-parse --show-toplevel 2>/dev/null)"
[ -n "$raiz" ] || _recusa "$aqui não está dentro de um repositório git — sem raiz não há state.json para ancorar"

plugin="${CLAUDE_PLUGIN_ROOT:-}"
reserva="$raiz/.harness/runtime/plugin-root.json"
if [ -z "$plugin" ]; then
  [ -f "$reserva" ] || _recusa "CLAUDE_PLUGIN_ROOT não está definido e $reserva não existe — sem um dos dois não há como achar o state.py"
  plugin="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("plugin_root") or "")' "$reserva" 2>/dev/null)"
  [ -n "$plugin" ] || _recusa "$reserva não traz a chave plugin_root"
fi

estado="$plugin/scripts/state/state.py"
[ -f "$estado" ] || _recusa "state.py não está em $estado"

# Quem mede diz o que mediu: sem esta linha a raiz errada só aparece depois de
# o estado já ter sido gravado nela.
printf 'state: ancorado em %s\n' "$raiz" >&2

exec python3 "$estado" --root "$raiz" "$@"
