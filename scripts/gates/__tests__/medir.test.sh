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

# `caso` roda o corpo sem `set -e`, e o `run:` do GitHub Actions roda com ele.
# A diferença não é acadêmica: uma atribuição que herda saída não-zero mata o
# script antes da mensagem, e o passo fica vermelho sem dizer o que mediu — que
# é a reprovação muda, indistinguível de crash. Este caso mede a voz.
caso_fala() { # caso_fala <nome> <trecho esperado> <corpo>
  local nome="$1" trecho="$2" corpo="$3" saida
  saida="$(bash -e -c "$corpo" 2>&1)"
  if printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — a saída sob `bash -e` não contém %s\n' "$nome" "$trecho"
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

# A quarta forma: um filtro de pnpm que não casa pacote nenhum sai 0, e o passo
# do CI que dependia dele aprova sem ter rodado.
caso "exige_pacote_pnpm REPROVA quando o filtro não casa pacote" 1 \
  "source '$lib'; exige_pacote_pnpm pacote-inexistente-42 'um pacote do workspace'"
caso "exige_pacote_pnpm passa com um pacote real do workspace" 0 \
  "source '$lib'; exige_pacote_pnpm site 'o hotsite'"

# O marcador tem de vir do shell do sistema. Um `sh` que o PATH ofereça — e
# `pnpm exec` oferece o `node_modules/.bin` do pacote antes de tudo — mataria a
# medição e ainda daria execução de código a quem plantasse o binário.
mkdir -p "$tmp/bin-sequestrado"
printf '#!/bin/sh\nexit 0\n' > "$tmp/bin-sequestrado/sh"
chmod +x "$tmp/bin-sequestrado/sh"
caso "exige_pacote_pnpm ignora o 'sh' que o PATH oferece" 0 \
  "PATH=\"$tmp/bin-sequestrado:\$PATH\"; source '$lib'; exige_pacote_pnpm site 'o hotsite'"

# As duas reprovações abaixo rodam sob `bash -e`, como o `run:` do CI. O que se
# mede aqui não é o código de saída, é a voz: portão que reprova calado não pode
# ser auditado, e não se distingue de um crash da ferramenta.
caso_fala "exige_pacote_pnpm diz quanto mediu antes de reprovar" "medido: 0 pacote(s)" \
  "source '$lib'; exige_pacote_pnpm pacote-inexistente-42 'um pacote do workspace'"
caso_fala "exige_pacote_pnpm nomeia a impossibilidade de medir" "REPROVADO por impossibilidade de medição" \
  "source '$lib'; exige_pacote_pnpm pacote-inexistente-42 'um pacote do workspace'"
caso_fala "conta_sob nomeia a impossibilidade de medir" "REPROVADO por impossibilidade de medição" \
  "GITHUB_WORKSPACE='$tmp'; source '$lib'; conta_sob apps/api/src -name '*.ts'"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ medir.sh: todas as asserções mordem.\n'
else
  printf '\n✗ %s asserção(ões) não reprovaram quando deveriam.\n' "$falhas" >&2
  exit 1
fi
