import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ATRIBUTO_DO_TEMA, CHAVE_DO_TEMA } from "@folioteca/tema";
import { ThemeProvider, useTema } from "./theme-provider";

function Sonda() {
  const { tema, alternarTema } = useTema();
  return (
    <button type="button" onClick={alternarTema}>
      tema: {tema}
    </button>
  );
}

function renderSonda() {
  return render(
    <ThemeProvider>
      <Sonda />
    </ThemeProvider>,
  );
}

function fingirPreferenciaDoSistema(prefereEscuro: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (consulta: string) =>
      ({
        matches: prefereEscuro,
        media: consulta,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute(ATRIBUTO_DO_TEMA);
  document.cookie = `${CHAVE_DO_TEMA}=; Max-Age=0; Path=/`;
  vi.restoreAllMocks();
});

describe("ThemeProvider — contrato", () => {
  it("sem escolha guardada, o tema inicial é o que o sistema pede", () => {
    fingirPreferenciaDoSistema(true);

    renderSonda();

    expect(screen.getByRole("button")).toHaveTextContent("tema: escuro");
  });

  it("a escolha já aplicada ao documento vence a preferência do sistema", () => {
    fingirPreferenciaDoSistema(true);
    document.documentElement.setAttribute(ATRIBUTO_DO_TEMA, "claro");

    renderSonda();

    expect(screen.getByRole("button")).toHaveTextContent("tema: claro");
  });
});

describe("ThemeProvider — caminho feliz", () => {
  it("alternar escreve o atributo no documento e grava o cookie que atravessa as origens", async () => {
    fingirPreferenciaDoSistema(false);
    renderSonda();

    await userEvent.click(screen.getByRole("button"));

    expect(document.documentElement.getAttribute(ATRIBUTO_DO_TEMA)).toBe(
      "escuro",
    );
    expect(document.cookie).toContain(`${CHAVE_DO_TEMA}=escuro`);
    expect(screen.getByRole("button")).toHaveTextContent("tema: escuro");
  });
});

describe("ThemeProvider — bordas", () => {
  it("usar o contexto fora do provedor falha com mensagem que nomeia a causa", () => {
    const silencio = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Sonda />)).toThrow(
      "useTema deve ser usado dentro de ThemeProvider",
    );

    silencio.mockRestore();
  });
});
