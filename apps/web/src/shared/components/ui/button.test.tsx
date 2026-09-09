import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("exposes the button role with its children as the accessible name", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });

  it("fires the click handler it receives, like a plain button would", () => {
    const aoClicar = vi.fn();
    render(<Button onClick={aoClicar}>Confirmar</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it("lets the caller's className win over the default utility of the same group", () => {
    render(<Button className="px-6">Botão com classe de fora</Button>);
    const botao = screen.getByRole("button", {
      name: "Botão com classe de fora",
    });
    const classes = botao.className.split(" ");
    expect(classes).toContain("px-6");
    expect(classes).not.toContain("px-4");
  });

  it("marks a disabled button as unavailable to assistive tech, not only visually", () => {
    render(<Button disabled>Indisponível</Button>);
    expect(screen.getByRole("button", { name: "Indisponível" })).toBeDisabled();
  });
});
