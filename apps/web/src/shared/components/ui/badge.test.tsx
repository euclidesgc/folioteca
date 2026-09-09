import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders its children as visible text", () => {
    render(<Badge>Rascunho</Badge>);
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
  });

  it("keeps the label reachable in both the normal and the reduced variant", () => {
    render(
      <>
        <Badge>Rascunho</Badge>
        <Badge size="reduzida">Canal</Badge>
      </>,
    );
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("Canal")).toBeInTheDocument();
  });

  it("renders as a plain span, not a focusable control", () => {
    render(<Badge>Rascunho</Badge>);
    const etiqueta = screen.getByText("Rascunho");
    expect(etiqueta.tagName).toBe("SPAN");
    expect(etiqueta).not.toHaveAttribute("tabindex");
  });
});
