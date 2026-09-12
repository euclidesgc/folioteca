import { describe, expect, it } from "vitest";
import { findSpace, listTopLevelSpaces, spaceAncestry } from "./tree";

describe("spaces tree", () => {
  it("lista só os espaços sem pai entre os espaços de topo", () => {
    const topo = listTopLevelSpaces();
    expect(topo.map((space) => space.id).sort()).toEqual(
      ["comite-seguranca", "operacoes", "produto"].sort(),
    );
    expect(topo.every((space) => space.parentId === null)).toBe(true);
  });

  it("monta a trilha de ancestrais até a raiz", () => {
    const trilha = spaceAncestry("backend");
    expect(trilha.map((space) => space.id)).toEqual(["produto", "engenharia", "backend"]);
  });

  it("a trilha de um espaço de topo contém só ele mesmo", () => {
    const trilha = spaceAncestry("produto");
    expect(trilha.map((space) => space.id)).toEqual(["produto"]);
  });

  it("devolve undefined para um espaço que não existe", () => {
    expect(findSpace("espaco-inexistente")).toBeUndefined();
    expect(spaceAncestry("espaco-inexistente")).toEqual([]);
  });
});
