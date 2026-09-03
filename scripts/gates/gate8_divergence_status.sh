#!/usr/bin/env bash
#
# G8 — o documento da divergência e o `product/state.json` dizem o mesmo status.
#
# A CAUSA RAIZ QUE ISTO EXISTE PARA MATAR
#
# O status de uma divergência mora em dois lugares. O `state.py` grava um
# (`product/state.json`) e não toca o outro (a linha `**Status:**` do
# `D-nnn.md`), e nada comparava os dois. Dez divergências reconciliadas
# continuaram se anunciando `PENDENTE` para quem abrisse o documento — a regra
# "Docs não mentem" existia, a asserção não. Um documento que mente sobre o
# próprio estado é pior que documento nenhum: ele é lido com confiança.
#
# Não conseguir medir é reprovação, nunca aprovação. Sem `state.json` legível,
# ou sem arquivo de divergência para comparar, este portão reprova em voz alta
# em vez de aprovar por não ter comparado nada — e a linha de reprovação sai
# também no stdout porque é só ele que o dispatcher lê.
#
# O que o portão mediu sai no stderr: o stdout é o canal das violações, uma por
# linha, e um resumo ali viraria violação inventada.
#
# Recebe a lista de arquivos por stdin; sem lista, descobre os arquivos sob
# `product/items/*/04-divergencias/`. Imprime arquivo:linha:trecho.

set -uo pipefail

# shellcheck source=scripts/gates/medir.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/medir.sh"

RAIZ="$(medir_raiz)"
ESTADO_REL="product/state.json"
ITENS_REL="product/items"
ARQUIVO_DA_MEDICAO="$ESTADO_REL"

# medir.sh reprova pelo stderr, e o dispatcher lê só o stdout. Uma reprovação
# por impossibilidade de medição chegaria nele como silêncio — que é a
# aprovação-por-não-ter-medido que estas asserções existem para matar. A
# reescrita mantém a voz do stderr e acrescenta a linha que o dispatcher lê.
_reprova() {
  printf '%s:0:portão não conseguiu medir: %s\n' "$ARQUIVO_DA_MEDICAO" "$1"
  printf '::error::portão não conseguiu medir: %s\n' "$1" >&2
  printf 'REPROVADO por impossibilidade de medição, não por resultado.\n' >&2
  exit 1
}

exige_comando python3
exige_caminho "$ESTADO_REL" "o status de cada divergência"

alvos=()
if [ ! -t 0 ]; then
  while IFS= read -r linha || [ -n "$linha" ]; do
    case "$linha" in
      */04-divergencias/D-*.md) alvos+=("$linha") ;;
    esac
  done
fi

if [ "${#alvos[@]}" -eq 0 ]; then
  ARQUIVO_DA_MEDICAO="$ITENS_REL"
  if ! encontrados="$(conta_sob "$ITENS_REL" -path '*/04-divergencias/D-*.md' -type f)"; then
    printf '%s\n' "$encontrados"
    exit 1
  fi
  if [ "$encontrados" -eq 0 ]; then
    _reprova "nenhum D-nnn.md sob $ITENS_REL/*/04-divergencias — procurei e não há o que comparar"
  fi
  while IFS= read -r linha; do
    alvos+=("${linha#"$RAIZ/"}")
  done < <(find "$RAIZ/$ITENS_REL" -path '*/04-divergencias/D-*.md' -type f | sort)
  ARQUIVO_DA_MEDICAO="$ESTADO_REL"
fi

violacoes="$(python3 - "$RAIZ" "$ESTADO_REL" "${alvos[@]}" <<'PYTHON'
import json
import os
import re
import sys

raiz, estado_rel = sys.argv[1], sys.argv[2]
alvos = [caminho for caminho in sys.argv[3:] if caminho.strip()]

VALIDOS = ("PENDENTE", "APROVADA", "REJEITADA", "RECONCILIADA")
LINHA_STATUS = re.compile(r"^\s*\*\*Status:\*\*\s*(.*)$")
PRIMEIRA_PALAVRA = re.compile(r"^([A-Za-zÀ-ÿ]+)")


def nao_medi(motivo):
    print(motivo)
    sys.exit(3)


try:
    with open(os.path.join(raiz, estado_rel), encoding="utf-8") as handle:
        estado = json.load(handle)
except OSError as erro:
    nao_medi(f"{estado_rel} não pôde ser lido ({erro.strerror})")
except ValueError as erro:
    nao_medi(f"{estado_rel} não é JSON legível ({erro})")

itens = estado.get("items")
if not isinstance(itens, dict):
    nao_medi(f"{estado_rel} não tem o mapa 'items' — não há status a comparar")

comparados = 0
for alvo in alvos:
    partes = alvo.replace(os.sep, "/").split("/")
    if "04-divergencias" not in partes:
        continue
    posicao = partes.index("04-divergencias")
    item = partes[posicao - 1] if posicao >= 1 else ""
    identificador = os.path.basename(alvo)[: -len(".md")]

    caminho = alvo if os.path.isabs(alvo) else os.path.join(raiz, alvo)
    try:
        with open(caminho, encoding="utf-8") as handle:
            linhas = handle.read().splitlines()
    except OSError:
        continue
    comparados += 1

    escrito, numero = None, 0
    for indice, linha in enumerate(linhas, start=1):
        casou = LINHA_STATUS.match(linha)
        if casou:
            escrito, numero = casou.group(1).strip(), indice
    if escrito is None:
        print(
            f"{alvo}:0:sem linha `**Status:**` — o documento não diz em que ponto "
            f"do ciclo {identificador} está"
        )
        continue

    palavra = PRIMEIRA_PALAVRA.match(escrito)
    no_documento = palavra.group(1).upper() if palavra else ""
    if no_documento not in VALIDOS:
        print(
            f"{alvo}:{numero}:**Status:** {escrito} — a primeira palavra não é um "
            f"dos quatro valores ({', '.join(VALIDOS)})"
        )
        continue

    registro = ((itens.get(item) or {}).get("divergences") or {}).get(identificador)
    if not isinstance(registro, dict):
        print(
            f"{alvo}:{numero}:**Status:** {no_documento} — {identificador} não "
            f"existe em {estado_rel} sob o item `{item}`"
        )
        continue

    no_estado = str(registro.get("status") or "").strip().upper()
    if not no_estado:
        print(
            f"{alvo}:{numero}:**Status:** {no_documento} — {identificador} não tem "
            f"status em {estado_rel}"
        )
        continue

    if no_estado != no_documento:
        print(
            f"{alvo}:{numero}:**Status:** {no_documento} — {estado_rel} diz "
            f"{no_estado} para {identificador}; o documento mente"
        )

if comparados == 0:
    nao_medi(
        f"nenhum dos {len(alvos)} caminho(s) recebido(s) pôde ser aberto como "
        f"arquivo de divergência"
    )

print(
    f"::notice::G8 comparou {comparados} arquivo(s) de divergência com {estado_rel}",
    file=sys.stderr,
)
PYTHON
)"
codigo=$?

if [ "$codigo" -eq 3 ]; then
  _reprova "$violacoes"
fi

if [ "$codigo" -ne 0 ]; then
  _reprova "o comparador saiu com código $codigo"
fi

[ -n "$violacoes" ] && printf '%s\n' "$violacoes"

exit 0
