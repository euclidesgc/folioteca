#!/usr/bin/env bash
# Instala no PATH a versão de gitleaks fixada em scripts/ci/gitleaks.lock.
#
# A conferência do sha256 acontece antes da extração, e não depois: um pacote de
# procedência não confirmada extraído já escreveu no disco, e o portão que ele
# alimenta roda sobre a árvore inteira do repositório logo depois do checkout —
# que a essa altura já gravou o token da execução. Falhar barato aqui é o que
# impede de falhar caro lá.
set -uo pipefail

RAIZ_DO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"

exige_caminho scripts/ci/gitleaks.lock "a versão e o sha256 do binário de gitleaks"
exige_comando curl
exige_comando sha256sum
exige_comando tar

LOCK="$(medir_raiz)/scripts/ci/gitleaks.lock"
le_do_lock() { awk -F= -v chave="$1" '$1 == chave { print $2 }' "$LOCK"; }

versao="$(le_do_lock versao)"
arquivo="$(le_do_lock arquivo)"
sha256="$(le_do_lock sha256)"

[ -n "$versao" ] || _reprova "scripts/ci/gitleaks.lock não declara 'versao'"
[ -n "$arquivo" ] || _reprova "scripts/ci/gitleaks.lock não declara 'arquivo'"
[ -n "$sha256" ] || _reprova "scripts/ci/gitleaks.lock não declara 'sha256'"

# Os três valores entram numa URL e num caminho de escrita. `curl` normaliza
# `..` no path antes de enviar, então um `versao` com travessia aponta o
# download para outro repositório do GitHub — e o sha256 que o confere sai do
# mesmo arquivo que o atacante teria editado, de modo que o pino não morde. O
# mesmo valor é o nome local do `-o`, e escreveria fora do `mktemp -d` antes da
# conferência. Um diff de lock parece um bump de versão; a forma é o que separa
# um do outro.
[[ "$versao" =~ ^[0-9]+(\.[0-9]+)*$ ]] \
  || _reprova "a 'versao' de scripts/ci/gitleaks.lock não tem forma de versão: '$versao'"
[[ "$arquivo" =~ ^gitleaks_[0-9.]+_linux_x64\.tar\.gz$ ]] \
  || _reprova "o 'arquivo' de scripts/ci/gitleaks.lock não tem o nome de um pacote de release: '$arquivo'"
[[ "$sha256" =~ ^[0-9a-f]{64}$ ]] \
  || _reprova "o 'sha256' de scripts/ci/gitleaks.lock não tem 64 dígitos hexadecimais"

TEMPORARIO="$(mktemp -d)" || _reprova "não foi possível criar o diretório temporário da instalação"
limpa_temporario() { rm -rf -- "$TEMPORARIO"; }
trap limpa_temporario EXIT

url="https://github.com/gitleaks/gitleaks/releases/download/v${versao}/${arquivo}"
echo "baixando gitleaks $versao de $url"
curl -sSL --fail --max-time 120 -o "$TEMPORARIO/$arquivo" "$url" || _reprova "o download de $url falhou"

printf '%s  %s\n' "$sha256" "$TEMPORARIO/$arquivo" > "$TEMPORARIO/soma.sha256"
if ! sha256sum -c "$TEMPORARIO/soma.sha256"; then
  printf '::error::o sha256 do pacote baixado não é o de scripts/ci/gitleaks.lock — nada foi extraído.\n' >&2
  exit 1
fi

tar -xzf "$TEMPORARIO/$arquivo" -C "$TEMPORARIO" gitleaks || _reprova "o pacote $arquivo não contém o binário 'gitleaks'"

destino="${GITLEAKS_BIN_DIR:-$HOME/.local/bin}"
mkdir -p "$destino"
install -m 0755 "$TEMPORARIO/gitleaks" "$destino/gitleaks"

# No runner do GitHub o PATH do passo seguinte vem deste arquivo; fora dele a
# variável não existe e o binário fica onde o PATH de quem desenvolve já olha.
[ -n "${GITHUB_PATH:-}" ] && echo "$destino" >> "$GITHUB_PATH"

echo "instalado: gitleaks $versao em $destino, sha256 conferido contra o lock"
