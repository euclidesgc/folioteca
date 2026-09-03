#!/usr/bin/env bash
# Prova que o portão das ações do CI reprova a tag móvel, reprova o SHA sem
# versão legível ao lado e — o caso que importa — reprova quando não há fluxo
# para medir. Sem o último, o portão imprime `0 referências` e aprova no dia em
# que o diretório for renomeado, que é a primeira armadilha da tabela: um `grep`
# vazio responde igual para "está tudo fixado" e para "não consegui procurar".
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a variável
# vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
portao="$raiz/scripts/gates/acoes_em_sha.sh"
tmp="${TMPDIR:-/tmp}/acoes-em-sha-test-$$"
bash_absoluto="$(command -v bash)"
falhas=0

SHA_DE_MENTIRA="11d5960a326750d5838078e36cf38b85af677262"

# Toda fixture nasce com o piso de referências fixadas, porque o portão afirma a
# contagem além de imprimi-la: uma fixture com duas linhas mediria o piso em vez
# do que o caso quer medir. As linhas do caso vêm depois dessas.
PISO=27

monta_fixture() { # monta_fixture <diretório> <linhas de uses: do caso>
  local casa="$1" linhas="$2" i
  mkdir -p "$casa/.github/workflows"
  {
    printf 'name: Fixture\non:\n  push:\njobs:\n  medir:\n    runs-on: ubuntu-latest\n    steps:\n'
    for ((i = 0; i < PISO; i++)); do
      printf '      - uses: actions/checkout@%s # v4.4.0\n' "$SHA_DE_MENTIRA"
    done
    printf '%s' "$linhas"
  } > "$casa/.github/workflows/fixture.yml"
}

caso() { # caso <nome> <esperado 0|1> <trecho na saída> <diretório da fixture>
  local nome="$1" esperado="$2" trecho="$3" casa="$4" saida obtido
  saida="$(env GITHUB_WORKSPACE="$casa" "$bash_absoluto" "$portao" 2>&1)"
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

fixada="$tmp/fixada"
monta_fixture "$fixada" ""
caso "tudo fixado passa" 0 "✓ ações do CI" "$fixada"
caso "declara quantas referências mediu, e contra qual piso" 0 \
  "medido: 27 referência(s) 'uses:' em 1 fluxo(s) de .github/workflows (piso 27)" "$fixada"

movel="$tmp/tag-movel"
monta_fixture "$movel" "      - uses: actions/checkout@v4
"
caso "tag móvel REPROVA nomeando o arquivo e a linha" 1 \
  ".github/workflows/fixture.yml:35" "$movel"
caso "tag móvel diz o que esperava no lugar" 1 "sha de 40 hexadecimais" "$movel"

# SHA sozinho não diz o que está fixado, e é o comentário que o robô de
# atualização lê para saber de onde está saindo. Sem esta cobrança, o pino vira
# arqueologia na primeira vez que alguém precisar subir a versão.
sem_versao="$tmp/sem-versao-legivel"
monta_fixture "$sem_versao" "      - uses: actions/checkout@$SHA_DE_MENTIRA
"
caso "SHA sem versão legível REPROVA" 1 "SHA sem versão legível ao lado" "$sem_versao"

# Versão abreviada é o meio-termo que parece suficiente e não é: `# v4` volta a
# ser a tag móvel escrita em prosa, e não diz qual patch está pinada.
versao_abreviada="$tmp/versao-abreviada"
monta_fixture "$versao_abreviada" "      - uses: actions/checkout@$SHA_DE_MENTIRA # v4
"
caso "versão abreviada ao lado do SHA REPROVA" 1 "esperava '# vX.Y.Z'" "$versao_abreviada"

# A palavra num comentário conta como referência, e tem de contar: RF-20.1 e
# RF-20.2 são `grep` cru sobre a linha, e um portão mais esperto que o critério
# aprovaria o que o critério reprova. O que se cobra aqui é a frase, para quem
# leu a reprovação não sair procurando ação que não existe.
em_comentario="$tmp/palavra-em-comentario"
monta_fixture "$em_comentario" "      # cuidado ao mexer nas linhas uses: deste job
      - uses: actions/checkout@$SHA_DE_MENTIRA # v4.4.0
"
caso "a palavra num comentário REPROVA dizendo que é comentário" 1 \
  "aparece num comentário e conta como referência" "$em_comentario"

# A outra metade da mesma armadilha: `"uses":` e `uses :` são a mesma chave para
# o interpretador do GitHub, e nenhuma das duas contém a cadeia que o `grep`
# procura. Sem afirmar a contagem contra o piso, a referência reescrita assim
# some da medição, volta a ser tag móvel e o portão anuncia `0 referência(s)`
# numa linha verde.
reescrita="$tmp/forma-que-escapa"
monta_fixture "$reescrita" ""
sed -i '0,/^      - uses: /s//      - "uses": /' "$reescrita/.github/workflows/fixture.yml"
caso "referência reescrita como \"uses\": REPROVA por cair abaixo do piso" 1 \
  "contei 26 referência(s) e o piso é 27" "$reescrita"
caso "queda abaixo do piso reprova por medição, não por resultado" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$reescrita"

# O caso que o portão existe para pegar: sem fluxo nenhum, todo `grep -v` sai
# vazio e toda referência está trivialmente fixada.
vazio="$tmp/diretorio-vazio"
mkdir -p "$vazio/.github/workflows"
caso "diretório sem fluxo REPROVA em vez de aprovar 0 referências" 1 \
  "não encontrou fluxo para medir" "$vazio"
caso "diretório sem fluxo reprova por medição, não por resultado" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$vazio"

ausente="$tmp/sem-o-diretorio"
mkdir -p "$ausente"
caso "diretório ausente REPROVA nomeando o caminho" 1 ".github/workflows" "$ausente"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ acoes_em_sha.sh: reprova a tag móvel, o SHA mudo e o diretório sem fluxo.\n'
else
  printf '\n✗ %s caso(s) do portão das ações não se comportaram como deviam.\n' "$falhas" >&2
  exit 1
fi
