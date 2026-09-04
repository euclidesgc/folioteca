#!/usr/bin/env bash
# Portão de vulnerabilidade: nenhuma dependência do pnpm-lock.yaml carrega aviso
# de severidade alta ou crítica sem isenção nominal com prazo em vigor.
#
# POR QUE O VEREDICTO VEM DO CONTEÚDO DO JSON, E NÃO DO CÓDIGO DE SAÍDA
#
# `pnpm audit` sai 1 tanto para "achei vulnerabilidade" quanto para "não
# consegui falar com o registro". As duas respostas são indistinguíveis pelo
# código de saída, e uma delas tem de reprovar dizendo `não consegui auditar` em
# vez de `0 achados` — que é a regra 19 e o motivo de `medir.sh` existir. Por
# isso o motor imprime a saída padrão crua e o veredicto sai do JSON: sem JSON
# parseável, ou com `metadata.totalDependencies` em zero, o portão reprova por
# não ter medido, e sem imprimir contagem nenhuma. Imprimir zeros ali seria
# dizer `0 achados` por outro nome, que é exatamente o defeito que este arquivo
# existe para fechar.
#
# POR QUE A LISTA DE ISENÇÕES MORA AQUI, E NÃO EM auditConfig.ignoreGhsas
#
# A configuração do pnpm é fundida: o `.npmrc` da máquina de quem executa soma
# ao arquivo do repositório, e uma isenção declarada fora do repositório
# deixaria o portão verde para quem tem a máquina certa e vermelho para todo o
# resto. É o mesmo buraco que a quarentena ainda tem, e repeti-lo de propósito
# seria a segunda ocorrência do mesmo defeito.
#
# POR QUE O PISO É `high`, E POR QUE ELE É UMA LINHA DE CONTAGEM SÓ
#
# O piso cobre `critical` junto — as duas severidades reprovam. `moderate` e
# `low` aparecem só na linha de contagem, para quem executa o portão saber o que
# ficou de fora sem que ele fique vermelho por elas.
#
# POR QUE A CONTAGEM É CONFRONTADA COM A LISTA DE ACHADOS
#
# `pnpm audit --json` poda `.advisories` duas vezes antes de serializar — pela
# lista de isenção da configuração e pelo piso de nível — e serializa `metadata`
# intacta (medido em pnpm 11.25.0, `dist/pnpm.mjs`, o `pickBy` sobre
# `auditReport.advisories` seguido de `JSON.stringify({ ...auditReport,
# advisories })`). A contagem sobe uma vez por aviso, no mesmo laço que preenche
# `.advisories`, então `critical + high` da metadata é exatamente o número de
# avisos altos e críticos **antes** da poda. Um PR que acrescente quatro linhas
# de `audit.ignore` ao `pnpm-workspace.yaml` — o que `pnpm audit --ignore` grava
# sozinho, sem data e sem dono — faria este portão imprimir `high: 2` e aprovar
# dizendo `0 achados` na linha seguinte. Confrontar as duas fecha isso, e fecha
# junto o caso em que o filtro de achados não pôde ser aplicado: sem o
# confronto, `jq` mudo é indistinguível de lockfile limpo.
#
# POR QUE O MOTOR É UMA FUNÇÃO SÓ, E POR QUE ELE TEM TETO DE TEMPO
#
# Trocar a ferramenta de auditoria é mexer em `auditar_lockfile` e em mais nada:
# nem quem chama o portão nem o que ele imprime mudam de forma.
#
# `pnpm audit` fala com o registro npm, e chamada de rede sem teto não reprova
# nem aprova: ela pendura o job até o limite do runner, que é de seis horas por
# omissão. O teto transforma o pendurado em reprovação nomeada — o processo
# morre, a saída padrão fica vazia, e o portão cai no mesmo caminho de `não
# consegui auditar` que já existe para o registro inalcançável. É o idioma que
# `scripts/merge-se-liberado.sh` já usa em toda chamada de rede.
#
# POR QUE O TEMPO DE UMA TENTATIVA É DECLARADO AQUI
#
# O endpoint de auditoria responde sobre o lockfile inteiro numa requisição só, e
# a resposta destes 923 pacotes leva 71 segundos numa chamada isolada — mais que
# os 60 segundos de `fetch-timeout` que o pnpm assume por omissão. Com o valor de
# omissão a tentativa é abortada a 11 segundos do fim, o pnpm reencadeia as
# tentativas, e o que chega à saída padrão é um JSON válido de erro por tempo
# esgotado: o portão reprova dizendo `não consegui auditar` em toda execução, num
# repositório sem vulnerabilidade nenhuma. Portão que reprova sempre não é
# rigoroso, é ignorado — e a saída seria desligá-lo. O tempo de uma tentativa fica
# acima do que a chamada mede, com folga, e quem continua fechando o caso do
# registro morto é o teto do processo, que não depende de configuração de
# ferramenta.
set -uo pipefail

