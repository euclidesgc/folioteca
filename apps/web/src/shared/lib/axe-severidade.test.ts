import { describe, expect, it } from "vitest";
import { BLOQUEANTES, separar, type Violacao } from "./axe-severidade";

const TODAS_AS_SEVERIDADES: Violacao[] = [
  { id: "critical-1", impact: "critical" },
  { id: "serious-1", impact: "serious" },
  { id: "moderate-1", impact: "moderate" },
  { id: "minor-1", impact: "minor" },
  { id: "nula-1", impact: null },
  { id: "ausente-1" },
];

function ids(violacoes: Violacao[]): string[] {
  return violacoes.map((violacao) => violacao.id);
}

describe("separar — contrato", () => {
  it("cada violação cai em exatamente um dos dois lados, sem perder nem duplicar", () => {
    const { bloqueantes, apontamentos } = separar(TODAS_AS_SEVERIDADES);

    const juntos = [...ids(bloqueantes), ...ids(apontamentos)].sort();
    expect(juntos).toEqual(ids(TODAS_AS_SEVERIDADES).sort());
    expect(bloqueantes.length + apontamentos.length).toBe(
      TODAS_AS_SEVERIDADES.length,
    );
  });

  it("toda severidade de BLOQUEANTES reprova, e nenhuma delas vira apontamento", () => {
    expect([...BLOQUEANTES].sort()).toEqual(["critical", "serious"]);

    for (const severidade of BLOQUEANTES) {
      const { bloqueantes, apontamentos } = separar([
        { id: severidade, impact: severidade as Violacao["impact"] },
      ]);
      expect(ids(bloqueantes)).toEqual([severidade]);
      expect(apontamentos).toEqual([]);
    }
  });

  it("apontamento só carrega moderate ou minor, que é o que o registro admite", () => {
    const { apontamentos } = separar(TODAS_AS_SEVERIDADES);

    for (const violacao of apontamentos) {
      expect(["moderate", "minor"]).toContain(violacao.impact);
    }
  });
});

describe("separar — caminho feliz", () => {
  it("critical e serious reprovam; moderate e minor ficam registrados", () => {
    const { bloqueantes, apontamentos } = separar([
      { id: "color-contrast", impact: "serious" },
      { id: "aria-required-children", impact: "critical" },
      { id: "region", impact: "moderate" },
      { id: "empty-heading", impact: "minor" },
    ]);

    expect(ids(bloqueantes)).toEqual([
      "color-contrast",
      "aria-required-children",
    ]);
    expect(ids(apontamentos)).toEqual(["region", "empty-heading"]);
  });

  it("preserva a ordem de chegada dentro de cada lado", () => {
    const { bloqueantes, apontamentos } = separar([
      { id: "primeiro", impact: "critical" },
      { id: "segundo", impact: "minor" },
      { id: "terceiro", impact: "serious" },
      { id: "quarto", impact: "moderate" },
    ]);

    expect(ids(bloqueantes)).toEqual(["primeiro", "terceiro"]);
    expect(ids(apontamentos)).toEqual(["segundo", "quarto"]);
  });
});

describe("separar — bordas", () => {
  it("violação sem impact reprova: ausência de severidade não é ausência de gravidade", () => {
    const { bloqueantes, apontamentos } = separar([{ id: "sem-severidade" }]);

    expect(ids(bloqueantes)).toEqual(["sem-severidade"]);
    expect(apontamentos).toEqual([]);
  });

  it("impact nulo reprova, do mesmo jeito que impact ausente", () => {
    const { bloqueantes, apontamentos } = separar([
      { id: "severidade-nula", impact: null },
    ]);

    expect(ids(bloqueantes)).toEqual(["severidade-nula"]);
    expect(apontamentos).toEqual([]);
  });

  it("severidade de nome desconhecido reprova em vez de escapar pela lista", () => {
    const desconhecida = "blocker" as unknown as Violacao["impact"];
    const { bloqueantes, apontamentos } = separar([
      { id: "severidade-nova", impact: desconhecida },
    ]);

    expect(ids(bloqueantes)).toEqual(["severidade-nova"]);
    expect(apontamentos).toEqual([]);
  });

  it("lista vazia devolve os dois lados vazios, e não um deles indefinido", () => {
    const { bloqueantes, apontamentos } = separar([]);

    expect(bloqueantes).toEqual([]);
    expect(apontamentos).toEqual([]);
  });
});
