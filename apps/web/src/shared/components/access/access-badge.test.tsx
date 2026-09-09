import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccessBadge } from "./access-badge";

describe("AccessBadge", () => {
  it("names each origin in Portuguese, one label per value it receives", () => {
    render(
      <>
        <AccessBadge origin="canal" />
        <AccessBadge origin="pessoa" />
        <AccessBadge origin="privado" />
      </>,
    );
    expect(screen.getByText("Canal")).toBeInTheDocument();
    expect(screen.getByText("Pessoa")).toBeInTheDocument();
    expect(screen.getByText("Privado")).toBeInTheDocument();
  });

  it("carries a graphic mark hidden from assistive tech alongside the label", () => {
    render(<AccessBadge origin="canal" />);
    const etiqueta = screen.getByText("Canal");
    const marca = etiqueta.closest("span")?.querySelector("svg");
    expect(marca).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the label and the mark together under the reduced variant, without losing either", () => {
    render(<AccessBadge origin="pessoa" reduced />);
    const etiqueta = screen.getByText("Pessoa");
    expect(etiqueta.closest("span")?.querySelector("svg")).toBeInTheDocument();
  });
});
