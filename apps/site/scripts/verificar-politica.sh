#!/usr/bin/env bash
# Verificação da política de conteúdo e dos cabeçalhos do hotsite.
#
# `apps/site` não tem pack nem runner de teste, e tudo o que a spec cobra aqui é
# observável na resposta HTTP. As asserções que reprovam por não ter conseguido
# medir moram em scripts/gates/medir.sh, e é de lá que vêm.
#
# Três armadilhas desta classe de portão, todas já reproduzidas contra este
# arquivo, governam as decisões abaixo:
#
#   1. medir a porta em vez do servidor — qualquer processo que atenda em 3001
#      responde as perguntas, e um servidor de outra execução aprova o build de
#      hoje sem que este código tenha sido servido;
#   2. perguntar "contém" em vez de "é" — `object-src 'none'` está contido em
#      `object-src 'none' *`, então uma política alargada passa por completa;
#   3. provar que dois nonces são diferentes e chamar isso de aleatório — um
#      contador passa igual, e no dia em que alguém trocar o gerador por
#      `Math.random()` o portão continua verde.
#
# Uso: bash apps/site/scripts/verificar-politica.sh [producao|desenvolvimento]
set -uo pipefail

_politica_raiz="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=../../../scripts/gates/medir.sh
source "$_politica_raiz/scripts/gates/medir.sh"

# A porta é a do script `start` de apps/site/package.json, e não uma variável:
# tornar configurável só o lado da medição faria o portão medir uma porta onde o
# servidor não está.
readonly PORTA_HOTSITE=3001

# A política inteira, com o nonce normalizado. Comparar a linha completa é o que
# distingue "as nove diretivas estão lá" de "a política é esta": nove buscas de
# substring aprovam `script-src 'self' 'nonce-X' https: *`, onde o nonce vira
# decoração e qualquer origem carrega script.
readonly POLITICA_CANONICA="script-src 'self' 'nonce-X'; default-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"

# 16 bytes em base64: 22 caracteres do alfabeto padrão e dois de preenchimento.
readonly FORMA_DO_NONCE='^[A-Za-z0-9+/]{22}==$'

_politica_falhas=0
_politica_servidor_pgid=""
_politica_trabalho=""
_politica_registro=""

_reprova_resultado() {
  printf '::error::%s\n' "$1" >&2
  _politica_falhas=$((_politica_falhas + 1))
}

# exige_nonces_distintos <primeiro> <segundo>
# Nonce repetido é nonce ausente: é o que `headers()` produziria, porque grava a
# mesma string em toda resposta.
exige_nonces_distintos() {
  local primeiro="${1:-}" segundo="${2:-}"
  echo "medido: nonce da primeira resposta = '${primeiro:-<vazio>}', da segunda = '${segundo:-<vazio>}'"
  if [ -z "$primeiro" ] || [ -z "$segundo" ]; then
    printf '::error::nonce ausente em uma das respostas — sem valor não há o que comparar\n' >&2
    printf 'REPROVADO por impossibilidade de medição, não por resultado.\n' >&2
    return 1
  fi
  if [ "$primeiro" = "$segundo" ]; then
    printf '::error::duas requisições consecutivas receberam o mesmo nonce: %s\n' "$primeiro" >&2
    return 1
  fi
  return 0
}

# exige_nonce_imprevisivel <valor>
# Diferente não é imprevisível: um contador passa por `exige_nonces_distintos`.
# A medição da forma mora numa função à parte porque a comparação acima tem
# contrato próprio, exercitado com valores curtos.
exige_nonce_imprevisivel() {
  local valor="${1:-}"
  if [[ ! "$valor" =~ $FORMA_DO_NONCE ]]; then
    printf '::error::o nonce %s não tem a forma de 16 bytes aleatórios em base64 — um contador ou um valor curto passaria pela comparação de igualdade\n' "'${valor:-<vazio>}'" >&2
    return 1
  fi
  echo "medido: nonce com a forma de 16 bytes em base64 — ${#valor} caracteres"
  return 0
}

_normaliza_politica() { # <linha do cabeçalho>
  printf '%s' "$1" |
    sed 's/\r$//' |
    sed 's/^[Cc]ontent-[Ss]ecurity-[Pp]olicy:[[:space:]]*//' |
    sed "s/'nonce-[^']*'/'nonce-X'/"
}

_cabecalho_presente() { # <arquivo de cabeçalhos> <linha esperada, sem caixa>
  grep -qiF "$2" "$1"
}

