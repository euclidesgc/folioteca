#!/usr/bin/env bash
# Verificação da política de conteúdo e dos cabeçalhos de apps/web.
#
# `apps/web` é SPA sobre Vite: não há resposta de servidor de aplicação para
# medir a política, como no hotsite. O que existe são dois artefatos
# distintos, e o portão mede os dois:
#
#   1. o artefato de build (`apps/web/dist`), onde a política vive numa tag
#      <meta> gravada no HTML no instante do build, derivada de VITE_API_URL;
#   2. os dois servidores locais do Vite (`vite`, porta 5173, e
#      `vite preview`, porta 4173), que respondem com os quatro cabeçalhos
#      constantes por `server.headers`/`preview.headers`, e nunca com HSTS —
#      HSTS emitida em localhost fixa no navegador de quem desenvolve uma
#      regra que persiste em cache.
#
# As asserções que reprovam por não terem conseguido medir moram em
# scripts/gates/medir.sh, e é de lá que vêm. As armadilhas desta classe de
# portão, já reproduzidas neste repositório contra apps/site, valem aqui do
# mesmo jeito:
#
#   1. medir a porta em vez do servidor — qualquer processo que atenda em
#      5173 ou 4173 responde as perguntas, e um servidor de outra execução
#      aprova o build de hoje sem que este código tenha sido servido;
#   2. perguntar "contém" em vez de "é" — `object-src 'none'` está contido em
#      `object-src 'none' *`, então uma política alargada passa por completa.
#      Por isso a comparação é da política inteira contra a canônica, não
#      nove buscas de substring;
#   3. `pnpm --filter web exec vite ...` bifurca: `$!` é o pid do `pnpm`, não
#      o do `vite` que de fato escuta a porta. Matar só o `pnpm` deixa o
#      `vite` vivo, órfão, ainda atendendo a porta na medição seguinte — por
#      isso o servidor sobe sob `setsid` e registra o próprio grupo antes de
#      o portão seguir em frente.
#
# As asserções abaixo são funções `exige_*` pequenas e parametrizadas — cada
# uma recebe o que vai medir por argumento, em vez de ler um caminho fixo —
# porque é isso que permite ao teste em __tests__/ provar que cada uma morde,
# sem precisar de um build nem de um servidor de verdade.
#
# Uso: bash apps/web/scripts/verificar-politica.sh <origem usada no build>
# Ex.: bash apps/web/scripts/verificar-politica.sh http://localhost:3000
set -uo pipefail

_politica_raiz="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=../../../scripts/gates/medir.sh
source "$_politica_raiz/scripts/gates/medir.sh"

readonly DIST_REL="apps/web/dist"
readonly INDEX_REL="apps/web/dist/index.html"

# Os mesmos quatro pares que apps/web/vite.config.ts declara em
# SECURITY_HEADERS. Duplicar a lista aqui é intencional: o portão não lê a
# constante do código-fonte, mede a resposta HTTP que ela produz.
CABECALHOS_CONSTANTES=(
  "x-content-type-options: nosniff"
  "referrer-policy: strict-origin-when-cross-origin"
  "x-frame-options: DENY"
  "permissions-policy: camera=(), microphone=(), geolocation=()"
)

_politica_falhas=0
_politica_pgid=""
_politica_trabalho=""
_politica_registro=""

_politica_canonica() { # <origem>
  printf "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' %s; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" "$1"
}

_conta_diretivas() { # <política>
  printf '%s' "$1" | awk -F';' '{n=0; for (i=1;i<=NF;i++){gsub(/^[ \t]+|[ \t]+$/,"",$i); if ($i != "") n++}; print n}'
}

_connect_src_de() { # <política>
  printf '%s' "$1" | tr ';' '\n' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//' | grep -E '^connect-src[[:space:]]' || true
}

_ocorrencias_meta_csp() { # <arquivo html>
  grep -o '<meta http-equiv="Content-Security-Policy"[^>]*>' "$1" 2>/dev/null | wc -l | tr -d ' '
}

# Assume que há exatamente uma tag; quem chama confere a contagem com
# exige_meta_csp_unica antes de pedir a política.
_politica_do_html() { # <arquivo html>
  grep -o '<meta http-equiv="Content-Security-Policy"[^>]*>' "$1" | head -1 | sed -E 's/.*content="([^"]*)".*/\1/'
}