RAIZ_DO_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$RAIZ_DO_SCRIPT/scripts/gates/medir.sh"

# Cada entrada é `identificador do aviso:AAAA-MM-DD`, e o motivo de cada uma vai
# em comentário logo acima dela, nunca como terceiro campo — o predicado abaixo
# recusaria. O vencimento não é decoração: quando a data chega o aviso volta a
# reprovar sozinho, e ninguém precisa lembrar de remover a linha.
ISENCOES_DECLARADAS=()

# O identificador é um GHSA ou o número do aviso, e nunca um nome de pacote:
# nome casaria com todo aviso presente e futuro daquele pacote, escondendo o
# próximo, que ninguém decidiu aceitar.
PADRAO_DE_ISENCAO='^(GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|[0-9]+):[0-9]{4}-[0-9]{2}-[0-9]{2}$'

# Segundos. Não é alvo, é limite superior: uma auditoria que passa daqui não está
# medindo, está pendurada.
TETO_DA_AUDITORIA=600

# Milissegundos, e por tentativa. Fica abaixo do teto do processo mesmo somando a
# tentativa de repetição: quem decide o fim é o teto, não a ferramenta.
TEMPO_DE_UMA_TENTATIVA=240000
REPETICOES_DA_TENTATIVA=1

# POR QUE A AUDITORIA É TENTADA MAIS DE UMA VEZ
#
# O endpoint de auditoria do npm limita por volume, e a medição que o mostra está
# na `D42` do `decisoes-autonomas.md` deste item: três chamadas iguais, espaçadas
# por 45 segundos, responderam em 74 s, em 90 s e em nenhum tempo — a terceira
# esgotou os 240 s da tentativa. Um pull request deste repositório dispara três
# jobs que chamam a auditoria ao mesmo tempo, e foi assim que os três ficaram
# vermelhos juntos, no mesmo minuto, com o lockfile limpo.
#
# A repetição com espera é mitigação, e não conserto: quem conserta é trocar o
# motor por um que não limite assim, e essa decisão reabre a `D1` — está na
# divergência `D-001` desta fase, com o roadmap `055`. Enquanto ela não vem, o
# portão prefere esperar a reprovar quem não errou. O que ele **não** faz é
# desistir em silêncio: esgotadas as tentativas, a reprovação continua sendo por
# impossibilidade de medição, dizendo quantas vezes tentou.
TENTATIVAS_DA_AUDITORIA=3
ESPERA_ENTRE_TENTATIVAS=30

# `mktemp` e não um nome derivado do PID: nome previsível em diretório
# compartilhado é arquivo que outro usuário planta como link antes, e o `2>` do
# shell segue link. O `trap` cobre a interrupção, que o `rm` no fim do caminho
# feliz não cobre.
ARQUIVO_DE_ERRO=""
limpar_arquivo_de_erro() { [ -n "$ARQUIVO_DE_ERRO" ] && rm -f "$ARQUIVO_DE_ERRO"; }
trap limpar_arquivo_de_erro EXIT

# `-k 30`: processo que ignora o SIGTERM penduraria o job assim mesmo, que é o
# cenário que o teto existe para eliminar. A saída de erro vai para arquivo em
# vez do descarte porque é ela que diz se foi proxy, TLS ou registro fora do ar —
# reprovar sem a razão manda quem lê o log adivinhar.
auditar_lockfile() {
  (cd "$RAIZ" && env npm_config_fetch_timeout="$TEMPO_DE_UMA_TENTATIVA" \
    npm_config_fetch_retries="$REPETICOES_DA_TENTATIVA" \
    timeout -k 30 "$TETO_DA_AUDITORIA" pnpm audit --audit-level=high --json 2>"$ARQUIVO_DE_ERRO")
}

