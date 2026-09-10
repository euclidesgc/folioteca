import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { comSessao, nomeComFalhaDeRede, nomeSalvo } from "../api/conta-handlers";

const server = setupServer(comSessao, nomeSalvo);

// motivo: o cliente do Better Auth captura o `fetch` do ambiente quando é
// criado, no import do módulo. Importado estaticamente, ele guardaria o fetch
// original — o que o MSW instala depois nunca seria consultado, e a requisição
// sairia para a rede de verdade. Daí o import tardio, depois do `listen`.
let NomeForm: typeof import("./nome-form").NomeForm;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ NomeForm } = await import("./nome-form"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("NomeForm — contrato", () => {
  it("chega com o nome de quem está na sessão, e não vazio", async () => {
    render(<NomeForm />);

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Seu nome" })).toHaveValue(
        "Maria Souza",
      ),
    );
  });

  it("manda o nome aparado, e não o que foi digitado com espaços", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/update-user", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    render(<NomeForm />);
    const pessoa = userEvent.setup();
    const campo = await screen.findByRole("textbox", { name: "Seu nome" });

    await pessoa.clear(campo);
    await pessoa.type(campo, "  Maria de Souza  ");
    await pessoa.click(screen.getByRole("button", { name: "Salvar nome" }));

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({ name: "Maria de Souza" }),
    );
  });
});

describe("NomeForm — caminho feliz", () => {
  it("confirma que salvou", async () => {
    render(<NomeForm />);
    const pessoa = userEvent.setup();
    const campo = await screen.findByRole("textbox", { name: "Seu nome" });

    await pessoa.clear(campo);
    await pessoa.type(campo, "Maria de Souza");
    await pessoa.click(screen.getByRole("button", { name: "Salvar nome" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Nome salvo.");
  });
});

describe("NomeForm — bordas", () => {
  it("nome vazio é recusado no cliente, sem pedir nada ao servidor", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/api/auth/update-user", () => {
        houveRequisicao = true;
        return HttpResponse.json({ status: true });
      }),
    );
    render(<NomeForm />);
    const pessoa = userEvent.setup();
    const campo = await screen.findByRole("textbox", { name: "Seu nome" });

    await pessoa.clear(campo);
    await pessoa.click(screen.getByRole("button", { name: "Salvar nome" }));

    expect(await screen.findByText("Informe seu nome.")).toBeInTheDocument();
    expect(houveRequisicao).toBe(false);
  });

  it("falha de rede vira aviso, e não silêncio", async () => {
    server.use(nomeComFalhaDeRede);
    render(<NomeForm />);
    const pessoa = userEvent.setup();
    const campo = await screen.findByRole("textbox", { name: "Seu nome" });

    await pessoa.clear(campo);
    await pessoa.type(campo, "Maria de Souza");
    await pessoa.click(screen.getByRole("button", { name: "Salvar nome" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não conseguimos salvar agora.",
    );
  });
});
