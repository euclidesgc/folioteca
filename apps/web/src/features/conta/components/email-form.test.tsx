import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  comSessao,
  trocaDeEmailAceita,
  trocaDeEmailComFalhaDeRede,
} from "../api/conta-handlers";

const server = setupServer(comSessao, trocaDeEmailAceita);

// motivo: o cliente do Better Auth captura o `fetch` do ambiente quando é
// criado, no import do módulo. Importado estaticamente, ele guardaria o fetch
// original — o que o MSW instala depois nunca seria consultado, e a requisição
// sairia para a rede de verdade. Daí o import tardio, depois do `listen`.
let EmailForm: typeof import("./email-form").EmailForm;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ EmailForm } = await import("./email-form"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function pedirTroca(novo: string) {
  const pessoa = userEvent.setup();
  await pessoa.type(
    screen.getByRole("textbox", { name: "Endereço novo" }),
    novo,
  );
  await pessoa.click(screen.getByRole("button", { name: "Enviar confirmação" }));
}

describe("EmailForm — contrato", () => {
  it("manda o endereço aparado e em minúsculas", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/change-email", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    render(<EmailForm />);

    await pedirTroca("  NOVA@ACME.COM  ");

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({ newEmail: "nova@acme.com" }),
    );
  });
});

describe("EmailForm — caminho feliz", () => {
  it("diz que o endereço antigo continua valendo até o link ser aberto", async () => {
    render(<EmailForm />);

    await pedirTroca("nova@acme.com");

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent("nova@acme.com");
    expect(aviso).toHaveTextContent(
      "Seu endereço continua sendo maria@acme.com",
    );
  });
});

describe("EmailForm — bordas", () => {
  it("pedir o endereço que já é o seu não vira requisição", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/api/auth/change-email", () => {
        houveRequisicao = true;
        return HttpResponse.json({ status: true });
      }),
    );
    render(<EmailForm />);
    await screen.findByText("maria@acme.com");

    await pedirTroca("maria@acme.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este já é o seu endereço.",
    );
    expect(houveRequisicao).toBe(false);
  });

  it("endereço malformado é recusado no cliente", async () => {
    render(<EmailForm />);

    await pedirTroca("nao-e-endereco");

    expect(
      await screen.findByText("Informe um endereço de e-mail válido."),
    ).toBeInTheDocument();
  });

  it("falha de rede não se disfarça de pedido enviado", async () => {
    server.use(trocaDeEmailComFalhaDeRede);
    render(<EmailForm />);

    await pedirTroca("nova@acme.com");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não conseguimos enviar agora.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
