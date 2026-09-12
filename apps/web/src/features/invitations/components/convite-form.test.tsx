import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  aceiteComSucesso,
  aceiteRecusado,
  convitePublicoInvalido,
  convitePublicoValido,
} from "../api/convite-handlers";
import { ConviteForm } from "./convite-form";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderForm(token: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: "/convite/:token", element: <ConviteForm /> },
      { path: "/entrar", element: <p>Tela de entrar</p> },
      { path: "/inicio", element: <p>Tela de início</p> },
    ],
    { initialEntries: [`/convite/${token}`] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function preencherEEnviar(nome: string, senha: string) {
  const pessoa = userEvent.setup();
  await pessoa.type(screen.getByLabelText("Nome"), nome);
  await pessoa.type(screen.getByLabelText("Senha nova"), senha);
  await pessoa.click(screen.getByRole("button", { name: "Criar minha conta" }));
}

describe("ConviteForm — contrato", () => {
  it("consulta o convite do token que veio na URL, e não outro", async () => {
    let tokenConsultado: string | null = null;
    server.use(
      http.get("*/invitations/by-token/:token", ({ params }) => {
        tokenConsultado = params.token as string;
        return HttpResponse.json({
          organizationName: "Acme",
          unitName: "Design",
          maskedEmail: "n***@acme.com",
          expiresAt: "2099-01-01T00:00:00.000Z",
        });
      }),
    );
    renderForm("token-do-convite");

    await screen.findByRole("heading", { name: "Você foi convidado para Acme" });
    expect(tokenConsultado).toBe("token-do-convite");
  });
});

describe("ConviteForm — caminho feliz", () => {
  it("mostra a organização, o e-mail mascarado e a unidade, e aceita com nome e senha", async () => {
    server.use(convitePublicoValido, aceiteComSucesso);
    renderForm("token-valido");

    expect(
      await screen.findByRole("heading", { name: "Você foi convidado para Acme" }),
    ).toBeInTheDocument();
    const descricao = screen.getByText(/Convite para/);
    expect(descricao).toHaveTextContent("n***@acme.com");
    expect(descricao).toHaveTextContent("Design");

    await preencherEEnviar("Marina Lopes", "uma-senha-bem-longa");

    expect(await screen.findByRole("status")).toHaveTextContent("Conta criada.");
  });
});

describe("ConviteForm — bordas", () => {
  it("mostra convite inválido quando o link não vale mais", async () => {
    server.use(convitePublicoInvalido);
    renderForm("token-vencido");

    expect(
      await screen.findByRole("heading", { name: "Convite inválido" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Nome")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Senha nova")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Já tem conta? Entrar" })).toBeInTheDocument();
  });

  it("convite que vira inválido entre a consulta e o envio reaproveita o texto do estado inválido", async () => {
    server.use(convitePublicoValido, aceiteRecusado);
    renderForm("token-valido");

    await screen.findByRole("heading", { name: "Você foi convidado para Acme" });
    await preencherEEnviar("Marina Lopes", "uma-senha-bem-longa");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este link não vale mais.",
    );
  });
});
