import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("Field.Password", () => {
  function CampoDeSenha() {
    return (
      <Field.Root>
        <Field.Label>Senha</Field.Label>
        <Field.Password defaultValue="uma-senha-de-doze" />
        <Field.Hint>De 12 a 128 caracteres</Field.Hint>
      </Field.Root>
    );
  }

  it("nasce oculto, e o gatilho oferece revelar", () => {
    render(<CampoDeSenha />);
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Mostrar senha" }),
    ).toBeInTheDocument();
  });

  it("revela o que foi digitado e passa a oferecer o caminho de volta", async () => {
    const pessoa = userEvent.setup();
    render(<CampoDeSenha />);

    await pessoa.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Senha")).toHaveValue("uma-senha-de-doze");
    expect(
      screen.getByRole("button", { name: "Ocultar senha" }),
    ).toBeInTheDocument();
  });

  it("volta a ocultar na segunda vez", async () => {
    const pessoa = userEvent.setup();
    render(<CampoDeSenha />);

    await pessoa.click(screen.getByRole("button", { name: "Mostrar senha" }));
    await pessoa.click(screen.getByRole("button", { name: "Ocultar senha" }));

    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  });

  // O gatilho vive dentro de um <form>: botão sem `type` é submit por padrão, e
  // olhar a senha enviaria o formulário. Se este caso quebrar, o formulário de
  // entrada volta a enviar sozinho.
  it("olhar a senha não envia o formulário que a contém", async () => {
    const pessoa = userEvent.setup();
    let enviou = false;
    render(
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviou = true;
        }}
      >
        <CampoDeSenha />
      </form>,
    );

    await pessoa.click(screen.getByRole("button", { name: "Mostrar senha" }));

    expect(enviou).toBe(false);
  });

  it("mantém a fiação de acessibilidade do campo, dica inclusive", () => {
    render(<CampoDeSenha />);
    expect(screen.getByLabelText("Senha")).toHaveAccessibleDescription(
      "De 12 a 128 caracteres",
    );
  });

  it("marca aria-invalid quando o campo está inválido", () => {
    render(
      <Field.Root invalid hasHint={false}>
        <Field.Label>Senha</Field.Label>
        <Field.Password />
        <Field.Error>Informe sua senha.</Field.Error>
      </Field.Root>,
    );
    const controle = screen.getByLabelText("Senha");
    expect(controle).toHaveAttribute("aria-invalid", "true");
    expect(controle).toHaveAccessibleDescription("Informe sua senha.");
  });
});
