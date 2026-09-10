import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  comSessao,
  senhaAtualRecusada,
  senhaTrocadaNoPerfil,
} from "../api/conta-handlers";

const server = setupServer(comSessao, senhaTrocadaNoPerfil);

// motivo: o cliente do Better Auth captura o `fetch` do ambiente quando é
// criado, no import do módulo. Importado estaticamente, ele guardaria o fetch
// original — o que o MSW instala depois nunca seria consultado, e a requisição
// sairia para a rede de verdade. Daí o import tardio, depois do `listen`.
let SenhaForm: typeof import("./senha-form").SenhaForm;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ SenhaForm } = await import("./senha-form"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function preencherEEnviar(atual: string, nova: string) {
  const pessoa = userEvent.setup();
  await pessoa.type(screen.getByLabelText("Senha atual"), atual);
  await pessoa.type(screen.getByLabelText("Senha nova"), nova);
  await pessoa.click(screen.getByRole("button", { name: "Trocar senha" }));
}

describe("SenhaForm — contrato", () => {
  it("manda a senha atual junto com a nova, que é o que separa troca de sequestro", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/change-password", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    render(<SenhaForm />);

    await preencherEEnviar("a-senha-de-agora", "uma-senha-bem-longa");

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({
        currentPassword: "a-senha-de-agora",
        newPassword: "uma-senha-bem-longa",
        revokeOtherSessions: true,
      }),
    );
  });

  it("respeita a escolha de manter as outras sessões abertas", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/change-password", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    render(<SenhaForm />);
    const pessoa = userEvent.setup();

    await pessoa.click(
      screen.getByRole("checkbox", {
        name: "Encerrar as outras sessões desta conta",
      }),
    );
    await preencherEEnviar("a-senha-de-agora", "uma-senha-bem-longa");

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({ revokeOtherSessions: false }),
    );
  });
});

describe("SenhaForm — caminho feliz", () => {
  it("confirma a troca e esvazia os campos, para a senha não ficar na tela", async () => {
    render(<SenhaForm />);

    await preencherEEnviar("a-senha-de-agora", "uma-senha-bem-longa");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Senha trocada.",
    );
    expect(screen.getByLabelText("Senha atual")).toHaveValue("");
    expect(screen.getByLabelText("Senha nova")).toHaveValue("");
  });
});

describe("SenhaForm — bordas", () => {
  it("senha atual errada diz exatamente isso, sem culpar a senha nova", async () => {
    server.use(senhaAtualRecusada);
    render(<SenhaForm />);

    await preencherEEnviar("nao-era-essa", "uma-senha-bem-longa");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A senha atual não confere.",
    );
  });

  it("senha nova curta é recusada no cliente, sem chegar a pedir nada ao servidor", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/api/auth/change-password", () => {
        houveRequisicao = true;
        return HttpResponse.json({ status: true });
      }),
    );
    render(<SenhaForm />);

    await preencherEEnviar("a-senha-de-agora", "curta");

    expect(
      await screen.findByText("A senha precisa de pelo menos 12 caracteres."),
    ).toBeInTheDocument();
    expect(houveRequisicao).toBe(false);
  });

  it("senha atual vazia é recusada no próprio campo", async () => {
    render(<SenhaForm />);
    const pessoa = userEvent.setup();

    await pessoa.type(screen.getByLabelText("Senha nova"), "uma-senha-bem-longa");
    await pessoa.click(screen.getByRole("button", { name: "Trocar senha" }));

    expect(
      await screen.findByText("Informe a senha atual."),
    ).toBeInTheDocument();
  });
});
