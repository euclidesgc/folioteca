import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Menu } from "./menu";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

function ExemploMenu({
  aoSelecionar,
}: {
  aoSelecionar: (valor: string) => void;
}) {
  return (
    <Menu.Root onSelect={(detalhe) => aoSelecionar(detalhe.value)}>
      <Menu.Trigger>Abrir menu de exemplo</Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.Item value="canal">
            <Menu.ItemText>Canal</Menu.ItemText>
          </Menu.Item>
          <Menu.Item value="pessoa">
            <Menu.ItemText>Pessoa</Menu.ItemText>
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

describe("Menu", () => {
  it("has no menu role before the trigger is activated", () => {
    render(<ExemploMenu aoSelecionar={() => {}} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens with one menuitem per option once the trigger is activated", async () => {
    render(<ExemploMenu aoSelecionar={() => {}} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menu de exemplo" }),
    );
    expect(await screen.findByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Canal" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Pessoa" }),
    ).toBeInTheDocument();
  });

  it("reports the chosen value and closes itself, with no key handler written by the caller", async () => {
    const aoSelecionar = vi.fn();
    render(<ExemploMenu aoSelecionar={aoSelecionar} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir menu de exemplo" }),
    );
    const menu = await screen.findByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Canal" })).toHaveAttribute(
        "data-highlighted",
        "",
      ),
    );
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Pessoa" })).toHaveAttribute(
        "data-highlighted",
        "",
      ),
    );
    fireEvent.keyDown(menu, { key: "Enter" });
    await waitFor(() => expect(aoSelecionar).toHaveBeenCalledWith("pessoa"));
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });
});
