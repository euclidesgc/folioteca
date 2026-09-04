#!/usr/bin/env bash
# O CI não roda em PR rascunho, e sai do rascunho é o que o dispara.
#
# POR QUE ESTE PORTÃO EXISTE
# O desenho é: o PR nasce rascunho, a iteração acontece na máquina de quem
# trabalha, e o runner remoto é chamado uma vez — quando o trabalho fica pronto
# para revisão. Ele vale nada se um job novo esquecer a guarda: basta um para
# que todo push volte a acender o runner, e ninguém percebe, porque o sintoma é
# a conta no fim do mês.
#
# Duas asserções, e a segunda é a que se esquece:
#   1. todo job de fluxo com `pull_request` tem a guarda de rascunho;
#   2. todo fluxo com `pull_request` declara `ready_for_review` nos `types`.
#
# Sem a segunda, sair do rascunho não dispara evento nenhum e o PR fica pronto e
# sem CI para sempre — que é trocar "roda demais" por "não roda nunca".
#
# `!= true` e não `== false`: em evento de `push` não existe `pull_request`, o
# campo vem nulo, e nulo não é rascunho.
set -uo pipefail

aqui="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "$aqui/medir.sh"

RAIZ="$(medir_raiz)"
exige_caminho ".github/workflows" "o diretório de fluxos do GitHub Actions"
DIR="$RAIZ/.github/workflows"
exige_comando python3 "sem ele não há como ler o YAML dos fluxos"

python3 - "$DIR" <<'PY'
import pathlib, sys, yaml

diretorio = pathlib.Path(sys.argv[1])
fluxos = sorted(diretorio.glob("*.yml")) + sorted(diretorio.glob("*.yaml"))
if not fluxos:
    print("::error::nenhum fluxo em .github/workflows — não há o que medir.", file=sys.stderr)
    raise SystemExit(1)

sem_guarda, sem_ready, medidos = [], [], 0
for f in fluxos:
    try:
        doc = yaml.safe_load(f.read_text()) or {}
    except yaml.YAMLError as erro:
        print(f"::error::{f.name} não é YAML legível ({erro}) — não consegui medir.", file=sys.stderr)
        raise SystemExit(1)

    # `on:` vira booleano True no YAML 1.1, que é como o PyYAML o lê.
    gatilhos = doc.get("on", doc.get(True)) or {}
    if not isinstance(gatilhos, dict) or "pull_request" not in gatilhos:
        continue

    medidos += 1
    pr = gatilhos.get("pull_request") or {}
    tipos = (pr.get("types") if isinstance(pr, dict) else None) or []
    if "ready_for_review" not in tipos:
        sem_ready.append(f.name)

    for nome, job in (doc.get("jobs") or {}).items():
        if "github.event.pull_request.draft" not in str((job or {}).get("if", "")):
            sem_guarda.append(f"{f.name}:{nome}")

print(f"medido: {medidos} fluxo(s) com gatilho de pull_request, "
      f"{len(sem_guarda)} job(s) sem a guarda de rascunho.")

if sem_guarda:
    print("::error::job sem a guarda de rascunho — ele roda em PR rascunho e "
          "acende o runner a cada push: " + ", ".join(sem_guarda), file=sys.stderr)
    print("Acrescente `if: github.event.pull_request.draft != true` ao job.", file=sys.stderr)
if sem_ready:
    print("::error::fluxo sem `ready_for_review` nos types: " + ", ".join(sem_ready),
          file=sys.stderr)
    print("Sem ele, sair do rascunho não dispara nada e o PR fica pronto e sem CI.",
          file=sys.stderr)
raise SystemExit(1 if (sem_guarda or sem_ready) else 0)
PY
codigo=$?
[ "$codigo" -eq 0 ] && echo "✓ rascunho: nenhum job roda em PR rascunho, e sair do rascunho dispara o CI."
exit "$codigo"
