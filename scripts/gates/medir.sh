#!/usr/bin/env bash
# Asserções para portão. Carregue com `source scripts/gates/medir.sh`.
#
# gate3-ok: o texto abaixo é a razão de o arquivo existir, não a mecânica dele.
#
# A CAUSA RAIZ QUE ISTO EXISTE PARA MATAR
#
# Um portão faz duas perguntas, e quase todo mundo escreve só a segunda:
#
#   1. consegui medir?
#   2. o que medi?
#
# Quando a primeira fica implícita, o predicado responde igual para "procurei e
# não achei" e para "não consegui procurar" — e o portão passa por não ter
# medido. Aconteceu quatro vezes num único dia neste repositório:
#
#   find apps/api/src -name '*.ts'   → vazio se não há fonte E se o diretório
#                                      não existe. A guarda do CI rodava dentro
#                                      de apps/api por causa de um
#                                      working-directory herdado, procurava
#                                      apps/api/apps/api/src, e respondia "não
#                                      há código" em toda branch.
#   git diff --exit-code <arquivo>   → 0 se está idêntico E se o gerador não
#                                      escreveu nada.
#   contador de progresso com CPU    → CPU sempre sobe, então "nada mudou"
#                                      nunca acontecia e o alarme nunca tocava.
#
# A regra: **não conseguir medir é reprovação, nunca aprovação.** Estas funções
# fazem a pergunta 1 falhar fechada e em voz alta, para a pergunta 2 só ser
# feita quando tiver sentido.
set -uo pipefail

# A âncora nunca é o diretório corrente: é ele que muda debaixo de você.
medir_raiz() {
  printf '%s' "${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
}

_reprova() {
  printf '::error::portão não conseguiu medir: %s\n' "$1" >&2
  printf 'REPROVADO por impossibilidade de medição, não por resultado.\n' >&2
  exit 1
}

# exige_caminho <caminho relativo à raiz> <o que ele deveria conter>
exige_caminho() {
  local alvo="$(medir_raiz)/$1"
  [ -e "$alvo" ] || _reprova "$1 não existe sob $(medir_raiz) — esperava $2"
}

# exige_comando <binário>
exige_comando() {
  command -v "$1" >/dev/null 2>&1 || _reprova "o comando '$1' não está no PATH"
}

# exige_escrita <arquivo> <instante em epoch antes da geração>
# Prova que a ferramenta escreveu, em vez de aceitar silêncio como acerto.
exige_escrita() {
  local arquivo="$(medir_raiz)/$1" antes="$2"
  [ -f "$arquivo" ] || _reprova "$1 não existe depois da geração"
  local depois; depois="$(stat -c %Y "$arquivo" 2>/dev/null || echo 0)"
  [ "$depois" -gt "$antes" ] || _reprova "$1 não foi reescrito — o gerador não rodou, e comparar o que ninguém gerou aprova qualquer coisa"
}

# conta_sob <caminho relativo> <expressão do find...>
# Só conta depois de provar que há onde contar.
conta_sob() {
  local rel="$1"; shift
  exige_caminho "$rel" "um diretório para contar"
  find "$(medir_raiz)/$rel" "$@" 2>/dev/null | wc -l
}

# exige_pacote_pnpm <filtro> <o que ele deveria casar>
# `pnpm --filter <inexistente> <script>` imprime "No projects matched the
# filters" e sai 0. É a quarta forma da tabela: o passo do CI aprova sem ter
# rodado nada, e o fluxo inteiro fica verde por não ter medido.
exige_pacote_pnpm() {
  local filtro="$1" descricao="$2" casados
  exige_comando pnpm
  # O marcador é a medição. Contar as linhas da saída aprovaria pelo próprio
  # aviso de "No projects matched", que o pnpm imprime na saída padrão.
  casados="$(cd "$(medir_raiz)" && pnpm --filter "$filtro" exec sh -c 'echo PACOTE_MEDIDO' 2>/dev/null | grep -c '^PACOTE_MEDIDO$')"
  echo "medido: $casados pacote(s) casados pelo filtro '$filtro'"
  [ "$casados" -ge 1 ] || _reprova "o filtro pnpm '$filtro' não casou pacote nenhum — esperava $descricao, e os passos seguintes sairiam 0 sem rodar"
}
