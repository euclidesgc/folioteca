#!/usr/bin/env bash
# Prova que G8 morde: que ele reprova o documento que mente sobre o próprio
# status, e que ele reprova quando não consegue medir em vez de aprovar em
# silêncio. Um portão exercitado só no caminho feliz não prova nada — ele
# aprovaria igual se o predicado nunca casasse.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a
# variável vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
portao="$raiz/scripts/gates/gate8_divergence_status.sh"
tmp="${TMPDIR:-/tmp}/status-divergencia-test-$$"
mkdir -p "$tmp"
falhas=0

ESTADO='{"schema":1,"items":{"001-item":{"divergences":{
  "D-001":{"status":"RECONCILIADA"},
  "D-002":{"status":"APROVADA"}}}}}'

caixa() { # caixa <nome> — monta a árvore mínima e ecoa a raiz dela
  local nome="$1" alvo="$tmp/$1"
  rm -rf "$alvo"
  mkdir -p "$alvo/product/items/001-item/04-divergencias"
  printf '%s\n' "$ESTADO" > "$alvo/product/state.json"
  printf '%s' "$alvo"
}

escreve() { # escreve <raiz> <id> <linha de status crua, ou VAZIO>
  local arquivo="$1/product/items/001-item/04-divergencias/$2.md"
  printf '# %s — título\n\nCorpo da divergência.\n' "$2" > "$arquivo"
  [ "$3" = "VAZIO" ] || printf '\n**Status:** %s\n' "$3" >> "$arquivo"
}

roda() { # roda <raiz> [arquivos...] — grava stdout/stderr e ecoa o exit code
  local caixa="$1"; shift
  if [ "$#" -eq 0 ]; then
    GITHUB_WORKSPACE="$caixa" bash "$portao" \
      > "$tmp/stdout" 2> "$tmp/stderr" < /dev/null
  else
    printf '%s\n' "$@" | GITHUB_WORKSPACE="$caixa" bash "$portao" \
      > "$tmp/stdout" 2> "$tmp/stderr"
  fi
  printf '%s' "$?"
}

verifica() { # verifica <nome> <condição avaliada> ...
  local nome="$1"; shift
  if eval "$@"; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s\n' "$nome"
    printf '        stdout: %s\n' "$(cat "$tmp/stdout")"
    printf '        stderr: %s\n' "$(cat "$tmp/stderr")"
    falhas=$((falhas + 1))
  fi
}

alvo1="product/items/001-item/04-divergencias/D-001.md"
alvo2="product/items/001-item/04-divergencias/D-002.md"

# (a) documento coerente com o estado passa, e sem imprimir violação.
c="$(caixa coerente)"
escreve "$c" D-001 RECONCILIADA
escreve "$c" D-002 APROVADA
codigo="$(roda "$c" "$alvo1" "$alvo2")"
verifica "documento coerente com o estado passa" \
  '[ "$codigo" = 0 ] && [ ! -s "$tmp/stdout" ]'

# O portão diz quantos arquivos comparou, ou ninguém consegue auditá-lo.
verifica "o portão diz quantos arquivos comparou" \
  'grep -q "comparou 2 arquivo" "$tmp/stderr"'

# (b) o defeito que originou o portão: markdown PENDENTE, estado RECONCILIADA.
c="$(caixa mentiroso)"
escreve "$c" D-001 PENDENTE
escreve "$c" D-002 APROVADA
codigo="$(roda "$c" "$alvo1" "$alvo2")"
verifica "documento que mente sobre o status reprova, nomeando o arquivo" \
  '[ "$codigo" = 0 ] && grep -q "^$alvo1:" "$tmp/stdout" && grep -q "RECONCILIADA" "$tmp/stdout"'
verifica "o documento coerente não vira violação junto" \
  '! grep -q "^$alvo2:" "$tmp/stdout"'

# (c) impossibilidade de medição: sem estado, com estado ilegível, sem itens.
c="$(caixa sem-estado)"
escreve "$c" D-001 RECONCILIADA
rm -f "$c/product/state.json"
codigo="$(roda "$c" "$alvo1")"
verifica "state.json ausente REPROVA por impossibilidade de medição" \
  '[ "$codigo" = 1 ] && grep -q "não conseguiu medir" "$tmp/stderr" && [ -s "$tmp/stdout" ]'

c="$(caixa estado-ilegivel)"
escreve "$c" D-001 RECONCILIADA
printf '{ isto nao e json' > "$c/product/state.json"
codigo="$(roda "$c" "$alvo1")"
verifica "state.json ilegível REPROVA por impossibilidade de medição" \
  '[ "$codigo" = 1 ] && grep -q "não conseguiu medir" "$tmp/stderr" && [ -s "$tmp/stdout" ]'

# "não achei nenhum arquivo" e "não consegui procurar" são respostas diferentes.
c="$(caixa sem-divergencia)"
codigo="$(roda "$c")"
verifica "árvore sem D-nnn.md REPROVA em vez de aprovar por não ter comparado" \
  '[ "$codigo" = 1 ] && grep -q "procurei e não há o que comparar" "$tmp/stderr"'

c="$(caixa sem-itens)"
rm -rf "$c/product/items"
codigo="$(roda "$c")"
verifica "product/items ausente REPROVA por não conseguir procurar" \
  '[ "$codigo" = 1 ] && grep -q "não existe sob" "$tmp/stderr"'

# (d) o parêntese é comentário humano, não parte do status.
c="$(caixa com-comentario)"
escreve "$c" D-002 "APROVADA (ratificação autônoma — espera olhar humano)"
codigo="$(roda "$c" "$alvo2")"
verifica "status com comentário entre parênteses é lido pela primeira palavra" \
  '[ "$codigo" = 0 ] && [ ! -s "$tmp/stdout" ]'

# Status malformado e status ausente são violações, não silêncio.
c="$(caixa palavra-invalida)"
escreve "$c" D-001 "FEITO"
codigo="$(roda "$c" "$alvo1")"
verifica "primeira palavra fora dos quatro valores reprova" \
  '[ "$codigo" = 0 ] && grep -q "não é um dos quatro valores" "$tmp/stdout"'

c="$(caixa sem-linha-de-status)"
escreve "$c" D-001 VAZIO
codigo="$(roda "$c" "$alvo1")"
verifica "documento sem linha de status reprova" \
  '[ "$codigo" = 0 ] && grep -q "sem linha" "$tmp/stdout"'

# Divergência que o documento afirma e o estado desconhece.
c="$(caixa fora-do-estado)"
escreve "$c" D-099 PENDENTE
codigo="$(roda "$c" "product/items/001-item/04-divergencias/D-099.md")"
verifica "divergência ausente do state.json reprova" \
  '[ "$codigo" = 0 ] && grep -q "não existe em product/state.json" "$tmp/stdout"'

# Sem lista no stdin o portão descobre a árvore, em vez de comparar nada.
c="$(caixa descoberta)"
escreve "$c" D-001 PENDENTE
codigo="$(roda "$c")"
verifica "sem lista no stdin o portão descobre os arquivos e ainda morde" \
  '[ "$codigo" = 0 ] && grep -q "^$alvo1:" "$tmp/stdout"'

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ G8: o portão morde o documento que mente e reprova quando não mede.\n'
else
  printf '\n✗ %s caso(s) em que o portão não se comportou como deve.\n' "$falhas" >&2
  exit 1
fi
