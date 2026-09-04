#!/usr/bin/env bash
# Recusa mergear um PR que tenha bloqueio pendente, verificação vermelha — ou
# cuja situação este script não tenha conseguido medir.
#
#   merge-se-liberado.sh <numero-do-pr> [--squash|--merge|--rebase]
#
# gate3-ok: os dois parágrafos abaixo são o porquê de o script existir, não a
# mecânica.
#
# POR QUE ELE EXISTE
# O rótulo `blocked-on-*` deveria ser tranca, e o workflow `harness.yml` o faz
# reprovar. Mas verificação obrigatória exige plano pago em repositório
# privado, e sem isso o botão de merge continua clicável com a verificação
# vermelha. A tranca então mora aqui: no ator que mergeia. Vale para quem roda
# à mão e para o motor autônomo, que é quem mergeia de madrugada.
#
# POR QUE ELE MEDE ANTES DE DECIDIR
# A primeira versão lia cada resposta do `gh` com `2>/dev/null` e decidia pela
# saída. Numa rede fora do ar a saída vem vazia, e vazio dizia "sem rótulo de
# bloqueio", "sem check vermelho" e "a pilha inteira está limpa" — a tranca
# aprovava justamente quando tinha menos informação para aprovar. É o mesmo
# defeito que `medir.sh` existe para matar, dentro do script que é a última
# linha de defesa antes do merge. A regra aqui é a mesma: **não conseguir
# medir é recusa, nunca liberação.**
#
# Toda chamada de rede tem teto de tempo. Espera sem teto não é espera, é
# travamento — e um motor autônomo travado às três da manhã perde a noite sem
# que nada acuse.
set -uo pipefail

TETO="${MERGE_TETO_SEGUNDOS:-30}"
# Teto de espera por verificação pendente. Separado do teto de rede: aquele mede
# se o GitHub responde, este mede quanto se espera por um CI que ainda roda.
ESPERA="${MERGE_ESPERA_SEGUNDOS:-1200}"

pr="${1:-}"
metodo="${2:---squash}"
[ -n "$pr" ] || { printf 'uso: merge-se-liberado.sh <numero-do-pr> [--squash|--merge|--rebase]\n' >&2; exit 2; }
case "$pr" in ''|*[!0-9]*) printf 'RECUSADO: "%s" não é número de PR.\n' "$pr" >&2; exit 2 ;; esac

command -v gh >/dev/null 2>&1 || { printf 'gh não encontrado.\n' >&2; exit 2; }
command -v timeout >/dev/null 2>&1 || { printf 'timeout não encontrado: sem ele não há teto de tempo, e sem teto não há tranca.\n' >&2; exit 2; }

nao_mediu() {
  printf 'RECUSADO por impossibilidade de medição, não por resultado.\n' >&2
  printf '  %s\n' "$1" >&2
  printf 'Uma tranca que libera quando não consegue medir não é tranca. Verifique a\n' >&2
  printf 'conexão e a autenticação do gh, e rode de novo.\n' >&2
  exit 1
}

# O resultado sai em `$MEDIDO`, e não pelo stdout, porque `mede` precisa poder
# encerrar o script quando não mede. Um `exit` dentro de `$( )` encerra só o
# subshell da substituição: o script seguiria adiante com a variável vazia, que
# é exatamente a leitura de vazio como resposta que esta reescrita existe para
# acabar. Chamada direta, o `exit` vale.
MEDIDO=""

# mede <descrição> <comando...>
mede() {
  local desc="$1"; shift
  local err saida rc detalhe
  err="$(mktemp)"
  saida="$(timeout "$TETO" "$@" 2>"$err")"; rc=$?
  detalhe="$(head -c 300 "$err" | tr '\n' ' ')"
  rm -f "$err"
  [ "$rc" -eq 124 ] && nao_mediu "$desc: nada respondeu em ${TETO}s."
  [ "$rc" -eq 0 ] || nao_mediu "$desc: o comando saiu $rc. ${detalhe:-sem detalhe}"
  MEDIDO="$saida"
}

# `gh pr checks` sai 1 quando há check vermelho e 8 quando há pendente: os dois
# são medição bem-sucedida, e tratá-los como falha travaria todo PR legítimo.
# Já 2 (PR inexistente) e qualquer erro de transporte são falta de medição.
mede_checks() {
  local err saida rc detalhe
  err="$(mktemp)"
  saida="$(timeout "$TETO" gh pr checks "$1" 2>"$err")"; rc=$?
  detalhe="$(head -c 300 "$err" | tr '\n' ' ')"
  rm -f "$err"
  case "$rc" in
    0|1|8) ;;
    124) nao_mediu "checks do PR #$1: nada respondeu em ${TETO}s." ;;
    *) nao_mediu "checks do PR #$1: o comando saiu $rc. ${detalhe:-sem detalhe}" ;;
  esac
  MEDIDO="$saida"
}

