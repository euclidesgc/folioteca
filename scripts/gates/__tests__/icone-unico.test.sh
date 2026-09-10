#!/usr/bin/env bash
# Prova que as asserções de scripts/gates/icone_unico.sh REPROVAM quando devem.
# Cada caso roda contra o valor que a asserção deve reprovar e contra o que ela
# deve aprovar — nenhum dos dois sozinho prova que ela morde.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
# motivo: os corpos abaixo referenciam $ALVO sem expandi-lo aqui — só o `eval`
# de cada caso o lê, e do ambiente. Um checkout cujo caminho carregue aspa
# simples ou `$(...)` viraria código executado se o valor fosse emendado na
# string.
export ALVO="$raiz/scripts/gates/icone_unico.sh"
export INDEX_REAL="$raiz/apps/web/index.html"
export LAYOUT_REAL="$raiz/apps/site/src/app/layout.tsx"

# motivo: os padrões e as fixtures carregam aspas duplas e barras invertidas.
# Emendá-los na string que o `eval` recebe os faria atravessar duas rodadas de
# citação — e um padrão corrompido não casa nada, o que faz os casos de
# REPROVAÇÃO passarem pelo motivo errado e não medirem coisa alguma.
export PADRAO_ICONE='rel="icon"[^>]*href="/icone\.svg"'
export PADRAO_TOQUE='rel="apple-touch-icon"[^>]*href="/icone-180\.png"'
export PADRAO_SVG='/icone\.svg'
export PADRAO_PNG='/icone-180\.png'
export HTML_COM_ICONE='<link rel="icon" href="/icone.svg" type="image/svg+xml">'
export HTML_COM_OUTRO='<link rel="icon" href="/outro.svg">'
export HTML_SEM_ICONE='<head><title>x</title></head>'
falhas=0

caso() { # caso <nome> <esperado 0|1> <corpo>
  local nome="$1" esperado="$2" corpo="$3" obtido
  ( eval "$corpo" ) >/dev/null 2>&1
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" = "$esperado" ]; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    falhas=$((falhas + 1))
  fi
}

caso_fala() { # caso_fala <nome> <trecho esperado> <corpo>
  local nome="$1" trecho="$2" corpo="$3" saida
  saida="$(bash -c "$corpo" 2>&1)"
  if printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  ok    %s\n' "$nome"
  else
    printf '  FALHA %s — a saída não contém %s\n' "$nome" "$trecho"
    falhas=$((falhas + 1))
  fi
}

caso "carregar o script não executa o corpo" 0 \
  "source \"\$ALVO\""

# O defeito que este portão existe para pegar: um retoque que ficou num app só.
caso "exige_arquivos_identicos REPROVA conteúdos diferentes" 1 \
  "source \"\$ALVO\"; d=\$(mktemp -d); printf 'a' > \"\$d/um\"; printf 'b' > \"\$d/dois\"; exige_arquivos_identicos \"\$d/um\" \"\$d/dois\" teste"
caso "exige_arquivos_identicos REPROVA quando um dos dois não existe" 1 \
  "source \"\$ALVO\"; d=\$(mktemp -d); printf 'a' > \"\$d/um\"; exige_arquivos_identicos \"\$d/um\" \"\$d/nao-existe\" teste"
caso "exige_arquivos_identicos passa com conteúdos iguais" 0 \
  "source \"\$ALVO\"; d=\$(mktemp -d); printf 'a' > \"\$d/um\"; printf 'a' > \"\$d/dois\"; exige_arquivos_identicos \"\$d/um\" \"\$d/dois\" teste"

# Diferença de um byte só: `cmp` mede o conteúdo, não o tamanho — dois arquivos
# do mesmo tamanho com um pixel trocado têm de reprovar igual.
caso "exige_arquivos_identicos REPROVA diferença de um byte no mesmo tamanho" 1 \
  "source \"\$ALVO\"; d=\$(mktemp -d); printf 'abc' > \"\$d/um\"; printf 'abd' > \"\$d/dois\"; exige_arquivos_identicos \"\$d/um\" \"\$d/dois\" teste"

# O outro defeito: o arquivo está em public/ e ninguém o declara. Sem a
# declaração o navegador pede /favicon.ico e recebe 404 em toda carga.
caso "exige_declaracao_de_icone REPROVA HTML sem a declaração" 1 \
  "source \"\$ALVO\"; h=\$(mktemp); printf '%s' \"\$HTML_SEM_ICONE\" > \"\$h\"; exige_declaracao_de_icone \"\$h\" \"\$PADRAO_ICONE\" teste 'o ícone'"
caso "exige_declaracao_de_icone REPROVA declaração que aponta para outro arquivo" 1 \
  "source \"\$ALVO\"; h=\$(mktemp); printf '%s' \"\$HTML_COM_OUTRO\" > \"\$h\"; exige_declaracao_de_icone \"\$h\" \"\$PADRAO_ICONE\" teste 'o ícone'"
caso "exige_declaracao_de_icone REPROVA arquivo inexistente" 1 \
  "source \"\$ALVO\"; exige_declaracao_de_icone \"/tmp/nao-existe-\$\$\" 'x' teste 'o ícone'"
caso "exige_declaracao_de_icone passa com a declaração esperada" 0 \
  "source \"\$ALVO\"; h=\$(mktemp); printf '%s' \"\$HTML_COM_ICONE\" > \"\$h\"; exige_declaracao_de_icone \"\$h\" \"\$PADRAO_ICONE\" teste 'o ícone'"

# Os arquivos reais, e não só fixtures: se a declaração sair do index.html ou do
# layout.tsx, são estes casos que percebem.
caso "o index.html real declara o ícone da aba" 0 \
  "source \"\$ALVO\"; exige_declaracao_de_icone \"\$INDEX_REAL\" \"\$PADRAO_ICONE\" teste 'o ícone'"
caso "o index.html real declara o ícone de atalho de tela" 0 \
  "source \"\$ALVO\"; exige_declaracao_de_icone \"\$INDEX_REAL\" \"\$PADRAO_TOQUE\" teste 'o atalho'"
caso "o layout.tsx real declara os dois ícones" 0 \
  "source \"\$ALVO\"; exige_declaracao_de_icone \"\$LAYOUT_REAL\" \"\$PADRAO_SVG\" teste 'o ícone' && exige_declaracao_de_icone \"\$LAYOUT_REAL\" \"\$PADRAO_PNG\" teste 'o atalho'"

# Reprovação calada não se distingue de crash: a mensagem tem de dizer qual é o
# defeito, senão quem lê o CI não sabe se retocou um app só ou esqueceu a linha.
caso_fala "exige_arquivos_identicos explica que um retoque ficou num app só" "dois ícones" \
  "source \"\$ALVO\"; d=\$(mktemp -d); printf 'a' > \"\$d/um\"; printf 'b' > \"\$d/dois\"; exige_arquivos_identicos \"\$d/um\" \"\$d/dois\" teste"
caso_fala "exige_declaracao_de_icone explica que o arquivo em public/ não basta" "não basta" \
  "source \"\$ALVO\"; h=\$(mktemp); printf '%s' \"\$HTML_SEM_ICONE\" > \"\$h\"; exige_declaracao_de_icone \"\$h\" \"\$PADRAO_ICONE\" teste 'o ícone'"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ icone_unico.sh: as asserções do ícone mordem.\n'
else
  printf '\n✗ %s asserção(ões) não reprovaram quando deveriam.\n' "$falhas" >&2
  exit 1
fi
