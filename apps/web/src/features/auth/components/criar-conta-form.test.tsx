import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cadastroAceito, cadastroFreado } from "../api/auth-handlers";

const server = setupServer(cadastroAceito);

let CriarContaForm: typeof import("./criar-conta-form").CriarContaForm;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ CriarContaForm } = await import("./criar-conta-form"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SENHA_VALIDA = "uma-senha-de-doze";

async function preencherEEnviar({
  email = "maria@acme.com",
  senha = SENHA_VALIDA,
}: { email?: string; senha?: string } = {}) {
  const pessoa = userEvent.setup();
  await pessoa.type(
    screen.getByRole("textbox", { name: "Seu nome" }),
    "Maria Souza",
  );
  await pessoa.type(
    screen.getByRole("textbox", { name: "Nome da empresa" }),
    "Acme Ltda",
  );
  await pessoa.type(screen.getByRole("textbox", { name: "E-mail" }), email);
  await pessoa.type(screen.getByLabelText("Senha"), senha);
  await pessoa.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("CriarContaForm — contrato", () => {
  it("envia nome, empresa, endereço normalizado e senha", async () => {
    let corpo: unknown = null;
    server.use(
      http.post("*/auth/register", async ({ request }) => {
        corpo = await request.json();
        return HttpResponse.json(null, { status: 202 });
      }),
    );
    render(<CriarContaForm />);

    await preencherEEnviar({ email: "  MARIA@ACME.COM " });

    await waitFor(() =>
      expect(corpo).toMatchObject({
        name: "Maria Souza",
        organizationName: "Acme Ltda",
        email: "maria@acme.com",
        password: SENHA_VALIDA,
      }),
    );
  });
});

describe("CriarContaForm — caminho feliz", () => {
  it("o aceite substitui o formulário pela mensagem de próximos passos", async () => {
    render(<CriarContaForm />);

    await preencherEEnviar();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Se houver uma conta a criar com esse endereço",
    );
    expect(
      screen.queryByRole("button", { name: "Criar conta" }),
    ).not.toBeInTheDocument();
  });
});

describe("CriarContaForm — bordas", () => {
  it("senha curta é recusada no cliente, sem pedir nada ao servidor", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/auth/register", () => {
        houveRequisicao = true;
        return HttpResponse.json(null, { status: 202 });
      }),
    );
    render(<CriarContaForm />);

    await preencherEEnviar({ senha: "onze-carac" });

    expect(
      await screen.findByText("A senha precisa de pelo menos 12 caracteres."),
    ).toBeInTheDocument();
    expect(houveRequisicao).toBe(false);
  });

  it("excesso de tentativas diz quanto esperar, em vez de repetir o genérico", async () => {
    server.use(cadastroFreado);
    render(<CriarContaForm />);

    await preencherEEnviar();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Muitas tentativas seguidas.",
    );
  });

  // O invariante de privacidade do cadastro: a tela responde a mesma coisa
  // exista ou não a conta, porque a diferença só pode aparecer no e-mail que
  // chega — ou não chega. Se este caso quebrar, a varredura de endereços volta
  // a ser possível pela mensagem.
  it("a mensagem de aceite é a mesma para endereço novo e para endereço já cadastrado", async () => {
    const primeira = render(<CriarContaForm />);
    await preencherEEnviar({ email: "nova@acme.com" });
    const textoDaPrimeira = (await screen.findByRole("status")).textContent;
    primeira.unmount();

    render(<CriarContaForm />);
    await preencherEEnviar({ email: "jaexiste@acme.com" });
    const textoDaSegunda = (await screen.findByRole("status")).textContent;

    expect(textoDaSegunda).toBe(textoDaPrimeira);
  });
});
