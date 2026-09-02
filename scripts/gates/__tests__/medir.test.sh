#!/usr/bin/env bash
# Prova que cada asserção de medir.sh REPROVA quando deve. Uma biblioteca de
# portão sem este teste carrega o defeito que ela existe para matar, um nível
# acima: ninguém sabe se ela morde.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a
# variável vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
lib="$raiz/scripts/gates/medir.sh"
tmp="${TMPDIR:-/tmp}/medir-test-$$"
mkdir -p "$tmp/existe"
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

caso "exige_caminho passa quando existe" 0 \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; exige_caminho existe 'um diretório'"
caso "exige_caminho REPROVA quando não existe" 1 \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; exige_caminho nao-existe 'um diretório'"
caso "exige_comando passa com binário real" 0 \
  "source '$lib'; exige_comando find"
caso "exige_comando REPROVA com binário inexistente" 1 \
  "source '$lib'; exige_comando binario-inexistente-42"

: > "$tmp/gerado.txt"
antes="$(stat -c %Y "$tmp/gerado.txt")"
caso "exige_escrita REPROVA quando o gerador não escreveu" 1 \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; exige_escrita gerado.txt $antes"
caso "exige_escrita passa quando o arquivo foi reescrito" 0 \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; sleep 1; touch '$tmp/gerado.txt'; exige_escrita gerado.txt $antes"
caso "exige_escrita REPROVA quando o arquivo nem existe" 1 \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; exige_escrita nunca-gerado.txt 0"

# O caso que originou tudo: contar sob diretório inexistente tem de reprovar,
# nunca devolver zero em silêncio.
caso "conta_sob REPROVA quando o diretório não existe" 1 \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; conta_sob apps/api/src -name '*.ts'"
caso "conta_sob conta quando o diretório existe" 0 \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; conta_sob existe -type f"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ medir.sh: todas as asserções mordem.\n'
else
  printf '\n✗ %s asserção(ões) não reprovaram quando deveriam.\n' "$falhas" >&2
  exit 1
fi
