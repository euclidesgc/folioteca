import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  recuperacaoAceita,
  recuperacaoComFalhaDeRede,
  semSessao,
} from "../api/auth-handlers";

const server = setupServer(semSessao, recuperacaoAceita);

// motivo: o cliente do Better Auth captura o `fetch` do ambiente quando é
// criado, no import do módulo. Importado estaticamente, ele guardaria o fetch
// original — o que o MSW instala depois nunca seria consultado, e a requisição
// sairia para a rede de verdade. Daí o import tardio, depois do `listen`.
let RecuperarSenhaForm: typeof import("./recuperar-senha-form").RecuperarSenhaForm;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ RecuperarSenhaForm } = await import("./recuperar-senha-form"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderForm() {
  const router = createMemoryRouter(
    [{ path: "/recuperar-senha", element: <RecuperarSenhaForm /> }],
    { initialEntries: ["/recuperar-senha"] },
  );
  return render(<RouterProvider router={router} />);
}

async function preencherEEnviar(email: string) {
  const pessoa = userEvent.setup();
  await pessoa.type(screen.getByRole("textbox", { name: "E-mail" }), email);
  await pessoa.click(
    screen.getByRole("button", { name: "Enviar link de recuperação" }),
  );
}

describe("RecuperarSenhaForm — contrato", () => {
  it("manda o endereço aparado e o destino de retorno que o servidor exige", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/request-password-reset", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    renderForm();

    await preencherEEnviar("  MARIA@ACME.COM  ");

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({
        email: "maria@acme.com",
        redirectTo: expect.stringContaining("/redefinir-senha"),
      }),
    );
  });
});

describe("RecuperarSenhaForm — caminho feliz", () => {
  it("confirma o envio sem revelar se o endereço tem conta", async () => {
    renderForm();

    await preencherEEnviar("maria@acme.com");

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("Se houver uma conta com esse endereço");
  });
});

describe("RecuperarSenhaForm — bordas", () => {
  it("endereço malformado é recusado no cliente, sem pedir nada ao servidor", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/api/auth/request-password-reset", () => {
        houveRequisicao = true;
        return HttpResponse.json({ status: true });
      }),
    );
    renderForm();

    await preencherEEnviar("nao-e-endereco");

    expect(
      await screen.findByText("Informe um endereço de e-mail válido."),
    ).toBeInTheDocument();
    expect(houveRequisicao).toBe(false);
  });

  it("falha de rede vira aviso acionável, não tela muda", async () => {
    server.use(recuperacaoComFalhaDeRede);
    renderForm();

    await preencherEEnviar("maria@acme.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não conseguimos enviar agora.",
    );
  });
});
