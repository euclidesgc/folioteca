import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./avatar";

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
});
