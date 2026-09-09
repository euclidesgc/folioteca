import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { PaginaViva } from "./design";

const SECOES = ["Cor", "Tipografia", "Espaço", "Raio", "Sombra", "Movimento"] as const;

function setRootToken(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

afterEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.className = "";
});

describe("PaginaViva", () => {
  it("renders the level-1 heading and the six sections it promises", () => {
    render(<PaginaViva />);

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

    render(<PaginaViva />);

    expect(screen.getByText("--color-papel")).toBeInTheDocument();
    expect(screen.getByText("oklch(0.98 0 0)")).toBeInTheDocument();
  });

  it("shows only the token name when no value is passed, with no leftover label", () => {
    render(<PaginaViva />);

    const nome = screen.getByText("--font-body");

    expect(nome.parentElement?.children).toHaveLength(1);
  });

  it("re-reads the token value when the root element's class changes", async () => {
    setRootToken("--radius-sutil", "2px");
    render(<PaginaViva />);
    expect(screen.getByText("2px")).toBeInTheDocument();

    setRootToken("--radius-sutil", "10px");
    document.documentElement.classList.add("tema-escuro");

    await waitFor(() => expect(screen.getByText("10px")).toBeInTheDocument());
    expect(screen.queryByText("2px")).not.toBeInTheDocument();
  });
});
