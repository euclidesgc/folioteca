import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Switch } from "./switch";

function ExemploAlternador() {
  return (
    <Switch.Root>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Label>Mostrar arquivados</Switch.Label>
      <Switch.Context>
        {(api) => (
          <Switch.HiddenInput role="switch" aria-checked={api.checked} />
        )}
      </Switch.Context>
    </Switch.Root>
  );
}

describe("Switch", () => {
  it("exposes a switch role named by the label, unchecked by default", () => {
    render(<ExemploAlternador />);
    expect(
      screen.getByRole("switch", { name: "Mostrar arquivados" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("marks aria-checked true once activated", async () => {
    render(<ExemploAlternador />);
    fireEvent.click(screen.getByText("Mostrar arquivados"));
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Mostrar arquivados" }),
      ).toHaveAttribute("aria-checked", "true"),
    );
  });

  it("toggles back to false on a second activation", async () => {
    render(<ExemploAlternador />);
    const rotulo = screen.getByText("Mostrar arquivados");
    fireEvent.click(rotulo);
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Mostrar arquivados" }),
      ).toHaveAttribute("aria-checked", "true"),
    );
    fireEvent.click(rotulo);
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Mostrar arquivados" }),
      ).toHaveAttribute("aria-checked", "false"),
    );
  });
});
