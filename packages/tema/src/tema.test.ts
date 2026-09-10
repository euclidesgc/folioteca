import { describe, expect, it } from "vitest";
import {
  CHAVE_DO_TEMA,
  lerTemaDoDocumento,
  serializarCookieDeTema,
  temaEfetivo,
  type Tema,
} from "./tema";

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

describe("lerTemaDoDocumento — contrato", () => {
  it("devolve um tema válido ou null, nunca o valor cru do cookie", () => {
    const entradas = [
      "",
      "outro=1",
      `${CHAVE_DO_TEMA}=escuro`,
      `${CHAVE_DO_TEMA}=sistema`,
    ];

    for (const entrada of entradas) {
      const lido = lerTemaDoDocumento(entrada);
      expect(lido === null || lido === "claro" || lido === "escuro").toBe(true);
    }
  });
});

describe("lerTemaDoDocumento — caminho feliz", () => {
  it("lê o tema quando o cookie é o único presente", () => {
    expect(lerTemaDoDocumento(`${CHAVE_DO_TEMA}=escuro`)).toBe("escuro");
  });

  it("lê o tema quando o cookie está no meio de outros", () => {
    expect(
      lerTemaDoDocumento(`sessao=abc; ${CHAVE_DO_TEMA}=claro; outro=1`),
    ).toBe("claro");
  });

  it("tolera o espaço que o navegador põe depois do ponto e vírgula", () => {
    expect(
      lerTemaDoDocumento(`  sessao=abc;   ${CHAVE_DO_TEMA}=escuro  `),
    ).toBe("escuro");
  });
});

describe("lerTemaDoDocumento — bordas", () => {
  it("sem cabeçalho nenhum, devolve null", () => {
    expect(lerTemaDoDocumento("")).toBeNull();
    expect(lerTemaDoDocumento(null)).toBeNull();
    expect(lerTemaDoDocumento(undefined)).toBeNull();
  });

  it("cookie ausente entre outros devolve null", () => {
    expect(lerTemaDoDocumento("sessao=abc; outro=1")).toBeNull();
  });

  it("valor inválido não vaza — devolve null", () => {
    expect(lerTemaDoDocumento(`${CHAVE_DO_TEMA}=sistema`)).toBeNull();
  });

  it("não confunde um cookie cujo nome termina com o nosso", () => {
    expect(lerTemaDoDocumento(`x.${CHAVE_DO_TEMA}=escuro`)).toBeNull();
  });

  it("parte sem sinal de igual não derruba a leitura", () => {
    expect(lerTemaDoDocumento(`lixo; ${CHAVE_DO_TEMA}=escuro`)).toBe("escuro");
  });
});

describe("serializarCookieDeTema", () => {
  it("escreve o valor, o caminho, a validade e a política de envio", () => {
    const cookie = serializarCookieDeTema("escuro", { seguro: false });

    expect(cookie).toContain(`${CHAVE_DO_TEMA}=escuro`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("sem domínio informado, não escreve Domain — é o cookie de host do desenvolvimento", () => {
    expect(serializarCookieDeTema("claro", { seguro: false })).not.toContain(
      "Domain=",
    );
  });

  it("com domínio informado, escreve Domain para atravessar os subdomínios", () => {
    expect(
      serializarCookieDeTema("claro", {
        dominio: "folioteca.duckdns.org",
        seguro: true,
      }),
    ).toContain("Domain=folioteca.duckdns.org");
  });

  it("só marca Secure quando a página está sob https", () => {
    expect(serializarCookieDeTema("claro", { seguro: true })).toContain(
      "Secure",
    );
    expect(serializarCookieDeTema("claro", { seguro: false })).not.toContain(
      "Secure",
    );
  });

  it("o que ele escreve é o que lerTemaDoDocumento lê de volta", () => {
    const cookie = serializarCookieDeTema("escuro", { seguro: false });
    const parBruto = cookie.split(";")[0];

    expect(lerTemaDoDocumento(parBruto)).toBe("escuro");
  });

  it("nunca marca HttpOnly — o alternador do navegador precisa escrever este cookie", () => {
    expect(serializarCookieDeTema("escuro", { seguro: true })).not.toContain(
      "HttpOnly",
    );
  });
});
