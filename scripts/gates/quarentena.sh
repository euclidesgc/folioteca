#!/usr/bin/env bash
# Portão da quarentena: a espera de sete dias está valendo, e o portão diz qual
# número mediu.
#
# POR QUE A LISTA DE ISENÇÕES É MEDIDA JUNTO DO NÚMERO
#
# `minimumReleaseAgeExclude` desliga a espera pacote a pacote, e
# `minimumReleaseAgeExclude: ["*"]` a desliga inteira — sem tocar no número que
# este portão lê. Medido: com as duas chaves declaradas,
# `pnpm config get minimumReleaseAge` continua respondendo 10080. Um portão que
# olhasse só o número aprovaria um repositório onde a política não vale para
# nada, com o comentário de nove linhas que a justifica intacto logo acima.
# Por isso a lista também é comparada com uma constante, e qualquer nome a mais
# reprova: isenção sem dono nem prazo é a política morrendo por dentro.
#
# POR QUE O NÚMERO ESPERADO É CONSTANTE AQUI, E NÃO LIDO DO ARQUIVO MEDIDO
#
# `pnpm config get minimumReleaseAge` imprime `undefined` e sai 0 quando a chave
# não existe — e sai 0 do mesmo jeito quando ela existe com um caractere
# trocado, porque `minimumReleaseAg` é chave desconhecida, não erro. Um portão
# que só verificasse ausência de erro aprovaria as duas. Ler o esperado do
# próprio `pnpm-workspace.yaml` teria o mesmo defeito por outro caminho: as duas
# pontas da comparação sairiam do arquivo sob medição, e qualquer valor lá
# dentro — sete minutos, zero, nenhum — casaria consigo mesmo. A constante é um
# segundo lugar de propósito: baixar a espera passa a exigir editar os dois, e é
# nesse segundo arquivo que a decisão aparece para quem revisa.
set -uo pipefail

RAIZ_DO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"

ESPERADO=10080

# As isenções aceitas, na forma normalizada de `pnpm config get`. `qs` está aqui
# porque a espera fixou a versão vulnerável dele em vez da corrigida, e sai
# quando `6.16.0` completar sete dias — o porquê inteiro está em
# `pnpm-workspace.yaml`, ao lado da lista que esta constante espelha.
ISENCOES_ESPERADAS='["qs"]'

exige_comando pnpm
exige_caminho pnpm-workspace.yaml "a declaração de minimumReleaseAge"

RAIZ="$(medir_raiz)"

MEDIDO="$(cd "$RAIZ" && pnpm config get minimumReleaseAge 2>/dev/null)" \
  || _reprova "'pnpm config get minimumReleaseAge' terminou por erro sob $RAIZ — sem leitura não há o que comparar"
MEDIDO="$(printf '%s' "$MEDIDO" | tr -d '[:space:]')"

# A linha vai para a saída padrão antes da reprovação, e não junto dela na saída
# de erro: quem executa o portão à mão não é obrigado a redirecionar a segunda, e
# o valor medido é a única informação que torna a reprovação acionável.
echo "medido: minimumReleaseAge = ${MEDIDO:-<vazio>} (esperado $ESPERADO minutos, sete dias)"

ISENTOS="$(cd "$RAIZ" && pnpm config get minimumReleaseAgeExclude 2>/dev/null)" \
  || _reprova "'pnpm config get minimumReleaseAgeExclude' terminou por erro sob $RAIZ — sem leitura não há o que comparar"
ISENTOS="$(printf '%s' "$ISENTOS" | tr -d '[:space:]')"
[ "$ISENTOS" = "undefined" ] && ISENTOS='[]'

echo "medido: minimumReleaseAgeExclude = $ISENTOS (esperado $ISENCOES_ESPERADAS)"

if [ "$MEDIDO" != "$ESPERADO" ]; then
  printf '::error::a quarentena de dependência não está valendo: minimumReleaseAge = %s, esperado %s.\n' \
    "${MEDIDO:-<vazio>}" "$ESPERADO" >&2
  exit 1
fi

if [ "$ISENTOS" != "$ISENCOES_ESPERADAS" ]; then
  printf '::error::a lista de isenções da quarentena mudou: %s, esperado %s. Isenção nova entra aqui e em pnpm-workspace.yaml, com o motivo e o prazo escritos.\n' \
    "$ISENTOS" "$ISENCOES_ESPERADAS" >&2
  exit 1
fi

echo "✓ quarentena: versão publicada há menos de $ESPERADO minutos não entra na resolução, com as isenções $ISENCOES_ESPERADAS."