# exige_meta_csp_unica <arquivo html>
exige_meta_csp_unica() {
  local arquivo="$1" ocorrencias
  ocorrencias="$(_ocorrencias_meta_csp "$arquivo")"
  echo "medido: $ocorrencias tag(s) <meta http-equiv=\"Content-Security-Policy\">"
  if [ "$ocorrencias" = "1" ]; then
    return 0
  fi
  printf '::error::o HTML traz %s tag(s) de política — esperava exatamente uma, e o navegador aplica a interseção de todas\n' "$ocorrencias" >&2
  return 1
}

# exige_politica_com_nove_diretivas <política>
exige_politica_com_nove_diretivas() {
  local politica="$1" quantidade
  quantidade="$(_conta_diretivas "$politica")"
  echo "medido: $quantidade diretiva(s) na política"
  if [ "$quantidade" = "9" ]; then
    return 0
  fi
  printf '::error::a política tem %s diretiva(s) — esperava exatamente 9\n' "$quantidade" >&2
  return 1
}

# exige_politica_canonica <política obtida> <origem esperada>
# A política inteira contra a canônica, não busca de substring:
# `object-src 'none'` está contido em `object-src 'none' *`, e uma política
# alargada passaria por completa numa busca de substring.
exige_politica_canonica() {
  local obtida="$1" origem="$2" esperada
  esperada="$(_politica_canonica "$origem")"
  if [ "$obtida" = "$esperada" ]; then
    echo "medido: a política é exatamente a declarada — nove diretivas, e nada além delas"
    return 0
  fi
  printf '::error::a política não é a declarada\n   esperada: %s\n   obtida:   %s\n' "$esperada" "$obtida" >&2
  return 1
}

# exige_connect_src <política> <origem esperada>
exige_connect_src() {
  local politica="$1" origem="$2" obtido esperado
  obtido="$(_connect_src_de "$politica")"
  esperado="connect-src 'self' $origem"
  echo "medido: connect-src = '${obtido:-<ausente>}'"
  if [ "$obtido" = "$esperado" ]; then
    return 0
  fi
  printf "::error::connect-src é '%s' — esperava '%s'\n" "${obtido:-<ausente>}" "$esperado" >&2
  return 1
}

# exige_politica_sem_termo <política> <termo perigoso>
exige_politica_sem_termo() {
  local politica="$1" termo="$2"
  if printf '%s' "$politica" | grep -qi "$termo"; then
    printf "::error::a política contém '%s'\n" "$termo" >&2
    return 1
  fi
  echo "medido: '$termo' ausente da política"
  return 0
}

# exige_dist_sem_cabecalhos_constantes <diretório>
# Nenhum arquivo sob o artefato de build pode declarar os quatro cabeçalhos
# constantes — nem em <meta http-equiv> nem em arquivo de configuração de
# host. Quem os emite em produção é o host, e este item não o escolhe.
exige_dist_sem_cabecalhos_constantes() {
  local diretorio="$1" achados
  achados="$(grep -rliE 'X-Frame-Options|X-Content-Type-Options|Referrer-Policy|Permissions-Policy' "$diretorio" 2>/dev/null || true)"
  if [ -n "$achados" ]; then
    printf '::error::um arquivo sob %s declara um dos quatro cabeçalhos constantes:\n%s\n' "$diretorio" "$achados" >&2
    return 1
  fi
  echo "medido: nenhum arquivo sob $diretorio declara os quatro cabeçalhos constantes"
  return 0
}

# exige_cabecalhos_constantes <arquivo de cabeçalhos> <rótulo>
exige_cabecalhos_constantes() {
  local arquivo="$1" rotulo="$2" conferidos=0 esperado falha=0
  for esperado in "${CABECALHOS_CONSTANTES[@]}"; do
    if grep -qiF "$esperado" "$arquivo"; then
      conferidos=$((conferidos + 1))
    else
      printf '::error::%s não traz "%s"\n' "$rotulo" "$esperado" >&2
      falha=1
    fi
  done
  echo "medido: $rotulo — $conferidos de ${#CABECALHOS_CONSTANTES[@]} cabeçalhos constantes presentes"
  [ "$falha" = "0" ]
}

# exige_sem_hsts <arquivo de cabeçalhos> <rótulo>
exige_sem_hsts() {
  local arquivo="$1" rotulo="$2"
  if grep -qi '^strict-transport-security:' "$arquivo"; then
    printf '::error::%s emitiu Strict-Transport-Security — HSTS em localhost fixa no navegador de quem desenvolve uma regra que persiste em cache\n' "$rotulo" >&2
    return 1
  fi
  echo "medido: $rotulo — HSTS ausente"
  return 0
}

