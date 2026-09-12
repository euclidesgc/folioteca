import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import { criacaoAceita, criacaoComFalhaDeRede, DOCUMENTO_CRIADO } from "../api/documents-handlers";
import { NewDocumentButton } from "./new-document-button";

const server = setupServer(criacaoAceita);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderNewDocumentButton() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/", element: <NewDocumentButton /> },
      { path: "/documentos/:id", element: <p>Documento aberto</p> },
    ],
    { initialEntries: ["/"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("NewDocumentButton — contrato", () => {
  it("é um botão com o rótulo do desenho, não um link", () => {
    renderNewDocumentButton();

    expect(screen.getByRole("button", { name: "Novo documento" })).toBeInTheDocument();
  });
});

describe("NewDocumentButton — caminho feliz", () => {
  it("cria o documento e navega para ele", async () => {
    renderNewDocumentButton();
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Novo documento" }));

    expect(await screen.findByText("Documento aberto")).toBeInTheDocument();
  });
});

describe("NewDocumentButton — bordas", () => {
  it("falha de rede vira aviso acessível, sem navegar para lugar nenhum", async () => {
    server.use(criacaoComFalhaDeRede);
    renderNewDocumentButton();
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Novo documento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível criar o documento agora.",
    );
    expect(screen.queryByText("Documento aberto")).not.toBeInTheDocument();
  });

  it("desabilita o botão enquanto a criação está pendente", async () => {
    server.use(
      http.post("*/documents", async () => {
        await delay(20);
        return HttpResponse.json(DOCUMENTO_CRIADO);
      }),
    );
    renderNewDocumentButton();
    const pessoa = userEvent.setup();
    const botao = screen.getByRole("button", { name: "Novo documento" });

    await pessoa.click(botao);

    expect(botao).toBeDisabled();
    expect(await screen.findByText("Documento aberto")).toBeInTheDocument();
  });
});
