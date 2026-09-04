#!/usr/bin/env bash
# Prova que o portão de vulnerabilidade separa as três respostas que
# `pnpm audit` dá com o mesmo código de saída 1: achei vulnerabilidade, não
# consegui falar com o registro, e a auditoria de nenhum pacote. Sem este teste,
# os caminhos de reprovação só são exercidos à mão no dia em que foram escritos —
# e um portão que parou de morder tem exatamente a mesma cara de um lockfile
# limpo.
#
# POR QUE O `pnpm` É DE MENTIRA
#
# Não existe dependência vulnerável neste repositório, e instalar `qs@6.15.3` de
# propósito para provar que o portão morde trocaria um risco medido por um risco
# real dentro do PR que instala a medição. O stub à frente do PATH dá acesso a
# todos os casos sem rede e sem dependência vulnerável.
#
# POR QUE O VENCIMENTO É COBRADO NUMA CÓPIA FÍSICA
#
# A alternativa seria uma variável de ambiente no portão de produção que
# desligasse a cobrança — isto é, uma porta para deixar o portão verde sem que
# ninguém veja em revisão. A cópia mora numa árvore com a mesma forma da de
# verdade porque o portão resolve o `source` de `medir.sh` pelo próprio caminho:
# uma cópia solta morreria antes da primeira asserção, aprovando o caso pelo
# motivo errado.
#
# O sandbox fica num caminho previsível e nada é apagado por trap — faxina
# destrutiva em trap é a linha que limpa a árvore errada no dia em que a variável
# vem vazia.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../.." && pwd)"
portao="$raiz/scripts/gates/vulnerabilidade.sh"
fixtures="$raiz/scripts/gates/__tests__/fixtures"
tmp="${TMPDIR:-/tmp}/vulnerabilidade-test-$$"
bash_absoluto="$(command -v bash)"
falhas=0

# `jq` ausente é falha do teste, nomeando `jq`, nunca caso pulado: teste que pula
# não mediu, e não medir nunca aprova.
if ! command -v jq >/dev/null 2>&1; then
  printf '  FALHA o comando jq não está no PATH — o portão o exige, e um caso pulado não é um caso que passou.\n' >&2
  exit 1
fi

monta_stub() { # monta_stub <diretório> <fixture> <código de saída>
  local casa="$1" fixture="$2" codigo="$3"
  mkdir -p "$casa/bin"
  printf "lockfileVersion: '9.0'\n" > "$casa/pnpm-lock.yaml"
  {
    printf '#!/bin/sh\n'
    printf '[ "$1" = "audit" ] || exit 0\n'
    printf ': > "%s/chamou-audit"\n' "$casa"
    printf 'cat "%s/%s"\n' "$fixtures" "$fixture"
    printf 'exit %s\n' "$codigo"
  } > "$casa/bin/pnpm"
  chmod +x "$casa/bin/pnpm"
}

monta_stub_mudo() { # monta_stub_mudo <diretório> — a ferramenta não devolve JSON nenhum
  local casa="$1"
  mkdir -p "$casa/bin"
  printf "lockfileVersion: '9.0'\n" > "$casa/pnpm-lock.yaml"
  {
    printf '#!/bin/sh\n'
    printf '[ "$1" = "audit" ] || exit 0\n'
    printf ': > "%s/chamou-audit"\n' "$casa"
    printf 'echo "TypeError: fetch failed" >&2\n'
    printf 'exit 1\n'
  } > "$casa/bin/pnpm"
  chmod +x "$casa/bin/pnpm"
}

copia_portao() { # copia_portao <diretório> <conteúdo da constante>
  local casa="$1" conteudo="$2"
  mkdir -p "$casa/scripts/gates"
  cp "$raiz/scripts/gates/medir.sh" "$casa/scripts/gates/medir.sh"
  sed "s|^ISENCOES_DECLARADAS=()\$|ISENCOES_DECLARADAS=($conteudo)|" "$portao" \
    > "$casa/scripts/gates/vulnerabilidade.sh"
  printf '%s' "$casa/scripts/gates/vulnerabilidade.sh"
}