# Só a resposta que não é auditoria nenhuma — sem JSON, ou JSON cujo corpo é um
# erro — é tentada de novo. Achado, contagem e forma desconhecida saem na
# primeira: repetir uma resposta que a ferramenta deu é gastar tempo para receber
# a mesma coisa, e esconderia atrás de uma espera o relatório que mudou de forma.
auditoria_utilizavel() {
  [ -n "$1" ] || return 1
  printf '%s' "$1" | jq -s -e 'length == 1 and (.[0] | type) == "object" and (.[0] | has("error") | not)' >/dev/null 2>&1
}

# Escreve em duas variáveis do escopo do script em vez de devolver pela saída
# padrão: a contagem de tentativas é parte do que o portão mediu, e uma função
# capturada por `$( )` roda em subshell, de onde nenhuma atribuição volta.
auditar_com_repeticao() {
  TENTATIVAS_GASTAS=1
  while :; do
    JSON_DA_AUDITORIA="$(auditar_lockfile)"
    auditoria_utilizavel "$JSON_DA_AUDITORIA" && return
    [ "$TENTATIVAS_GASTAS" -ge "$TENTATIVAS_DA_AUDITORIA" ] && return
    echo "  tentativa $TENTATIVAS_GASTAS de $TENTATIVAS_DA_AUDITORIA não trouxe auditoria; esperando ${ESPERA_ENTRE_TENTATIVAS}s"
    sleep "$ESPERA_ENTRE_TENTATIVAS"
    TENTATIVAS_GASTAS=$((TENTATIVAS_GASTAS + 1))
  done
}

# Toda mensagem que vem de fora — do registro, da ferramenta — atravessa isto
# antes de chegar ao log do runner: uma quebra de linha no meio dela injetaria
# `::stop-commands::` ou `::add-mask::` e o runner obedeceria.
em_uma_linha() {
  printf '%s' "$1" | tr '\n\r\t' '   '
}

# Ler a própria constante não custa rede, e a lista mal escrita é acusada mesmo
# no dia em que a auditoria não encontra nada para ela esconder.
for entrada in ${ISENCOES_DECLARADAS[@]+"${ISENCOES_DECLARADAS[@]}"}; do
  [[ "$entrada" =~ $PADRAO_DE_ISENCAO ]] && continue
  printf '::error::isenção que não nomeia um aviso com prazo: %s. A entrada é <identificador do aviso>:<AAAA-MM-DD>, e o identificador é um GHSA ou o número do aviso — nome de pacote ou curinga casaria com mais de um aviso e esconderia o próximo, que ninguém decidiu aceitar.\n' \
    "$entrada" >&2
  exit 1
done

exige_comando pnpm
exige_comando jq
exige_comando timeout
exige_comando mktemp
exige_caminho pnpm-lock.yaml "o lockfile da raiz que a auditoria lê"

ARQUIVO_DE_ERRO="$(mktemp)" || _reprova "não consegui auditar o pnpm-lock.yaml: mktemp não criou o arquivo onde a saída de erro da auditoria seria lida"

RAIZ="$(medir_raiz)"
HOJE="$(date -u +%Y-%m-%d)"

# Quem responde a auditoria é escolhido pela configuração da raiz, que é arquivo
# do PR: um registro apontado para um espelho que devolve `{"advisories":{}}`
# faria o portão imprimir os 923 pacotes do lockfile — a contagem é local — e
# aprovar com zero achados, além de entregar a árvore inteira de dependências ao
# servidor que o autor do PR escolheu. A resposta forjada é internamente
# coerente, então o confronto das contagens, abaixo, não a pega: ele cobre a
# **poda** que a configuração da máquina de quem executa faria, e não o registro
# mentiroso, cujas duas metades são forjadas juntas.
#
# As duas casas são medidas porque as duas valem: o `ini` do `.npmrc` apara o
# espaço em volta do `=`, e o `pnpm-workspace.yaml` é onde este repositório já
# guarda `minimumReleaseAge` e `overrides`. Uma peneira que só casasse
# `registry=` seria derrotada por um espaço, e a linha `medido:` passaria a
# afirmar zero com um redirecionamento em vigor — portão que diz ter medido o
# que não mediu é o defeito que `medir.sh` existe para matar.
REGISTRO_ESPERADO='https://registry.npmjs.org'