_nonce_do_cabecalho() { # <arquivo de cabeçalhos>
  grep -i '^content-security-policy:' "$1" |
    grep -o "nonce-[A-Za-z0-9+/=_-]*" |
    head -1 |
    sed 's/^nonce-//'
}

_nonces_dos_scripts() { # <arquivo de corpo>
  grep -o '<script[^>]*nonce="[^"]*"' "$1" |
    sed 's/.*nonce="\([^"]*\)".*/\1/'
}

# A faxina remove apenas o diretório que este script criou, e só depois de
# provar que é ele: apagar recursivamente dentro de um `trap` é a linha que
# limpa a árvore errada no dia em que a variável vem vazia.
_derrubar() {
  if [ -n "${_politica_servidor_pgid:-}" ]; then
    kill -- "-$_politica_servidor_pgid" 2>/dev/null
  fi
  case "${_politica_trabalho:-}" in
    /tmp/*)
      [ -d "$_politica_trabalho" ] && rm -r "$_politica_trabalho" 2>/dev/null
      ;;
  esac
  return 0
}

# Um servidor de outra execução, ou qualquer outro serviço, responderia todas as
# perguntas deste portão — e o veredicto seria sobre código que ninguém serviu.
_exige_porta_livre() {
  curl -s -o /dev/null --max-time 2 "http://localhost:$PORTA_HOTSITE/"
  local codigo=$?
  # 7 é `couldn't connect`: ninguém escuta, que é a única situação em que este
  # portão sabe de quem é a resposta que vai medir.
  if [ "$codigo" -ne 7 ]; then
    _reprova "já há alguém atendendo em localhost:$PORTA_HOTSITE (curl saiu $codigo) — o portão mediria um servidor que não foi este que subiu"
  fi
  echo "medido: a porta $PORTA_HOTSITE estava livre antes de subir o hotsite"
}

# O processo registra o próprio identificador e faz `exec`: `$!` seria o do
# `setsid`, que bifurca quando o controle de trabalho está ligado e deixa o
# servidor real noutro grupo, vivo depois do `trap`.
_subir_servidor() { # <comando do servidor>
  local comando="$1" arquivo_pid="$_politica_trabalho/servidor.pid" espera=0
  setsid bash -c "echo \$\$ > \"$arquivo_pid\"; exec $comando" >"$_politica_registro" 2>&1 &
  while [ ! -s "$arquivo_pid" ] && [ "$espera" -lt 15 ]; do
    sleep 1
    espera=$((espera + 1))
  done
  if [ ! -s "$arquivo_pid" ]; then
    cat "$_politica_registro" >&2
    _reprova "o servidor não registrou o próprio identificador em ${espera}s — sem ele o portão não sabe o que subiu nem o que derrubar"
  fi
  _politica_servidor_pgid="$(cat "$arquivo_pid")"
  echo "medido: o hotsite subiu no grupo de processos $_politica_servidor_pgid"
}

_aguardar_porta() { # <segundos>
  local limite="$1" decorrido=0
  while [ "$decorrido" -lt "$limite" ]; do
    if ! kill -0 "$_politica_servidor_pgid" 2>/dev/null; then
      cat "$_politica_registro" >&2
      _reprova "o servidor do hotsite morreu antes de responder — a saída dele está acima"
    fi
    if curl -sf -o /dev/null "http://localhost:$PORTA_HOTSITE/"; then
      echo "medido: o hotsite respondeu em http://localhost:$PORTA_HOTSITE após ${decorrido}s"
      return 0
    fi
    sleep 1
    decorrido=$((decorrido + 1))
  done
  cat "$_politica_registro" >&2
  _reprova "o hotsite não respondeu em http://localhost:$PORTA_HOTSITE em ${limite}s — a saída dele está acima"
}

# exige_icone_servido <caminho> <tipo de conteúdo esperado>
# Mede o que só a resposta diz: que o arquivo chega, e chega com o tipo certo.
# Um 404 aqui devolve ao console o mesmo erro em toda carga que motivou o item,
# e um SVG servido como `text/html` não é aceito como ícone pelo navegador.
exige_icone_servido() {
  local caminho="$1" tipo="$2" codigo obtido
  codigo="$(curl -s -o "$_politica_trabalho/icone.bin" \
    -D "$_politica_trabalho/icone.headers" \
    -w '%{http_code}' "http://localhost:$PORTA_HOTSITE$caminho")"
  obtido="$(grep -i '^content-type:' "$_politica_trabalho/icone.headers" |
    head -1 | tr -d '\r' | sed -E 's/^[Cc]ontent-[Tt]ype:[[:space:]]*//')"
  echo "medido: GET $caminho respondeu $codigo, content-type '${obtido:-<ausente>}'"
  if [ "$codigo" != "200" ]; then
    printf '::error::GET %s respondeu %s — o navegador registraria o erro em toda carga, que é o defeito que este ícone existe para fechar\n' "$caminho" "$codigo" >&2
    return 1
  fi
  if ! printf '%s' "$obtido" | grep -qiF "$tipo"; then
    printf "::error::GET %s respondeu com content-type '%s' — esperava '%s', e o navegador recusa o ícone servido com outro tipo\n" "$caminho" "$obtido" "$tipo" >&2
    return 1
  fi
  [ -s "$_politica_trabalho/icone.bin" ] || {
    printf '::error::GET %s respondeu 200 com corpo vazio\n' "$caminho" >&2
    return 1
  }
  return 0
}

