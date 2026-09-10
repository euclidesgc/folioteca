#!/usr/bin/env bash
# A empresa tem um ícone só, e ele é declarado nos dois apps.
#
# gate3-ok: o texto abaixo é a razão de o arquivo existir, não a mecânica dele.
#
# Dois defeitos distintos moram aqui, e nenhum dos dois se vê lendo o diff de um
# app só:
#
#   1. **Os arquivos divergem.** `apps/web/public/` e `apps/site/public/` servem
#      cópias do mesmo ícone, porque cada app serve o seu estático pela própria
#      origem — a política de conteúdo dos dois é `default-src 'self'`, e ícone
#      de outra origem é bloqueado. Cópia que ninguém compara é cópia que
#      envelhece: quem retocar o desenho num app deixa o outro para trás, e a
#      empresa passa a ter um ícone no produto e outro no hotsite. O portão
#      compara byte a byte.
#   2. **O arquivo existe e ninguém o declara.** É o defeito original: sem
#      `<link rel="icon">`, o navegador pede `/favicon.ico` por conta própria e
#      recebe 404 em toda carga — e o console, que os critérios comportamentais
#      usam como instrumento, começa com um falso positivo a descartar. Ter o
#      arquivo no lugar certo não resolve nada sozinho.
#
# As asserções são funções pequenas e parametrizadas, para o teste em
# __tests__/ provar que cada uma morde sem precisar de um build.
set -uo pipefail

_icone_raiz="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=medir.sh
source "$_icone_raiz/scripts/gates/medir.sh"

readonly ICONE_WEB_REL="apps/web/public/icone.svg"
readonly ICONE_SITE_REL="apps/site/public/icone.svg"
readonly TOQUE_WEB_REL="apps/web/public/icone-180.png"
readonly TOQUE_SITE_REL="apps/site/public/icone-180.png"
readonly INDEX_WEB_REL="apps/web/index.html"
readonly LAYOUT_SITE_REL="apps/site/src/app/layout.tsx"

_icone_falhas=0

# exige_arquivos_identicos <arquivo a> <arquivo b> <rótulo>
exige_arquivos_identicos() {
  local a="$1" b="$2" rotulo="$3"
  if [ ! -f "$a" ] || [ ! -f "$b" ]; then
    printf '::error::%s: um dos arquivos não existe (%s, %s)\n' "$rotulo" "$a" "$b" >&2
    return 1
  fi
  if cmp -s "$a" "$b"; then
    echo "medido: $rotulo — os dois apps servem o mesmo arquivo, byte a byte"
    return 0
  fi
  printf '::error::%s: os dois apps servem arquivos diferentes — um retoque ficou num app só, e a empresa passa a ter dois ícones\n   %s\n   %s\n' \
    "$rotulo" "$a" "$b" >&2
  return 1
}

# exige_declaracao_de_icone <arquivo> <padrão> <rótulo> <o que ele deveria declarar>
# Arquivo servido e ícone declarado são coisas diferentes: sem a declaração o
# navegador ignora o que está em `public/` e pede `/favicon.ico`.
exige_declaracao_de_icone() {
  local arquivo="$1" padrao="$2" rotulo="$3" esperado="$4"
  if [ ! -f "$arquivo" ]; then
    printf '::error::%s não existe — sem ele não há onde declarar o ícone\n' "$arquivo" >&2
    return 1
  fi
  if grep -qE "$padrao" "$arquivo"; then
    echo "medido: $rotulo declara $esperado"
    return 0
  fi
  printf '::error::%s não declara %s — o arquivo em public/ não basta: sem a declaração o navegador pede /favicon.ico e recebe 404 em toda carga\n' \
    "$rotulo" "$esperado" >&2
  return 1
}

principal() {
  exige_caminho "$ICONE_WEB_REL" "o ícone servido por apps/web"
  exige_caminho "$ICONE_SITE_REL" "o ícone servido por apps/site"
  exige_caminho "$TOQUE_WEB_REL" "o ícone de atalho de tela de apps/web"
  exige_caminho "$TOQUE_SITE_REL" "o ícone de atalho de tela de apps/site"

  exige_arquivos_identicos \
    "$_icone_raiz/$ICONE_WEB_REL" "$_icone_raiz/$ICONE_SITE_REL" \
    "o ícone da aba" || _icone_falhas=$((_icone_falhas + 1))

  exige_arquivos_identicos \
    "$_icone_raiz/$TOQUE_WEB_REL" "$_icone_raiz/$TOQUE_SITE_REL" \
    "o ícone de atalho de tela" || _icone_falhas=$((_icone_falhas + 1))

  exige_declaracao_de_icone "$_icone_raiz/$INDEX_WEB_REL" \
    'rel="icon"[^>]*href="/icone\.svg"' \
    "apps/web/index.html" 'rel="icon" apontando para /icone.svg' ||
    _icone_falhas=$((_icone_falhas + 1))

  exige_declaracao_de_icone "$_icone_raiz/$INDEX_WEB_REL" \
    'rel="apple-touch-icon"[^>]*href="/icone-180\.png"' \
    "apps/web/index.html" 'rel="apple-touch-icon" apontando para /icone-180.png' ||
    _icone_falhas=$((_icone_falhas + 1))

  exige_declaracao_de_icone "$_icone_raiz/$LAYOUT_SITE_REL" \
    '/icone\.svg' \
    "apps/site/src/app/layout.tsx" 'o ícone /icone.svg em metadata.icons' ||
    _icone_falhas=$((_icone_falhas + 1))

  exige_declaracao_de_icone "$_icone_raiz/$LAYOUT_SITE_REL" \
    '/icone-180\.png' \
    "apps/site/src/app/layout.tsx" 'o ícone /icone-180.png em metadata.icons' ||
    _icone_falhas=$((_icone_falhas + 1))

  if [ "$_icone_falhas" -gt 0 ]; then
    printf 'REPROVADO: %s verificação(ões) do ícone falharam.\n' "$_icone_falhas" >&2
    exit 1
  fi
  printf '✓ ícone: um arquivo só nos dois apps, e declarado nos dois.\n'
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  principal "$@"
fi
