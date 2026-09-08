#!/usr/bin/env bash
#
# A suíte comportamental sobe a aplicação UMA vez, mede todos os casos nessa
# subida, e entrega um relatório do qual cada critério é respondido.
#
# A CAUSA RAIZ QUE ISTO EXISTE PARA MATAR
#
# Subir a aplicação custa build do app, boot da API e banco de pé. Os casos, ao
# lado disso, são de graça. O validador cego escreve um critério comportamental
# por requisito, e a leitura ingênua de "verifique cada critério com evidência
# executada" é invocar o Playwright uma vez por critério — o mesmo build e o
# mesmo boot repetidos, para medir o que uma execução já mediu. Numa fase de uma
# dúzia de critérios isso é uma dúzia de subidas.
#
# Duas formas produzem o mesmo estrago, e as duas são cobradas aqui:
#
#   1. FATIAR. `-g`, `--grep` e `--shard` transformam uma execução em N, cada
#      uma pagando a subida inteira.
#   2. DESISTIR CEDO. `-x` e `--max-failures` encerram a execução antes do fim,
#      e os casos que não chegaram a rodar somem do relatório. Ausência de
#      resultado lida como ausência de falha é exatamente o defeito que este
#      repositório inteiro persegue — e aqui ele custa outra subida para
#      descobrir o que já teria sido medido.
#
# O QUE ELE NÃO OLHA
#
# Projeto sem configuração de Playwright não tem o que declarar, e passa. O que
# não passa é a configuração existir e mentir sobre como é medida — vazio e
# ilegível são coisas diferentes, e só o segundo recusa.
set -uo pipefail

. "$(dirname "$0")/medir.sh"

RAIZ="$(medir_raiz)"
CONFIG="$RAIZ/apps/web/playwright.config.ts"

if [ ! -f "$CONFIG" ]; then
  printf 'medido: não há apps/web/playwright.config.ts — nenhuma suíte comportamental a cobrar.\n'
  exit 0
fi

exige_comando python3 "sem ele não há como ler a configuração nem os fluxos"

VIOLACOES=()

# 1. O relatório JSON é o que torna uma execução suficiente. Sem ele, responder
#    por um caso exige reexecutar a suíte, e a regra vira intenção.
if ! grep -qE '\["json"|"json",[[:space:]]*\{' "$CONFIG"; then
  VIOLACOES+=("apps/web/playwright.config.ts não declara o reporter \`json\`: sem relatório de máquina, cada critério reexecuta a suíte.")
fi
if ! grep -q 'outputFile' "$CONFIG"; then
  VIOLACOES+=("apps/web/playwright.config.ts declara o reporter \`json\` sem \`outputFile\`: o relatório vai para a saída padrão e não sobra arquivo para consultar.")
fi

# 2. Desistir cedo apaga do relatório o que não chegou a rodar.
if ! grep -qE '^[[:space:]]*maxFailures:[[:space:]]*0[[:space:]]*,' "$CONFIG"; then
  VIOLACOES+=("apps/web/playwright.config.ts não declara \`maxFailures: 0\`: uma parte falhar passa a impedir o resto de ser medido na mesma subida.")
fi
if ! grep -qE '^[[:space:]]*retries:[[:space:]]*0[[:space:]]*,' "$CONFIG"; then
  VIOLACOES+=("apps/web/playwright.config.ts não declara \`retries: 0\`: repetição esconde instabilidade e paga outra rodada da mesma aplicação.")
fi

# 3. Ninguém fatia nem interrompe a execução, em fluxo de CI ou script versionado.
ALVOS="$(git -C "$RAIZ" ls-files '.github/workflows/*.yml' '.github/workflows/*.yaml' 'scripts/*' 'package.json' 'apps/web/package.json' 2>/dev/null)"
[ -n "$ALVOS" ] || _reprova "\`git ls-files\` não devolveu fluxo nem script: não há como medir as invocações"

INVOCACOES=0
while IFS= read -r arquivo; do
  [ -f "$RAIZ/$arquivo" ] || continue
  case "$arquivo" in
    scripts/gates/e2e_uma_subida.sh|scripts/gates/__tests__/*) continue ;;
  esac
  while IFS= read -r linha; do
    INVOCACOES=$((INVOCACOES + 1))
    case "$linha" in
      *" -x"*|*"--max-failures"*)
        VIOLACOES+=("$arquivo invoca o Playwright desistindo cedo: o que não rodar some do relatório, e ausência de resultado não é ausência de falha.") ;;
    esac
    case "$linha" in
      *" -g "*|*"--grep"*|*"--shard"*)
        VIOLACOES+=("$arquivo fatia a suíte: cada fatia paga a subida inteira da aplicação para medir um pedaço.") ;;
    esac
  done < <(grep -hn 'playwright test\|run e2e' "$RAIZ/$arquivo" 2>/dev/null || true)
done <<< "$ALVOS"

printf 'medido: %s invocação(ões) de suíte comportamental em fluxo ou script versionado, %s violação(ões).\n' \
  "$INVOCACOES" "${#VIOLACOES[@]}"

if [ "${#VIOLACOES[@]}" -gt 0 ]; then
  printf '✗ e2e uma subida:\n' >&2
  printf '  %s\n' "${VIOLACOES[@]}" >&2
  printf '\n  A suíte sobe a aplicação uma vez e mede tudo; cada critério é respondido\n' >&2
  printf '  lendo o relatório com `bash scripts/e2e/relatorio.sh criterio "<título>"`.\n' >&2
  exit 1
fi

printf '✓ e2e uma subida: a suíte roda inteira numa subida, e o relatório responde por cada critério.\n'
