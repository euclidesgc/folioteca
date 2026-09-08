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

# As isenções aceitas, cada uma como `nome:vencimento`. O vencimento não é
# decoração: o portão reprova quando a data chega. Isenção temporária que ninguém
# cobra vira permanente, e o vencimento silencioso é exatamente como isso
# acontece — o comentário promete uma data, ninguém a mede, e um ano depois a
# lista continua igual sem que ninguém tenha decidido nada.
#
# A lista está vazia, e é o estado a que toda isenção deve voltar. Quem
# acrescentar um nome escreve junto o vencimento, no formato `nome:AAAA-MM-DD`, e
# a data é o dia SEGUINTE àquele em que a versão completa a espera — nunca o
# mesmo dia. Vencimento igual ao dia da liberação abre uma janela de vinte e
# quatro horas em que os dois lados reprovam: este portão desde a meia-noite,
# porque a isenção venceu, e o `pnpm install` até o instante exato da liberação,
# porque a política é verificada contra as entradas já existentes do lockfile.
ISENCOES_ESPERADAS=()

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

HOJE="$(date -u +%Y-%m-%d)"
LISTA_ESPERADA=""
VENCIDAS=()
for entrada in "${ISENCOES_ESPERADAS[@]}"; do
  nome="${entrada%%:*}"
  vence="${entrada##*:}"
  LISTA_ESPERADA="${LISTA_ESPERADA:+$LISTA_ESPERADA,}\"$nome\""
  [[ "$HOJE" < "$vence" ]] || VENCIDAS+=("$nome, que vencia em $vence")
done
LISTA_ESPERADA="[$LISTA_ESPERADA]"

echo "medido: minimumReleaseAgeExclude = $ISENTOS (esperado $LISTA_ESPERADA, hoje é $HOJE)"

# `pnpm config get` funde a configuração global de quem executa com a do
# repositório: um `minimumReleaseAge` global deixaria a leitura acima verde com o
# arquivo do repositório quebrado, e o portão estaria medindo a máquina em vez da
# política versionada. As duas perguntas são diferentes e as duas importam.
if ! grep -qE "^minimumReleaseAge: $ESPERADO\$" "$RAIZ/pnpm-workspace.yaml"; then
  printf '::error::pnpm-workspace.yaml não declara "minimumReleaseAge: %s" — o valor em vigor vem de outro lugar, e o que vale para quem clonar é o do repositório.\n' \
    "$ESPERADO" >&2
  exit 1
fi

if [ "$MEDIDO" != "$ESPERADO" ]; then
  printf '::error::a quarentena de dependência não está valendo: minimumReleaseAge = %s, esperado %s.\n' \
    "${MEDIDO:-<vazio>}" "$ESPERADO" >&2
  exit 1
fi

if [ "$ISENTOS" != "$LISTA_ESPERADA" ]; then
  printf '::error::a lista de isenções da quarentena mudou: %s, esperado %s. Isenção nova entra aqui e em pnpm-workspace.yaml, com o motivo e o vencimento escritos.\n' \
    "$ISENTOS" "$LISTA_ESPERADA" >&2
  exit 1
fi

if [ "${#VENCIDAS[@]}" -gt 0 ]; then
  printf '::error::isenção vencida da quarentena: %s. Ou o pacote sai de minimumReleaseAgeExclude em pnpm-workspace.yaml e desta constante, ou o vencimento é reescrito com o motivo novo — o que não vale é a data passar sem ninguém decidir.\n' \
    "$(IFS='; '; printf '%s' "${VENCIDAS[*]}")" >&2
  exit 1
fi

echo "✓ quarentena: versão publicada há menos de $ESPERADO minutos não entra na resolução, com as isenções $LISTA_ESPERADA dentro do prazo."
