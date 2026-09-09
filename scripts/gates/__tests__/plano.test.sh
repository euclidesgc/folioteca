#!/usr/bin/env bash
# Prova que o portão do plano MORDE, e morde nas três formas que o deixariam
# aprovar sem ter medido.
#
# O caso que importa é o segundo: um plano com critério que cobra artefato de
# fase posterior é exatamente o defeito que atravessou duas sessões do item 050
# sem ninguém ver, porque nenhum portão abria o arquivo. Se este caso sumir, o
# silêncio volta.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
alvo="$raiz/scripts/gates/plano.sh"
falhas=0

caso() { # caso <nome> <esperado 0|1> <corpo>
  local nome="$1" esperado="$2" corpo="$3" obtido
  ( eval "$corpo" ) >/dev/null 2>&1
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

contem() { # contem <nome> <trecho> <corpo>
  local nome="$1" trecho="$2" corpo="$3" saida
  saida="$( ( eval "$corpo" ) 2>&1 )"
  if printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — a saída não contém "%s"\n' "$nome" "$trecho"
    falhas=$((falhas + 1))
  fi
}

# O oráculo de verdade, quando alcançável: sem ele os casos de conteúdo não
# medem o que dizem medir, e o teste avisa em vez de fingir que passou.
oraculo=""
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "$CLAUDE_PLUGIN_ROOT/scripts/lints/criteria_lint.py" ]; then
  oraculo="$CLAUDE_PLUGIN_ROOT"
elif [ -f "$raiz/.harness/runtime/plugin-root.json" ]; then
  candidato="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1], encoding="utf-8")).get("plugin_root") or "")' \
    "$raiz/.harness/runtime/plugin-root.json" 2>/dev/null)"
  [ -n "$candidato" ] && [ -f "$candidato/scripts/lints/criteria_lint.py" ] && oraculo="$candidato"
fi

# Um repositório de mentira por caso, para o portão medir estado e plano sem
# tocar os deste repositório.
monta() { # monta <estágio> <corpo do plano ou vazio>
  local estagio="$1" plano="${2-}" dir
  dir="$(mktemp -d)"
  mkdir -p "$dir/product/items/099-item-de-teste"
  cat > "$dir/product/state.json" <<JSON
{"schema": 1, "active_item": "099-item-de-teste",
 "items": {"099-item-de-teste": {"stage": "$estagio"}}}
JSON
  [ -n "$plano" ] && printf '%s\n' "$plano" > "$dir/product/items/099-item-de-teste/03-plan.md"
  printf '%s' "$dir"
}

PLANO_BOM='# Plano — 099

## Fase 1 — A base

**Critérios de aceite:**

- [ ] `comando` — `RF-01` — o pacote existe. Executados na raiz do repositório:
      `grep -c "" leia-me.md` imprime um número **maior que** `0`.

**Etapas:**

- [ ] 1.1 Criar `leia-me.md` com a primeira linha.
      *Considerando: nada antes.*
      Justificativa: `RF-01`.
'

# O defeito real: o critério da fase 1 cobra o que a fase 2 é quem cria.
PLANO_COSTURADO='# Plano — 099

## Fase 1 — A base

**Critérios de aceite:**

- [ ] `comando` — `RF-01` — o arquivo `segundo-arquivo.md` existe. Executado na
      raiz do repositório: `wc -l` sobre ele imprime um número **maior que**
      `0`.

**Etapas:**

- [ ] 1.1 Criar `leia-me.md` com a primeira linha.
      *Considerando: nada antes.*
      Justificativa: `RF-01`.

## Fase 2 — O resto

**Critérios de aceite:**

- [ ] `comando` — `RF-02` — o pacote existe. Executados na raiz do repositório:
      `grep -c "" leia-me.md` imprime um número **maior que** `0`.

**Etapas:**

- [ ] 2.1 Criar `segundo-arquivo.md` com a segunda linha.
      *Considerando 1.1: o primeiro já existe.*
      Justificativa: `RF-02`.
