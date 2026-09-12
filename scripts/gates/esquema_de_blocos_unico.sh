#!/usr/bin/env bash
# Portão do esquema de blocos: `packages/editor/src/schema.ts` (o editor no
# navegador) e `apps/api/src/collaboration/document-sync.service.ts` (a
# derivação de `content`/`plainText` no servidor) declaram a mesma lista de
# blocos, e ela é declarada duas vezes.
#
# POR QUE DUAS VEZES, E POR QUE UM PORTÃO
#
# `packages/editor` não tem build: o Vite o consome como fonte TypeScript.
# O servidor carrega `@blocknote/*` por `import()` dinâmico — única forma de
# alcançar a build ESM desses pacotes a partir de um processo CommonJS — e
# esse caminho resolve pacote publicado, nunca `.ts` cru. Então o serviço
# repete a lista em vez de importá-la.
#
# Divergir é um defeito silencioso: um bloco só no editor vira "tipo
# desconhecido" em `yDocToBlocks`, e o documento perde o parágrafo na
# pesquisa e na inteligência sem nenhum erro aparecer. O portão torna a
# divergência barulhenta.
set -uo pipefail

_raiz="${GITHUB_WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
# shellcheck source=medir.sh
source "$_raiz/scripts/gates/medir.sh"

EDITOR="packages/editor/src/schema.ts"
SERVIDOR="apps/api/src/collaboration/document-sync.service.ts"

exige_caminho "$EDITOR" "o esquema de blocos do editor"
exige_caminho "$SERVIDOR" "a derivação do documento no servidor"

RAIZ="$(medir_raiz)"

chaves() {
  awk '
    /blockSpecs: \{/ { dentro = 1; next }
    dentro && /^[[:space:]]*\},[[:space:]]*$/ { exit }
    dentro && match($0, /^[[:space:]]*[A-Za-z][A-Za-z0-9]*:/) {
      chave = $0
      sub(/^[[:space:]]*/, "", chave)
      sub(/:.*$/, "", chave)
      print chave
    }
  ' "$1" | sort
}

CHAVES_EDITOR="$(chaves "$RAIZ/$EDITOR")"
CHAVES_SERVIDOR="$(chaves "$RAIZ/$SERVIDOR")"

QUANTIDADE_EDITOR="$(printf '%s\n' "$CHAVES_EDITOR" | sed '/^$/d' | wc -l | tr -d ' ')"

echo "medido: $QUANTIDADE_EDITOR bloco(s) em $EDITOR"

if [ "$QUANTIDADE_EDITOR" -eq 0 ]; then
  printf '::error::esquema_de_blocos_unico: não foi possível ler nenhuma chave de blockSpecs em %s — o portão não conseguiu medir.\n' "$EDITOR" >&2
  exit 1
fi

if [ "$CHAVES_EDITOR" != "$CHAVES_SERVIDOR" ]; then
  printf '::error::esquema_de_blocos_unico: a lista de blocos de %s e a de %s divergiram. Um bloco declarado só no editor vira tipo desconhecido na derivação do servidor, sem erro visível.\n' "$EDITOR" "$SERVIDOR" >&2
  diff <(printf '%s\n' "$CHAVES_EDITOR") <(printf '%s\n' "$CHAVES_SERVIDOR") >&2 || true
  exit 1
fi

echo "✓ esquema_de_blocos_unico: as duas listas de blocos coincidem."
