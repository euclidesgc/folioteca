#!/usr/bin/env bash
#
# O plano do item ativo é medido pelo portão local, e não pela boa vontade.
#
# A CAUSA RAIZ QUE ISTO EXISTE PARA MATAR
#
# Duas sessões seguidas do item 050 leram o plano, encontraram defeitos reais,
# escreveram a decisão em `decisoes-autonomas.md` — e terminaram sem aplicar uma
# linha. A terceira abriu o arquivo, achou dez decisões registradas e uma
# aplicada, e o `criteria_lint` ainda com sete erros. Decisão registrada e não
# aplicada é pior que decisão nenhuma: ela faz a sessão seguinte ler a tabela,
# acreditar que o problema está fechado, e aprovar em cima do defeito.
#
# O buraco não era de disciplina, era de medição. `gates_runner.sh` mede código,
# fluxos, segredo e ações; nada nele abria o plano. O oráculo dos critérios
# existe desde sempre no plugin, e só rodava quando alguém lembrava — que é
# exatamente a condição em que "alguém lembra" falha duas vezes seguidas.
#
# A partir daqui o plano do item ativo entra no portão local: enquanto ele
# reprovar, o PR fica em rascunho e a sessão não dá o estágio por pronto.
#
# Reprova quando não conseguiu medir: sem python3, sem o oráculo do plugin, ou
# com o item em `plan` e nenhum `03-plan.md` na pasta. Ausência de plano só é
# legítima antes do estágio `plan`, e é a única passagem silenciosa daqui.
set -uo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/medir.sh"

RAIZ="$(medir_raiz)"
ESTADO="$RAIZ/product/state.json"

exige_comando python3
exige_caminho "product/state.json" "o estado do harness, de onde sai o item ativo"

leitura="$(python3 - "$ESTADO" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as f:
    estado = json.load(f)
ativo = estado.get("active_item") or ""
item = (estado.get("items") or {}).get(ativo) or {}
print(ativo)
print(item.get("stage") or "")
PY
)" || _reprova "product/state.json não é JSON legível — sem ele não há item ativo para medir"

ATIVO="$(printf '%s' "$leitura" | sed -n 1p)"
ESTAGIO="$(printf '%s' "$leitura" | sed -n 2p)"

if [ -z "$ATIVO" ]; then
  echo "medido: nenhum item ativo no estado — não há plano a medir."
  exit 0
fi

PLANO="product/items/$ATIVO/03-plan.md"
printf 'medido: item ativo %s, estágio %s\n' "$ATIVO" "${ESTAGIO:-sem estágio}"

if [ ! -f "$RAIZ/$PLANO" ]; then
  case "$ESTAGIO" in
    plan | execute | done)
      _reprova "$PLANO não existe, e o item está em '$ESTAGIO' — deste estágio em diante o plano é o que os critérios medem"
      ;;
    *)
      echo "medido: $ATIVO está em '${ESTAGIO:-sem estágio}' e ainda não tem plano — nada a medir."
      exit 0
      ;;
  esac
fi

# O oráculo mora no plugin, pela mesma razão que o `state.py`: ele é do harness
# e vale para todo projeto que o instale. A busca segue a do
# `scripts/harness/state.sh`.
plugin="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$plugin" ] && [ -f "$RAIZ/.harness/runtime/plugin-root.json" ]; then
  plugin="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("plugin_root") or "")' \
    "$RAIZ/.harness/runtime/plugin-root.json" 2>/dev/null)"
fi
LINT=""
[ -n "$plugin" ] && LINT="$plugin/scripts/lints/criteria_lint.py"

# O runner remoto não tem o plugin, e nunca terá: ele é um repositório à parte
# da máquina de quem escreve, e `.harness/runtime/` está no `.gitignore`. Esta é
# a única passagem por ausência do oráculo, e ela é explícita porque a
# alternativa seria pior das duas maneiras — reprovar todo PR no CI por um
# arquivo que não cabe lá, ou calar a ausência também na máquina onde o plugin
# existe, que é justamente onde o plano é escrito e onde este portão morde.
if [ -z "$LINT" ] || [ ! -f "$LINT" ]; then
  if [ -n "${CI:-}" ]; then
    echo "medido: o oráculo de critérios não vive no runner remoto — o plano de $ATIVO é medido no portão local, e é lá que ele reprova."
    exit 0
  fi
  _reprova "o oráculo de critérios não está alcançável (CLAUDE_PLUGIN_ROOT vazio ou sem scripts/lints/criteria_lint.py) — na máquina de quem escreve o plano, isto é o portão sem instrumento"
fi

saida="$(cd "$RAIZ" && python3 "$LINT" "$PLANO" 2>&1)"
codigo=$?
printf '%s\n' "$saida"

erros="$(printf '%s\n' "$saida" | grep -c '^  ERRO ' || true)"
avisos="$(printf '%s\n' "$saida" | grep -c '^  aviso ' || true)"
printf 'medido: %s erro(s) e %s aviso(s) em %s\n' "$erros" "$avisos" "$PLANO"

if [ "$codigo" -ne 0 ]; then
  printf '::error::o plano de %s reprova o oráculo de critérios\n' "$ATIVO" >&2
  echo "" >&2
  echo "Enquanto isto estiver vermelho, o estágio não está pronto e o PR fica em" >&2
  echo "rascunho. Corrija o critério — ou, se o achado for falso positivo do" >&2
  echo "oráculo, a prosa que o dispara —, e registre a decisão em" >&2
  echo "product/items/$ATIVO/decisoes-autonomas.md." >&2
  exit 1
fi

echo "✓ plano: os critérios de $ATIVO têm forma válida."