'

if [ -n "$oraculo" ]; then
  bom="$(monta plan "$PLANO_BOM")"
  costurado="$(monta plan "$PLANO_COSTURADO")"
  caso "plano de forma válida passa" 0 \
    "export GITHUB_WORKSPACE='$bom' CLAUDE_PLUGIN_ROOT='$oraculo'; bash '$alvo'"
  caso "critério que cobra artefato de fase posterior REPROVA" 1 \
    "export GITHUB_WORKSPACE='$costurado' CLAUDE_PLUGIN_ROOT='$oraculo'; bash '$alvo'"
  contem "a reprovação nomeia o item" "reprova o oráculo de critérios" \
    "export GITHUB_WORKSPACE='$costurado' CLAUDE_PLUGIN_ROOT='$oraculo'; bash '$alvo'"
  contem "o portão imprime o que mediu" "medido: 1 erro(s)" \
    "export GITHUB_WORKSPACE='$costurado' CLAUDE_PLUGIN_ROOT='$oraculo'; bash '$alvo'"
  rm -rf "$bom" "$costurado"
else
  printf '  AVISO os casos de conteúdo não rodaram: o oráculo do harness não está alcançável nesta máquina\n'
fi

sem_plano="$(monta plan "")"
antes_do_plano="$(monta discovery "")"
com_plano="$(monta plan "$PLANO_BOM")"

caso "item em 'plan' sem 03-plan.md REPROVA por impossibilidade de medição" 1 \
  "export GITHUB_WORKSPACE='$sem_plano' CLAUDE_PLUGIN_ROOT='${oraculo:-/nao/existe}'; bash '$alvo'"
contem "e diz que a ausência é do estágio 'plan'" "deste estágio em diante o plano é o que os critérios medem" \
  "export GITHUB_WORKSPACE='$sem_plano' CLAUDE_PLUGIN_ROOT='${oraculo:-/nao/existe}'; bash '$alvo'"
caso "item antes do estágio 'plan' passa sem plano" 0 \
  "export GITHUB_WORKSPACE='$antes_do_plano' CLAUDE_PLUGIN_ROOT='${oraculo:-/nao/existe}'; bash '$alvo'"
caso "sem o oráculo e fora do CI REPROVA — é a máquina onde o plano se escreve" 1 \
  "export GITHUB_WORKSPACE='$com_plano' CLAUDE_PLUGIN_ROOT='/nao/existe'; unset CI; bash '$alvo'"
caso "sem o oráculo e dentro do CI passa dizendo que não é ele quem mede" 0 \
  "export GITHUB_WORKSPACE='$com_plano' CLAUDE_PLUGIN_ROOT='/nao/existe' CI=true; bash '$alvo'"
contem "e a passagem no CI é dita em voz alta" "medido no portão local" \
  "export GITHUB_WORKSPACE='$com_plano' CLAUDE_PLUGIN_ROOT='/nao/existe' CI=true; bash '$alvo'"

vazio="$(mktemp -d)"
caso "sem product/state.json REPROVA por impossibilidade de medição" 1 \
  "export GITHUB_WORKSPACE='$vazio' CLAUDE_PLUGIN_ROOT='${oraculo:-/nao/existe}'; bash '$alvo'"

quebrado="$(monta plan "$PLANO_BOM")"
printf 'isto não é json' > "$quebrado/product/state.json"
caso "product/state.json ilegível REPROVA" 1 \
  "export GITHUB_WORKSPACE='$quebrado' CLAUDE_PLUGIN_ROOT='${oraculo:-/nao/existe}'; bash '$alvo'"

rm -rf "$sem_plano" "$antes_do_plano" "$com_plano" "$vazio" "$quebrado"

if [ "$falhas" -gt 0 ]; then
  printf '✗ plano: %s caso(s) falharam.\n' "$falhas"
  exit 1
fi
echo "✓ plano: o portão reprova o plano costurado, a ausência de plano no estágio que o exige e o estado que não deu para ler."