_medir_resposta() { # <número da requisição>
  local n="$1" codigo
  codigo="$(curl -s -o "$_politica_trabalho/corpo-$n.html" -D "$_politica_trabalho/cabecalho-$n.txt" \
    -w '%{http_code}' "http://localhost:$PORTA_HOTSITE/")"
  if [ "$codigo" != "200" ]; then
    _reprova "a requisição $n a GET / respondeu '$codigo' — só a resposta que o navegador aceitaria vale como medição"
  fi
  [ -s "$_politica_trabalho/cabecalho-$n.txt" ] || _reprova "a resposta $n veio sem cabeçalho nenhum"
  [ -s "$_politica_trabalho/corpo-$n.html" ] || _reprova "a resposta $n veio com corpo vazio"
  echo "medido: requisição $n respondeu $codigo"
}

principal() {
  local modo="${1:-producao}"
  case "$modo" in
    producao | desenvolvimento) ;;
    *) _reprova "modo '$modo' desconhecido — esperava 'producao' ou 'desenvolvimento'" ;;
  esac

  exige_comando curl
  exige_comando pnpm
  exige_comando setsid
  exige_caminho apps/site/next.config.ts "a configuração do hotsite"
  exige_caminho apps/site/src/middleware.ts "o middleware que emite a política"
  exige_pacote_pnpm site "o pacote do hotsite"

  cd "$_politica_raiz" || _reprova "não consegui entrar em $_politica_raiz"

  _politica_trabalho="$(mktemp -d)" ||
    _reprova "não consegui criar o diretório de trabalho — sem ele os caminhos ficam vazios e as mensagens apontam para o lugar errado"
  [ -d "$_politica_trabalho" ] || _reprova "o diretório de trabalho não existe depois do mktemp"
  _politica_registro="$_politica_trabalho/servidor.log"
  trap _derrubar EXIT INT TERM

  _exige_porta_livre

  if [ "$modo" = producao ]; then
    pnpm --filter site build >"$_politica_trabalho/build.log" 2>&1 || {
      cat "$_politica_trabalho/build.log" >&2
      _reprova "o build do hotsite falhou — não há artefato de produção para medir"
    }
    _subir_servidor "pnpm --filter site start"
  else
    _subir_servidor "pnpm --filter site dev"
  fi

  _aguardar_porta 60
  _medir_resposta 1
  _medir_resposta 2

  local constantes=(
    "x-content-type-options: nosniff"
    "referrer-policy: strict-origin-when-cross-origin"
    "x-frame-options: DENY"
    "permissions-policy: camera=(), microphone=(), geolocation=()"
  )
  local conferidos=0 esperado
  for esperado in "${constantes[@]}"; do
    if _cabecalho_presente "$_politica_trabalho/cabecalho-1.txt" "$esperado"; then
      conferidos=$((conferidos + 1))
    else
      _reprova_resultado "a resposta não traz '$esperado'"
    fi
  done
  echo "medido: $conferidos de ${#constantes[@]} cabeçalhos constantes presentes"

  if grep -qi '^x-powered-by:' "$_politica_trabalho/cabecalho-1.txt"; then
    _reprova_resultado "a resposta traz X-Powered-By, que entrega de graça qual servidor atende o hotsite"
  else
    echo "medido: X-Powered-By ausente"
  fi

  local linha_hsts
  linha_hsts="$(grep -i '^strict-transport-security:' "$_politica_trabalho/cabecalho-1.txt")"
  if [ "$modo" = producao ]; then
    if printf '%s' "$linha_hsts" | grep -qiF "max-age=31536000; includeSubDomains"; then
      echo "medido: HSTS presente no build de produção"
    else
      _reprova_resultado "o build de produção respondeu sem 'strict-transport-security: max-age=31536000; includeSubDomains'"
    fi
  else
    if [ -n "$linha_hsts" ]; then
      _reprova_resultado "o servidor de desenvolvimento emitiu HSTS, que persiste em cache no navegador de quem desenvolve"
    else
      echo "medido: HSTS ausente fora do build de produção"
    fi
  fi
  # A busca é na linha da HSTS, e não no arquivo inteiro: `Link: <...>;
  # rel=preload` é cabeçalho legítimo que o Next emite assim que houver folha de
  # estilo ou fonte, e reprovar por ele ensinaria a afrouxar a asserção.
  if printf '%s' "$linha_hsts" | grep -qi 'preload'; then
    _reprova_resultado "a HSTS traz 'preload', que inscreve o domínio na lista embutida dos navegadores e é caro de desfazer"
  fi

  local quantas_politicas
  quantas_politicas="$(grep -ci '^content-security-policy:' "$_politica_trabalho/cabecalho-1.txt" || true)"
  echo "medido: $quantas_politicas linha(s) de Content-Security-Policy na resposta"
  if [ "$quantas_politicas" -ne 1 ]; then
    _reprova "a resposta traz $quantas_politicas políticas — o navegador aplica a interseção de todas, e medir uma delas não diz o que vale"
  fi

  local politica normalizada
  politica="$(grep -i '^content-security-policy:' "$_politica_trabalho/cabecalho-1.txt")"
  normalizada="$(_normaliza_politica "$politica")"
  if [ "$normalizada" = "$POLITICA_CANONICA" ]; then
    echo "medido: a política é exatamente a declarada — nove diretivas, e nada além delas"
  else
    _reprova_resultado "a política entregue não é a declarada
       esperada: $POLITICA_CANONICA
       obtida:   $normalizada"
  fi

  local nonce_1 nonce_2
  nonce_1="$(_nonce_do_cabecalho "$_politica_trabalho/cabecalho-1.txt")"
  nonce_2="$(_nonce_do_cabecalho "$_politica_trabalho/cabecalho-2.txt")"
  exige_nonces_distintos "$nonce_1" "$nonce_2" || _politica_falhas=$((_politica_falhas + 1))
  exige_nonce_imprevisivel "$nonce_1" || _politica_falhas=$((_politica_falhas + 1))
  exige_nonce_imprevisivel "$nonce_2" || _politica_falhas=$((_politica_falhas + 1))

  local estampados=0 valor
  if [ -n "$nonce_1" ]; then
    while IFS= read -r valor; do
      [ "$valor" = "$nonce_1" ] && estampados=$((estampados + 1))
    done < <(_nonces_dos_scripts "$_politica_trabalho/corpo-1.html")
  fi
  echo "medido: $estampados <script> do corpo carregam o nonce da própria resposta"
  if [ "$estampados" -lt 1 ]; then
    _reprova_resultado "nenhum <script> do corpo carrega o nonce do cabeçalho da mesma resposta — a página não hidrataria"
  fi

  # O ícone tem de sair pela própria origem: a política é `default-src 'self'`,
  # e o `matcher` do middleware nem passa por `_next/static`. `scripts/gates/
  # icone_unico.sh` já prova que o arquivo existe e que o layout o declara —
  # o que só uma requisição responde é se o servidor o entrega, porque o
  # `standalone` do Next deixa `public/` de fora e o Dockerfile a copia à parte.
  exige_icone_servido "/icone.svg" "image/svg+xml" || _politica_falhas=$((_politica_falhas + 1))
  exige_icone_servido "/icone-180.png" "image/png" || _politica_falhas=$((_politica_falhas + 1))

  if [ "$_politica_falhas" -gt 0 ]; then
    printf 'REPROVADO: %s verificação(ões) da política falharam no modo %s.\n' "$_politica_falhas" "$modo" >&2
    exit 1
  fi
  printf 'APROVADO: a política e os cabeçalhos do hotsite conferem no modo %s.\n' "$modo"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  principal "$@"
fi