caso() { # caso <nome> <esperado 0|1> <trecho na saída> <diretório> [PATH] [portão]
  local nome="$1" esperado="$2" trecho="$3" casa="$4" alvo="${6:-$portao}"
  local caminho="${5:-$casa/bin:$PATH}"
  local saida obtido
  saida="$(env GITHUB_WORKSPACE="$casa" PATH="$caminho" "$bash_absoluto" "$alvo" 2>&1)"
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

caso_sem() { # caso_sem <nome> <esperado 0|1> <trecho ausente> <diretório> [PATH] [portão]
  local nome="$1" esperado="$2" trecho="$3" casa="$4" alvo="${6:-$portao}"
  local caminho="${5:-$casa/bin:$PATH}"
  local saida obtido
  saida="$(env GITHUB_WORKSPACE="$casa" PATH="$caminho" "$bash_absoluto" "$alvo" 2>&1)"
  obtido=$?
  [ "$obtido" -ne 0 ] && obtido=1
  if [ "$obtido" != "$esperado" ]; then
    printf '  FALHA %s — esperava saída %s, obteve %s\n' "$nome" "$esperado" "$obtido"
    falhas=$((falhas + 1))
    return
  fi
  if printf '%s' "$saida" | grep -qF "$trecho"; then
    printf '  FALHA %s — a saída contém %s, e não deveria\n' "$nome" "$trecho"
    falhas=$((falhas + 1))
    return
  fi
  printf '  ok    %s\n' "$nome"
}

marcador_ausente() { # marcador_ausente <nome> <diretório>
  if [ -e "$2/chamou-audit" ]; then
    printf '  FALHA %s — o portão chamou a auditoria antes de reprovar\n' "$1"
    falhas=$((falhas + 1))
    return
  fi
  printf '  ok    %s\n' "$1"
}

limpo="$tmp/limpo"
monta_stub "$limpo" pnpm-audit-limpo.json 0
caso "lockfile sem achado passa dizendo quantos pacotes mediu" 0 \
  "923 pacotes auditados, 0 achados de severidade alta ou crítica, 0 isenções" "$limpo"
caso "lista de isenções vazia é medida em voz alta" 0 \
  "medido: 0 isenção(ões) declarada(s)" "$limpo"

# `pnpm audit` sai 1 aqui, e o portão não lê esse código: o veredicto sai do JSON.
qs="$tmp/qs-alto"
monta_stub "$qs" pnpm-audit-qs-alto.json 1
caso "achado de severidade alta REPROVA" 1 "GHSA-4mjr-xmp4-gh2g" "$qs"
caso "achado alto nomeia o segundo aviso do mesmo pacote" 1 "GHSA-x5fp-wj9c-mxmx" "$qs"
caso "achado alto nomeia o pacote e a versão instalada" 1 "qs@6.15.3" "$qs"
caso "achado alto nomeia a versão que corrige" 1 "corrigido em >=6.16.0" "$qs"
caso "achado alto imprime a contagem das quatro severidades" 1 \
  "critical: 0, high: 2, moderate: 0, low: 0" "$qs"
caso "achado alto diz onde a isenção nominal deve ser escrita" 1 \
  "ISENCOES_DECLARADAS de scripts/gates/vulnerabilidade.sh" "$qs"

# Presença não é ordem: com as duas linhas na saída, um portão que imprimisse a
# contagem depois do `::error::` passaria por um teste que só procura as cadeias.
# A contagem é o que torna a reprovação acionável, e ela vem antes dos achados.
saida_qs="$tmp/qs-alto.saida"
erro_qs="$tmp/qs-alto.erro"
env GITHUB_WORKSPACE="$qs" PATH="$qs/bin:$PATH" "$bash_absoluto" "$portao" > "$saida_qs" 2> "$erro_qs"
linha_contagem="$(grep -n -- 'pacote(s) auditado(s)' "$saida_qs" | head -1 | cut -d: -f1)"
linha_achado="$(grep -n 'achado:' "$saida_qs" | head -1 | cut -d: -f1)"
if [ -z "$linha_contagem" ] || [ -z "$linha_achado" ]; then
  printf '  FALHA a contagem vem antes do primeiro achado — falta uma das duas linhas na saída padrão\n'
  falhas=$((falhas + 1))
elif [ "$linha_contagem" -ge "$linha_achado" ]; then
  printf '  FALHA a contagem vem antes do primeiro achado — contagem na linha %s, achado na linha %s\n' \
    "$linha_contagem" "$linha_achado"
  falhas=$((falhas + 1))
else
  printf '  ok    a contagem vem antes do primeiro achado, na mesma saída padrão\n'
fi
if grep -qF '::error::vulnerabilidade conhecida no lockfile' "$erro_qs"; then
  printf '  ok    a anotação de erro do CI sai na saída de erro\n'
else
  printf '  FALHA a anotação ::error::vulnerabilidade conhecida no lockfile não saiu na saída de erro\n'
  falhas=$((falhas + 1))
fi

# `--audit-level=high` filtra o que o pnpm **imprime**, e `metadata.vulnerabilities`
# continua contando as quatro severidades. É essa assimetria que faz o portão
# contar `moderate` e `low` sem ficar vermelho por elas.
moderado="$tmp/moderado"
monta_stub "$moderado" pnpm-audit-moderado.json 0
caso "achado moderado conta e não reprova" 0 "moderate: 3, low: 5" "$moderado"
caso "achado moderado sai pelo caminho de aprovação" 0 \
  "0 achados de severidade alta ou crítica" "$moderado"

# O piso `high` cobre `critical` junto, e a auditoria é do lockfile inteiro: um
# aviso alcançado só por caminho de desenvolvimento reprova igual.
dev="$tmp/dev"
monta_stub "$dev" pnpm-audit-dev.json 1
caso "achado crítico em dependência de desenvolvimento REPROVA" 1 \
  "pacote-de-desenvolvimento-de-mentira@1.0.0 GHSA-fals-odev-1111 critical" "$dev"
caso "achado crítico conta na severidade certa" 1 \
  "923 pacote(s) auditado(s) — critical: 1" "$dev"

# Os dois caminhos de impossibilidade: a ferramenta que não devolve JSON e o JSON
# que diz ter auditado nenhum pacote. Nenhum dos dois pode dizer `0 achados`.
sem_json="$tmp/sem-json"
monta_stub_mudo "$sem_json"
caso "registro inalcançável REPROVA por não ter medido" 1 "não consegui auditar" "$sem_json"
caso "registro inalcançável usa a fórmula de medição impossível" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$sem_json"
caso_sem "registro inalcançável não imprime contagem de severidade" 1 "critical:" "$sem_json"
caso_sem "registro inalcançável não diz 0 achados" 1 \
  "0 achados de severidade alta ou crítica" "$sem_json"

# Medido contra o registro de verdade: quando ele não responde, `pnpm audit
# --json` devolve um JSON **válido** cujo corpo inteiro é o erro. Ele passa por
# qualquer teste de forma, e `metadata.totalDependencies` some — sem este caso o
# portão reprovaria pelo caminho certo dizendo a razão errada, e mandaria quem lê
# procurar um lockfile vazio que não existe.
erro_rede="$tmp/erro-de-rede"
monta_stub "$erro_rede" pnpm-audit-erro-de-rede.json 1
caso "erro da ferramenta REPROVA por não ter medido" 1 "não consegui auditar" "$erro_rede"
caso "erro da ferramenta é citado em vez de virar lockfile vazio" 1 \
  "The operation was aborted due to timeout" "$erro_rede"
caso_sem "erro da ferramenta não é confundido com auditoria de nenhum pacote" 1 \
  "auditoria de nenhum pacote não é lockfile limpo" "$erro_rede"
caso_sem "erro da ferramenta não imprime contagem de severidade" 1 "critical:" "$erro_rede"

# A mensagem vem de fora — do registro, ou de quem quer que responda por ele — e
# vai para o log do runner. Com quebra de linha preservada, `::stop-commands::`
# no começo de uma linha desliga o processamento de anotações do job inteiro, e
# `::add-mask::` esconde o que o revisor precisava ler. O comando de fluxo só
# vale no início da linha, então é isso que se mede.
erro_injetado="$tmp/erro-com-quebra"
monta_stub "$erro_injetado" pnpm-audit-erro-com-quebra.json 1
saida_injetada="$tmp/erro-com-quebra.saida"
env GITHUB_WORKSPACE="$erro_injetado" PATH="$erro_injetado/bin:$PATH" \
  "$bash_absoluto" "$portao" > "$saida_injetada" 2>&1
if grep -q '^::stop-commands::' "$saida_injetada"; then
  printf '  FALHA a mensagem da ferramenta injetou comando de fluxo no log do runner\n'
  falhas=$((falhas + 1))
else
  printf '  ok    quebra de linha na mensagem da ferramenta não injeta comando de fluxo\n'
fi
caso "mensagem com quebra de linha continua sendo citada" 1 "marcador-plantado" "$erro_injetado"

zero="$tmp/zero-pacotes"
monta_stub "$zero" pnpm-audit-sem-pacote.json 0
caso "auditoria de nenhum pacote REPROVA por não ter medido" 1 "não consegui auditar" "$zero"
caso "auditoria de nenhum pacote usa a fórmula de medição impossível" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$zero"
caso_sem "auditoria de nenhum pacote não imprime contagem de severidade" 1 "critical:" "$zero"
caso_sem "auditoria de nenhum pacote não diz 0 achados" 1 \
  "0 achados de severidade alta ou crítica" "$zero"

# A configuração do pnpm é fundida: `auditConfig.ignoreGhsas` no arquivo do
# repositório e `.npmrc` na máquina de quem executa somam. O portão não lê nem um
# nem outro para isentar — e estes dois casos provam só isso, porque o `pnpm` de
# mentira não lê configuração nenhuma. Quem prova que a isenção pela configuração
# não passa é o bloco do relatório podado, logo abaixo: é lá que mora a defesa, e
# um teste que a cobrasse daqui passaria verde com o portão quebrado.
config="$tmp/config-fundida"
monta_stub "$config" pnpm-audit-qs-alto.json 0
printf 'auditConfig:\n  ignoreGhsas:\n    - GHSA-4mjr-xmp4-gh2g\n    - GHSA-x5fp-wj9c-mxmx\n' \
  > "$config/pnpm-workspace.yaml"
printf 'audit-level=critical\n' > "$config/.npmrc"
caso "portão não lê a isenção do repositório para esconder achado" 1 "GHSA-4mjr-xmp4-gh2g" "$config"
caso "portão não lê o audit-level da máquina para baixar o piso" 1 "GHSA-x5fp-wj9c-mxmx" "$config"

# O que `pnpm audit --json` devolve quando a isenção está na configuração: a
# contagem inteira em `metadata`, e `.advisories` podado. Medido em pnpm 11.25.0.
# Sem o confronto das duas, o portão imprimiria `high: 2` e aprovaria dizendo
# `0 achados` na linha seguinte — e `pnpm audit --ignore` grava essa configuração
# sozinho, então o caminho acidental é mais provável que o deliberado.
podado="$tmp/relatorio-podado"
monta_stub "$podado" pnpm-audit-podado.json 0
caso "aviso podado da lista pela configuração REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$podado"
caso "aviso podado nomeia a divergência entre a contagem e a lista" 1 \
  "diz 2 aviso(s) de severidade alta ou crítica" "$podado"
caso "aviso podado nomeia onde a isenção legítima se declara" 1 \
  "ISENCOES_DECLARADAS" "$podado"
caso_sem "aviso podado não diz 0 achados" 1 "0 achados de severidade alta ou crítica" "$podado"
caso_sem "aviso podado não imprime contagem de severidade" 1 "critical:" "$podado"

# O mesmo confronto pega a troca de formato do relatório: aqui `.advisories` vem
# com tipo inesperado, o filtro de achados morre, e a lista fica vazia com a
# contagem dizendo que há um aviso alto. Antes do confronto isso saía verde.
forma="$tmp/forma-desconhecida"
monta_stub "$forma" pnpm-audit-forma-desconhecida.json 0
caso "relatório de forma desconhecida REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$forma"
caso_sem "relatório de forma desconhecida não diz 0 achados" 1 \
  "0 achados de severidade alta ou crítica" "$forma"

# O registro que responde a auditoria é escolhido pelo `.npmrc` da raiz, que é
# arquivo do PR. Um espelho que devolve nada faria o portão imprimir os 923
# pacotes do lockfile — a contagem é local — e aprovar.
espelho="$tmp/registro-espelhado"
monta_stub "$espelho" pnpm-audit-limpo.json 0
printf 'engine-strict=true\nregistry=https://espelho.exemplo/\n' > "$espelho/.npmrc"
caso "registro redirecionado no .npmrc REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$espelho"
caso "registro redirecionado é contado em voz alta" 1 \
  "medido: 1 registro(s) declarado(s) fora de https://registry.npmjs.org" "$espelho"
marcador_ausente "registro redirecionado reprova antes de chamar a auditoria" "$espelho"

# O `ini` que o npm e o pnpm leem apara o espaço em volta do `=`. Uma peneira que
# só casasse `registry=` seria derrotada por um espaço — e mediria zero dizendo
# que mediu.
com_espaco="$tmp/registro-com-espaco"
monta_stub "$com_espaco" pnpm-audit-limpo.json 0
printf 'registry = https://espelho.exemplo/\n' > "$com_espaco/.npmrc"
caso "espaço em volta do = não esconde o redirecionamento" 1 \
  "aponta o registro para fora" "$com_espaco"

escopado="$tmp/registro-escopado"
monta_stub "$escopado" pnpm-audit-limpo.json 0
printf '@empresa:registry=https://espelho.exemplo/\n' > "$escopado/.npmrc"
caso "registro de escopo redirecionado também REPROVA" 1 \
  "aponta o registro para fora" "$escopado"

# A outra casa: é onde este repositório já guarda `minimumReleaseAge` e
# `overrides`, e é a que a mensagem do confronto nomeia como casa do
# `audit.ignore`. Medir só o `.npmrc` deixaria a porta ao lado aberta.
workspace="$tmp/registro-no-workspace"
monta_stub "$workspace" pnpm-audit-limpo.json 0
printf 'registry: https://espelho.exemplo/\nminimumReleaseAge: 10080\n' > "$workspace/pnpm-workspace.yaml"
caso "registro no pnpm-workspace.yaml também REPROVA" 1 \
  "aponta o registro para fora" "$workspace"
marcador_ausente "registro no pnpm-workspace.yaml reprova antes de auditar" "$workspace"

# Fixar o registro oficial explicitamente é endurecimento, não desvio: o portão
# mede para onde a declaração aponta, não a existência dela.
oficial="$tmp/registro-oficial"
monta_stub "$oficial" pnpm-audit-limpo.json 0
printf 'registry=https://registry.npmjs.org/\n' > "$oficial/.npmrc"
caso "registro oficial declarado à mão não é redirecionamento" 0 \
  "medido: 0 registro(s) declarado(s) fora de" "$oficial"

# O `.npmrc` que não mexe no registro não reprova: o portão mede para onde o
# registro aponta, não a existência do arquivo.
npmrc_inocente="$tmp/npmrc-inocente"
monta_stub "$npmrc_inocente" pnpm-audit-limpo.json 0
printf 'engine-strict=true\n' > "$npmrc_inocente/.npmrc"
caso ".npmrc sem redirecionamento não atrapalha a auditoria" 0 \
  "medido: 0 registro(s) declarado(s) fora de" "$npmrc_inocente"

# O marcador é a única forma de separar "reprovou" de "reprovou depois de
# auditar". Sem ele, as duas têm a mesma cara.
sem_lock="$tmp/sem-lockfile"
monta_stub "$sem_lock" pnpm-audit-limpo.json 0
rm "$sem_lock/pnpm-lock.yaml"
caso "lockfile ausente REPROVA por não ter medido" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$sem_lock"
caso "lockfile ausente nomeia o arquivo que falta" 1 "pnpm-lock.yaml" "$sem_lock"
marcador_ausente "lockfile ausente reprova antes de chamar a auditoria" "$sem_lock"

# Um PATH sem pnpm, e não um PATH vazio: sem `dirname` o script morre antes da
# asserção, e o teste mediria a ausência do shell em vez da do pnpm.
sem_pnpm="$tmp/path-sem-pnpm"
mkdir -p "$sem_pnpm/bin"
for essencial in dirname git tr cat date jq sed; do
  caminho_do_essencial="$(command -v "$essencial")" || continue
  ln -sf "$caminho_do_essencial" "$sem_pnpm/bin/$essencial"
done
printf "lockfileVersion: '9.0'\n" > "$sem_pnpm/pnpm-lock.yaml"
caso "pnpm fora do PATH REPROVA por não ter medido" 1 \
  "o comando 'pnpm' não está no PATH" "$sem_pnpm" "$sem_pnpm/bin"
caso "pnpm fora do PATH usa a fórmula de medição impossível" 1 \
  "REPROVADO por impossibilidade de medição, não por resultado." "$sem_pnpm" "$sem_pnpm/bin"

# `jq` é a dependência nova deste portão, e nenhum outro portão de produção
# depende dela. A imagem do runner a traz hoje; a asserção é o que transforma uma
# mudança futura da imagem em reprovação nomeada, em vez de erro de parse.
sem_jq="$tmp/path-sem-jq"
monta_stub "$sem_jq" pnpm-audit-limpo.json 0
for essencial in dirname git tr cat date sed; do
  caminho_do_essencial="$(command -v "$essencial")" || continue
  ln -sf "$caminho_do_essencial" "$sem_jq/bin/$essencial"
done
caso "jq fora do PATH REPROVA nomeando a ferramenta que falta" 1 \
  "o comando 'jq' não está no PATH" "$sem_jq" "$sem_jq/bin"

# `timeout` é o que separa "não consegui auditar" de "o job ficou pendurado até o
# limite do runner". Sem ele no PATH o portão não tem teto, e um portão sem teto
# não reprova nem aprova.
sem_timeout="$tmp/path-sem-timeout"
monta_stub "$sem_timeout" pnpm-audit-limpo.json 0
for essencial in dirname git tr cat date jq sed; do
  caminho_do_essencial="$(command -v "$essencial")" || continue
  ln -sf "$caminho_do_essencial" "$sem_timeout/bin/$essencial"
done
caso "timeout fora do PATH REPROVA nomeando a ferramenta que falta" 1 \
  "o comando 'timeout' não está no PATH" "$sem_timeout" "$sem_timeout/bin"

# `mktemp` é onde a saída de erro da auditoria é lida. Sem ele o portão perderia
# a razão de toda falha de rede, e reprovar sem dizer o que consertar é meia
# medição.
sem_mktemp="$tmp/path-sem-mktemp"
monta_stub "$sem_mktemp" pnpm-audit-limpo.json 0
for essencial in dirname git tr cat date jq sed timeout; do
  caminho_do_essencial="$(command -v "$essencial")" || continue
  ln -sf "$caminho_do_essencial" "$sem_mktemp/bin/$essencial"
done
caso "mktemp fora do PATH REPROVA nomeando a ferramenta que falta" 1 \
  "o comando 'mktemp' não está no PATH" "$sem_mktemp" "$sem_mktemp/bin"

# Chamada de rede sem teto não reprova nem aprova: pendura o job até o limite do
# runner, que é de seis horas por omissão. O caso roda uma cópia do portão com o
# teto recuado a um segundo contra um `pnpm` que dorme cinco — se o teto sumir do
# original ele some da cópia, e este caso passa a pendurar em vez de passar.
dorminhoco="$tmp/pnpm-dorminhoco"
mkdir -p "$dorminhoco/bin"
printf "lockfileVersion: '9.0'\n" > "$dorminhoco/pnpm-lock.yaml"
{
  printf '#!/bin/sh\n'
  printf '[ "$1" = "audit" ] || exit 0\n'
  printf 'sleep 5\n'
  printf 'exit 0\n'
} > "$dorminhoco/bin/pnpm"
chmod +x "$dorminhoco/bin/pnpm"
mkdir -p "$tmp/copia-teto-curto/scripts/gates"
cp "$raiz/scripts/gates/medir.sh" "$tmp/copia-teto-curto/scripts/gates/medir.sh"
teto_curto="$tmp/copia-teto-curto/scripts/gates/vulnerabilidade.sh"
sed 's|^TETO_DA_AUDITORIA=600$|TETO_DA_AUDITORIA=1|' "$portao" > "$teto_curto"
caso "auditoria que passa do teto REPROVA por não ter medido" 1 \
  "não consegui auditar" "$dorminhoco" "$dorminhoco/bin:$PATH" "$teto_curto"
caso_sem "auditoria que passa do teto não diz 0 achados" 1 \
  "0 achados de severidade alta ou crítica" "$dorminhoco" "$dorminhoco/bin:$PATH" "$teto_curto"

# A isenção vigente esconde o achado que ela nomeia, e diz na saída que o
# escondeu — isenção que some da saída é isenção que ninguém audita.
vigente="$(copia_portao "$tmp/copia-vigente" '"GHSA-4mjr-xmp4-gh2g:2099-01-01" "GHSA-x5fp-wj9c-mxmx:2099-01-01"')"
caso "isenção vigente esconde o achado que nomeia" 0 \
  "0 achados de severidade alta ou crítica, 2 isenções" "$qs" "$qs/bin:$PATH" "$vigente"
caso "isenção vigente é contada em voz alta" 0 \
  "medido: 2 isenção(ões) declarada(s)" "$qs" "$qs/bin:$PATH" "$vigente"
caso "isenção vigente diz até quando vale" 0 \
  "isenção: GHSA-4mjr-xmp4-gh2g vigente até 2099-01-01" "$qs" "$qs/bin:$PATH" "$vigente"

# O vencimento é o que impede a isenção temporária de virar permanente: quando a
# data chega, o aviso volta a reprovar sem ninguém precisar lembrar da linha.
vencida="$(copia_portao "$tmp/copia-vencida" '"GHSA-4mjr-xmp4-gh2g:2020-01-01" "GHSA-x5fp-wj9c-mxmx:2020-01-01"')"
caso "isenção vencida deixa de proteger" 1 \
  "isenção: GHSA-4mjr-xmp4-gh2g VENCIDA em 2020-01-01" "$qs" "$qs/bin:$PATH" "$vencida"
caso "isenção vencida devolve o achado à lista que reprova" 1 \
  "achado: qs@6.15.3 GHSA-x5fp-wj9c-mxmx high" "$qs" "$qs/bin:$PATH" "$vencida"

# Nome de pacote casaria com todo aviso presente e futuro daquele pacote, e
# curinga com todos: as duas formas escondem o próximo achado, que ninguém
# decidiu aceitar. A entrada sem data nunca venceria.
larga="$tmp/isencao-larga"
monta_stub "$larga" pnpm-audit-limpo.json 0
i=0
for entrada in 'qs:2099-01-01' '*:2099-01-01' 'GHSA-4mjr-xmp4-gh2g:amanha'; do
  i=$((i + 1))
  alvo="$(copia_portao "$tmp/copia-larga-$i" "\"$entrada\"")"
  caso "isenção '$entrada' REPROVA a lista em vez de valer" 1 \
    "não nomeia um aviso com prazo" "$larga" "$larga/bin:$PATH" "$alvo"
  caso "isenção '$entrada' é citada na reprovação" 1 "$entrada" "$larga" "$larga/bin:$PATH" "$alvo"
done
marcador_ausente "isenção mal escrita reprova antes de chamar a auditoria" "$larga"

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ vulnerabilidade.sh: reprova o achado alto, a isenção vencida e o que não conseguiu medir.\n'
else
  printf '\n✗ %s caso(s) do portão de vulnerabilidade não se comportaram como deviam.\n' "$falhas" >&2
  exit 1
fi
