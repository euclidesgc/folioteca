import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  arvoreComUnidade,
  convitePendenteParaOMesmoEmail,
  emailComConta,
} from "../api/convite-handlers";
import { ConvidarPessoaDialog } from "./convidar-pessoa-dialog";

// motivo: jsdom não implementa `ResizeObserver` nem `scrollTo`, e o Select do
// Ark UI os consulta ao posicionar a lista aberta — mesmo dublê de
// `shared/components/ui/select.test.tsx`.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollTo ??= function scrollTo() {};

const server = setupServer(arvoreComUnidade);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers(arvoreComUnidade));
afterAll(() => server.close());

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ConvidarPessoaDialog />
    </QueryClientProvider>,
  );
}

async function abrirDialogo() {
  const pessoa = userEvent.setup();
  await pessoa.click(screen.getByRole("button", { name: "Convidar pessoa" }));
  await screen.findByRole("dialog", { name: "Convidar pessoa" });
  return pessoa;
}

async function escolherUnidade(nome: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Unidade" }));
  // motivo: a opção carrega um prefixo visual de profundidade ("— ") quando a
  // unidade não é a raiz — o nome buscado é o da unidade, não a indentação; e
  // `getByRole` não lê `exact` para o nome (só `getByText` lê), daí a expressão
  // regular em vez de `exact: false`.
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(nome) }));
}

async function escolherPapel(nome: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Papel" }));
  fireEvent.click(await screen.findByRole("option", { name: nome }));
}

describe("ConvidarPessoaDialog — contrato", () => {
  it("manda o e-mail aparado e em minúsculas, com a unidade e o papel escolhidos", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/invitations", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({
          id: "convite-2",
          email: "nova@acme.com",
          unitId: "unidade-design",
          unitName: "Design",
          role: "ADMIN",
          expiresAt: "2099-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        });
      }),
    );
    renderDialog();
    const pessoa = await abrirDialogo();

    await escolherUnidade("Design");
    await escolherPapel("Administrador(a)");
    await pessoa.type(
      screen.getByRole("textbox", { name: "E-mail" }),
      "  NOVA@ACME.COM  ",
    );
    await pessoa.click(screen.getByRole("button", { name: "Enviar convite" }));

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({
        email: "nova@acme.com",
        unitId: "unidade-design",
        role: "ADMIN",
      }),
    );
  });
});

describe("ConvidarPessoaDialog — caminho feliz", () => {
  it("com o papel padrão (Membro), mostra a confirmação com o e-mail enviado", async () => {
    server.use(
      http.post("*/invitations", () =>
        HttpResponse.json({
          id: "convite-2",
          email: "nova@acme.com",
          unitId: "unidade-design",
          unitName: "Design",
          role: "MEMBER",
          expiresAt: "2099-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      ),
    );
    renderDialog();
    const pessoa = await abrirDialogo();

    expect(
      screen.getByRole("combobox", { name: "Papel" }),
    ).toHaveTextContent("Membro");

    await escolherUnidade("Design");
    await pessoa.type(screen.getByRole("textbox", { name: "E-mail" }), "nova@acme.com");
    await pessoa.click(screen.getByRole("button", { name: "Enviar convite" }));

    const confirmacao = await screen.findByRole("status");
    expect(confirmacao).toHaveTextContent("Convite enviado para nova@acme.com.");
    expect(screen.queryByRole("button", { name: "Enviar convite" })).not.toBeInTheDocument();
  });
});

describe("ConvidarPessoaDialog — bordas", () => {
  it("recusa um e-mail que já tem conta na Folioteca, com a razão do servidor", async () => {
    server.use(emailComConta);
    renderDialog();
    const pessoa = await abrirDialogo();

    await escolherUnidade("Design");
    await pessoa.type(screen.getByRole("textbox", { name: "E-mail" }), "ja-tem-conta@acme.com");
    await pessoa.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este e-mail já tem conta na Folioteca.",
    );
  });

  it("recusa um segundo convite pendente para o mesmo e-mail", async () => {
    server.use(convitePendenteParaOMesmoEmail);
    renderDialog();
    const pessoa = await abrirDialogo();

    await escolherUnidade("Design");
    await pessoa.type(screen.getByRole("textbox", { name: "E-mail" }), "pendente@acme.com");
    await pessoa.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um convite pendente para este e-mail.",
    );
  });

  it("sem escolher uma unidade, a validação do cliente recusa e nada é mandado ao servidor", async () => {
    let houveRequisicao = false;
    server.use(
      http.post("*/invitations", () => {
        houveRequisicao = true;
        return HttpResponse.json({});
      }),
    );
    renderDialog();
    const pessoa = await abrirDialogo();

    await pessoa.type(screen.getByRole("textbox", { name: "E-mail" }), "alguem@acme.com");
    await pessoa.click(screen.getByRole("button", { name: "Enviar convite" }));

    expect(await screen.findByText("Selecione uma unidade.")).toBeInTheDocument();
    expect(houveRequisicao).toBe(false);
  });
});
