#!/usr/bin/env bash
# Prova que o portão de segredo reprova quando deve — e, principalmente, quando
# não conseguiu medir. Sem este teste, os três caminhos de reprovação por
# medição impossível só são exercidos à mão uma vez, no dia em que foram
# escritos: o portão continua verde a cada push mesmo depois de a asserção
# parar de morder, porque a árvore limpa e a medição que não aconteceu têm a
# mesma cara.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a
# variável vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
portao="$raiz/scripts/gates/segredo.sh"
tmp="${TMPDIR:-/tmp}/segredo-test-$$"
bash_absoluto="$(command -v bash)"
falhas=0

# Nenhum segredo é escrito literal neste arquivo: ele é rastreado, e o portão
# que ele testa varre os arquivos rastreados. Um token colado aqui faria o
# repositório reprovar no documento que o testa.
segredo_de_mentira() {
  printf 'const token = "ghp_%s";\n' \
    "$(head -c 60 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 36)"
}

monta_fixture() { # monta_fixture <diretório>
  local casa="$1"
  mkdir -p "$casa/apps/web/dist" "$casa/apps/site/.next" "$casa/apps/api/dist"
  cp "$raiz/.gitleaks.toml" "$casa/.gitleaks.toml"
  printf 'console.log("app");\n' > "$casa/apps/web/dist/index.js"
  printf '{"pages":{}}\n' > "$casa/apps/site/.next/build-manifest.json"
  printf 'console.log("api");\n' > "$casa/apps/api/dist/main.js"
  printf '# fixture\n' > "$casa/README.md"
  # Os artefatos ficam fora do índice, como no repositório real: é o que faz o
  # universo rastreado e os três de artefato serem conjuntos distintos, e o que
  # permite plantar segredo num artefato sem que ele apareça também no outro.
  printf 'apps/*/dist\napps/site/.next\n' > "$casa/.gitignore"
  git -C "$casa" init -q
  git -C "$casa" add -A
  git -C "$casa" -c user.email=fixture@exemplo -c user.name=fixture commit -qm inicial
}

caso() { # caso <nome> <esperado 0|1> <trecho na saída> <diretório da fixture> [PATH]
  local nome="$1" esperado="$2" trecho="$3" casa="$4" caminho="${5:-$PATH}" saida obtido
  saida="$(env GITHUB_WORKSPACE="$casa" PATH="$caminho" "$bash_absoluto" "$portao" 2>&1)"
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" != "$esperado" ]; then
    printf '  FALHA %s — esperava saída %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    falhas=$((falhas + 1))
    return
  fi
  if [ -n "$trecho" ] && ! printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  FALHA %s — a saída não contém %s\n' "$nome" "$trecho"
    falhas=$((falhas + 1))
    return
  fi
  printf '  ok    %s\n' "$nome"
}

limpa="$tmp/limpa"
monta_fixture "$limpa"

caso "árvore e artefatos limpos passam" 0 "medido: 1 arquivo(s) no universo apps/api/dist" "$limpa"
caso "declara a versão da ferramenta" 0 "medido com gitleaks" "$limpa"
caso "declara a contagem do universo rastreado" 0 "no universo git ls-files" "$limpa"

# Um PATH sem gitleaks, e não um PATH vazio: sem `dirname` o script morre antes
# de chegar à asserção, e um erro de shell aprovaria este caso pelo motivo
# errado — o teste mediria a ausência do shell, não a do gitleaks.
sem_gitleaks="$tmp/path-sem-gitleaks"
mkdir -p "$sem_gitleaks"
for essencial in dirname git mktemp mkdir cp find sed wc rm stat; do
  caminho_do_essencial="$(command -v "$essencial")" || continue
  ln -sf "$caminho_do_essencial" "$sem_gitleaks/$essencial"
done
caso "gitleaks fora do PATH REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$limpa" "$sem_gitleaks"
caso "gitleaks fora do PATH nomeia a ferramenta que falta" 1 \
  "gitleaks" "$limpa" "$sem_gitleaks"

sem_artefato="$tmp/sem-artefato"
monta_fixture "$sem_artefato"
mv "$sem_artefato/apps/site/.next" "$sem_artefato/apps/site/.next-guardado"
caso "artefato ausente REPROVA nomeando o caminho" 1 "apps/site/.next" "$sem_artefato"
caso "artefato ausente nomeia o comando que o produz" 1 "pnpm --filter site build" "$sem_artefato"