conta_registros() { # conta_registros <arquivo> <separador `=` ou `:`>
  local arquivo="$1" separador="$2" linha chave valor total=0
  [ -f "$arquivo" ] || { printf '0'; return; }
  while IFS= read -r linha || [ -n "$linha" ]; do
    linha="${linha#"${linha%%[![:space:]]*}"}"
    case "$linha" in ''|'#'*|';'*) continue ;; esac
    case "$linha" in *"$separador"*) ;; *) continue ;; esac
    chave="${linha%%"$separador"*}"
    valor="${linha#*"$separador"}"
    chave="${chave%"${chave##*[![:space:]]}"}"
    valor="${valor#"${valor%%[![:space:]]*}"}"
    valor="${valor%"${valor##*[![:space:]]}"}"
    valor="${valor%\"}"; valor="${valor#\"}"
    valor="${valor%/}"
    case "$chave" in
      registry|*:registry) [ "$valor" = "$REGISTRO_ESPERADO" ] || total=$((total + 1)) ;;
    esac
  done < "$arquivo"
  printf '%s' "$total"
}

# As quatro casas são medidas porque as quatro redirecionam a mesma chamada. O
# `~/.npmrc` e o ambiente não são arquivo do pull request, e por isso não são
# risco de quem abre o PR — são o buraco simétrico: o portão ficaria verde na
# máquina de quem tem o espelho configurado, sobre uma resposta que ninguém
# verificou, exatamente o defeito que as isenções deste arquivo recusam repetir.
conta_registros_do_ambiente() {
  local total=0
  for valor in "${npm_config_registry:-}" "${NPM_CONFIG_REGISTRY:-}"; do
    [ -z "$valor" ] && continue
    valor="${valor%/}"
    [ "$valor" = "$REGISTRO_ESPERADO" ] || total=$((total + 1))
  done
  printf '%s' "$total"
}

# O arquivo do usuário não é `$HOME/.npmrc` por definição: `npm_config_userconfig`
# reloca esse arquivo inteiro, e uma peneira ancorada no `$HOME` mediria o arquivo
# que ninguém está lendo enquanto o espelho responde pelo que vale. Ler o caminho
# que a ferramenta leria é o que faz a linha `medido:` dizer a verdade.
CONFIG_DO_USUARIO="${npm_config_userconfig:-${NPM_CONFIG_USERCONFIG:-${HOME:-}/.npmrc}}"

REDIRECIONAMENTOS=$(( $(conta_registros "$RAIZ/.npmrc" '=') \
  + $(conta_registros "$RAIZ/pnpm-workspace.yaml" ':') \
  + $(conta_registros "$CONFIG_DO_USUARIO" '=') \
  + $(conta_registros_do_ambiente) ))
echo "medido: $REDIRECIONAMENTOS registro(s) declarado(s) fora de $REGISTRO_ESPERADO em .npmrc, pnpm-workspace.yaml, $CONFIG_DO_USUARIO e no ambiente"
if [ "$REDIRECIONAMENTOS" -ne 0 ]; then
  _reprova "não consegui auditar o pnpm-lock.yaml: a configuração que vale sob $RAIZ aponta o registro para fora de $REGISTRO_ESPERADO — em .npmrc, em pnpm-workspace.yaml, em $CONFIG_DO_USUARIO ou nas variáveis npm_config_registry e NPM_CONFIG_REGISTRY —, e quem responde a auditoria passa a ser escolhido por essa declaração: a contagem de pacotes é local e continuaria dizendo o número certo sobre uma resposta que ninguém verificou"
fi

