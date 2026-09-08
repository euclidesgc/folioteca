#!/usr/bin/env bash
# Prova que `scripts/harness/state.sh` ancora na raiz do repositório mesmo com o
# diretório corrente em outro lugar — e, no mesmo cenário, que a chamada crua ao
# `state.py` RECUSA em vez de escolher uma raiz sozinha. As duas metades são
# necessárias: sem a primeira o wrapper poderia não ancorar em nada, e sem a
# segunda o teste passaria mesmo que a chamada crua voltasse a gravar em
# silêncio no repositório errado.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a
# variável vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"

# Caminho físico: `git rev-parse --show-toplevel` resolve link simbólico, e um
# TMPDIR ligado por link faria a comparação falhar por grafia, não por defeito.
tmp="$(cd "${TMPDIR:-/tmp}" && pwd -P)/state-wrapper-test-$$"
projeto="$tmp/projeto"
plugin="$tmp/plugin"
falhas=0

mkdir -p "$projeto/scripts/harness" "$projeto/product" "$projeto/.harness/runtime"
cp "$raiz/scripts/harness/state.sh" "$projeto/scripts/harness/state.sh"
printf '{"schema": 1, "active_item": null, "items": {}}\n' > "$projeto/product/state.json"
git -C "$projeto" init --quiet

# O intruso é o clone temporário dos critérios de aceite: outro diretório, com
# um product/state.json próprio, esperando para receber a gravação errada.
for intruso in comum clone; do
  mkdir -p "$tmp/$intruso/product"
  printf '{"schema": 1, "active_item": null, "items": {}}\n' > "$tmp/$intruso/product/state.json"
done
git -C "$tmp/clone" init --quiet

mkdir -p "$plugin/scripts/state"
alvo="$plugin/scripts/state/state.py"
original="${CLAUDE_PLUGIN_ROOT:-}/scripts/state/state.py"
if [ -f "$original" ]; then
  cp "$original" "$alvo"
  medido="state.py real do plugin"
else
  # O plugin não existe na máquina do CI. O duplo copia literalmente a resolução
  # de raiz do original — se ela divergir, este teste deixa de falar dele.
  cat > "$alvo" <<'DUPLO'
#!/usr/bin/env python3
"""Duplo do state.py: só a decisão de onde gravar, copiada do original."""
import argparse
import json
import os
import subprocess


def git_toplevel():
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if out.returncode == 0 and out.stdout.strip():
            return out.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    return None


def resolve_root(explicit=None):
    """Recusa quando há duas respostas, em vez de escolher uma."""
    if explicit:
        return explicit
    corrente = git_toplevel()
    sessao = os.environ.get("HARNESS_PROJECT_ROOT")
    if sessao and corrente and os.path.realpath(sessao) != os.path.realpath(corrente):
        raise SystemExit(
            json.dumps(
                {
                    "erro": f"raiz ambígua: a sessão abriu em {sessao} e o diretório "
                    f"corrente pertence a {corrente}."
                },
                ensure_ascii=False,
            )
        )
    return corrente or sessao or os.getcwd()


def state_path(root):
    return os.path.join(root, "product", "state.json")


parser = argparse.ArgumentParser()
parser.add_argument("--root", default=None)
sub = parser.add_subparsers(dest="command", required=True)
novo = sub.add_parser("item-new")
novo.add_argument("--item", required=True)
novo.add_argument("--title", required=True)
args = parser.parse_args()

path = state_path(resolve_root(args.root))
os.makedirs(os.path.dirname(path), exist_ok=True)
if os.path.isfile(path):
    with open(path, encoding="utf-8") as handle:
        data = json.load(handle)
else:
    data = {"schema": 1, "active_item": None, "items": {}}
data["items"][args.item] = {"title": args.title}
data["active_item"] = args.item
with open(path, "w", encoding="utf-8") as handle:
    json.dump(data, handle, indent=2, ensure_ascii=False)
    handle.write("\n")
print(json.dumps({"created": args.item}, ensure_ascii=False))
DUPLO
  medido="duplo do state.py (plugin indisponível)"
fi

wrapper="$projeto/scripts/harness/state.sh"
estado="$projeto/product/state.json"

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

printf 'medindo com o %s\nsandbox em %s\n\n' "$medido" "$tmp"

