#!/usr/bin/env bash
# Instala no PATH a versão de pnpm que o `packageManager` da raiz declara.
#
# POR QUE A FORMA É PENEIRADA ANTES DE O VALOR VIRAR COMANDO
#
# A imagem do runner traz npm e Yarn, nunca pnpm, e os jobs de portões precisam
# dele para o portão da quarentena interrogar. O valor vem do `package.json` do
# pull request que esses mesmos jobs estão prestes a julgar, e `npm install`
# aceita muito mais que `nome@versão`: tarball por URL, atalho de repositório,
# caminho local. Sem a peneira, quem abre o PR escolhe o que roda no runner.
#
# `--ignore-scripts` fecha a outra metade: `preinstall` e `postinstall` do
# pacote instalado rodariam como o usuário do runner **antes** do passo que
# cobra os portões, e bastaria plantar um `pnpm`, um `git` ou um `grep` no
# início do PATH para o portão passar a dizer o que o PR quiser.
set -uo pipefail

RAIZ_DO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"

exige_caminho package.json "o campo packageManager da raiz"
exige_comando npm
exige_comando node

RAIZ="$(medir_raiz)"

declarado="$(cd "$RAIZ" && node -p 'require("./package.json").packageManager || ""' 2>/dev/null)" \
  || _reprova "não foi possível ler o campo packageManager de package.json"
declarado="$(printf '%s' "$declarado" | tr -d '[:space:]')"

[ -n "$declarado" ] || _reprova "package.json não declara packageManager — sem ele não há versão para instalar"
[[ "$declarado" =~ ^pnpm@[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || _reprova "o packageManager declarado não tem a forma 'pnpm@X.Y.Z': '$declarado'"

versao="${declarado#pnpm@}"
echo "instalando $declarado, sem scripts de ciclo de vida"

# O DESTINO É PRIVADO DO JOB, NÃO O PREFIXO GLOBAL DO HOME
#
# `npm install --global` sem `--prefix` escreve no prefixo global do usuário —
# que, nos runners desta casa, é o MESMO `$HOME` para os quatro processos na
# mesma máquina (ver scripts/gates/pnpm_isolado.sh, que documenta a mesma
# corrida para `pnpm/action-setup`). Dois jobs de portões em workflows
# distintos, no mesmo runner, instalavam e apagavam os mesmos arquivos de
# `node_modules/pnpm` ao mesmo tempo; o segundo `pnpm --version` respondia
# vazio, com a causa engolida pelo `2>/dev/null` da conferência — vermelho
# intermitente, sem relação com o diff, medido em 13/09/2026. `RUNNER_TEMP`
# é próprio de cada job, e o runner o limpa sozinho.
destino="${RUNNER_TEMP:-$(mktemp -d)}/pnpm-instalado"
npm install --global --ignore-scripts --prefix "$destino" "$declarado" >/dev/null \
  || _reprova "a instalação de $declarado falhou"

export PATH="$destino/bin:$PATH"
# O passo que interroga o pnpm é outro processo, noutro step — `GITHUB_PATH`
# é o canal que o Actions dá para atravessar essa fronteira. Fora do Actions,
# quem chamou este script herda o `export` acima e só.
[ -z "${GITHUB_PATH:-}" ] || printf '%s\n' "$destino/bin" >>"$GITHUB_PATH"

exige_comando pnpm
erro="$(mktemp)"
if ! instalada="$(pnpm --version 2>"$erro")"; then
  _reprova "'pnpm --version' falhou depois da instalação (binário em $(command -v pnpm)): $(cat "$erro")"
fi
instalada="$(printf '%s' "$instalada" | tr -d '[:space:]')"
[ "$instalada" = "$versao" ] \
  || _reprova "o pnpm que respondeu no PATH é $instalada (em $(command -v pnpm)), e o declarado é $versao — o binário que responde não é o que foi instalado"

echo "instalado: pnpm $instalada, igual ao packageManager da raiz"
