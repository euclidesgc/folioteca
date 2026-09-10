import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  confirmacaoComFalhaDeRede,
  confirmacaoReenviada,
  entrarComCredencialInvalida,
  entrarComEnderecoNaoConfirmado,
  entrarComFalhaDeRede,
  entrarComSucesso,
  semSessao,
} from "../api/auth-handlers";
const server = setupServer(semSessao, entrarComSucesso);

// motivo: o cliente do Better Auth captura o `fetch` do ambiente quando é
// criado, no import do módulo. Importado estaticamente, ele guardaria o fetch
// original — o que o MSW instala depois nunca seria consultado, e a requisição
// sairia para a rede de verdade. Daí o import tardio, depois do `listen`.
let EntrarForm: typeof import("./entrar-form").EntrarForm;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ EntrarForm } = await import("./entrar-form"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderEntrarForm(destinoInicial?: string) {
  const router = createMemoryRouter(
    [
      { path: "/entrar", element: <EntrarForm /> },
      { path: "/documentos", element: <p>Área de documentos</p> },
      { path: "/canais", element: <p>Área de canais</p> },
    ],
    {
      initialEntries: [
        destinoInicial
          ? { pathname: "/entrar", state: { de: destinoInicial } }
          : "/entrar",
      ],
    },
  );
  return render(<RouterProvider router={router} />);
}

async function preencherEEnviar(email: string, senha: string) {
  const pessoa = userEvent.setup();
  await pessoa.type(screen.getByRole("textbox", { name: "E-mail" }), email);
  await pessoa.type(screen.getByLabelText("Senha"), senha);
  await pessoa.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("EntrarForm — contrato", () => {
  it("envia o endereço aparado e em minúsculas, e não o que foi digitado", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/sign-in/email", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ redirect: false, token: "t", user: {} });
      }),
    );
    renderEntrarForm();

    await preencherEEnviar("  MARIA@ACME.COM  ", "uma-senha-qualquer");

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({ email: "maria@acme.com" }),
    );
  });
});

describe("EntrarForm — caminho feliz", () => {
  it("leva ao produto quando a entrada é aceita", async () => {
    renderEntrarForm();

    await preencherEEnviar("maria@acme.com", "uma-senha-qualquer");

    expect(await screen.findByText("Área de documentos")).toBeInTheDocument();
  });

  it("devolve ao destino que a pessoa tentou alcançar antes de entrar", async () => {
    renderEntrarForm("/canais");

    await preencherEEnviar("maria@acme.com", "uma-senha-qualquer");

    expect(await screen.findByText("Área de canais")).toBeInTheDocument();
  });
});

describe("EntrarForm — bordas", () => {
  it("credencial recusada vira aviso que não culpa o endereço nem a senha isoladamente", async () => {
    server.use(entrarComCredencialInvalida);
    renderEntrarForm();

    await preencherEEnviar("maria@acme.com", "senha-errada-longa");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha não conferem.",
    );
  });

  it("endereço não confirmado diz exatamente isso, em vez de mandar trocar a senha", async () => {
    server.use(entrarComEnderecoNaoConfirmado);
    renderEntrarForm();

    await preencherEEnviar("maria@acme.com", "uma-senha-qualquer");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Seu endereço ainda não foi confirmado.",
    );
  });

  it("falha de rede vira mensagem acionável, não tela quebrada", async () => {
    server.use(entrarComFalhaDeRede);
    renderEntrarForm();

    await preencherEEnviar("maria@acme.com", "uma-senha-qualquer");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("endereço malformado é recusado no cliente, sem chegar a pedir nada ao servidor", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/api/auth/sign-in/email", () => {
        houveRequisicao = true;
        return HttpResponse.json({});
      }),
    );
    renderEntrarForm();

    await preencherEEnviar("nao-e-endereco", "uma-senha-qualquer");

    expect(
      await screen.findByText("Informe um endereço de e-mail válido."),
    ).toBeInTheDocument();
    expect(houveRequisicao).toBe(false);
  });

  it("senha vazia é recusada no cliente com erro no próprio campo", async () => {
    renderEntrarForm();
    const pessoa = userEvent.setup();

    await pessoa.type(
      screen.getByRole("textbox", { name: "E-mail" }),
      "maria@acme.com",
    );
    await pessoa.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Informe sua senha.")).toBeInTheDocument();
  });
});

describe("EntrarForm — reenvio da confirmação", () => {
  it("oferece reenviar só quando o endereço está pendente de confirmação", async () => {
    server.use(entrarComCredencialInvalida);
    renderEntrarForm();

    await preencherEEnviar("maria@acme.com", "senha-errada-longa");

    await screen.findByRole("alert");
    expect(
      screen.queryByRole("button", { name: "Reenviar e-mail de confirmação" }),
    ).not.toBeInTheDocument();
  });

  it("reenvia para o endereço que o servidor recusou, aparado e em minúsculas", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      entrarComEnderecoNaoConfirmado,
      http.post("*/api/auth/send-verification-email", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    renderEntrarForm();
    await preencherEEnviar("  MARIA@ACME.COM  ", "uma-senha-qualquer");

    const pessoa = userEvent.setup();
    await pessoa.click(
      await screen.findByRole("button", {
        name: "Reenviar e-mail de confirmação",
      }),
    );

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({ email: "maria@acme.com" }),
    );
  });

  it("confirma o reenvio na própria tela, sem tirar a pessoa daqui", async () => {
    server.use(entrarComEnderecoNaoConfirmado, confirmacaoReenviada);
    renderEntrarForm();
    await preencherEEnviar("maria@acme.com", "uma-senha-qualquer");

    const pessoa = userEvent.setup();
    await pessoa.click(
      await screen.findByRole("button", {
        name: "Reenviar e-mail de confirmação",
      }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Enviamos de novo.",
    );
  });

  it("falha no reenvio não se disfarça de sucesso", async () => {
    server.use(entrarComEnderecoNaoConfirmado, confirmacaoComFalhaDeRede);
    renderEntrarForm();
    await preencherEEnviar("maria@acme.com", "uma-senha-qualquer");

    const pessoa = userEvent.setup();
    await pessoa.click(
      await screen.findByRole("button", {
        name: "Reenviar e-mail de confirmação",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((no) =>
          no.textContent?.includes("Não conseguimos reenviar agora."),
        ),
      ).toBe(true),
    );
  });
});
