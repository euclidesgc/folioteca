import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  semSessao,
  senhaComTokenInvalido,
  senhaTrocada,
} from "../api/auth-handlers";

const server = setupServer(semSessao, senhaTrocada);

// motivo: o cliente do Better Auth captura o `fetch` do ambiente quando é
// criado, no import do módulo. Importado estaticamente, ele guardaria o fetch
// original — o que o MSW instala depois nunca seria consultado, e a requisição
// sairia para a rede de verdade. Daí o import tardio, depois do `listen`.
let RedefinirSenhaForm: typeof import("./redefinir-senha-form").RedefinirSenhaForm;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ RedefinirSenhaForm } = await import("./redefinir-senha-form"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderForm(query: string) {
  const router = createMemoryRouter(
    [
      { path: "/redefinir-senha", element: <RedefinirSenhaForm /> },
      { path: "/entrar", element: <p>Tela de entrar</p> },
      { path: "/recuperar-senha", element: <p>Tela de recuperar</p> },
    ],
    { initialEntries: [`/redefinir-senha${query}`] },
  );
  return render(<RouterProvider router={router} />);
}

async function digitarEEnviar(senha: string) {
  const pessoa = userEvent.setup();
  await pessoa.type(screen.getByLabelText("Senha nova"), senha);
  await pessoa.click(screen.getByRole("button", { name: "Trocar senha" }));
}

describe("RedefinirSenhaForm — contrato", () => {
  it("manda ao servidor o token que veio na URL, e não outro", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/reset-password", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    renderForm("?token=token-do-email");

    await digitarEEnviar("uma-senha-bem-longa");

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({
        token: "token-do-email",
        newPassword: "uma-senha-bem-longa",
      }),
    );
  });
});

describe("RedefinirSenhaForm — caminho feliz", () => {
  it("confirma a troca e oferece o caminho de volta para entrar", async () => {
    renderForm("?token=token-do-email");

    await digitarEEnviar("uma-senha-bem-longa");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Senha trocada.",
    );
    expect(
      screen.getByRole("link", { name: "Entrar na Folioteca" }),
    ).toBeInTheDocument();
  });
});

describe("RedefinirSenhaForm — bordas", () => {
  it("link vencido chega como erro na URL e vira convite a pedir outro", async () => {
    renderForm("?error=INVALID_TOKEN");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este link não vale mais.",
    );
    expect(
      screen.getByRole("link", { name: "Pedir um link novo" }),
    ).toBeInTheDocument();
  });

  it("chegada sem token nenhum não mostra formulário que não teria como funcionar", async () => {
    renderForm("");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este link não vale mais.",
    );
    expect(
      screen.queryByRole("button", { name: "Trocar senha" }),
    ).not.toBeInTheDocument();
  });

  it("senha curta é recusada no cliente, sem chegar a pedir nada ao servidor", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/api/auth/reset-password", () => {
        houveRequisicao = true;
        return HttpResponse.json({ status: true });
      }),
    );
    renderForm("?token=token-do-email");

    await digitarEEnviar("curta");

    expect(
      await screen.findByText("A senha precisa de pelo menos 12 caracteres."),
    ).toBeInTheDocument();
    expect(houveRequisicao).toBe(false);
  });

  it("token recusado pelo servidor vira aviso que diz o que fazer", async () => {
    server.use(senhaComTokenInvalido);
    renderForm("?token=token-vencido");

    await digitarEEnviar("uma-senha-bem-longa");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Peça um link novo",
    );
  });
});
