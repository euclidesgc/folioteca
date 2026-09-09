import type { ImpactValue } from "axe-core";

export type Violacao = {
  id: string;
  impact?: ImpactValue;
};

export const BLOQUEANTES: ReadonlySet<string> = new Set([
  "critical",
  "serious",
]);

const APONTAVEIS: ReadonlySet<string> = new Set(["moderate", "minor"]);

// invariante: a partição é feita pelo complemento de APONTAVEIS, e não pela
// pertinência a BLOQUEANTES. Severidade ausente, nula ou de nome que o axe
// ainda não publicava reprova em vez de escapar por não estar na lista de
// bloqueio — ausência de severidade não é ausência de gravidade, e o registro
// de apontamentos só admite `moderate` e `minor`.
export function separar<V extends Violacao>(
  violacoes: readonly V[],
): { bloqueantes: V[]; apontamentos: V[] } {
  const bloqueantes: V[] = [];
  const apontamentos: V[] = [];

  for (const violacao of violacoes) {
    if (APONTAVEIS.has(violacao.impact ?? "")) {
      apontamentos.push(violacao);
    } else {
      bloqueantes.push(violacao);
    }
  }

  return { bloqueantes, apontamentos };
}
