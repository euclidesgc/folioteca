#!/usr/bin/env bash
# Portão das ações do CI: toda referência `uses:` está fixada em SHA de 40
# hexadecimais, com a versão legível ao lado — e o portão declara quantas mediu.
#
# POR QUE A CONTAGEM É PARTE DO VEREDICTO
#
# `grep -rn 'uses:' .github/workflows/ | grep -vE '@[0-9a-f]{40}'` imprime nada
# quando tudo está fixado **e** quando não há fluxo nenhum para ler — caminho
# renomeado, `working-directory` herdado, diretório que a reorganização de um dia
# esvaziou. As duas respostas têm a mesma cara, e a segunda aprova sem ter
# medido. Por isso o diretório é exigido antes, a ausência de fluxo reprova em
# voz alta, e o número de referências medidas é impresso em todo push: é ele que
# denuncia o dia em que 27 viram 3 — e por isso a contagem é **afirmada** contra
# um piso, não só impressa. Imprimir sem afirmar deixava a segunda metade da
# armadilha aberta: `"uses":` e `uses :` são a mesma chave para o interpretador
# do GitHub e nenhuma das duas contém a cadeia que o `grep` procura, de modo que
# uma referência reescrita assim saía da contagem e voltava a ser tag móvel, com
# o portão anunciando `medido: 0 referência(s)` numa linha verde que ninguém lê.
#
# POR QUE A VERSÃO LEGÍVEL É COBRADA JUNTO
#
# SHA sozinho não diz o que está fixado. Sem `# vX.Y.Z` na mesma linha, atualizar
# uma ação vira arqueologia na API do GitHub, e o Dependabot — que lê o
# comentário para saber de onde está saindo — deixa de conseguir propor a
# atualização. As duas metades são a mesma decisão.
set -uo pipefail

RAIZ_DO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"

DIRETORIO_DOS_FLUXOS=".github/workflows"

# O piso é mínimo, não exato: job novo sobe a contagem e passa, e é a queda que
# reprova. Baixá-lo é decisão consciente de quem removeu um job de verdade, que
# é exatamente onde ela deve ser tomada.
PISO_DE_REFERENCIAS=27

FORMA_DO_SHA='@[0-9a-f]{40}'
FORMA_DA_VERSAO='@[0-9a-f]{40}[[:space:]]+#[[:space:]]*v[0-9]+\.[0-9]+\.[0-9]+'

exige_caminho "$DIRETORIO_DOS_FLUXOS" "os fluxos do CI"

RAIZ="$(medir_raiz)"

FLUXOS=()
while IFS= read -r fluxo; do
  FLUXOS+=("$fluxo")
done < <(cd "$RAIZ" && find "$DIRETORIO_DOS_FLUXOS" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)

if [ "${#FLUXOS[@]}" -eq 0 ]; then
  echo "medido: 0 arquivo(s) de fluxo em $DIRETORIO_DOS_FLUXOS"
  _reprova "não encontrou fluxo para medir em $DIRETORIO_DOS_FLUXOS — sem fluxo, toda referência está trivialmente fixada"
fi

TOTAL=0
VIOLACOES=()

for fluxo in "${FLUXOS[@]}"; do
  while IFS= read -r ocorrencia; do
    numero="${ocorrencia%%:*}"
    linha="${ocorrencia#*:}"
    TOTAL=$((TOTAL + 1))
    if [[ ! "$linha" =~ $FORMA_DO_SHA ]]; then
      # A linha comentada conta igual, e não é descuido: RF-20.1 e RF-20.2 são
      # `grep` cru sobre a linha inteira, e um portão mais esperto que o critério
      # aprovaria o que o critério reprova. O que muda é só a frase, para quem
      # leu a reprovação não sair procurando ação que não existe.
      if [[ "$linha" =~ ^[[:space:]]*# ]]; then
        VIOLACOES+=("$fluxo:$numero: a palavra 'uses:' aparece num comentário e conta como referência — reescreva o comentário sem ela")
      else
        VIOLACOES+=("$fluxo:$numero: referência por tag móvel —$(printf '%s' "${linha#*uses:}") — esperava @<sha de 40 hexadecimais>")
      fi
      continue
    fi
    if [[ ! "$linha" =~ $FORMA_DA_VERSAO ]]; then
      VIOLACOES+=("$fluxo:$numero: SHA sem versão legível ao lado —$(printf '%s' "${linha#*uses:}") — esperava '# vX.Y.Z' na mesma linha")
    fi
  done < <(cd "$RAIZ" && grep -n 'uses:' "$fluxo" || true)
done

echo "medido: $TOTAL referência(s) 'uses:' em ${#FLUXOS[@]} fluxo(s) de $DIRETORIO_DOS_FLUXOS (piso $PISO_DE_REFERENCIAS)"

if [ "$TOTAL" -lt "$PISO_DE_REFERENCIAS" ]; then
  _reprova "contei $TOTAL referência(s) e o piso é $PISO_DE_REFERENCIAS — ou um job sumiu, ou uma referência foi escrita numa forma que este portão não enxerga ('\"uses\":' e 'uses :' são a mesma chave para o GitHub e não contêm a cadeia procurada)"
fi

if [ "${#VIOLACOES[@]}" -gt 0 ]; then
  printf '  %s\n' "${VIOLACOES[@]}"
  printf '::error::ação do CI fora do pino: %s referência(s) acima não estão em SHA com versão legível.\n' \
    "${#VIOLACOES[@]}" >&2
  exit 1
fi

echo "✓ ações do CI: as $TOTAL referência(s) estão fixadas em SHA de 40 hexadecimais, com a versão ao lado."
