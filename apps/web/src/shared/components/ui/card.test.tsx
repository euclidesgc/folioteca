import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./card";

describe("Card", () => {
  it("renders as a div by default, holding whatever content it is given", () => {
    render(<Card>Conteúdo do cartão</Card>);
    expect(screen.getByText("Conteúdo do cartão")).toBeInTheDocument();
  });

  it("renders as the element and role the caller asks for", () => {
    render(
      <Card as="article" aria-label="Documento de canal">
        Relatório mensal
      </Card>,
    );
    expect(
      screen.getByRole("article", { name: "Documento de canal" }),
    ).toBeInTheDocument();
  });

  it("keeps the default div free of any role it wasn't given", () => {
    render(<Card>Conteúdo do cartão</Card>);
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});
