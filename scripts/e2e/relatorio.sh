#!/usr/bin/env bash
#
# UMA SUBIDA, UMA ANÁLISE
#
# A suíte comportamental sobe a aplicação inteira — API, banco, build do app e
# servidor de pré-visualização — e o custo de uma execução é dominado por essa
# subida, não pelos casos. O validador cego tem um critério comportamental por
# requisito, e a leitura ingênua de "verifique cada critério com evidência
# executada" é invocar o Playwright uma vez por critério: o mesmo build, o mesmo
# boot e o mesmo banco, multiplicados pelo número de critérios, para medir
# exatamente o que uma execução já mediu.
#
# Este script fecha esse caminho. `rodar` executa a suíte UMA vez e guarda o
# relatório JSON daquela execução; `criterio` responde por um caso lendo o
# relatório. Nenhum critério sobe a aplicação.
#
# O relatório é amarrado à ÁRVORE que o produziu. Responder por um caso a partir
# de um relatório de outra árvore é a forma mais barata de aprovar código que
# nunca foi medido, e é a classe de defeito que este repositório inteiro existe
# para matar: ausência de medição lida como medição verde.
set -uo pipefail

RAIZ="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$RAIZ" || exit 1

RELATORIO="apps/web/e2e-resultado.json"
ARVORE="apps/web/.e2e-arvore"

_reprova() {
  printf '✗ e2e: não foi possível medir — %s\n' "$1" >&2
  printf '  Portão que não conseguiu medir reprova, nunca aprova.\n' >&2
  exit 1
}

# A identidade da árvore medida. `git write-tree` exigiria índice limpo; o
# hash abaixo cobre o que a suíte enxerga — o app e os próprios casos —, e muda
# a cada alteração deles, versionada ou não.
#
# motivo: `apps/web/e2e/.auth/` é o `storageState` que o próprio projeto
# `setup` escreve a cada execução (token e validade de uma sessão nova, nunca
# os mesmos dois bytes) — sem excluí-lo, a árvore "antes" e a árvore "depois"
# da mesma subida nunca seriam iguais, e _exige_relatorio_da_arvore reprovaria
# toda execução, mesmo sem nada de fonte ter mudado.
arvore_atual() {
  find apps/web/src apps/web/e2e apps/web/index.html apps/web/vite.config.ts \
       apps/web/playwright.config.ts packages/tema/src -type f \
       -not -path '*/e2e/.auth/*' 2>/dev/null |
    LC_ALL=C sort |
    xargs -r sha256sum 2>/dev/null |
    sha256sum |
    cut -d' ' -f1
}

rodar() {
  command -v pnpm >/dev/null 2>&1 || _reprova "pnpm não está no PATH"
  local antes
  antes="$(arvore_atual)"
  [ -n "$antes" ] || _reprova "não deu para identificar a árvore de apps/web"

  rm -f "$RELATORIO" "$ARVORE"
  printf 'e2e: uma subida, todos os casos. Isto leva minutos.\n' >&2
  pnpm --filter web exec playwright test "$@"
  local codigo=$?

  # O código de saída do Playwright diz se ALGUM caso falhou, e não é ele que
  # decide aqui: uma parte falhar não invalida a medição das outras, e é
  # justamente por isso que a suíte roda inteira. O que invalida é não haver
  # relatório — aí nada foi medido.
  [ -s "$RELATORIO" ] || _reprova "a execução não deixou $RELATORIO — nenhum caso foi medido"
  printf '%s' "$antes" > "$ARVORE"

  resumo
  return "$codigo"
}

_exige_relatorio_da_arvore() {
  [ -s "$RELATORIO" ] || _reprova "não há $RELATORIO — rode \`bash scripts/e2e/relatorio.sh rodar\` antes"
  [ -s "$ARVORE" ] || _reprova "não há $ARVORE — o relatório não diz de que árvore veio"
  local gravada agora
  gravada="$(cat "$ARVORE")"
  agora="$(arvore_atual)"
  [ "$gravada" = "$agora" ] ||
    _reprova "o relatório é de outra árvore de apps/web — rode a suíte de novo"
}

# Lê o relatório do Playwright e imprime uma linha `status<TAB>título` por caso.
_casos() {
  python3 - "$RELATORIO" <<'PY'
import json, sys

with open(sys.argv[1], encoding="utf-8") as h:
    dados = json.load(h)

def anda(suites, prefixo=()):
    for suite in suites or []:
        nome = suite.get("title") or ""
        for spec in suite.get("specs") or []:
            titulo = " > ".join([*prefixo, nome, spec.get("title") or ""]).strip(" >")
            resultados = [
                r.get("status")
                for teste in spec.get("tests") or []
                for r in teste.get("results") or []
            ]
            if not resultados:
                estado = "nao_medido"
            elif all(r == "passed" for r in resultados):
                estado = "passou"
            elif any(r == "skipped" for r in resultados) and not any(
                r in ("failed", "timedOut", "interrupted") for r in resultados
            ):
                estado = "pulado"
            else:
                estado = "falhou"
            print(f"{estado}\t{titulo}")
        anda(suite.get("suites"), (*prefixo, nome))

anda(dados.get("suites"))
PY
}

resumo() {
  _exige_relatorio_da_arvore
  local linhas
  linhas="$(_casos)" || _reprova "o relatório não é legível como JSON do Playwright"
  [ -n "$linhas" ] || _reprova "o relatório não tem caso nenhum — a suíte não coletou testes"
  printf 'medido: %s caso(s) numa subida — %s passou(aram), %s falhou(aram), %s pulado(s), %s sem resultado.\n' \
    "$(printf '%s\n' "$linhas" | wc -l | tr -d ' ')" \
    "$(printf '%s\n' "$linhas" | grep -c '^passou' || true)" \
    "$(printf '%s\n' "$linhas" | grep -c '^falhou' || true)" \
    "$(printf '%s\n' "$linhas" | grep -c '^pulado' || true)" \
    "$(printf '%s\n' "$linhas" | grep -c '^nao_medido' || true)"
  printf '%s\n' "$linhas" | sed 's/^/  /'
}

# criterio <trecho do título>
# Responde por UM caso, lendo o relatório. Caso ausente é `NAO_MEDIDO`, e
# NAO_MEDIDO reprova: um critério cuja evidência não existe não passou.
criterio() {
  local busca="${1:-}"
  [ -n "$busca" ] || _reprova "criterio exige o trecho do título do caso"
  _exige_relatorio_da_arvore
  local achados
  achados="$(_casos | grep -F -- "$busca" || true)"
  if [ -z "$achados" ]; then
    printf 'NAO_MEDIDO: nenhum caso do relatório casa com "%s".\n' "$busca" >&2
    printf 'Critério sem caso que o meça não passou — ele não foi medido.\n' >&2
    exit 1
  fi
  printf '%s\n' "$achados" | sed 's/^/  /'
  if printf '%s\n' "$achados" | grep -qv '^passou'; then
    printf '✗ e2e: "%s" não passou.\n' "$busca" >&2
    exit 1
  fi
  printf '✓ e2e: "%s" passou, na execução única desta árvore.\n' "$busca"
}

case "${1:-}" in
  rodar) shift; rodar "$@" ;;
  resumo) resumo ;;
  criterio) shift; criterio "$@" ;;
  *)
    printf 'uso: %s rodar | resumo | criterio <trecho do título>\n' "$0" >&2
    exit 2
    ;;
esac