vazio="$tmp/universo-vazio"
monta_fixture "$vazio"
rm -f -- "$vazio/apps/api/dist/main.js"
caso "universo vazio REPROVA nomeando o universo" 1 \
  "o universo apps/api/dist terminou com 0 arquivo varrido" "$vazio"
caso "universo vazio reprova por medição, não por resultado" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$vazio"

no_artefato="$tmp/segredo-no-artefato"
monta_fixture "$no_artefato"
segredo_de_mentira > "$no_artefato/apps/web/dist/vazado.js"
caso "segredo no artefato REPROVA nomeando o caminho na raiz" 1 \
  "apps/web/dist/vazado.js" "$no_artefato"

env_rastreado="$tmp/env-rastreado"
monta_fixture "$env_rastreado"
printf 'PORT=3000\n' > "$env_rastreado/.env"
git -C "$env_rastreado" add -f .env

# O .env desta fixture não carrega valor nenhum de alta entropia. É de
# propósito: o que reprova é o arquivo estar versionado, e um portão que
# dependesse do conteúdo daria veredictos diferentes em cada máquina.
caso "'.env' rastreado REPROVA mesmo sem valor forte dentro" 1 ".env" "$env_rastreado"

variantes="$tmp/variantes-de-ambiente"
monta_fixture "$variantes"
printf 'PORT=3000\n' > "$variantes/.env.production.local"
git -C "$variantes" add -f .env.production.local
caso "'.env.[modo].local' também REPROVA" 1 ".env.production.local" "$variantes"

# A cópia que perde arquivos no meio é a forma mais silenciosa de aprovar sem
# ter lido: o universo sai menor e o portão declara varrido o que ficou para
# trás. Um symlink quebrado rastreado produz esse buraco sem depender de
# permissão de arquivo — que num runner rodando como root não impediria leitura
# nenhuma. A comparação de contagem contra a origem é a segunda rede, para o
# `cp` que sai zero escrevendo menos do que devia; o caminho exercitado aqui é
# o primeiro, o `cp` que falha e diz.
copia_incompleta="$tmp/copia-incompleta"
monta_fixture "$copia_incompleta"
ln -s alvo-que-nao-existe "$copia_incompleta/atalho-quebrado"
git -C "$copia_incompleta" add -f atalho-quebrado
caso "entrada rastreada que não dá para copiar REPROVA" 1 \
  "a cópia de 'atalho-quebrado' falhou" "$copia_incompleta"
caso "cópia incompleta reprova por medição, não por resultado" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$copia_incompleta"

# gitleaks sai 1 tanto por achado quanto por erro de execução. Sem separar os
# dois, uma configuração ilegível vira "segredo encontrado" e quem lê o log
# passa a caçar um segredo que não existe.
config_quebrada="$tmp/config-quebrada"
monta_fixture "$config_quebrada"
printf 'isto não é TOML válido [[[\n' > "$config_quebrada/.gitleaks.toml"
caso "erro de execução do gitleaks REPROVA como medição impossível" 1 \
  "isso é erro de execução, não achado" "$config_quebrada"

# A allowlist embutida do gitleaks pula todo caminho que contenha
# `gitleaks.toml`. Sem o sufixo de varredura, a configuração do portão seria o
# único arquivo rastreado onde um token real passaria despercebido.
ponto_cego="$tmp/ponto-cego"
monta_fixture "$ponto_cego"
segredo_de_mentira >> "$ponto_cego/.gitleaks.toml.token"
cat "$ponto_cego/.gitleaks.toml.token" | sed 's/^/# /' >> "$ponto_cego/.gitleaks.toml"
rm -f -- "$ponto_cego/.gitleaks.toml.token"
git -C "$ponto_cego" add -A
caso "segredo dentro do próprio .gitleaks.toml REPROVA" 1 \
  ".gitleaks.toml" "$ponto_cego"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ segredo.sh: reprova o que acha e reprova o que não conseguiu medir.\n'
else
  printf '\n✗ %s caso(s) do portão de segredo não se comportaram como deviam.\n' "$falhas" >&2
  exit 1
fi
