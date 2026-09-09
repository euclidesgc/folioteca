import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Checkbox } from "./checkbox";

function ExemploCaixaDeMarcacao() {
  return (
    <Checkbox.Root>
      <Checkbox.Control>
        <Checkbox.Indicator />
      </Checkbox.Control>
      <Checkbox.Label>Aceito os termos</Checkbox.Label>
      <Checkbox.HiddenInput />
    </Checkbox.Root>
  );
}

describe("Checkbox", () => {
  it("exposes a checkbox role named by the label, unchecked by default", () => {
    render(<ExemploCaixaDeMarcacao />);
    expect(
      screen.getByRole("checkbox", { name: "Aceito os termos" }),
    ).not.toBeChecked();
  });

  it("checks on click, from the base's own state", async () => {
    render(<ExemploCaixaDeMarcacao />);
    fireEvent.click(screen.getByText("Aceito os termos"));
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Aceito os termos" }),
      ).toBeChecked(),
    );
  });

  it("unchecks back on a second activation", async () => {
    render(<ExemploCaixaDeMarcacao />);
    const rotulo = screen.getByText("Aceito os termos");
    fireEvent.click(rotulo);
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Aceito os termos" }),
      ).toBeChecked(),
    );
    fireEvent.click(rotulo);
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "Aceito os termos" }),
      ).not.toBeChecked(),
    );
  });
});
