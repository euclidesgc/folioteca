#!/usr/bin/env bash
# Prova que as marcas de justificativa ACENTUADAS que o cabeçalho do G3 promete
# realmente passam pelo portão, no awk desta máquina.
#
# O caso que importa é o primeiro: o `awk` do Debian/Ubuntu é o mawk 1.3.4, que
# não é UTF-8-aware. Numa classe de caractere ele casa BYTE, não caractere, e
# `ã`, `ê` e `ç` ocupam dois bytes cada. A versão anterior deste portão escrevia
# `decis[ãa]o`, e o mawk comparava o primeiro byte de `ã` (0xC3) com `a`: a
# palavra acentuada NUNCA casava. O resultado é que `// decisão:` — marca que o
# próprio cabeçalho do portão anuncia — reprovava no G3.
#
# O defeito mordeu três vezes na feature 050: detectado na fase 1 (item 069 do
# roadmap), contornado na fase 2 trocando a marca por `motivo:` em
# `apps/web/src/shared/components/ui/switch.tsx`, e contornado de novo na fase 5.
# Sem estes casos, a próxima reescrita colapsa a alternância de volta em classe
# de caractere e o portão volta a negar a marca que documenta.
#
# O controle positivo anda junto do negativo de propósito: um teste que só
# afirma "não reprovou" passa também quando o portão não rodou.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
alvo="$raiz/scripts/gates/gate3_no_comments.sh"
falhas=0

sandbox="$(mktemp -d)"
trap 'rm -rf "$sandbox"' EXIT

# Escreve <conteúdo> num arquivo e devolve a saída do portão para ele.
portao() { # portao <conteudo>
  local arquivo="$sandbox/amostra.ts"
  printf '%s\n' "$1" >"$arquivo"
  printf '%s\n' "$arquivo" | bash "$alvo" 2>&1
}

passa() { # passa <nome> <conteudo>
  local nome="$1" saida
  saida="$(portao "$2")"
  if [ -z "$saida" ]; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — o portão reprovou: %s\n' "$nome" "$saida"
    falhas=$((falhas + 1))
  fi
}

reprova() { # reprova <nome> <trecho esperado na saída> <conteudo>
  local nome="$1" trecho="$2" saida
  saida="$(portao "$3")"
  if printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — esperava reprovação citando "%s", obteve: %s\n' \
      "$nome" "$trecho" "${saida:-<nada>}"
    falhas=$((falhas + 1))
  fi
}

if [ ! -f "$alvo" ]; then
  echo "✗ marca-acentuada: não foi possível medir — $alvo não existe."
  echo "  Portão que não conseguiu medir reprova, nunca aprova."
  exit 1
fi

echo "awk desta execução: $(command -v awk)"

# As quatro marcas acentuadas que o cabeçalho do portão promete. O texto de
# cada caso não pode conter NENHUMA outra marca — "porque" no meio da prosa faz
# o caso passar pela marca errada, e a asserção deixa de medir o que promete.
passa "a marca decisão passa" \
  '// decisão: o menu fecha no blur, e não no clique fora, para o Safari
const a = 1;'
passa "a marca por quê passa" \
  '// por quê: o retry para no terceiro; o provedor derruba a conexão no quarto
const b = 2;'
passa "a marca limitação passa" \
  '// limitação: o Firefox ignora scrollend, então medimos por timeout
const c = 3;'
passa "a marca restrição passa" \
  '// restrição: o token viaja no corpo; o proxy trunca header em 8KB
const d = 4;'

# As mesmas marcas sem acento continuam passando: a correção acrescenta forma,
# não troca uma pela outra.
passa "a forma sem acento decisao continua passando" \
  '// decisao: sem acento, a forma que os contornos anteriores usaram
const e = 5;'
passa "a marca ascii motivo continua passando" \
  '// motivo: a fase 2 trocou a marca acentuada por esta, que é ASCII
const f = 6;'

# Controle positivo: sem estes, "não reprovou" também significaria "não rodou".
reprova "comentário sem marca nenhuma REPROVA" \
  'incrementa o contador em um' \
  '// incrementa o contador em um
const g = 7;'
reprova "cabeçalho decorativo de seção REPROVA" \
  'Helpers' \
  '// ----- Helpers -----
const h = 8;'
reprova "nota de histórico REPROVA" \
  'antes era um useEffect' \
  '// antes era um useEffect
const i = 9;'

# A marca acentuada abre bloco: a continuação sem marca passa junto dela, e a
# continuação de um bloco NÃO justificado continua reprovando.
passa "continuação de bloco aberto por marca acentuada passa" \
  '// decisão: o cache invalida por tag, não por chave: a lista muda junto
// com o item, e invalidar as duas chaves deixava a tela piscando
const j = 10;'
reprova "segunda linha de bloco sem marca REPROVA" \
  'e depois soma um' \
  '// primeiro le o valor
// e depois soma um
const k = 11;'

if [ "$falhas" -eq 0 ]; then
  echo ""
  echo "✓ marca-acentuada: as quatro marcas acentuadas do cabeçalho passam no G3,"
  echo "  e o comentário sem marca continua reprovando."
  exit 0
fi
echo ""
echo "✗ $falhas caso(s) falharam."
exit 1
