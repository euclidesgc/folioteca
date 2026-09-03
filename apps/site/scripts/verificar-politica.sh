#!/usr/bin/env bash
# Verificação da política de conteúdo e dos cabeçalhos do hotsite.
#
# `apps/site` não tem pack nem runner de teste, e tudo o que a spec cobra aqui é
# observável na resposta HTTP. As asserções que reprovam por não ter conseguido
# medir moram em scripts/gates/medir.sh, e é de lá que vêm.
#
# Uso: bash apps/site/scripts/verificar-politica.sh [producao|desenvolvimento]
set -uo pipefail

_politica_raiz="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=../../../scripts/gates/medir.sh
source "$_politica_raiz/scripts/gates/medir.sh"

PORTA_HOTSITE="${PORTA_HOTSITE:-3001}"
_politica_falhas=0
# O `trap EXIT` roda depois de a função retornar, e variável `local` já saiu de
# escopo lá: sob `set -u` o próprio derrubador morre e deixa a porta ocupada.
_politica_servidor_pgid=""
_politica_trabalho=""

_reprova_resultado() {
  printf '::error::%s\n' "$1" >&2
  _politica_falhas=$((_politica_falhas + 1))
}

# exige_nonces_distintos <primeiro> <segundo>
# Nonce repetido é nonce ausente: é exatamente o que `headers()` produziria,
# porque grava a mesma string em toda resposta. A comparação mora numa função
# própria para poder ser provada sem subir servidor.
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

# O derrubador mata o grupo inteiro: `pnpm` delega a `next`, e matar só o pnpm
# deixa a porta ocupada para a próxima execução.
_derrubar() {
  [ -n "${_politica_servidor_pgid:-}" ] && kill -- "-$_politica_servidor_pgid" 2>/dev/null
  return 0
}

_aguardar_porta() { # <segundos>
  local limite="$1" decorrido=0
  while [ "$decorrido" -lt "$limite" ]; do
    if curl -sf -o /dev/null "http://localhost:$PORTA_HOTSITE/"; then
      echo "medido: o hotsite respondeu em http://localhost:$PORTA_HOTSITE após ${decorrido}s"
      return 0
    fi
    sleep 1
    decorrido=$((decorrido + 1))
  done
  _reprova "o hotsite não respondeu em http://localhost:$PORTA_HOTSITE em ${limite}s — sem servidor de pé não há resposta para medir"
}

