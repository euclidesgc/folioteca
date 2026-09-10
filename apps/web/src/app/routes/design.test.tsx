import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ATRIBUTO_DO_TEMA } from "@folioteca/tema";
import { ThemeProvider } from "@/shared/theme";
import { PaginaViva } from "./design";

const SECOES = [
  "Cor",
  "Tipografia",
  "Espaço",
  "Raio",
  "Sombra",
  "Movimento",
] as const;

function setRootToken(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

function renderPaginaViva() {
  return render(
    <ThemeProvider>
      <PaginaViva />
    </ThemeProvider>,
  );
}

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute(ATRIBUTO_DO_TEMA);
});

describe("PaginaViva", () => {
  it("renders the level-1 heading and the six sections it promises", () => {
    renderPaginaViva();

    expect(
      screen.getByRole("heading", { level: 1, name: "Página viva" }),
    ).toBeInTheDocument();

    for (const titulo of SECOES) {
      expect(
        screen.getByRole("heading", { level: 2, name: titulo }),
      ).toBeInTheDocument();
    }
  });

  it("shows the token name and its value once the root already carries it on mount", () => {
    setRootToken("--color-papel", "oklch(0.98 0 0)");

    renderPaginaViva();

    expect(screen.getByText("--color-papel")).toBeInTheDocument();
    expect(screen.getByText("oklch(0.98 0 0)")).toBeInTheDocument();
  });

  it("shows only the token name when no value is passed, with no leftover label", () => {
    renderPaginaViva();

    const nome = screen.getByText("--font-body");

    expect(nome.parentElement?.children).toHaveLength(1);
  });

  it("re-reads the token value when the root element's theme attribute changes", async () => {
    setRootToken("--radius-sutil", "2px");
    renderPaginaViva();
    expect(screen.getByText("2px")).toBeInTheDocument();

    setRootToken("--radius-sutil", "10px");
    document.documentElement.setAttribute(ATRIBUTO_DO_TEMA, "escuro");

    await waitFor(() => expect(screen.getByText("10px")).toBeInTheDocument());
    expect(screen.queryByText("2px")).not.toBeInTheDocument();
  });
});