# POR QUE PENDENTE NÃO É VERDE
# A primeira versão recusava só o check `fail`. Um PR cujas verificações ainda
# rodam não tem nenhuma `fail` — tem quatro `pending` —, então ele passava, e o
# merge acontecia antes de o CI dizer qualquer coisa. É a mesma forma de falha
# que o cabeçalho deste arquivo descreve: a ausência de vermelho lida como
# verde, quando o certo era ler como *ainda não medido*. Numa noite de trinta
# merges, isso é trinta merges sem CI.
#
# Espera até $ESPERA segundos e recusa o que continuar pendente. Recusar de
# imediato travaria todo PR legítimo, porque o CI sempre começa pendente.
espera_checks() {
  local alvo="$1" inicio agora pendentes
  inicio="$(date +%s)"
  while :; do
    mede_checks "$alvo"
    pendentes="$(printf '%s\n' "$MEDIDO" | awk -F'\t' '$2=="pending"{print $1}')"
    [ -n "$pendentes" ] || return 0
    agora="$(date +%s)"
    if [ "$((agora - inicio))" -ge "$ESPERA" ]; then
      printf 'RECUSADO: o PR #%s ainda tem verificação pendente depois de %ss:\n' "$alvo" "$ESPERA" >&2
      printf '%s\n' "$pendentes" | sed 's/^/  /' >&2
      printf 'Pendente não é verde. Espere o CI terminar, ou aumente MERGE_ESPERA_SEGUNDOS\n' >&2
      printf 'quando souber por que aquela suite demora.\n' >&2
      exit 1
    fi
    printf 'aguardando %s verificação(ões) do PR #%s...\n' "$(printf '%s\n' "$pendentes" | wc -l | tr -d ' ')" "$alvo" >&2
    sleep 20
  done
}

mede "rótulos do PR #$pr" gh pr view "$pr" --json labels --jq '.labels[].name'
rotulos="$MEDIDO"
bloqueios="$(printf '%s\n' "$rotulos" | grep '^blocked-on-' || true)"
if [ -n "$bloqueios" ]; then
  printf 'RECUSADO: o PR #%s está travado por: %s\n' "$pr" "$(printf '%s' "$bloqueios" | tr '\n' ' ')" >&2
  printf 'A trava sai quando a divergência for ratificada por um humano, nunca quando alguém tirar o rótulo.\n' >&2
  exit 1
fi

espera_checks "$pr"
vermelhos="$(printf '%s\n' "$MEDIDO" | awk -F'\t' '$2=="fail"{print $1}')"
if [ -n "$vermelhos" ]; then
  printf 'RECUSADO: o PR #%s tem verificação vermelha:\n' "$pr" >&2
  printf '%s\n' "$vermelhos" | sed 's/^/  /' >&2
  exit 1
fi

mede "estado de merge do PR #$pr" gh pr view "$pr" --json mergeStateStatus --jq .mergeStateStatus
estado="$MEDIDO"
case "$estado" in
  CLEAN|UNSTABLE|HAS_HOOKS) ;;
  '') nao_mediu "estado de merge do PR #$pr: o GitHub respondeu, mas sem estado." ;;
  *) printf 'RECUSADO: o PR #%s está em estado %s.\n' "$pr" "$estado" >&2; exit 1 ;;
esac

printf 'PR #%s liberado: sem bloqueio, nenhuma verificação vermelha nem pendente, estado %s.\n' "$pr" "$estado"

# PR que pertence a uma pilha não mergeia por `gh pr merge`: o GitHub exige a
# via da pilha. `gh stack merge` é atômico — tudo até o PR escolhido entra
# junto, ou nada entra —, e é por isso que a checagem acima precisa valer para
# toda a pilha abaixo, não só para este PR.
#
# Um `gh stack view` que falha aqui significa "esta branch não está numa
# pilha", e não "não consegui perguntar": as três medições acima já provaram
# que o GitHub responde. Sem elas, esta linha seria o desvio silencioso para o
# merge que não verifica a pilha.
if timeout "$TETO" gh stack view >/dev/null 2>&1; then
  mede "a lista de PRs abertos" gh pr list --state open --json number --jq '.[].number'
  abaixo_de_todos="$MEDIDO"
  for abaixo in $(printf '%s\n' "$abaixo_de_todos" | sort -n); do
    [ "$abaixo" -le "$pr" ] || continue
    mede "rótulos do PR #$abaixo" gh pr view "$abaixo" --json labels --jq '.labels[].name'
    r="$(printf '%s\n' "$MEDIDO" | grep '^blocked-on-' || true)"
    [ -z "$r" ] || { printf 'RECUSADO: o PR #%s, abaixo na pilha, está travado por %s.\n' "$abaixo" "$r" >&2; exit 1; }
    espera_checks "$abaixo"
    v="$(printf '%s\n' "$MEDIDO" | awk -F'\t' '$2=="fail"{print $1}')"
    [ -z "$v" ] || { printf 'RECUSADO: o PR #%s, abaixo na pilha, tem check vermelho.\n' "$abaixo" >&2; exit 1; }
  done
  printf 'A pilha inteira até o #%s está limpa. Merge atômico.\n' "$pr"
  timeout "$TETO" gh stack merge "$pr" --yes --merge-method "${metodo#--}"
else
  timeout "$TETO" gh pr merge "$pr" "$metodo"
fi
