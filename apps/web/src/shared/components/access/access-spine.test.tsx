import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AccessSpine, accessSpineVariants } from "./access-spine";

describe("accessSpineVariants", () => {
  it("maps each access origin to a distinct theme border color, never an arbitrary value", () => {
    expect(accessSpineVariants({ origin: "canal" })).toContain(
      "border-l-verdete",
    );
    expect(accessSpineVariants({ origin: "pessoa" })).toContain(
      "border-l-carimbo",
    );
    expect(accessSpineVariants({ origin: "privado" })).toContain(
      "border-l-grafite",
    );
  });
});

describe("AccessSpine", () => {
  it("renders a decorative bar hidden from assistive tech", () => {
    const { container } = render(<AccessSpine origin="canal" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
