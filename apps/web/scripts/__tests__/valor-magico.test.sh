#!/usr/bin/env bash
# Prova que apps/web/eslint-rules/valor-magico.js REPROVA quando deve e
# APROVA quando deve. Sem este teste, a regra pode declarar-se no lint e
# nunca morder — verde por não medir nada, não por não haver o que reprovar.
set -uo pipefail
raiz="$(cd "$(dirname "$0")/../../../.." && pwd)"
sonda_feature="$raiz/apps/web/src/features/sonda"
sonda_primitivo="$raiz/apps/web/src/shared/components/sonda"
falhas=0

limpar() {
  rm -rf "$sonda_feature" "$sonda_primitivo"
}
trap limpar EXIT

ok() {
  printf '  ok    %s\n' "$1"
}

falha() {
  printf '  FALHA %s — %s\n' "$1" "$2"
  falhas=$((falhas + 1))
}

rodar_lint() {
  ( cd "$raiz" && pnpm --filter web run lint ) 2>&1
}

mkdir -p "$sonda_feature"
printf 'export const Sonda = () => <div className="bg-[#3b82f6] p-[13px]">x</div>;\n' \
  > "$sonda_feature/sonda.tsx"

saida="$(rodar_lint)"
codigo=$?

if [ "$codigo" -ne 0 ]; then
  ok "a sintaxe arbitrária sob src/features reprova o lint"
else
  falha "a sintaxe arbitrária sob src/features reprova o lint" "terminou com código 0"
fi

if printf '%s' "$saida" | grep -qF "sonda.tsx"; then
  ok "a reprovação nomeia o arquivo da sonda"
else
  falha "a reprovação nomeia o arquivo da sonda" "a saída não contém sonda.tsx"
fi

if printf '%s' "$saida" | grep -qF "1:"; then
  ok "a reprovação nomeia a linha da ocorrência"
else
  falha "a reprovação nomeia a linha da ocorrência" "a saída não contém 1:"
fi

# A classe desta casa chega por `cn(...)`, não como valor direto do atributo:
# uma regra que só lesse o valor direto ficaria verde exatamente onde a classe
# de verdade é escrita, e ninguém procuraria de novo.
printf 'import { cn } from "@/shared/lib/cn";\nexport const Sonda = () => <div className={cn("bg-[#3b82f6] p-[13px]")}>x</div>;\n' \
  > "$sonda_feature/sonda.tsx"

rodar_lint >/dev/null 2>&1
codigo=$?
if [ "$codigo" -ne 0 ]; then
  ok "a sintaxe arbitrária dentro de cn() reprova o lint"
else
  falha "a sintaxe arbitrária dentro de cn() reprova o lint" "terminou com código 0"
fi

printf '// motivo: o cabeçalho do parceiro exige exatos treze pixels\nexport const Sonda = () => <div className="bg-[#3b82f6] p-[13px]">x</div>;\n' \
  > "$sonda_feature/sonda.tsx"

rodar_lint >/dev/null 2>&1
codigo=$?
if [ "$codigo" -eq 0 ]; then
  ok "a marca de justificativa na linha acima passa"
else
  falha "a marca de justificativa na linha acima passa" "terminou com código $codigo"
fi

rm -rf "$sonda_feature"

mkdir -p "$sonda_primitivo"
printf 'export const Sonda = () => <div className="bg-[#3b82f6] p-[13px]">x</div>;\n' \
  > "$sonda_primitivo/sonda.tsx"

rodar_lint >/dev/null 2>&1
codigo=$?
if [ "$codigo" -eq 0 ]; then
  ok "a mesma ocorrência sob src/shared/components passa, fora do escopo da regra"
else
  falha "a mesma ocorrência sob src/shared/components passa, fora do escopo da regra" "terminou com código $codigo"
fi

rm -rf "$sonda_primitivo"

rodar_lint >/dev/null 2>&1
codigo=$?
if [ "$codigo" -eq 0 ]; then
  ok "sem sonda nenhuma, o lint volta a passar"
else
  falha "sem sonda nenhuma, o lint volta a passar" "terminou com código $codigo"
fi

if [ "$falhas" -eq 0 ]; then
  printf '\n✓ valor mágico: reprova a sintaxe arbitrária fora dos primitivos e aceita a marca de justificativa.\n'
else
  printf '\n✗ %s caso(s) não se comportaram como esperado.\n' "$falhas" >&2
  exit 1
fi