# exige_html_sem_meta_csp <arquivo html> <rótulo>
exige_html_sem_meta_csp() {
  local arquivo="$1" rotulo="$2"
  if grep -qi 'http-equiv="content-security-policy"' "$arquivo"; then
    printf '::error::o HTML de %s contém a tag de política — em desenvolvimento ela proibiria o script embutido de que o recarregamento a quente depende\n' "$rotulo" >&2
    return 1
  fi
  echo "medido: o HTML de $rotulo não contém a tag de política"
  return 0
}

# Mata o grupo de processos do servidor corrente e espera a porta liberar
# antes de devolver o controle — o próximo servidor não pode herdar um
# processo que ainda não morreu.
_matar_grupo() {
  if [ -n "${_politica_pgid:-}" ]; then
    kill -- "-$_politica_pgid" 2>/dev/null
    local tentativas=0
    while kill -0 "$_politica_pgid" 2>/dev/null && [ "$tentativas" -lt 10 ]; do
      sleep 1
      tentativas=$((tentativas + 1))
    done
  fi
  _politica_pgid=""
}

# A faxina remove apenas o diretório que este script criou, e só depois de
# provar que é ele: apagar recursivamente dentro de um `trap` é a linha que
# limpa a árvore errada no dia em que a variável vem vazia.
_derrubar() {
  _matar_grupo
  case "${_politica_trabalho:-}" in
    /tmp/*)
      [ -d "$_politica_trabalho" ] && rm -r "$_politica_trabalho" 2>/dev/null
      ;;
  esac
  return 0
}

# Um servidor de outra execução, ou qualquer outro serviço, responderia todas
# as perguntas deste portão — e o veredicto seria sobre código que ninguém
# serviu.
_exige_porta_livre() { # <porta>
  local porta="$1"
  curl -s -o /dev/null --max-time 2 "http://localhost:$porta/"
  local codigo=$?
  # 7 é `couldn't connect`: ninguém escuta, que é a única situação em que
  # este portão sabe de quem é a resposta que vai medir.
  if [ "$codigo" -ne 7 ]; then
    _reprova "já há alguém atendendo em localhost:$porta (curl saiu $codigo) — o portão mediria um servidor que não foi este que subiu"
  fi
  echo "medido: a porta $porta estava livre antes de subir o servidor"
}

# O processo registra o próprio identificador e faz `exec`: `$!` seria o do
# `setsid`, que bifurca quando o controle de trabalho está ligado e deixa o
# servidor real noutro grupo, vivo depois do `trap`.
_subir_servidor() { # <comando do servidor> <arquivo de pid>
  local comando="$1" arquivo_pid="$2" espera=0
  setsid bash -c "echo \$\$ > \"$arquivo_pid\"; exec $comando" >"$_politica_registro" 2>&1 &
  while [ ! -s "$arquivo_pid" ] && [ "$espera" -lt 15 ]; do
    sleep 1
    espera=$((espera + 1))
  done
  if [ ! -s "$arquivo_pid" ]; then
    cat "$_politica_registro" >&2
    _reprova "o servidor não registrou o próprio identificador em ${espera}s — sem ele o portão não sabe o que subiu nem o que derrubar"
  fi
  _politica_pgid="$(cat "$arquivo_pid")"
  echo "medido: o servidor subiu no grupo de processos $_politica_pgid"
}

_aguardar_porta() { # <porta> <segundos>
  local porta="$1" limite="$2" decorrido=0
  while [ "$decorrido" -lt "$limite" ]; do
    if ! kill -0 "$_politica_pgid" 2>/dev/null; then
      cat "$_politica_registro" >&2
      _reprova "o servidor morreu antes de responder — a saída dele está acima"
    fi
    if curl -sf -o /dev/null "http://localhost:$porta/"; then
      echo "medido: o servidor respondeu em http://localhost:$porta após ${decorrido}s"
      return 0
    fi
    sleep 1
    decorrido=$((decorrido + 1))
  done
  cat "$_politica_registro" >&2
  _reprova "o servidor não respondeu em http://localhost:$porta em ${limite}s — a saída dele está acima"
}

_medir_resposta() { # <porta> <rótulo>
  local porta="$1" rotulo="$2" codigo
  codigo="$(curl -s -o "$_politica_trabalho/$rotulo.html" -D "$_politica_trabalho/$rotulo.headers" \
    -w '%{http_code}' "http://localhost:$porta/")"
  if [ "$codigo" != "200" ]; then
    _reprova "a requisição a GET / em $porta ($rotulo) respondeu '$codigo' — só a resposta que o navegador aceitaria vale como medição"
  fi
  [ -s "$_politica_trabalho/$rotulo.headers" ] || _reprova "a resposta de $rotulo veio sem cabeçalho nenhum"
  echo "medido: $rotulo respondeu $codigo em http://localhost:$porta"
}

_verificar_artefato() { # <origem esperada do connect-src>
  local origem="$1" arquivo="$_politica_raiz/$INDEX_REL"
  echo "== artefato: $DIST_REL =="

  if ! exige_meta_csp_unica "$arquivo"; then
    _politica_falhas=$((_politica_falhas + 1))
  else
    local politica
    politica="$(_politica_do_html "$arquivo")"

    exige_politica_com_nove_diretivas "$politica" || _politica_falhas=$((_politica_falhas + 1))
    exige_politica_canonica "$politica" "$origem" || _politica_falhas=$((_politica_falhas + 1))
    exige_connect_src "$politica" "$origem" || _politica_falhas=$((_politica_falhas + 1))
    exige_politica_sem_termo "$politica" "unsafe-inline" || _politica_falhas=$((_politica_falhas + 1))
    exige_politica_sem_termo "$politica" "unsafe-eval" || _politica_falhas=$((_politica_falhas + 1))
  fi

  exige_dist_sem_cabecalhos_constantes "$_politica_raiz/$DIST_REL" || _politica_falhas=$((_politica_falhas + 1))
}

_verificar_servidor_dev() {
  echo "== servidor: vite (5173) =="
  _exige_porta_livre 5173
  _politica_registro="$_politica_trabalho/dev.log"
  _subir_servidor "pnpm --filter web exec vite --strictPort" "$_politica_trabalho/dev.pid"
  _aguardar_porta 5173 60
  _medir_resposta 5173 dev

  exige_cabecalhos_constantes "$_politica_trabalho/dev.headers" "o servidor de desenvolvimento" || _politica_falhas=$((_politica_falhas + 1))
  exige_sem_hsts "$_politica_trabalho/dev.headers" "o servidor de desenvolvimento" || _politica_falhas=$((_politica_falhas + 1))
  exige_html_sem_meta_csp "$_politica_trabalho/dev.html" "vite" || _politica_falhas=$((_politica_falhas + 1))

  _matar_grupo
}

_verificar_servidor_preview() {
  echo "== servidor: vite preview (4173) =="
  _exige_porta_livre 4173
  _politica_registro="$_politica_trabalho/preview.log"
  _subir_servidor "pnpm --filter web exec vite preview --strictPort" "$_politica_trabalho/preview.pid"
  _aguardar_porta 4173 60
  _medir_resposta 4173 preview

  exige_cabecalhos_constantes "$_politica_trabalho/preview.headers" "o servidor de pré-visualização" || _politica_falhas=$((_politica_falhas + 1))
  exige_sem_hsts "$_politica_trabalho/preview.headers" "o servidor de pré-visualização" || _politica_falhas=$((_politica_falhas + 1))

  _matar_grupo
}

principal() {
  local origem="${1:-}"
  if [ -z "$origem" ]; then
    _reprova "nenhuma origem informada — uso: verificar-politica.sh <origem usada no build de apps/web/dist>"
  fi

  exige_comando curl
  exige_comando pnpm
  exige_comando setsid
  exige_pacote_pnpm web "o pacote da web"
  exige_caminho "$DIST_REL" "o artefato de build de apps/web — rode 'VITE_API_URL=$origem pnpm --filter web build' antes deste portão"
  exige_caminho "$INDEX_REL" "o index.html do artefato de build"

  cd "$_politica_raiz" || _reprova "não consegui entrar em $_politica_raiz"

  _politica_trabalho="$(mktemp -d)" ||
    _reprova "não consegui criar o diretório de trabalho — sem ele os caminhos ficam vazios e as mensagens apontam para o lugar errado"
  [ -d "$_politica_trabalho" ] || _reprova "o diretório de trabalho não existe depois do mktemp"
  trap _derrubar EXIT INT TERM

  _verificar_artefato "$origem"
  _verificar_servidor_dev
  _verificar_servidor_preview

  if [ "$_politica_falhas" -gt 0 ]; then
    printf 'REPROVADO: %s verificação(ões) da política de apps/web falharam.\n' "$_politica_falhas" >&2
    exit 1
  fi
  printf 'APROVADO: a política e os cabeçalhos de apps/web conferem.\n'
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  principal "$@"
fi
