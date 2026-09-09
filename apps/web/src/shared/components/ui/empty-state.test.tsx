import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("shows the title it is given", () => {
    render(<EmptyState title="Nenhum documento por aqui" />);
    expect(screen.getByText("Nenhum documento por aqui")).toBeInTheDocument();
  });

  it("shows the optional description alongside the title", () => {
    render(
      <EmptyState
        title="Nenhum documento por aqui"
        description="Publique o primeiro para começar."
      />,
    );
    expect(
      screen.getByText("Publique o primeiro para começar."),
    ).toBeInTheDocument();
  });

  it("renders no description paragraph when none is given", () => {
    render(<EmptyState title="Nenhum documento por aqui" />);
    expect(
      screen.queryByText("Publique o primeiro para começar."),
    ).not.toBeInTheDocument();
  });

  it("hosts the action it receives, like a button to create the first item", () => {
    render(
      <EmptyState
        title="Nenhum documento por aqui"
        action={<button type="button">Criar documento</button>}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Criar documento" }),
    ).toBeInTheDocument();
  });
});
