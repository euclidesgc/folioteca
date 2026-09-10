import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
  comSessao,
  duasSessoes,
  sessaoEncerrada,
  sessoesIndisponiveis,
} from "../api/conta-handlers";

const server = setupServer(comSessao, duasSessoes, sessaoEncerrada);

// motivo: o cliente do Better Auth captura o `fetch` do ambiente quando é
// criado, no import do módulo. Importado estaticamente, ele guardaria o fetch
// original — o que o MSW instala depois nunca seria consultado, e a requisição
// sairia para a rede de verdade. Daí o import tardio, depois do `listen`.
let SessoesLista: typeof import("./sessoes-lista").SessoesLista;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "error" });
  ({ SessoesLista } = await import("./sessoes-lista"));
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderLista() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <SessoesLista />
    </QueryClientProvider>,
  );
}

describe("SessoesLista — caminho feliz", () => {
  it("lista cada lugar onde a conta está aberta", async () => {
    renderLista();

    expect(await screen.findByText(/Chrome em Linux/)).toBeInTheDocument();
    expect(screen.getByText(/Safari em iOS/)).toBeInTheDocument();
  });

  it("marca a sessão de quem está olhando, para não encerrar a própria por engano", async () => {
    renderLista();

    expect(
      await screen.findByText("Chrome em Linux — esta sessão"),
    ).toBeInTheDocument();
  });
});

describe("SessoesLista — contrato", () => {
  it("encerra pelo token da sessão escolhida, e não por outro", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.post("*/api/auth/revoke-session", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    renderLista();
    const pessoa = userEvent.setup();

    await pessoa.click(
      await screen.findByRole("button", { name: "Encerrar" }),
    );

    await waitFor(() =>
      expect(corpoEnviado).toMatchObject({ token: "token-de-outro-lugar" }),
    );
  });
});

describe("SessoesLista — bordas", () => {
  it("a sessão atual não oferece botão de encerrar", async () => {
    renderLista();
    await screen.findByText(/Chrome em Linux/);

    expect(screen.getAllByRole("button", { name: "Encerrar" })).toHaveLength(1);
  });

  it("servidor indisponível vira aviso, não lista vazia que parece conta sem sessão", async () => {
    server.use(sessoesIndisponiveis);
    renderLista();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não conseguimos ler as sessões desta conta agora.",
    );
  });
});
