#!/usr/bin/env bash
# Prova que a peneira de forma do `packageManager` morde antes de o valor virar
# comando. Ela existe porque o arquivo lido é o do pull request que os jobs de
# portões estão prestes a julgar, e `npm install` aceita muito mais que
# `nome@versão`: tarball por URL, atalho de repositório, caminho local. Sem a
# peneira, quem abre o PR escolhe o que roda no runner — e roda antes do passo
# que cobra os portões.
#
# Nenhum caso deste arquivo chega a instalar coisa alguma: todos param na
# asserção. O caminho feliz é exercido pelo próprio CI, que instala de verdade.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a variável
# vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
instalador="$raiz/scripts/ci/instalar-pnpm.sh"
tmp="${TMPDIR:-/tmp}/instalar-pnpm-test-$$"
bash_absoluto="$(command -v bash)"
falhas=0

monta_fixture() { # monta_fixture <diretório> <valor de packageManager, ou vazio>
  local casa="$1" valor="$2"
  mkdir -p "$casa"
  if [ -z "$valor" ]; then
    printf '{"name":"fixture"}\n' > "$casa/package.json"
  else
    printf '{"name":"fixture","packageManager":"%s"}\n' "$valor" > "$casa/package.json"
  fi
}

caso() { # caso <nome> <trecho na saída> <valor de packageManager>
  local nome="$1" trecho="$2" valor="$3" casa saida obtido
  casa="$tmp/$(printf '%s' "$nome" | tr -c 'a-zA-Z0-9' '-')"
  monta_fixture "$casa" "$valor"
  saida="$(env GITHUB_WORKSPACE="$casa" "$bash_absoluto" "$instalador" 2>&1)"
  obtido=$?
  if [ "$obtido" -eq 0 ]; then
    printf '  FALHA %s — o instalador terminou com zero, e devia ter recusado\n' "$nome"
    falhas=$((falhas + 1))
    return
  fi
  if ! printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  FALHA %s — a saída não contém %s\n' "$nome" "$trecho"
    falhas=$((falhas + 1))
    return
  fi
  printf '  ok    %s\n' "$nome"
}

caso "tarball por URL é recusado" "não tem a forma 'pnpm@X.Y.Z'" \
  "https://exemplo.invalido/pacote.tgz"
caso "atalho de repositório é recusado" "não tem a forma 'pnpm@X.Y.Z'" \
  "quem-abriu-o-pr/pnpm-falso"
caso "outro gerenciador é recusado" "não tem a forma 'pnpm@X.Y.Z'" \
  "yarn@4.0.0"
caso "faixa em vez de versão exata é recusada" "não tem a forma 'pnpm@X.Y.Z'" \
  "pnpm@^11.0.0"
caso "campo ausente é recusado" "não declara packageManager" ""

# O sufixo de integridade é a forma que o corepack aceita e que este instalador
# não: `npm install` o trataria como parte do especificador, e a conferência que
# ele promete não é feita por ninguém aqui.
caso "versão com sufixo de integridade é recusada" "não tem a forma 'pnpm@X.Y.Z'" \
  "pnpm@11.25.0+sha512.abc"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ instalar-pnpm.sh: nenhum especificador que não seja pnpm@X.Y.Z vira comando.\n'
else
  printf '\n✗ %s caso(s) da peneira do packageManager não se comportaram como deviam.\n' "$falhas" >&2
  exit 1
fi
