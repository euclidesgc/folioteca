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

  it.each([
    ["canal", "border-l-verdete"],
    ["pessoa", "border-l-carimbo"],
    ["privado", "border-l-grafite"],
  ] as const)(
    "carries the %s spine colour through to the rendered element",
    (origin, classe) => {
      const { container } = render(<AccessSpine origin={origin} />);
      expect(container.firstElementChild).toHaveClass(classe);
    },
  );

  it("gives each origin a different spine, so the three never collapse into one", () => {
    const classes = (["canal", "pessoa", "privado"] as const).map((origin) => {
      const { container } = render(<AccessSpine origin={origin} />);
      return container.firstElementChild?.className ?? "";
    });
    expect(new Set(classes).size).toBe(3);
  });
});
