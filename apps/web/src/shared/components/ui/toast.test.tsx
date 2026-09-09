import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "./toast";

describe("Toast", () => {
  it("exposes a status role carrying its message", () => {
    render(<Toast>Publicado</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Publicado");
  });

  it("keeps the message under the success tone too, since a tone paints, it doesn't hide", () => {
    render(<Toast tone="sucesso">Publicado</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Publicado");
  });

  it("keeps a single status region per toast, not a duplicated announcement", () => {
    render(<Toast>Publicado</Toast>);
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });
});
