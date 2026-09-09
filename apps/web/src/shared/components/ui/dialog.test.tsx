import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dialog } from "./dialog";

function ExemploDialogo() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Abrir diálogo de exemplo</Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Title>Conceder acesso</Dialog.Title>
          <Dialog.CloseTrigger>Cancelar</Dialog.CloseTrigger>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

describe("Dialog", () => {
  it("has no dialog role in the tree before it opens", () => {
    render(<ExemploDialogo />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with the title as its accessible name once the trigger is activated", async () => {
    render(<ExemploDialogo />);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir diálogo de exemplo" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Conceder acesso" }),
    ).toBeInTheDocument();
  });

  it("closes and removes the dialog role when the close trigger is activated", async () => {
    render(<ExemploDialogo />);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir diálogo de exemplo" }),
    );
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
