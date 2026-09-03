#!/usr/bin/env bash
# Portão de segredo: varre quatro universos e declara o que mediu em cada um.
#
# POR QUE OS QUATRO UNIVERSOS SÃO MATERIALIZADOS FORA DA ÁRVORE
#
# Três deles — apps/web/dist, apps/site/.next e apps/api/dist — são caminhos que
# o .gitignore da raiz ignora, e o quarto precisa enxergar o .env no instante em
# que alguém o rastreia por engano. Varrer in loco faz o resultado depender de a
# ferramenta consultar ou não o .gitignore, dependência que não aparece no diff e
# muda com a versão dela. Copiar para um diretório temporário torna a lista de
# arquivos aquela que este script construiu — e é ela que a contagem declara.
#
# A contagem existe porque um portão faz duas perguntas, e a primeira é
# "consegui medir?". Três coisas fazem essa pergunta falhar fechada aqui:
# universo que termina com zero arquivo varrido, universo cuja cópia não bate
# com a origem, e gitleaks que sai por erro de execução em vez de por achado.
# Nenhuma das três é árvore limpa, e todas saem pela mesma _reprova.
set -uo pipefail

RAIZ_DO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"

exige_comando gitleaks

RAIZ="$(medir_raiz)"
CONFIG="$RAIZ/.gitleaks.toml"

# O gitleaks sai 1 tanto por achado quanto por erro de execução — configuração
# ilegível, alvo que não dá para ler. Um código próprio para o achado é o que
# separa "medi e achei" de "não consegui medir", que é a distinção inteira deste
# portão.
CODIGO_DE_ACHADO=7

# A allowlist embutida que `useDefault = true` herda pula todo caminho que
# **contenha** `gitleaks.toml` em qualquer posição — um sufixo não basta, foi
# medido. Sem isto, a configuração do portão seria o único ponto cego do
# universo rastreado, e é exatamente onde alguém cola um token real "só para ver
# se a regra pega". A cópia troca esse pedaço do nome, e a saída o desfaz para
# nomear o arquivo que existe na raiz.
NOME_SOB_VARREDURA="configuracao-da-varredura.toml"

exige_caminho .gitleaks.toml "a configuração da varredura, com a allowlist e o motivo de cada entrada"
exige_caminho apps/web/dist "o artefato do app, produzido por 'pnpm --filter web build'"
exige_caminho apps/site/.next "o artefato do hotsite, produzido por 'pnpm --filter site build'"
exige_caminho apps/api/dist "o artefato da API, produzido por 'pnpm --filter api build'"

TEMPORARIO="$(mktemp -d)" || _reprova "não foi possível criar o diretório temporário da varredura"
limpa_temporario() { rm -rf -- "$TEMPORARIO"; }
trap limpa_temporario EXIT

UNIVERSOS=("git ls-files" apps/web/dist apps/site/.next apps/api/dist)
DIRETORIOS=()
CONTAGENS=()
ESPERADAS=()

materializa_rastreados() {
  local destino="$1" arquivo alvo
  while IFS= read -r -d '' arquivo; do
    alvo="$destino/$arquivo"
    case "$arquivo" in *gitleaks.toml) alvo="${alvo%gitleaks.toml}$NOME_SOB_VARREDURA" ;; esac
    mkdir -p "$(dirname "$alvo")" \
      || _reprova "não foi possível preparar o destino de '$arquivo' na cópia do universo git ls-files"
    cp -- "$RAIZ/$arquivo" "$alvo" \
      || _reprova "a cópia de '$arquivo' falhou — o universo git ls-files ficaria incompleto, e portão que varre parte da árvore aprova o que não leu"
  done < <(cd "$RAIZ" && git ls-files -z)
}

materializa_artefato() {
  local destino="$1" relativo="$2"
  mkdir -p "$destino/$relativo" \
    || _reprova "não foi possível preparar o destino da cópia de $relativo"
  cp -a "$RAIZ/$relativo/." "$destino/$relativo/" \
    || _reprova "a cópia de $relativo falhou — o universo ficaria incompleto, e portão que varre parte do artefato aprova o que não leu"
}

conta_esperado() { # conta_esperado <universo>
  if [ "$1" = "git ls-files" ]; then
    (cd "$RAIZ" && git ls-files -z | tr -cd '\0' | wc -c)
  else
    find "$RAIZ/$1" -type f | wc -l
  fi
}

for indice in "${!UNIVERSOS[@]}"; do
  universo="${UNIVERSOS[$indice]}"
  destino="$TEMPORARIO/u$indice"
  mkdir -p "$destino"
  ESPERADAS+=("$(conta_esperado "$universo")")
  if [ "$universo" = "git ls-files" ]; then
    materializa_rastreados "$destino"
  else
    materializa_artefato "$destino" "$universo"
  fi
  DIRETORIOS+=("$destino")
  CONTAGENS+=("$(find "$destino" -type f | wc -l)")
done

echo "medido com gitleaks $(gitleaks version)"
for indice in "${!UNIVERSOS[@]}"; do
  echo "medido: ${CONTAGENS[$indice]} arquivo(s) no universo ${UNIVERSOS[$indice]}"
done

for indice in "${!UNIVERSOS[@]}"; do
  [ "${CONTAGENS[$indice]}" -gt 0 ] || _reprova "o universo ${UNIVERSOS[$indice]} terminou com 0 arquivo varrido"
  # Uma entrada rastreada que não é arquivo regular — submódulo, symlink
  # quebrado — sumiria em silêncio, e o universo seria declarado varrido com
  # menos do que tem. Comparar com a origem é o que transforma esse silêncio em
  # reprovação, em vez de numa contagem menor que ninguém confere.
  [ "${CONTAGENS[$indice]}" -eq "${ESPERADAS[$indice]}" ] || _reprova \
    "o universo ${UNIVERSOS[$indice]} tem ${ESPERADAS[$indice]} arquivo(s) na origem e ${CONTAGENS[$indice]} na cópia varrida"
done

achou=0
for indice in "${!UNIVERSOS[@]}"; do
  diretorio="${DIRETORIOS[$indice]}"
  saida="$(gitleaks dir --no-banner --no-color --redact --verbose \
    --exit-code "$CODIGO_DE_ACHADO" --config "$CONFIG" "$diretorio" 2>&1)"
  codigo=$?
  # O caminho impresso precisa nomear o arquivo na raiz do repositório; sob o
  # temporário ele nomeia a cópia, e quem lê o log não encontra o que corrigir.
  # As linhas Finding: e Secret: dizem sempre REDACTED sob --redact, e a regra
  # de caminho as enche do caminho inteiro caractere a caractere. O que nomeia o
  # arquivo a corrigir é File:, e é ele que precisa sobreviver legível.
  printf '%s\n' "$saida" \
    | sed -e "s#${diretorio}/##g" -e "s#${NOME_SOB_VARREDURA}#gitleaks.toml#g" \
          -e '/^Finding:/d' -e '/^Secret:/d'
  case "$codigo" in
    0) ;;
    "$CODIGO_DE_ACHADO") achou=1 ;;
    *) _reprova "gitleaks terminou com código $codigo ao varrer o universo ${UNIVERSOS[$indice]} — isso é erro de execução, não achado" ;;
  esac
done

if [ "$achou" -ne 0 ]; then
  printf '::error::segredo encontrado na varredura acima — nenhum dos quatro universos pode conter credencial.\n' >&2
  exit 1
fi

echo "✓ segredo: os quatro universos varridos, nenhum achado."