ISENCOES_VIGENTES=()
echo "medido: ${#ISENCOES_DECLARADAS[@]} isenção(ões) declarada(s)"
for entrada in ${ISENCOES_DECLARADAS[@]+"${ISENCOES_DECLARADAS[@]}"}; do
  id="${entrada%%:*}"
  vence="${entrada##*:}"
  if [[ "$HOJE" < "$vence" ]]; then
    ISENCOES_VIGENTES+=("$id")
    echo "  isenção: $id vigente até $vence"
  else
    echo "  isenção: $id VENCIDA em $vence — o aviso volta a reprovar"
  fi
done

auditar_com_repeticao
JSON="$JSON_DA_AUDITORIA"
echo "medido: $TENTATIVAS_GASTAS tentativa(s) de auditoria, de no máximo $TENTATIVAS_DA_AUDITORIA"
RAZAO_DA_FERRAMENTA="$(em_uma_linha "$(head -c 400 "$ARQUIVO_DE_ERRO" 2>/dev/null)")"
limpar_arquivo_de_erro
if [ -z "$JSON" ] || ! printf '%s' "$JSON" | jq -s -e 'length == 1 and (.[0] | type) == "object"' >/dev/null 2>&1; then
  _reprova "não consegui auditar o pnpm-lock.yaml: 'pnpm audit --audit-level=high --json' não devolveu JSON sob $RAIZ em $TENTATIVAS_GASTAS tentativa(s) — registro inalcançável e vulnerabilidade encontrada saem as duas com código 1, e só o conteúdo do JSON as separa. A ferramenta disse: ${RAZAO_DA_FERRAMENTA:-nada}"
fi

# Medido: quando o registro não responde, `pnpm audit --json` devolve um JSON
# **válido** cujo corpo inteiro é `{"error": {"code": 23, "message": "The
# operation was aborted due to timeout"}}`. Ele passa por qualquer teste de forma,
# e `metadata.totalDependencies` cai no `// 0` do filtro abaixo — o portão
# reprovaria pelo caminho certo dizendo a razão errada, "auditoria de nenhum
# pacote", quando o que houve foi rede. Dizer a razão errada é o defeito irmão de
# dizer `0 achados`: as duas mandam quem lê consertar a coisa errada.
# A presença da chave é o que decide, e não o texto dentro dela: um erro sem
# `message` cairia adiante no ramo de `totalDependencies` e culparia `auditoria de
# nenhum pacote`, mandando quem lê consertar lockfile quando o que houve foi rede.
if printf '%s' "$JSON" | jq -s -e 'length == 1 and (.[0] | has("error"))' >/dev/null 2>&1; then
  ERRO_DA_FERRAMENTA="$(em_uma_linha "$(printf '%s' "$JSON" | jq -s -r '.[0].error.message // (.[0].error | tostring)')")"
  _reprova "não consegui auditar o pnpm-lock.yaml: a ferramenta devolveu erro em vez de auditoria sob $RAIZ em $TENTATIVAS_GASTAS tentativa(s) — $ERRO_DA_FERRAMENTA"
fi

# O código de saída do `jq` é lido: sem isso a atribuição engole o erro, a
# variável fica vazia, e vazio é indistinguível de lockfile limpo.
#
# A forma é cobrada por presença de chave, e nunca por valor de omissão: `jq` erra
# por tipo errado, jamais por chave ausente, então um `// 0` sobre um relatório
# que renomeou `metadata.vulnerabilities` devolveria a contagem toda em zero e
# faria este portão imprimir `high: 0` sobre um formato que ele já não entende. É
# a mesma frase `0 achados` que o arquivo inteiro existe para não dizer, só que
# escrita pela ferramenta em vez de pelo lockfile.
CONTAGENS="$(printf '%s' "$JSON" | jq -s -r '
  if length != 1 then error("mais de um valor") else .[0] end
  | if (.advisories | type) != "object" then error("advisories")
  elif (.metadata | type) != "object" then error("metadata")
  elif (.metadata.vulnerabilities | type) != "object" then error("metadata.vulnerabilities")
  else [.metadata.vulnerabilities.critical, .metadata.vulnerabilities.high, .metadata.vulnerabilities.moderate, .metadata.vulnerabilities.low, .metadata.totalDependencies]
  end
  | if any(.[]; type != "number") then error("contagem") else . end
  | @tsv')" \
  || _reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria sob $RAIZ não traz .advisories e .metadata.vulnerabilities na forma que este portão lê — o relatório mudou de forma, e ler zero de um formato que este portão já não conhece é dizer 0 achados por outro nome"
