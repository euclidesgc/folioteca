#!/usr/bin/env bash
# Prova que o portão das portas de serviço MORDE.
#
# O defeito que ele existe para impedir não deixa rastro no diff: um
# `ports: ["5432:5432"]` escrito por conveniência passa em toda revisão, e só
# aparece no dia em que dois pull requests são medidos ao mesmo tempo — com
# `Docker start fail with exit code 1` e nenhuma menção a concorrência. Portão
# sem teste que morde é a forma pela qual este repositório já foi enganado, e
# aqui o custo de ele aprovar em silêncio é uma pilha inteira parada.
#
# O caso que mais importa é o do PAR: a árvore que tem um serviço correto e um
# fixo lado a lado. Um portão que reprovasse a árvore inteira sem nomear qual
# dos dois é o culpado passaria por um teste que só olhasse o código de saída.
#
# Os casos de impossibilidade verificam também o que a saída NÃO tem: a linha
# `medido:` ausente é o que separa "reprovou" de "reprovou depois de contar
# errado".
#
# Como `concorrencia.test.sh`, este teste não copia o portão nem o `medir.sh`
# para a sandbox: o portão resolve o `source` pelo caminho do próprio arquivo e
# a árvore por `medir_raiz()`, então apontar `GITHUB_WORKSPACE` para a sandbox
# mede a árvore de mentira com o script de verdade.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
alvo="$raiz/scripts/gates/portas_de_servico.sh"
falhas=0

[ -f "$alvo" ] || {
  printf '✗ portas-de-servico: o alvo %s não existe — não há o que medir.\n' "$alvo" >&2
  exit 2
}

avalia() { # avalia <nome> <esperado 0|1> <obtido> <saída> <trecho exigido> <trecho proibido>
  local nome="$1" esperado="$2" obtido="$3" saida="$4" trecho="$5" proibido="$6"
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" != "$esperado" ]; then
    printf '  FALHA %s — esperava %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
    return
  fi
  if [ -n "$trecho" ] && ! printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  FALHA %s — a saída não contém %s\n' "$nome" "$trecho"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
    return
  fi
  if [ -n "$proibido" ] && printf '%s' "$saida" | grep -qF "$proibido"; then
    printf '  FALHA %s — a saída contém %s, e não deveria\n' "$nome" "$proibido"
    printf '%s\n' "$saida" | sed 's/^/        /'
    falhas=$((falhas + 1))
    return
  fi
  printf '  ok    %s\n' "$nome"
}

caso() { # caso <nome> <esperado 0|1> <trecho na saída> <árvore> [<trecho proibido>]
  local nome="$1" esperado="$2" trecho="$3" casa="$4" proibido="${5:-}" saida obtido
  saida="$(env GITHUB_WORKSPACE="$casa" bash "$alvo" 2>&1)"
  obtido=$?
  avalia "$nome" "$esperado" "$obtido" "$saida" "$trecho" "$proibido"
}

arvore() { # arvore [<nome do arquivo> <conteúdo>]... → imprime o caminho da sandbox
  local casa; casa="$(mktemp -d)"
  mkdir -p "$casa/.github/workflows"
  while [ "$#" -ge 2 ]; do
    printf '%s' "$2" > "$casa/.github/workflows/$1"
    shift 2
  done
  printf '%s' "$casa"
}

SORTEADA='name: X
on: [push]
jobs:
  integracao:
    runs-on: self-hosted
    services:
      postgres:
        image: pgvector/pgvector:pg16
        ports: ["5432/tcp"]
    steps:
      - run: "true"
'
FIXA='name: X
on: [push]
jobs:
  integracao:
    runs-on: self-hosted
    services:
      postgres:
        image: pgvector/pgvector:pg16
        ports: ["5432:5432"]
    steps:
      - run: "true"
'
# A mesma publicação fixa escrita nas outras três formas que o YAML aceita: sem
# aspas, em lista com hífen, e com o protocolo no fim. Para o GitHub é o mesmo
# valor; para uma expressão regular sobre o texto, são quatro coisas.
FIXA_SEM_ASPAS='name: X
on: [push]
jobs:
  integracao:
    runs-on: self-hosted
    services:
      redis:
        image: redis
        ports:
          - 6379:6379
    steps:
      - run: "true"
'
FIXA_COM_PROTOCOLO='name: X
on: [push]
jobs:
  integracao:
    runs-on: self-hosted
    services:
      redis:
        image: redis
        ports: ["6379:6379/tcp"]
    steps:
      - run: "true"
'
SEM_PORTAS='name: X
on: [push]
jobs:
  integracao:
    runs-on: self-hosted
    services:
      postgres:
        image: pgvector/pgvector:pg16
    steps:
      - run: "true"
