#!/usr/bin/env bash
# Prova que o portão da quarentena distingue as três respostas que
# `pnpm config get` dá com o mesmo código de saída zero: o número certo, o
# `undefined` de quem não configurou, e o número errado de quem baixou a espera.
# Sem este teste, os dois caminhos de reprovação só são exercidos à mão no dia em
# que foram escritos — e um portão que parou de morder tem exatamente a mesma
# cara de um repositório configurado.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a variável
# vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
portao="$raiz/scripts/gates/quarentena.sh"
tmp="${TMPDIR:-/tmp}/quarentena-test-$$"
bash_absoluto="$(command -v bash)"
falhas=0

# A lista de isenções entra em toda fixture: o portão a compara com uma constante
# própria, e uma fixture sem ela mediria a ausência da lista em vez do que o caso
# quer medir.
#
# Ela é DERIVADA da constante do portão, e não escrita à mão. A primeira versão
# embutia `- qs`, que era a isenção em vigor no dia em que o teste foi escrito:
# quando ela saiu — o desfecho normal de toda isenção com prazo —, toda fixture
# passou a divergir da constante, e o caminho feliz reprovou. O caso media a
# política daquele dia, não o portão.
nomes_esperados="$(sed -n 's/^ISENCOES_ESPERADAS=(\(.*\))$/\1/p' "$portao" \
  | tr ' ' '\n' | sed -E 's/^"?([^":]*):?[^"]*"?$/\1/' | grep -v '^$' || true)"
if [ -z "$nomes_esperados" ]; then
  ISENCOES='minimumReleaseAgeExclude: []\n'
else
  ISENCOES="minimumReleaseAgeExclude:\n$(printf '%s\n' "$nomes_esperados" | sed 's/^/  - /' | tr '\n' '@' | sed 's/@/\\n/g')"
fi

monta_fixture() { # monta_fixture <diretório> <corpo do pnpm-workspace.yaml>
  local casa="$1" corpo="$2"
  mkdir -p "$casa"
  printf 'packages:\n  - "apps/*"\n%b%s' "$ISENCOES" "$corpo" > "$casa/pnpm-workspace.yaml"
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

configurada="$tmp/configurada"
monta_fixture "$configurada" 'minimumReleaseAge: 10080
'
caso "espera de sete dias declarada passa" 0 "minimumReleaseAge = 10080" "$configurada"

# A chave com um caractere trocado é o caso que o portão existe para separar:
# `pnpm config get` sai 0 e imprime `undefined`, igualzinho a quem nunca
# configurou nada. Um portão que só verificasse ausência de erro aprovaria os
# dois.
trocada="$tmp/chave-trocada"
monta_fixture "$trocada" 'minimumReleaseAg: 10080
'
caso "chave com um caractere trocado REPROVA" 1 "undefined" "$trocada"
caso "chave trocada nomeia o número esperado" 1 "esperado 10080" "$trocada"

ausente="$tmp/sem-a-chave"
monta_fixture "$ausente" ''
caso "chave ausente REPROVA" 1 "undefined" "$ausente"

# Baixar a espera é a forma que passa despercebida em revisão: o arquivo continua
# declarando a chave, e só o número mudou.
baixada="$tmp/espera-baixada"
monta_fixture "$baixada" 'minimumReleaseAge: 60
'
caso "espera baixada para uma hora REPROVA declarando o valor medido" 1 \
  "minimumReleaseAge = 60" "$baixada"

# `minimumReleaseAgeExclude` desliga a espera pacote a pacote sem tocar no número
# que o portão lê: com as duas chaves declaradas, `pnpm config get
# minimumReleaseAge` continua respondendo 10080. Sem esta cobrança, o portão
# aprovaria um repositório onde a política não vale para nada.
tudo_isento="$tmp/isencao-curinga"
mkdir -p "$tudo_isento"
printf 'packages:\n  - "apps/*"\nminimumReleaseAge: 10080\nminimumReleaseAgeExclude:\n  - qs\n  - "*"\n' \
  > "$tudo_isento/pnpm-workspace.yaml"
caso "isenção curinga REPROVA mesmo com o número intacto" 1 \
  'minimumReleaseAgeExclude = ["qs","*"]' "$tudo_isento"
caso "isenção curinga diz onde a isenção nova deve ser escrita" 1 \
  "com o motivo e o vencimento escritos" "$tudo_isento"

# O QUE ESTES CASOS MEDEM, E O QUE ELES DEIXARAM DE MEDIR
#
# A cobrança da lista e a cobrança do vencimento são comportamento do portão, e
# não dependem de haver isenção em vigor hoje. A primeira versão destes dois
# casos dependia: um exigia que a constante de produção tivesse pelo menos um
# nome, e o outro recuava a data com um `sed` que só casava uma constante não
# vazia. Quando a última isenção saiu — que é o desfecho normal e desejado de
# toda isenção com prazo —, os dois pararam de morder em silêncio: o primeiro
# passou a esperar reprovação de uma coisa correta, e o segundo rodou uma cópia
# idêntica ao original.
#
# Um teste que só funciona enquanto a política tiver um valor específico mede a
# política, não o portão. Os dois passam a INJETAR a constante de que precisam.
portao_com_isencoes() { # portao_com_isencoes <destino> <conteúdo da constante>
  local destino="$1" conteudo="$2" dir
  dir="$(dirname "$destino")"
  mkdir -p "$dir"
  cp "$raiz/scripts/gates/medir.sh" "$dir/medir.sh"
  # A cópia mora numa árvore com a mesma forma da de verdade: o portão resolve o
  # `source` de medir.sh pelo próprio caminho, e uma cópia solta num diretório
  # qualquer morreria antes da primeira asserção — aprovando o caso pelo motivo
  # errado. E a substituição é sobre o ORIGINAL: se a lógica sumir dele, ela some
  # da cópia, e o caso passa a falhar em vez de medir um portão fantasma.
  sed -E "s/^ISENCOES_ESPERADAS=\\(.*\\)\$/ISENCOES_ESPERADAS=($conteudo)/" "$portao" > "$destino"
  grep -qE "^ISENCOES_ESPERADAS=\\($(printf '%s' "$conteudo" | sed 's/[][\\.*^$/]/\\\\&/g')\\)\$" "$destino" || {
    printf '  FALHA a injeção da constante não pegou — o caso mediria o portão de produção\n'
    falhas=$((falhas + 1))
    return 1
  }
}

# A lista ausente reprova quando a constante espera alguma coisa. Sem a injeção,
# este caso passava a exigir reprovação de um repositório correto assim que a
# última isenção saísse.
portao_espera_uma="$tmp/espera-uma/scripts/gates/quarentena.sh"
if portao_com_isencoes "$portao_espera_uma" '"qs:2099-01-01"'; then
  sem_isencao="$tmp/sem-a-lista"
  mkdir -p "$sem_isencao"
  printf 'packages:\n  - "apps/*"\nminimumReleaseAge: 10080\n' > "$sem_isencao/pnpm-workspace.yaml"
  saida_sem="$(env GITHUB_WORKSPACE="$sem_isencao" "$bash_absoluto" "$portao_espera_uma" 2>&1)"
  codigo_sem=$?
  if [ "$codigo_sem" -eq 0 ]; then
    printf '  FALHA lista ausente REPROVA quando a constante espera uma — o portão aprovou\n'
    falhas=$((falhas + 1))
  elif ! printf '%s' "$saida_sem" | grep -qF "a lista de isenções da quarentena mudou"; then
    printf '  FALHA lista ausente REPROVA — a saída não diz que a lista divergiu\n'
    falhas=$((falhas + 1))
  else
    printf '  ok    lista de isenções ausente REPROVA quando a constante espera uma\n'
  fi
fi

# O vencimento só vale se alguém o cobrar. A data recuada entra por injeção, e
# não por porta de ambiente no portão de produção — que seria a forma de desligar
# a cobrança sem aparecer em revisão.
portao_vencido="$tmp/copia/scripts/gates/quarentena.sh"
if portao_com_isencoes "$portao_vencido" '"qs:2020-01-01"'; then
  # A fixture precisa casar a constante INJETADA, não a de produção: o portão
  # compara a lista antes de olhar a data, e uma divergência de lista o faria
  # reprovar pelo motivo errado — aprovando este caso sem nunca chegar ao
  # vencimento.
  vencida="$tmp/isencao-vencida"
  mkdir -p "$vencida"
  printf 'packages:\n  - "apps/*"\nminimumReleaseAgeExclude:\n  - qs\nminimumReleaseAge: 10080\n' \
    > "$vencida/pnpm-workspace.yaml"
  saida_vencida="$(env GITHUB_WORKSPACE="$vencida" "$bash_absoluto" "$portao_vencido" 2>&1)"
  codigo_vencida=$?
  if [ "$codigo_vencida" -eq 0 ]; then
    printf '  FALHA isenção vencida REPROVA — o portão aprovou com a data no passado\n'
    falhas=$((falhas + 1))
  elif ! printf '%s' "$saida_vencida" | grep -qF "isenção vencida da quarentena"; then
    printf '  FALHA isenção vencida REPROVA — a saída não nomeia o vencimento\n'
    falhas=$((falhas + 1))
  else
    printf '  ok    isenção vencida REPROVA em vez de virar permanente\n'
  fi
fi

# `pnpm config get` funde a configuração de quem executa com a do repositório: um
# valor global deixaria a leitura verde com o arquivo versionado quebrado, e o
# portão estaria medindo a máquina em vez da política. O `.npmrc` da fixture
# reproduz isso — a leitura devolve 10080 sem a chave estar no workspace.
so_na_maquina="$tmp/valor-so-na-maquina"
mkdir -p "$so_na_maquina"
printf 'packages:\n  - "apps/*"\nminimumReleaseAgeExclude:\n  - qs\n' > "$so_na_maquina/pnpm-workspace.yaml"
printf 'minimum-release-age=10080\n' > "$so_na_maquina/.npmrc"
caso "valor que não vem do arquivo versionado REPROVA" 1 \
  "pnpm-workspace.yaml não declara" "$so_na_maquina"

sem_arquivo="$tmp/sem-workspace"
mkdir -p "$sem_arquivo"
caso "pnpm-workspace.yaml ausente REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$sem_arquivo"

# Um PATH sem pnpm, e não um PATH vazio: sem `dirname` o script morre antes de
# chegar à asserção, e um erro de shell aprovaria este caso pelo motivo errado —
# o teste mediria a ausência do shell, não a do pnpm.
sem_pnpm="$tmp/path-sem-pnpm"
mkdir -p "$sem_pnpm"
for essencial in dirname git tr printf cat; do
  caminho_do_essencial="$(command -v "$essencial")" || continue
  ln -sf "$caminho_do_essencial" "$sem_pnpm/$essencial"
done
caso "pnpm fora do PATH REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$configurada" "$sem_pnpm"
caso "pnpm fora do PATH nomeia a ferramenta que falta" 1 "pnpm" "$configurada" "$sem_pnpm"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ quarentena.sh: separa o número certo do undefined e do número errado.\n'
else
  printf '\n✗ %s caso(s) do portão da quarentena não se comportaram como deviam.\n' "$falhas" >&2
  exit 1
fi