principal() {
  local modo="${1:-producao}"
  case "$modo" in
    producao | desenvolvimento) ;;
    *) _reprova "modo '$modo' desconhecido — esperava 'producao' ou 'desenvolvimento'" ;;
  esac

  exige_comando curl
  exige_comando pnpm
  exige_caminho apps/site/next.config.ts "a configuração do hotsite"
  exige_caminho apps/site/src/middleware.ts "o middleware que emite a política"
  exige_pacote_pnpm site "o pacote do hotsite"

  cd "$_politica_raiz" || _reprova "não consegui entrar em $_politica_raiz"

  _politica_trabalho="$(mktemp -d)"
  local trabalho="$_politica_trabalho"
  local registro="$trabalho/servidor.log"

  trap _derrubar EXIT INT TERM

  if [ "$modo" = producao ]; then
    pnpm --filter site build >"$trabalho/build.log" 2>&1 ||
      { cat "$trabalho/build.log" >&2; _reprova "o build do hotsite falhou — não há artefato de produção para medir"; }
    setsid pnpm --filter site start >"$registro" 2>&1 &
  else
    setsid pnpm --filter site dev >"$registro" 2>&1 &
  fi
  _politica_servidor_pgid=$!

  _aguardar_porta 60 || { cat "$registro" >&2; exit 1; }

  curl -s -D "$trabalho/cabecalho-1.txt" -o "$trabalho/corpo-1.html" "http://localhost:$PORTA_HOTSITE/" ||
    _reprova "a primeira requisição a GET / não completou"
  curl -s -D "$trabalho/cabecalho-2.txt" -o "$trabalho/corpo-2.html" "http://localhost:$PORTA_HOTSITE/" ||
    _reprova "a segunda requisição a GET / não completou"
  [ -s "$trabalho/cabecalho-1.txt" ] || _reprova "a primeira resposta veio sem cabeçalho nenhum"
  [ -s "$trabalho/corpo-1.html" ] || _reprova "a primeira resposta veio com corpo vazio"

  local constantes=(
    "x-content-type-options: nosniff"
    "referrer-policy: strict-origin-when-cross-origin"
    "x-frame-options: DENY"
    "permissions-policy: camera=(), microphone=(), geolocation=()"
  )
  local conferidos=0 esperado
  for esperado in "${constantes[@]}"; do
    if _cabecalho_presente "$trabalho/cabecalho-1.txt" "$esperado"; then
      conferidos=$((conferidos + 1))
    else
      _reprova_resultado "a resposta não traz '$esperado'"
    fi
  done
  echo "medido: $conferidos de ${#constantes[@]} cabeçalhos constantes presentes"

  if [ "$modo" = producao ]; then
    if _cabecalho_presente "$trabalho/cabecalho-1.txt" "strict-transport-security: max-age=31536000; includeSubDomains"; then
      echo "medido: HSTS presente no build de produção"
    else
      _reprova_resultado "o build de produção respondeu sem 'strict-transport-security: max-age=31536000; includeSubDomains'"
    fi
  else
    if grep -qi '^strict-transport-security:' "$trabalho/cabecalho-1.txt"; then
      _reprova_resultado "o servidor de desenvolvimento emitiu HSTS, que persiste em cache no navegador de quem desenvolve"
    else
      echo "medido: HSTS ausente fora do build de produção"
    fi
  fi
  if grep -qi 'preload' "$trabalho/cabecalho-1.txt"; then
    _reprova_resultado "a resposta traz 'preload', que inscreve o domínio na lista embutida dos navegadores"
  fi

  local politica; politica="$(grep -i '^content-security-policy:' "$trabalho/cabecalho-1.txt" | head -1)"
  [ -n "$politica" ] || _reprova "a resposta não traz Content-Security-Policy — sem política não há diretiva para conferir"

  local diretivas=(
    "default-src 'self'"
    "style-src 'self'"
    "img-src 'self' data:"
    "connect-src 'self'"
    "object-src 'none'"
    "base-uri 'self'"
    "form-action 'self'"
    "frame-ancestors 'none'"
    "script-src 'self' 'nonce-"
  )
  local diretivas_ok=0 diretiva
  for diretiva in "${diretivas[@]}"; do
    if printf '%s' "$politica" | grep -qF "$diretiva"; then
      diretivas_ok=$((diretivas_ok + 1))
    else
      _reprova_resultado "a política não contém a diretiva '$diretiva'"
    fi
  done
  echo "medido: $diretivas_ok de ${#diretivas[@]} diretivas presentes na política"

  local escape
  for escape in "'unsafe-inline'" "'unsafe-eval'"; do
    if printf '%s' "$politica" | grep -qF "$escape"; then
      _reprova_resultado "a política contém $escape, que devolve ao script embutido injetado a permissão que o nonce existe para tirar"
    fi
  done

  local nonce_1 nonce_2
  nonce_1="$(_nonce_do_cabecalho "$trabalho/cabecalho-1.txt")"
  nonce_2="$(_nonce_do_cabecalho "$trabalho/cabecalho-2.txt")"
  exige_nonces_distintos "$nonce_1" "$nonce_2" || _politica_falhas=$((_politica_falhas + 1))

  local estampados=0 valor
  if [ -n "$nonce_1" ]; then
    while IFS= read -r valor; do
      [ "$valor" = "$nonce_1" ] && estampados=$((estampados + 1))
    done < <(_nonces_dos_scripts "$trabalho/corpo-1.html")
  fi
  echo "medido: $estampados <script> do corpo carregam o nonce da própria resposta"
  if [ "$estampados" -lt 1 ]; then
    _reprova_resultado "nenhum <script> do corpo carrega o nonce do cabeçalho da mesma resposta — a página não hidrataria"
  fi

  if [ "$_politica_falhas" -gt 0 ]; then
    printf 'REPROVADO: %s verificação(ões) da política falharam no modo %s.\n' "$_politica_falhas" "$modo" >&2
    exit 1
  fi
  printf 'APROVADO: a política e os cabeçalhos do hotsite conferem no modo %s.\n' "$modo"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  principal "$@"
fi