'
QUEBRADO='name: X
on: [push]
jobs:
  a:
   - isto: [não
'

CERTA="$(arvore ci-ok.yml "$SORTEADA")"
caso 'porta sorteada APROVA' 0 'nenhum contêiner de serviço prende porta escrita' "$CERTA"
caso 'a aprovação imprime quantos serviços mediu' 0 \
  'medido: 1 fluxo(s) em .github/workflows — 1 contêiner(es) de serviço com `ports:` declarado, 0 publicando porta fixa no hospedeiro' \
  "$CERTA"

ERRADA="$(arvore ci-mau.yml "$FIXA")"
caso 'porta fixa REPROVA nomeando o arquivo' 1 'ci-mau.yml' "$ERRADA"
caso 'a reprovação nomeia o serviço, e não só o job' 1 'jobs.integracao.services.postgres' "$ERRADA"
caso 'a reprovação diz o valor lido' 1 '5432:5432' "$ERRADA"
caso 'a reprovação ensina a forma correta e onde ler a porta' 1 "job.services.<id>.ports['5432']" "$ERRADA"
caso 'a reprovação conta o que mediu antes de reprovar' 1 '1 publicando porta fixa no hospedeiro' "$ERRADA"

SEM_ASPAS="$(arvore ci-mau.yml "$FIXA_SEM_ASPAS")"
caso 'porta fixa sem aspas, em lista com hífen, REPROVA' 1 'jobs.integracao.services.redis' "$SEM_ASPAS"

COM_PROTOCOLO="$(arvore ci-mau.yml "$FIXA_COM_PROTOCOLO")"
caso 'porta fixa com protocolo no fim REPROVA' 1 '6379:6379/tcp' "$COM_PROTOCOLO"
caso 'a correção sugerida descarta o protocolo ao nomear a chave' 1 "ports['6379']" "$COM_PROTOCOLO"

PAR="$(arvore ci-ok.yml "$SORTEADA" ci-mau.yml "$FIXA")"
caso 'o serviço correto ao lado do fixo não é cobrado' 1 'ci-mau.yml' "$PAR" 'ci-ok.yml:'
caso 'os dois entram na contagem, e só um na reprovação' 1 \
  '2 contêiner(es) de serviço com `ports:` declarado, 1 publicando porta fixa no hospedeiro' "$PAR"

NENHUMA="$(arvore ci-ok.yml "$SEM_PORTAS")"
caso 'serviço sem `ports:` não é cobrado nem contado' 0 \
  '0 contêiner(es) de serviço com `ports:` declarado' "$NENHUMA"

VAZIA="$(arvore)"
caso 'diretório vazio REPROVA dizendo que não havia o que medir' 1 \
  'não havia o que medir' "$VAZIA" 'contêiner(es) de serviço'

AUSENTE="$(mktemp -d)"
caso 'diretório ausente REPROVA nomeando o diretório' 1 \
  '.github/workflows não existe' "$AUSENTE" 'medido:'

ILEGIVEL="$(arvore quebrado.yml "$QUEBRADO")"
caso 'YAML ilegível REPROVA sem contar nada' 1 'quebrado.yml' "$ILEGIVEL" 'medido:'
caso 'o ilegível diz que não conseguiu medir' 1 'não consegui medir' "$ILEGIVEL"

# O `python3` de mentira à frente do PATH é o único jeito determinístico de
# medir a ausência do MÓDULO sem desinstalar PyYAML da máquina de quem trabalha.
SEM_MODULO="$(arvore ci-mau.yml "$FIXA")"
mkdir -p "$SEM_MODULO/bin"
real="$(command -v python3)"
printf '#!/bin/sh\ncase "$*" in\n  *"import yaml"*) echo "ModuleNotFoundError: No module named '"'"'yaml'"'"'" >&2; exit 1 ;;\nesac\nexec %s "$@"\n' "$real" > "$SEM_MODULO/bin/python3"
chmod +x "$SEM_MODULO/bin/python3"
saida="$(env GITHUB_WORKSPACE="$SEM_MODULO" PATH="$SEM_MODULO/bin:$PATH" bash "$alvo" 2>&1)"
obtido=$?
avalia 'módulo yaml ausente REPROVA nomeando PyYAML' 1 "$obtido" "$saida" 'PyYAML' 'medido:'
avalia 'a ausência do módulo vem antes de classificar arquivo' 1 "$obtido" "$saida" \
  'não conseguiu medir' 'ci-mau.yml:'

[ "$falhas" -eq 0 ] && {
  printf '✓ portas-de-servico: reprova a porta fixa nas quatro formas de escrevê-la, e o que não conseguiu medir.\n'
  exit 0
}
printf '✗ portas-de-servico: %s caso(s) falharam\n' "$falhas" >&2
exit 1
