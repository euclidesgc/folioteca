#!/usr/bin/env bash
# A concorrência declarada: todo fluxo de gatilho mata o run que o push seguinte
# tornou obsoleto, e nenhuma suíte chamada declara nada.
#
# POR QUE ESTE PORTÃO EXISTE
# O bloco `concurrency` de um fluxo de gatilho é o que faz o push seguinte matar
# o run anterior. Sem ele, dois pushes em sequência pagam dois runs e o primeiro
# só termina para ser jogado fora. Um sexto fluxo de gatilho nasce sem os três
# campos e ninguém nota: o sintoma é a conta no fim do mês, longe da causa.
#
# A cobrança é DIRECIONAL, e é aí que mora o defeito que este portão existe para
# impedir. Suíte chamada por `workflow_call` não produz run próprio; chamador e
# chamado no mesmo grupo é a forma documentada de produzir impasse, com o job do
# pai esperando o filho que está enfileirado atrás do pai. Por isso são duas
# populações e duas asserções opostas:
#
#   1. todo fluxo de gatilho declara a forma esperada;
#   2. nenhuma suíte chamada declara `concurrency`.
#
# Um portão que só contasse quantos arquivos declaram aprovaria a declaração
# posta no arquivo errado — que é exatamente o impasse.
#
# POR QUE A FORMA ESPERADA É CONSTANTE AQUI, E NÃO LIDA DO ARQUIVO MEDIDO
# No padrão de `ISENCOES_ESPERADAS` de `scripts/gates/quarentena.sh`: ler o
# esperado do arquivo sob medição faria qualquer valor casar consigo mesmo. A
# constante é um segundo lugar de propósito, e é nele que a decisão aparece para
# quem revisa.
#
# A comparação é por valor interpretado, e não por texto: recuo e aspas não
# mudam o que o GitHub executa, e reprovar por eles seria o portão cobrando
# formatação. A exatidão caractere por caractere da declaração é cobrada pelo
# critério estrutural que mede os cinco arquivos.
#
# POR QUE python3 COM PyYAML, E NÃO yq
# `yq` está ausente da máquina de desenvolvimento, e trazer binário de terceiro
# para conferir três linhas de configuração custaria mais que o problema.
# `scripts/gates/fluxos.sh` e `scripts/gates/pnpm_isolado.sh` já leem estes
# mesmos arquivos com `python3` e PyYAML. A sondagem separada do módulo existe
# porque `exige_comando python3` cobre o binário e não cobre o `import`: sem
# guarda, `import yaml` termina em traceback, que reprova sem dizer o que faltou.
set -uo pipefail

aqui="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
. "$aqui/medir.sh"

RAIZ="$(medir_raiz)"
exige_caminho ".github/workflows" "o diretório de fluxos do GitHub Actions"
DIR="$RAIZ/.github/workflows"
exige_comando python3 "sem ele não há como ler o YAML dos fluxos"

# A segunda ponta da ferramenta. `exige_comando` acima provou o interpretador;
# esta linha prova o módulo, antes de classificar arquivo nenhum.
python3 -c 'import yaml' 2>/dev/null \
  || _reprova "o módulo PyYAML não responde a 'import yaml' no python3 do PATH — é com ele que este portão lê a chave on: e o bloco concurrency dos fluxos"

python3 - "$DIR" <<'PY'
import pathlib, sys, yaml

# A forma esperada, literal, num segundo lugar de propósito.
ESPERADO = {
    "group": "${{ github.workflow }}-${{ github.ref }}",
    "cancel-in-progress": "${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}",
}

EXIBIDO = ".github/workflows"

diretorio = pathlib.Path(sys.argv[1])
fluxos = sorted(diretorio.glob("*.yml")) + sorted(diretorio.glob("*.yaml"))

if not fluxos:
    # A forma curta, sem as seis contagens: sobre zero arquivo elas diriam
    # "0 sem" e pareceriam árvore limpa, que é a resposta de "procurei e não
    # achei" servida no lugar da de "não havia o que procurar".
    print(f"medido: 0 fluxo(s) em {EXIBIDO}")
    sys.stdout.flush()
    print(f"::error::{EXIBIDO} existe e não contém nenhum .yml nem .yaml — "
          "não havia o que medir.", file=sys.stderr)
    raise SystemExit(1)


def como_texto(valor):
    """O que o YAML leu, escrito como ele estava no arquivo.

    `cancel-in-progress: true` chega aqui como booleano do Python, e imprimir
    `True` faria a reprovação falar de um valor que não está escrito em lugar
    nenhum do arquivo que ela manda corrigir.
    """
    if valor is True:
        return "true"
    if valor is False:
        return "false"
    if valor is None:
        return "null"
    return str(valor)


