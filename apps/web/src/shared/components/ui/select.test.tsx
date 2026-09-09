import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createListCollection } from "@ark-ui/react";
import { Select } from "./select";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollTo ??= function scrollTo() {};

const origens = createListCollection({
  items: [
    { label: "Canal", value: "canal" },
    { label: "Pessoa", value: "pessoa" },
    { label: "Privado", value: "privado" },
  ],
});

function ExemploSelecao() {
  return (
    <Select.Root collection={origens}>
      <Select.Label>Origem do acesso</Select.Label>
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder="Selecione" />
        </Select.Trigger>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          {origens.items.map((item) => (
            <Select.Item key={item.value} item={item}>
              <Select.ItemText>{item.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Positioner>
      <Select.HiddenSelect />
    </Select.Root>
  );
}

describe("Select", () => {
  it("exposes a combobox named by the label, with no listbox before it opens", () => {
    render(<ExemploSelecao />);
    expect(
      screen.getByRole("combobox", { name: "Origem do acesso" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens one option per item and selects on click", async () => {
    render(<ExemploSelecao />);
    const trigger = screen.getByRole("combobox", { name: "Origem do acesso" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.click(screen.getByRole("option", { name: "Pessoa" }));
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Origem do acesso" }),
      ).toHaveTextContent("Pessoa"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  });

  it("selects the second item with Enter, ArrowDown, Enter, from the primitive's own key handling", async () => {
    render(<ExemploSelecao />);
    const trigger = screen.getByRole("combobox", { name: "Origem do acesso" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    const listbox = await screen.findByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Pessoa" })).toHaveAttribute(
        "data-highlighted",
        "",
      ),
    );
    fireEvent.keyDown(listbox, { key: "Enter" });
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: "Origem do acesso" }),
      ).toHaveTextContent("Pessoa"),
    );
  });
});
