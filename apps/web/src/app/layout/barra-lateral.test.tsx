import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { ThemeProvider } from "@/shared/theme";
import { useSession } from "@/features/auth/api/auth-client";
import { BarraLateral } from "./barra-lateral";

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

const comOrganizacao = http.get("*/me", () => HttpResponse.json(ME));

const server = setupServer(comOrganizacao);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SESSAO_RESOLVIDA = {
  data: {
    session: {
      id: "sessao-1",
      token: "token-1",
      userId: PESSOA.id,
      expiresAt: "2099-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    user: PESSOA,
  },
  isPending: false,
  isRefetching: false,
  error: null,
  refetch: vi.fn(),
};

const SESSAO_PENDENTE = {
  data: null,
  isPending: true,
  isRefetching: false,
  error: null,
  refetch: vi.fn(),
};

// motivo: o cliente do Better Auth guarda a sessão num store de módulo, global
// e compartilhado entre casos. Em vez de zerar e reimportar o grafo de módulos
// a cada teste — o que estourava o tempo limite no CI —, este dublê isola a
// sessão no limite onde ela é lida, e cada caso a define sem recarregar nada.
vi.mock("@/features/auth/api/auth-client", () => ({
  authClient: {},
  signOut: vi.fn(),
  changeEmail: vi.fn(),
  changePassword: vi.fn(),
  listSessions: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSession: vi.fn(),
  updateUser: vi.fn(),
  useSession: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(useSession).mockReturnValue(
    SESSAO_RESOLVIDA as unknown as ReturnType<typeof useSession>,
  );
});

async function renderBarraLateral(rota = "/inicio") {
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
    vi.mocked(useSession).mockReturnValue(
      SESSAO_PENDENTE as unknown as ReturnType<typeof useSession>,
    );

    await renderBarraLateral();

    expect(
      screen.getByRole("button", { name: "Menu de conta" }),
    ).toBeInTheDocument();
  });
});
