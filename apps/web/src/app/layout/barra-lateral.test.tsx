import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const PESSOA = {
  id: "pessoa-1",
  name: "Marina Lopes",
  email: "marina@arcabouco.com.br",
  emailVerified: true,
  image: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const ME = {
  id: "org-1",
  name: PESSOA.name,
  email: PESSOA.email,
  role: "ADMIN",
  organization: { id: "org-1", name: "Arcabouço Tecnologia" },
  units: [{ id: "raiz", name: "Arcabouço Tecnologia", path: ["Arcabouço Tecnologia"] }],
};

const comSessao = http.get("*/api/auth/get-session", () =>
  HttpResponse.json({
    session: {
      id: "sessao-1",
      token: "token-1",
      userId: PESSOA.id,
      expiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    user: PESSOA,
  }),
);

const comOrganizacao = http.get("*/me", () => HttpResponse.json(ME));

const server = setupServer(comSessao, comOrganizacao);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// motivo: o cliente do Better Auth guarda a sessão num store de módulo, global
// e compartilhado; sem zerar os módulos entre os casos, a sessão que um deles
// obteve continua valendo no caso seguinte, inclusive no que mede o estado
// antes dela chegar.
beforeEach(() => {
  vi.resetModules();
  server.use(comSessao, comOrganizacao);
});

async function renderBarraLateral(rota = "/inicio") {
  // por quê: o `ThemeProvider` precisa vir do mesmo grafo de módulos recém-
  // carregado que `BarraLateral` — importado à parte, seria um contexto React
  // diferente do que `useTema` lê dentro do menu de conta, e o provedor não
  // encontraria quem o consome.
  const [{ BarraLateral }, { ThemeProvider }] = await Promise.all([
    import("./barra-lateral"),
    import("@/shared/theme"),
  ]);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[rota]}>
          <BarraLateral />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("BarraLateral — contrato", () => {
  it("o link de Organização fica fora do nav de Destinos do produto", async () => {
    await renderBarraLateral();

    const nav = await screen.findByRole("navigation", {
      name: "Destinos do produto",
    });
    expect(
      within(nav).queryByRole("link", { name: "Organização" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Organização" }),
    ).toBeInTheDocument();
  });
});

describe("BarraLateral — caminho feliz", () => {
  it("marca o destino atual com aria-current", async () => {
    await renderBarraLateral("/inicio");

    expect(
      await screen.findByRole("link", { name: "Início" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Pesquisa" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("soma Favoritos ao lado de Meus documentos e Lixeira junto das ações de rodapé", async () => {
    await renderBarraLateral();

    const nav = await screen.findByRole("navigation", {
      name: "Destinos do produto",
    });
    expect(within(nav).getByRole("link", { name: "Favoritos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lixeira" })).toBeInTheDocument();
  });

  it("mostra o botão Novo documento antes de qualquer destino", async () => {
    await renderBarraLateral();

    expect(
      await screen.findByRole("button", { name: "Novo documento" }),
    ).toBeInTheDocument();
  });

  it("mostra o nome real da organização, sem a etiqueta de dados de exemplo ao lado", async () => {
    await renderBarraLateral();

    const nomeDaOrganizacao = await screen.findByText(ME.organization.name);
    expect(nomeDaOrganizacao).toBeInTheDocument();
    // decisão: a árvore de espaços continua exemplo (plano 05); só o nome da
    // organização passou a vir de `GET /me` — a etiqueta ao lado dele deixou
    // de fazer sentido, e sobra só a que marca os espaços.
    expect(screen.getAllByText("Dados de exemplo")).toHaveLength(1);
  });
});

describe("BarraLateral — bordas", () => {
  it("antes da sessão carregar, o menu de conta ainda mostra o texto 'Menu de conta'", async () => {
    await renderBarraLateral();

    expect(
      screen.getByRole("button", { name: "Menu de conta" }),
    ).toBeInTheDocument();
  });
});
