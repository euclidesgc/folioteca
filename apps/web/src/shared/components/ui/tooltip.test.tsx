import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Tooltip } from "./tooltip";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  ResizeObserverStub as unknown as typeof ResizeObserver;

function ExemploDica() {
  return (
    <Tooltip.Root openDelay={0} closeDelay={0}>
      <Tooltip.Trigger>Campo com dica</Tooltip.Trigger>
      <Tooltip.Positioner>
        <Tooltip.Content>Use o nome que aparece na lista</Tooltip.Content>
      </Tooltip.Positioner>
    </Tooltip.Root>
  );
}

describe("Tooltip", () => {
  it("has no tooltip role before the trigger is engaged", () => {
    render(<ExemploDica />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the hint text once the pointer enters the trigger", async () => {
    render(<ExemploDica />);
    const gatilho = screen.getByRole("button", { name: "Campo com dica" });
    fireEvent.pointerMove(gatilho);
    fireEvent.pointerEnter(gatilho);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Use o nome que aparece na lista",
    );
  });

  it("hides the hint again once the pointer leaves", async () => {
    render(<ExemploDica />);
    const gatilho = screen.getByRole("button", { name: "Campo com dica" });
    fireEvent.pointerMove(gatilho);
    fireEvent.pointerEnter(gatilho);
    await screen.findByRole("tooltip");
    fireEvent.pointerLeave(gatilho);
    await waitFor(() =>
      expect(screen.queryByRole("tooltip")).not.toBeInTheDocument(),
    );
  });
});
