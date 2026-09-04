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
# omissão. Medido nesta máquina: 242 segundos numa execução e nenhuma resposta em
# 180 na anterior. O teto transforma o pendurado em reprovação nomeada — o
# processo morre, a saída padrão fica vazia, e o portão cai no mesmo caminho de
# `não consegui auditar` que já existe para o registro inalcançável. É o idioma
# que `scripts/merge-se-liberado.sh` já usa em toda chamada de rede.
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

ARQUIVO_DE_ERRO="${TMPDIR:-/tmp}/vulnerabilidade-$$.erro"

# `-k 30`: processo que ignora o SIGTERM penduraria o job assim mesmo, que é o
# cenário que o teto existe para eliminar. A saída de erro vai para arquivo em
# vez do descarte porque é ela que diz se foi proxy, TLS ou registro fora do ar —
# reprovar sem a razão manda quem lê o log adivinhar.
auditar_lockfile() {
  (cd "$RAIZ" && timeout -k 30 "$TETO_DA_AUDITORIA" pnpm audit --audit-level=high --json 2>"$ARQUIVO_DE_ERRO")
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
exige_caminho pnpm-lock.yaml "o lockfile da raiz que a auditoria lê"

RAIZ="$(medir_raiz)"
HOJE="$(date -u +%Y-%m-%d)"

# Quem responde a auditoria é escolhido pelo `.npmrc` da raiz, que é arquivo do
# PR: um `registry=` apontado para um espelho que devolve nada faria o portão
# imprimir os 923 pacotes do lockfile — a contagem é local — e aprovar com zero
# achados, além de entregar a árvore inteira de dependências ao servidor que o
# autor do PR escolheu. A configuração da máquina de quem executa não é medida
# aqui: contra ela a rede é o confronto das contagens, abaixo.
REDIRECIONAMENTOS=0
if [ -f "$RAIZ/.npmrc" ]; then
  while IFS= read -r linha || [ -n "$linha" ]; do
    linha="${linha#"${linha%%[![:space:]]*}"}"
    case "$linha" in
      registry=*|*:registry=*) REDIRECIONAMENTOS=$((REDIRECIONAMENTOS + 1)) ;;
    esac
  done < "$RAIZ/.npmrc"
fi
echo "medido: $REDIRECIONAMENTOS redirecionamento(s) de registro em .npmrc"
if [ "$REDIRECIONAMENTOS" -ne 0 ]; then
  _reprova "não consegui auditar o pnpm-lock.yaml: o .npmrc da raiz sob $RAIZ redireciona o registro, e quem responde a auditoria passa a ser escolhido pelo arquivo do pull request — a contagem de pacotes é local e continuaria dizendo o número certo sobre uma resposta que ninguém verificou"
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

JSON="$(auditar_lockfile)"
RAZAO_DA_FERRAMENTA="$(em_uma_linha "$(head -c 400 "$ARQUIVO_DE_ERRO" 2>/dev/null)")"
rm -f "$ARQUIVO_DE_ERRO"
if [ -z "$JSON" ] || ! printf '%s' "$JSON" | jq -e 'type == "object"' >/dev/null 2>&1; then
  _reprova "não consegui auditar o pnpm-lock.yaml: 'pnpm audit --audit-level=high --json' não devolveu JSON sob $RAIZ — registro inalcançável e vulnerabilidade encontrada saem as duas com código 1, e só o conteúdo do JSON as separa. A ferramenta disse: ${RAZAO_DA_FERRAMENTA:-nada}"
fi

# Medido: quando o registro não responde, `pnpm audit --json` devolve um JSON
# **válido** cujo corpo inteiro é `{"error": {"code": 23, "message": "The
# operation was aborted due to timeout"}}`. Ele passa por qualquer teste de forma,
# e `metadata.totalDependencies` cai no `// 0` do filtro abaixo — o portão
# reprovaria pelo caminho certo dizendo a razão errada, "auditoria de nenhum
# pacote", quando o que houve foi rede. Dizer a razão errada é o defeito irmão de
# dizer `0 achados`: as duas mandam quem lê consertar a coisa errada.
ERRO_DA_FERRAMENTA="$(em_uma_linha "$(printf '%s' "$JSON" | jq -r '.error.message // empty')")"
if [ -n "$ERRO_DA_FERRAMENTA" ]; then
  _reprova "não consegui auditar o pnpm-lock.yaml: a ferramenta devolveu erro em vez de auditoria sob $RAIZ — $ERRO_DA_FERRAMENTA"
fi

# O código de saída do `jq` é lido: sem isso a atribuição engole o erro, a
# variável fica vazia, e vazio é indistinguível de lockfile limpo.
CONTAGENS="$(printf '%s' "$JSON" | jq -r '[.metadata.vulnerabilities.critical // 0, .metadata.vulnerabilities.high // 0, .metadata.vulnerabilities.moderate // 0, .metadata.vulnerabilities.low // 0, .metadata.totalDependencies // 0] | @tsv')" \
  || _reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria sob $RAIZ não respondeu ao filtro de contagem — o relatório mudou de forma, e ler zero de um formato que este portão já não conhece é dizer 0 achados por outro nome"
IFS=$'\t' read -r CRITICAS ALTAS MODERADAS BAIXAS TOTAL <<< "$CONTAGENS"

case "${TOTAL:-}" in
  ''|*[!0-9]*) TOTAL=0 ;;
esac
if [ "$TOTAL" -eq 0 ]; then
  _reprova "não consegui auditar o pnpm-lock.yaml: o JSON da auditoria traz metadata.totalDependencies = 0 sob $RAIZ — auditoria de nenhum pacote não é lockfile limpo"
fi

ACHADOS="$(printf '%s' "$JSON" | jq -r '(.advisories // {}) | to_entries[] | .value as $a | ($a.github_advisory_id // .key) as $id | select($a.severity == "high" or $a.severity == "critical") | [$id, ($a.module_name // "?"), ((($a.findings // [])[0]).version // "?"), $a.severity, ($a.patched_versions // "?")] | @tsv')" \
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
