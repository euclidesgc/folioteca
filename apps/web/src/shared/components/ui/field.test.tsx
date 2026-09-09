import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Field } from "./field";

function CampoDeExemplo({ invalido = false }: { invalido?: boolean }) {
  return (
    <Field.Root invalid={invalido}>
      <Field.Label>E-mail</Field.Label>
      <Field.Control type="email" />
      <Field.Hint>Use o endereço da empresa</Field.Hint>
      {invalido ? <Field.Error>Informe um e-mail válido</Field.Error> : null}
    </Field.Root>
  );
}

describe("Field", () => {
  it("associates the label with the control by id, not just by nesting", () => {
    render(<CampoDeExemplo />);
    expect(screen.getByRole("textbox", { name: "E-mail" })).toBeInTheDocument();
  });

  it("reaches the hint through aria-describedby while the field is at rest", () => {
    render(<CampoDeExemplo />);
    const controle = screen.getByRole("textbox", { name: "E-mail" });
    expect(controle).toHaveAccessibleDescription("Use o endereço da empresa");
    expect(controle).not.toHaveAttribute("aria-invalid", "true");
  });

  it("reaches both hint and error through aria-describedby, and marks aria-invalid, once invalid", () => {
    render(<CampoDeExemplo invalido />);
    const controle = screen.getByRole("textbox", { name: "E-mail" });
    expect(controle).toHaveAttribute("aria-invalid", "true");
    expect(controle).toHaveAccessibleDescription(
      "Use o endereço da empresa Informe um e-mail válido",
    );
  });

  it("carries a graphic mark alongside the error text, so color is never the only signal", () => {
    render(<CampoDeExemplo invalido />);
    const erro = screen.getByText("Informe um e-mail válido");
    const marca = erro.closest("p")?.querySelector("svg");
    expect(marca).toHaveAttribute("aria-hidden", "true");
    expect(erro.textContent?.length).toBeGreaterThan(0);
  });

  it("describes an errored field by its error alone when it carries no hint", () => {
    render(
      <Field.Root invalid hasHint={false}>
        <Field.Label>Nome do documento</Field.Label>
        <Field.Control type="text" />
        <Field.Error>Não consegui salvar: a conexão caiu.</Field.Error>
      </Field.Root>,
    );
    const controle = screen.getByRole("textbox", { name: "Nome do documento" });
    expect(controle).toHaveAttribute("aria-invalid", "true");
    expect(controle).toHaveAccessibleDescription(
      "Não consegui salvar: a conexão caiu.",
    );
  });

  it("leaves a resting field with no hint undescribed, rather than pointing at an absent element", () => {
    render(
      <Field.Root hasHint={false}>
        <Field.Label>Nome do documento</Field.Label>
        <Field.Control type="text" />
      </Field.Root>,
    );
    const controle = screen.getByRole("textbox", { name: "Nome do documento" });
    expect(controle).not.toHaveAttribute("aria-describedby");
  });

  it("throws when a part renders outside of Field.Root, instead of silently losing its wiring", () => {
    expect(() => render(<Field.Label>Solto</Field.Label>)).toThrow();
  });
});
