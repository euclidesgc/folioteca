#!/usr/bin/env bash
# Nenhum contêiner de serviço prende porta escrita no hospedeiro.
#
# POR QUE ESTE PORTÃO EXISTE
# Os runners desta casa são quatro processos na MESMA máquina. Um contêiner de
# serviço declarado como `ports: ["5432:5432"]` pede um endereço do hospedeiro
# que é único: dois jobs simultâneos — dois pull requests da mesma pilha em voo,
# que é o normal aqui — pedem o mesmo, e o segundo morre com
#
#   Bind for 0.0.0.0:5432 failed: port is already allocated
#   Docker start fail with exit code 1
#
# antes de qualquer passo. Este caso é pior que o do servidor que um portão
# sobe, porque ali existe `_exige_porta_livre` para recusar em voz alta: aqui o
# Docker recusa antes de o job começar, e o que se lê não tem relação visível
# com concorrência nem com o diff. O sintoma é vermelho intermitente que some ao
# reexecutar sozinho, e o custo é uma pilha inteira parada.
#
# A forma correta é `ports: ["5432/tcp"]`: o Actions publica numa porta livre
# que ele mesmo escolhe e devolve em `job.services.<id>.ports['5432']`. A porta
# do contêiner continua constante — quem varia é a do hospedeiro, que é o
# recurso disputado.
#
# O QUE ESTE PORTÃO MEDE, E O QUE ELE NÃO MEDE
# Ele mede a declaração `ports:` de todo `services:` de todo fluxo, em todos os
# níveis onde ela pode aparecer — no job e na matriz de estratégia. Ele NÃO mede
# a outra metade da classe, que é o servidor de pré-visualização que um portão
# sobe com porta escrita no `vite.config.ts`; essa continua no item
# `064-nenhum-job-do-ci-prende-porta-fixa-na-maquina-compartilhada`, e a
# asserção correspondente entra aqui quando ela fechar. Portão que promete o que
# não mede é a forma de mentira que esta casa cataloga.
#
# POR QUE python3 COM PyYAML, E NÃO grep
# `ports: ["5432:5432"]`, `ports: [5432:5432]` e a forma de lista com hífen são
# o mesmo valor para o GitHub e três textos diferentes para uma expressão
# regular. `scripts/gates/concorrencia.sh` e `scripts/gates/fluxos.sh` já leem
# estes mesmos arquivos com PyYAML, e a comparação por valor interpretado é a
# que não cobra formatação.
set -uo pipefail

aqui="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "$aqui/medir.sh"

RAIZ="$(medir_raiz)"
exige_caminho ".github/workflows" "o diretório de fluxos do GitHub Actions"
DIR="$RAIZ/.github/workflows"
exige_comando python3 "sem ele não há como ler o YAML dos fluxos"
exige_modulo_python yaml "é com o PyYAML que este portão lê o bloco services: dos fluxos"

python3 - "$DIR" <<'PY'
import pathlib, re, sys, yaml

EXIBIDO = ".github/workflows"

# Uma publicação fixa é a que escreve a porta do HOSPEDEIRO. Em `ports:`, isso é
# exatamente a forma com dois pontos: `<hospedeiro>:<contêiner>`, com o
# protocolo opcional no fim. `5432/tcp` e `5432` deixam o hospedeiro a cargo do
# runner, e são as duas formas que este portão aceita.
FIXA = re.compile(r"^\s*\d+\s*:\s*\d+(/(tcp|udp))?\s*$", re.IGNORECASE)

diretorio = pathlib.Path(sys.argv[1])
fluxos = sorted(diretorio.glob("*.yml")) + sorted(diretorio.glob("*.yaml"))

if not fluxos:
    print(f"medido: 0 fluxo(s) em {EXIBIDO}")
    sys.stdout.flush()
    print(f"::error::{EXIBIDO} existe e não contém nenhum .yml nem .yaml — "
          "não havia o que medir.", file=sys.stderr)
    raise SystemExit(1)

docs = {}
for f in fluxos:
    try:
        docs[f.name] = yaml.safe_load(f.read_text()) or {}
    except yaml.YAMLError as erro:
        print(f"::error::{f.name} não é YAML legível ({erro}) — não consegui medir.",
              file=sys.stderr)
        raise SystemExit(1)


def declaracoes_de_porta(valor):
    """Toda lista `ports:` do documento, com o caminho em que ela mora.

    O caminho é dado em prosa curta — `jobs.integracao.services.postgres` — e
    não como índice, porque é ele que a mensagem de erro entrega a quem tem de
    achar a linha.
    """
    achados = []

    def desce(no, caminho):
        if isinstance(no, dict):
            servicos = no.get("services")
            if isinstance(servicos, dict):
                for nome, servico in servicos.items():
                    if not isinstance(servico, dict):
                        continue
                    portas = servico.get("ports")
                    if portas is None:
                        continue
                    if not isinstance(portas, list):
                        portas = [portas]
                    achados.append((f"{caminho}.services.{nome}", portas))
            for chave, filho in no.items():
                if chave == "services":
                    continue
                desce(filho, f"{caminho}.{chave}" if caminho else str(chave))
        elif isinstance(no, list):
            for filho in no:
                desce(filho, caminho)

    desce(valor, "")
    return achados


servicos_medidos = 0
fixas = []
for nome, doc in docs.items():
    if not isinstance(doc, dict):
        continue
    for caminho, portas in declaracoes_de_porta(doc):
        servicos_medidos += 1
        for porta in portas:
            if FIXA.match(str(porta)):
                fixas.append((nome, caminho, str(porta)))

print(f"medido: {len(docs)} fluxo(s) em {EXIBIDO} — "
      f"{servicos_medidos} contêiner(es) de serviço com `ports:` declarado, "
      f"{len(fixas)} publicando porta fixa no hospedeiro")
sys.stdout.flush()

for nome, caminho, porta in fixas:
    contêiner = str(porta).split(":", 1)[1].strip()
    if "/" not in contêiner:
        contêiner = f"{contêiner}/tcp"
    print(f"::error::{nome}: {caminho} publica `{porta}` — porta escrita do "
          "hospedeiro. Dois jobs simultâneos na mesma máquina pedem o mesmo "
          "endereço, e o segundo morre em `port is already allocated` antes de "
          "qualquer passo.", file=sys.stderr)
    print(f"  Troque por `{contêiner}` e leia a porta sorteada em "
          f"`${{{{ job.services.<id>.ports['{contêiner.split('/')[0]}'] }}}}`, "
          "num passo — o contexto `job` não é resolvido no `env:` do job.",
          file=sys.stderr)

raise SystemExit(1 if fixas else 0)
PY
codigo=$?
[ "$codigo" -eq 0 ] && echo "✓ portas de serviço: nenhum contêiner de serviço prende porta escrita no hospedeiro."
exit "$codigo"
