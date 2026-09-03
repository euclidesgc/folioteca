#!/usr/bin/env bash
# O motor da corrida autônoma. Casca fina: a decisão mora em
# scripts/loop/decide-next-action.mjs, que é uma função pura sobre o estado.
#
# Não acrescente decisão aqui.
#
#   proxima-sessao.sh            uma rodada: decide, invoca a sessão, empilha o PR
#   proxima-sessao.sh --dry-run  imprime a decisão e sai, sem invocar nada
#   proxima-sessao.sh --ate N    no máximo N rodadas encadeadas (padrão: 1)
#
# O QUE ELE NUNCA FAZ: mergear PR, e empurrar com --force. A pilha existe para
# o merge ser uma decisão do dev, tomada de uma vez, acordado — e é
# scripts/merge-se-liberado.sh quem mergeia, quando o dev mandar.
#
# CADA RODADA É UMA SESSÃO NOVA. `claude -p` abre processo novo e o prompt é a
# única entrada — é daí que vem a economia de contexto.
#
# ⚠️ A sessão roda com --dangerously-skip-permissions, porque não há ninguém
# acordado para aprovar cada escrita. Os hooks do harness continuam valendo
# (escopo de agent, documento aprovado, comando destrutivo); o que deixa de
# existir é a pergunta ao humano. Reveja antes da primeira noite.
#
# gate3-ok: o bloco abaixo é o registro de por que o motor sobrevive a uma
# rodada ruim, e não a mecânica de como.
#
# POR QUE ELE SE RECUPERA
# Na primeira noite real uma rodada morreu às 07:13. A árvore ficou suja, o
# motor recusou partir — que era o comportamento projetado — e a corrida parou
# por cinco horas com o dono dormindo. Duas mudanças saíram daí:
#   1. rodada que falha é tentada mais UMA vez, não a noite inteira;
#   2. trabalho a meio caminho vira commit `wip` na branch da própria fase, em
#      vez de bloquear tudo. Não é validado nem mergeado: só deixa de ser refém
#      da árvore suja, e a rodada seguinte retoma a fase de onde parou.
set -uo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz" || exit 2

seco=0
ate=1
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) seco=1 ;;
    --ate) shift; ate="${1:-1}" ;;
    *) printf 'argumento desconhecido: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

for ferramenta in node claude gh git; do
  command -v "$ferramenta" >/dev/null 2>&1 || {
    printf 'motor: %s não encontrado no PATH; nada foi decidido.\n' "$ferramenta" >&2
    exit 2
  }
done

batimento="$raiz/.harness/runtime/motor-batimento"
mkdir -p "$(dirname "$batimento")"

# O hook de início de sessão exporta CLAUDE_PLUGIN_ROOT escrevendo no arquivo
# apontado por CLAUDE_ENV_FILE, que o Claude Code carrega antes de cada Bash.
# Sem essa variável definida, a exportação não tem para onde ir e todo comando
# do prompt que use "$CLAUDE_PLUGIN_ROOT" falha com "can't open file
# '/scripts/state/state.py'" — foi o que consumiu as duas primeiras tentativas
# de cada sessão da primeira noite. Quem abre a sessão é este script, então é
# ele quem prepara o canal.
export CLAUDE_ENV_FILE="${CLAUDE_ENV_FILE:-$raiz/.harness/runtime/sessao-env.sh}"
: > "$CLAUDE_ENV_FILE"

# Vigia externo lê o progresso com `cat`, nunca com `pgrep`: o padrão do pgrep
# casa com o próprio comando que o executa, e enganou três verificações.
marca() { printf '%s %s\n' "$(date -Iseconds)" "$1" > "$batimento"; }

salva_meio_caminho() {
  [ -n "$(git status --porcelain)" ] || return 0
  local branch; branch="$(git branch --show-current)"
  case "$branch" in
    main|develop|"")
      printf 'motor: árvore suja em %s. Não comito wip fora de branch de fase.\n' "${branch:-detached}" >&2
      return 1 ;;
  esac
  git add -A
  git commit --quiet -m "wip(${branch}): interrupted round, not reviewed nor validated

The round that produced this died before finishing. Committed so the tree stops
blocking the next round; the phase resumes from here and the blind validator
judges the branch tip, not this commit." || return 1
  printf 'motor: trabalho a meio caminho salvo como wip em %s.\n' "$branch" >&2
}

if [ "$seco" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  printf 'motor: árvore suja ao partir — provavelmente sobra de rodada anterior.\n' >&2
  salva_meio_caminho || {
    printf 'motor: não consegui limpar a árvore com segurança. Comite ou guarde à mão.\n' >&2
    git status --short >&2
    exit 2
  }
fi

rodada=0
while [ "$rodada" -lt "$ate" ]; do
  rodada=$((rodada + 1))
  printf '\n═══ rodada %s de %s ═══\n' "$rodada" "$ate"
  marca "rodada $rodada: decidindo"

  decisao="$(node scripts/loop/decide-next-action.mjs)"
  codigo=$?
  printf '%s\n' "$decisao"

  if [ "$codigo" -ne 0 ]; then
    marca "parado: a decisão mandou parar"
    printf '\nmotor: parando na rodada %s.\n' "$rodada"
    exit 0
  fi

  prompt="$(printf '%s' "$decisao" | node -e 'let e="";process.stdin.on("data",d=>e+=d).on("end",()=>process.stdout.write(JSON.parse(e).prompt??""))')"

  if [ "$seco" -eq 1 ]; then
    printf '\nmotor: --dry-run, nada foi invocado.\n'
    exit 0
  fi

  [ -f "$prompt" ] || { printf 'motor: %s não existe.\n' "$prompt" >&2; exit 2; }

  tentativa=0
  ok=0
  while [ "$tentativa" -lt 2 ]; do
    tentativa=$((tentativa + 1))
    marca "rodada $rodada: sessão viva (tentativa $tentativa)"
    : > "$CLAUDE_ENV_FILE"
    if claude -p "$(cat "$prompt")" --dangerously-skip-permissions; then
      ok=1
      break
    fi
    printf '\nmotor: a sessão da rodada %s saiu com erro (tentativa %s de 2).\n' "$rodada" "$tentativa" >&2
    salva_meio_caminho || true
  done

  if [ "$ok" -eq 0 ]; then
    marca "parado: duas tentativas falharam na rodada $rodada"
    printf 'motor: duas tentativas seguidas falharam. Parando — a causa é a montante.\n' >&2
    exit 2
  fi

  marca "rodada $rodada: empilhando o PR"
  if gh stack view >/dev/null 2>&1; then
    gh stack submit --auto || printf 'motor: gh stack submit falhou; os commits continuam locais.\n' >&2
  else
    printf 'motor: a branch corrente não está numa pilha; os commits continuam locais. `gh stack init --base develop <branch>` adota o que existe.\n' >&2
  fi
done

marca "concluído: $rodada rodada(s)"
printf '\nmotor: %s rodada(s) concluída(s).\n' "$rodada"
