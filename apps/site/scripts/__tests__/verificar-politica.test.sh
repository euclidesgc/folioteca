#!/usr/bin/env bash
# Prova que as asserções sobre o nonce REPROVAM quando devem. Sem este teste, a
# verificação da política é uma peça que ninguém verificou: ela passaria igual
# se comparasse os dois valores errados, ou se não comparasse nada.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../../.." && pwd)"
alvo="$raiz/apps/site/scripts/verificar-politica.sh"
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

# Carregar o script não pode subir servidor: é a guarda de BASH_SOURCE que
# permite provar as asserções sem hotsite de pé, e é o único jeito de provocar
# os casos que um servidor correto nunca produz.
caso "carregar o script não executa o corpo" 0 \
  "source '$alvo'"

caso "exige_nonces_distintos passa com valores diferentes" 0 \
  "source '$alvo'; exige_nonces_distintos abc123 def456"
caso "exige_nonces_distintos REPROVA com valores iguais" 1 \
  "source '$alvo'; exige_nonces_distintos abc123 abc123"
caso "exige_nonces_distintos REPROVA com o primeiro vazio" 1 \
  "source '$alvo'; exige_nonces_distintos '' def456"
caso "exige_nonces_distintos REPROVA com o segundo vazio" 1 \
  "source '$alvo'; exige_nonces_distintos abc123 ''"
caso "exige_nonces_distintos REPROVA sem argumento nenhum" 1 \
  "source '$alvo'; exige_nonces_distintos"

# Diferente não é imprevisível. Um contador — que é o que sai de `Math.random`
# arredondado, de um relógio ou de um índice — passa pela comparação acima com
# louvor, e é exatamente o defeito que esta segunda asserção existe para pegar.
caso "exige_nonce_imprevisivel passa com 16 bytes em base64" 0 \
  "source '$alvo'; exige_nonce_imprevisivel 'SnnLhT/eOyXtc/dsACtsGw=='"
caso "exige_nonce_imprevisivel passa com o alfabeto inteiro" 0 \
  "source '$alvo'; exige_nonce_imprevisivel '++++////AAAAzzzz9999ab=='"
caso "exige_nonce_imprevisivel REPROVA um contador" 1 \
  "source '$alvo'; exige_nonce_imprevisivel 2"
caso "exige_nonce_imprevisivel REPROVA valor curto demais" 1 \
  "source '$alvo'; exige_nonce_imprevisivel 'SnnLhT/eOyXt=='"
caso "exige_nonce_imprevisivel REPROVA valor longo demais" 1 \
  "source '$alvo'; exige_nonce_imprevisivel 'SnnLhT/eOyXtc/dsACtsGwAAAA=='"
caso "exige_nonce_imprevisivel REPROVA caractere fora do alfabeto" 1 \
  "source '$alvo'; exige_nonce_imprevisivel 'SnnLhT_eOyXtc-dsACtsGw=='"
caso "exige_nonce_imprevisivel REPROVA valor vazio" 1 \
  "source '$alvo'; exige_nonce_imprevisivel ''"
caso "exige_nonce_imprevisivel REPROVA sem argumento nenhum" 1 \
  "source '$alvo'; exige_nonce_imprevisivel"

# A política canônica é uma constante do script, e é ela que separa "as nove
# diretivas estão lá" de "a política é esta". Se alguém alargar a constante, os
# dois casos abaixo caem junto.
caso "a política canônica não abre exceção para script de outra origem" 0 \
  "source '$alvo'; [ \"\${POLITICA_CANONICA%%;*}\" = \"script-src 'self' 'nonce-X'\" ]"
caso "a política canônica não contém curinga" 1 \
  "source '$alvo'; printf '%s' \"\$POLITICA_CANONICA\" | grep -qF '*'"

# Reprovação calada não se distingue de crash da ferramenta: o valor tem de
# aparecer na saída, senão ninguém sabe qual nonce voltou duas vezes.
caso_fala "exige_nonces_distintos nomeia o valor repetido" "abc123" \
  "source '$alvo'; exige_nonces_distintos abc123 abc123"
caso_fala "exige_nonces_distintos diz o que mediu antes de reprovar" "medido: nonce da primeira resposta" \
  "source '$alvo'; exige_nonces_distintos abc123 abc123"
caso_fala "exige_nonces_distintos nomeia a impossibilidade de medir" "REPROVADO por impossibilidade de medição" \
  "source '$alvo'; exige_nonces_distintos '' ''"
caso_fala "exige_nonce_imprevisivel nomeia o valor que recusou" "'2'" \
  "source '$alvo'; exige_nonce_imprevisivel 2"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ verificar-politica.sh: as asserções sobre o nonce mordem.\n'
else
  printf '\n✗ %s asserção(ões) não reprovaram quando deveriam.\n' "$falhas" >&2
  exit 1
fi