IFS=$'\t' read -r CRITICAS ALTAS MODERADAS BAIXAS TOTAL <<< "$CONTAGENS"

case "${TOTAL:-}" in
  ''|*[!0-9]*) TOTAL=0 ;;
esac
if [ "$TOTAL" -eq 0 ]; then
  _reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria traz metadata.totalDependencies = 0 sob $RAIZ — auditoria de nenhum pacote não é lockfile limpo"
fi

ACHADOS="$(printf '%s' "$JSON" | jq -s -r 'if length != 1 then error("mais de um valor") else .[0] end | .advisories | to_entries[] | .value as $a | ($a.github_advisory_id // .key) as $id | select($a.severity == "high" or $a.severity == "critical") | [$id, ($a.module_name // "?"), ((($a.findings // [])[0]).version // "?"), $a.severity, ($a.patched_versions // "?")] | @tsv')" \
  || _reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria sob $RAIZ não respondeu ao filtro de achados — sem a lista, vazio é indistinguível de lockfile limpo"

LIDOS=0
while IFS= read -r linha; do
  [ -n "$linha" ] && LIDOS=$((LIDOS + 1))
done <<< "$ACHADOS"

# O confronto que o cabeçalho explica: `metadata` conta os avisos antes das duas
# podas, `.advisories` chega depois delas. Divergir é aviso escondido por arquivo
# do repositório ou por configuração da máquina — nunca lockfile limpo.
GRAVES=$((CRITICAS + ALTAS))
if [ "$LIDOS" -ne "$GRAVES" ]; then
  _reprova "não consegui auditar o pnpm-lock.yaml: a contagem do relatório diz $GRAVES aviso(s) de severidade alta ou crítica sob $RAIZ e a lista de avisos traz $LIDOS — 'pnpm audit --json' poda .advisories pela isenção da configuração (audit.ignore ou auditConfig.ignoreGhsas, que 'pnpm audit --ignore' grava sozinho no pnpm-workspace.yaml) e pelo piso de nível, sem tocar em metadata, e a diferença é exatamente o que ficaria escondido. Se a isenção é legítima, ela se declara em ISENCOES_DECLARADAS de scripts/gates/vulnerabilidade.sh, com prazo"
fi

# A contagem vem antes dos achados e do `::error::`, na mesma saída padrão: é ela
# que torna a reprovação acionável para quem executa o portão à mão, e quem lê de
# cima para baixo precisa saber sobre quantos pacotes o veredicto foi dado antes
# de ler o veredicto.
echo "medido: $TOTAL pacote(s) auditado(s) — critical: $CRITICAS, high: $ALTAS, moderate: $MODERADAS, low: $BAIXAS"

RESTANTES=0
ESCONDIDOS=0
while IFS=$'\t' read -r id pacote versao severidade corrigido; do
  [ -n "$id" ] || continue
  vigente=0
  for isento in ${ISENCOES_VIGENTES[@]+"${ISENCOES_VIGENTES[@]}"}; do
    if [ "$isento" = "$id" ]; then
      vigente=1
      break
    fi
  done
  if [ "$vigente" -eq 1 ]; then
    ESCONDIDOS=$((ESCONDIDOS + 1))
    continue
  fi
  RESTANTES=$((RESTANTES + 1))
  echo "  achado: $pacote@$versao $id $severidade — corrigido em $corrigido"
done <<< "$ACHADOS"

if [ "$RESTANTES" -gt 0 ]; then
  printf '::error::vulnerabilidade conhecida no lockfile: %s achado(s) de severidade alta ou crítica fora de isenção vigente. Atualize a dependência ou escreva a isenção nominal com prazo em ISENCOES_DECLARADAS de scripts/gates/vulnerabilidade.sh.\n' \
    "$RESTANTES" >&2
  exit 1
fi

echo "✓ vulnerabilidade: $TOTAL pacotes auditados, $RESTANTES achados de severidade alta ou crítica, $ESCONDIDOS isenções."
