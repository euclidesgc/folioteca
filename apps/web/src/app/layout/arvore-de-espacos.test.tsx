import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { ExampleSpace } from "@/shared/example-data/folioteca";
import { ArvoreDeEspacos } from "./arvore-de-espacos";

const ESPACOS: ExampleSpace[] = [
  {
    id: "engenharia",
    name: "Engenharia",
    parentId: null,
    kind: "unit",
    restricted: false,
  },
  {
    id: "backend",
    name: "Backend",
    parentId: "engenharia",
    kind: "unit",
    restricted: false,
  },
  {
    id: "frontend",
    name: "Frontend",
    parentId: "engenharia",
    kind: "unit",
    restricted: false,
  },
  {
    id: "design",
    name: "Design",
    parentId: null,
    kind: "unit",
    restricted: false,
  },
];

function renderArvore() {
  return render(
    <MemoryRouter>
      <ArvoreDeEspacos spaces={ESPACOS} />
    </MemoryRouter>,
  );
}

describe("ArvoreDeEspacos — contrato", () => {
  it("um espaço sem subespaços não ganha botão de expandir", () => {
    renderArvore();

    expect(screen.getByRole("link", { name: "Design" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Expandir Design" }),
    ).not.toBeInTheDocument();
  });
});

describe("ArvoreDeEspacos — caminho feliz", () => {
  it("o botão expande e recolhe o espaço, revelando os subespaços", async () => {
    renderArvore();
    const usuario = userEvent.setup();

    expect(
      screen.queryByRole("link", { name: "Backend" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Frontend" }),
    ).not.toBeInTheDocument();

    const botao = screen.getByRole("button", { name: "Expandir Engenharia" });
    expect(botao).toHaveAttribute("aria-expanded", "false");

    await usuario.click(botao);

    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Backend" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Frontend" })).toBeInTheDocument();

    await usuario.click(botao);

    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "Backend" }),
    ).not.toBeInTheDocument();
  });
});

describe("ArvoreDeEspacos — bordas", () => {
  it("depois de recolher, o botão mantém o nome 'Expandir <espaço>' para abrir de novo", async () => {
    renderArvore();
    const usuario = userEvent.setup();

    const botao = screen.getByRole("button", { name: "Expandir Engenharia" });
    await usuario.click(botao);
    await usuario.click(botao);

    expect(
      screen.getByRole("button", { name: "Expandir Engenharia" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