caso "o wrapper RECUSA sem CLAUDE_PLUGIN_ROOT e sem plugin-root.json" 1 \
  "cd '$tmp/comum' && env -u CLAUDE_PLUGIN_ROOT bash '$wrapper' item-new --item T-NAO --title Zero"

caso "o wrapper RECUSA quando o state.py não está no caminho resolvido" 1 \
  "mkdir -p '$tmp/plugin-vazio' && cd '$tmp/comum' &&
   CLAUDE_PLUGIN_ROOT='$tmp/plugin-vazio' bash '$wrapper' item-new --item T-NAO --title Um"

caso "o wrapper RECUSA fora de repositório git" 1 \
  "mkdir -p '$tmp/sem-git/scripts/harness' && cp '$wrapper' '$tmp/sem-git/scripts/harness/state.sh' &&
   cd '$tmp/comum' && CLAUDE_PLUGIN_ROOT='$plugin' bash '$tmp/sem-git/scripts/harness/state.sh' item-new --item T-NAO --title Dois"

caso "o wrapper grava na raiz com o cwd em diretório temporário comum" 0 \
  "cd '$tmp/comum' && CLAUDE_PLUGIN_ROOT='$plugin' bash '$wrapper' item-new --item T-COMUM --title Tres &&
   grep -q T-COMUM '$estado' && ! grep -q T-COMUM '$tmp/comum/product/state.json'"

# A ocorrência real: o critério de aceite manda medir num clone, o clone também
# responde a `git rev-parse`, e a raiz que ele devolve não é a do trabalho.
caso "o wrapper grava na raiz com o cwd dentro de um clone temporário" 0 \
  "cd '$tmp/clone' && CLAUDE_PLUGIN_ROOT='$plugin' bash '$wrapper' item-new --item T-CLONE --title Quatro &&
   grep -q T-CLONE '$estado' && ! grep -q T-CLONE '$tmp/clone/product/state.json'"

# A chamada crua não escolhe: quando a raiz da sessão e a do diretório corrente
# discordam, ela recusa dizendo as duas, e não grava em nenhuma das duas. Antes
# ela gravava no clone com saída de sucesso — o clone também responde a
# `git rev-parse`, e os critérios de aceite deste harness MANDAM medir em clone.
#
# `HARNESS_PROJECT_ROOT` é DECLARADO aqui, e não herdado. Herdá-lo faz o caso
# medir a máquina de quem o roda: na sessão de trabalho a variável existe e a
# ambiguidade aparece sozinha; num runner limpo ela não existe, não há duas
# respostas, e o caso passaria a medir outra coisa — foi assim que ele ficou
# verde nesta máquina e vermelho no CI, na primeira execução. A ambiguidade é
# construída pelo caso, para existir em qualquer máquina.
#
# Mede as três coisas, porque recusar e mesmo assim ter escrito seria o mesmo
# defeito com uma mensagem por cima.
caso "a chamada crua RECUSA a raiz ambígua, e não grava em nenhuma das duas" 0 \
  "cd '$tmp/clone' &&
   saida=\$(HARNESS_PROJECT_ROOT='$projeto' python3 '$alvo' item-new --item T-CRU --title Cinco 2>&1); rc=\$?;
   [ \"\$rc\" -ne 0 ] &&
   printf '%s' \"\$saida\" | grep -q 'raiz ambígua' &&
   ! grep -q T-CRU '$tmp/clone/product/state.json' &&
   ! grep -q T-CRU '$estado'"

caso "o wrapper anuncia em stderr a raiz que ancorou" 0 \
  "cd '$tmp/comum' && CLAUDE_PLUGIN_ROOT='$plugin' bash '$wrapper' item-new --item T-ECO --title Seis 2>&1 >/dev/null |
   grep -q 'ancorado em $projeto'"

caso "o wrapper aceita plugin-root.json como reserva" 0 \
  "printf '{\"plugin_root\": \"$plugin\"}' > '$projeto/.harness/runtime/plugin-root.json' &&
   cd '$tmp/comum' && env -u CLAUDE_PLUGIN_ROOT bash '$wrapper' item-new --item T-RESERVA --title Sete &&
   grep -q T-RESERVA '$estado'"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ state.sh: a âncora morde, e a chamada crua recusa a raiz que não é dela.\n'
else
  printf '\n✗ %s caso(s) não se comportaram como deveriam.\n' "$falhas" >&2
  exit 1
fi
