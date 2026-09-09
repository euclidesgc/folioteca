import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps unrelated classes together, in the order given", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("makes the later conflicting Tailwind utility win over the earlier one", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("drops falsy values and keeps clsx's conditional object syntax", () => {
    expect(
      cn("base", false && "escondido", undefined, null, {
        ativo: true,
        inativo: false,
      }),
    ).toBe("base ativo");
  });
});
