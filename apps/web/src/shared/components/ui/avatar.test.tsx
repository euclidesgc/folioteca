import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, avatarVariants } from "./avatar";

describe("Avatar", () => {
  it("exposes an image role named after the full person's name", () => {
    render(<Avatar name="Maria Fontoura" />);
    expect(
      screen.getByRole("img", { name: "Maria Fontoura" }),
    ).toBeInTheDocument();
  });

  it("shows the initials of the first and last name as its visible fallback", () => {
    render(<Avatar name="Maria Fontoura" />);
    expect(
      screen.getByRole("img", { name: "Maria Fontoura" }),
    ).toHaveTextContent("MF");
  });

  it("falls back to a single initial for a one-word name", () => {
    render(<Avatar name="Cher" />);
    expect(screen.getByRole("img", { name: "Cher" })).toHaveTextContent("C");
  });

  it("maps each size to a different box, so the variant is not decorative", () => {
    expect(avatarVariants({ size: "sm" })).toContain("size-8");
    expect(avatarVariants({ size: "md" })).toContain("size-10");
    expect(avatarVariants({ size: "lg" })).toContain("size-12");
    expect(avatarVariants({ size: "lg" })).not.toContain("size-8");
  });

  it("falls back to the medium box when no size is asked for", () => {
    expect(avatarVariants({})).toContain("size-10");
  });
});
