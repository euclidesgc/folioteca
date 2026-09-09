import { beforeEach, describe, expect, it } from "vitest";
import { gravarTema, lerTemaGuardado, temaEfetivo, type Tema } from "./tema";

describe("temaEfetivo — contrato", () => {
  it("sempre devolve um dos dois valores do tema, para qualquer combinação de entrada", () => {
    const entradas: Array<[Tema | null, boolean]> = [
      [null, true],
      [null, false],
      ["claro", true],
      ["claro", false],
      ["escuro", true],
      ["escuro", false],
    ];

    for (const [guardado, prefereEscuro] of entradas) {
      expect(["claro", "escuro"]).toContain(
        temaEfetivo(guardado, prefereEscuro),
      );
    }
  });
});

describe("temaEfetivo — caminho feliz", () => {
  it("sem escolha guardada, usa a preferência do sistema", () => {
    expect(temaEfetivo(null, true)).toBe("escuro");
    expect(temaEfetivo(null, false)).toBe("claro");
  });

  it("com escolha guardada, ela vence a preferência do sistema", () => {
    expect(temaEfetivo("claro", true)).toBe("claro");
    expect(temaEfetivo("escuro", false)).toBe("escuro");
  });
});

describe("temaEfetivo — bordas", () => {
  it("valor guardado que não é claro nem escuro cai na preferência do sistema", () => {
    const invalido = "sistema" as unknown as Tema;
    expect(temaEfetivo(invalido, true)).toBe("escuro");
    expect(temaEfetivo(invalido, false)).toBe("claro");
  });

  it("string vazia guardada cai na preferência do sistema", () => {
    const vazio = "" as unknown as Tema;
    expect(temaEfetivo(vazio, false)).toBe("claro");
  });
});

describe("lerTemaGuardado e gravarTema", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sem nada gravado, devolve null", () => {
    expect(lerTemaGuardado()).toBeNull();
  });

  it("depois de gravarTema, devolve o valor gravado", () => {
    gravarTema("escuro");
    expect(lerTemaGuardado()).toBe("escuro");
  });

  it("valor inválido gravado diretamente no armazenamento não vaza — devolve null", () => {
    localStorage.setItem("folioteca.tema", "sistema");
    expect(lerTemaGuardado()).toBeNull();
  });
});