def chaves_de_gatilho(doc):
    # `on:` vira booleano True no YAML 1.1, que é como o PyYAML o lê.
    gatilhos = doc.get("on", doc.get(True))
    if isinstance(gatilhos, dict):
        return [str(k) for k in gatilhos]
    if isinstance(gatilhos, list):
        return [str(k) for k in gatilhos]
    if isinstance(gatilhos, str):
        return [gatilhos]
    return []


docs = {}
for f in fluxos:
    try:
        docs[f.name] = yaml.safe_load(f.read_text()) or {}
    except yaml.YAMLError as erro:
        print(f"::error::{f.name} não é YAML legível ({erro}) — não consegui medir.",
              file=sys.stderr)
        raise SystemExit(1)

gatilho, suite, fora = [], [], []
for nome, doc in docs.items():
    if not isinstance(doc, dict):
        fora.append((nome, []))
        continue
    chaves = chaves_de_gatilho(doc)
    if "push" in chaves or "pull_request" in chaves:
        gatilho.append(nome)
    elif "workflow_call" in chaves:
        suite.append(nome)
    else:
        fora.append((nome, chaves))

sem_bloco, forma_errada, suite_declara = [], [], []
na_forma = 0
for nome in gatilho:
    bloco = (docs[nome] or {}).get("concurrency")
    if bloco is None:
        sem_bloco.append(nome)
        continue
    if not isinstance(bloco, dict):
        forma_errada.append((nome, [("concurrency", como_texto(bloco), "um bloco com group e cancel-in-progress")]))
        continue
    diferencas = []
    for chave, esperado in ESPERADO.items():
        lido = bloco.get(chave)
        if lido != esperado:
            diferencas.append((chave, como_texto(lido), esperado))
    for chave in bloco:
        if chave not in ESPERADO:
            diferencas.append((str(chave), como_texto(bloco[chave]), "nada — a forma esperada tem duas chaves"))
    if diferencas:
        forma_errada.append((nome, diferencas))
    else:
        na_forma += 1

for nome in suite:
    if (docs[nome] or {}).get("concurrency") is not None:
        suite_declara.append(nome)

print(f"medido: {len(docs)} fluxo(s) em {EXIBIDO} — "
      f"{len(gatilho)} de gatilho ({na_forma} com concurrency na forma esperada, "
      f"{len(gatilho) - na_forma} sem) e "
      f"{len(suite)} chamado(s) por workflow_call ({len(suite_declara)} com concurrency)")
sys.stdout.flush()

for nome in sem_bloco:
    print(f"::error::{nome}: fluxo de gatilho sem bloco `concurrency`. Acrescente, "
          "no nível de cima do arquivo:", file=sys.stderr)
    print("concurrency:", file=sys.stderr)
    print(f"  group: {ESPERADO['group']}", file=sys.stderr)
    print(f"  cancel-in-progress: {ESPERADO['cancel-in-progress']}", file=sys.stderr)

for nome, diferencas in forma_errada:
    print(f"::error::{nome}: concurrency fora da forma esperada.", file=sys.stderr)
    for chave, lido, esperado in diferencas:
        print(f"  {chave}: leu `{lido}` — esperava `{esperado}`", file=sys.stderr)

for nome in suite_declara:
    print(f"::error::{nome}: suíte chamada por workflow_call não declara `concurrency` — "
          "essa linha pertence ao fluxo chamador.", file=sys.stderr)
    print("  Chamador e chamado no mesmo grupo é a forma documentada de produzir "
          "impasse: o job do pai espera o filho que está enfileirado atrás do pai. "
          "Mova a declaração para o fluxo de gatilho que chama esta suíte, em vez "
          "de apagá-la dos dois lugares.", file=sys.stderr)

for nome, chaves in fora:
    lidas = ", ".join(chaves) if chaves else "nenhuma chave legível"
    print(f"::error::{nome}: não é fluxo de gatilho nem suíte chamada — a chave "
          f"on: que li declara {lidas}, e nenhuma das duas populações o inclui.",
          file=sys.stderr)
    print("  O total acima é maior que a soma das duas contagens por causa dele. "
          "Somá-lo a uma delas por chute cobraria deste arquivo uma regra que não "
          "é a dele; decidir qual é a regra é de quem escreveu o fluxo.",
          file=sys.stderr)

raise SystemExit(1 if (sem_bloco or forma_errada or suite_declara or fora) else 0)
PY
codigo=$?
[ "$codigo" -eq 0 ] && echo "✓ concorrencia: todo fluxo de gatilho declara a forma esperada, e nenhuma suíte chamada declara."
exit "$codigo"
