import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { UnitDto } from "@/shared/api";
import { UnidadeNo } from "./unidade-no";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const UNIDADE_COM_GENTE: UnitDto = {
  id: "unidade-design",
  name: "Design",
  isRoot: false,
  unitType: { id: "tipo-depto", name: "Departamento" },
  directMembers: [
    { id: "pessoa-1", name: "Marina Lopes", email: "marina@acme.com", role: "ADMIN" },
    { id: "pessoa-2", name: "Tiago Andrade", email: "tiago@acme.com", role: "MEMBER" },
  ],
  children: [],
};

const UNIDADE_SEM_GENTE: UnitDto = {
  id: "unidade-vazia",
  name: "Operações",
  isRoot: false,
  unitType: null,
  directMembers: [],
  children: [],
};

const RAIZ_SEM_FILHAS: UnitDto = {
  id: "raiz",
  name: "Arcabouço Tecnologia",
  isRoot: true,
  unitType: null,
  directMembers: [],
  children: [],
};

function renderUnidade(unit: UnitDto, isAdmin: boolean) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UnidadeNo unit={unit} isAdmin={isAdmin} />
    </QueryClientProvider>,
  );
}

describe("UnidadeNo — contrato", () => {
  it("mostra o nome, o tipo entre parênteses e a contagem de gente lotada direto", () => {
    renderUnidade(UNIDADE_COM_GENTE, false);

    expect(screen.getByText("Design")).toBeInTheDocument();
    expect(screen.getByText(/\(Departamento\)/)).toBeInTheDocument();
    expect(screen.getByText(/2 pessoas/)).toBeInTheDocument();
  });

  it("traduz o papel de cada pessoa lotada para o rótulo em português", () => {
    renderUnidade(UNIDADE_COM_GENTE, false);

    const marina = screen.getByText("Marina Lopes").closest("li") as HTMLElement;
    const tiago = screen.getByText("Tiago Andrade").closest("li") as HTMLElement;
    expect(within(marina).getByText("Administração")).toBeInTheDocument();
    expect(within(tiago).getByText("Membro")).toBeInTheDocument();
  });

  it("uma unidade sem gente lotada mostra a contagem zero, sem nenhum nome", () => {
    renderUnidade(UNIDADE_SEM_GENTE, false);

    expect(screen.getByText(/0 pessoas/)).toBeInTheDocument();
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
  });
});

describe("UnidadeNo — caminho feliz", () => {
  it("quem administra vê as ações de criar, lotar, renomear e apagar, e consegue renomear a unidade", async () => {
    let corpoEnviado: unknown = null;
    server.use(
      http.patch("*/units/unidade-design", async ({ request }) => {
        corpoEnviado = await request.json();
        return HttpResponse.json({ id: "unidade-design", name: "Produto" });
      }),
    );
    renderUnidade(UNIDADE_COM_GENTE, true);
    const pessoa = userEvent.setup();

    expect(
      screen.getByRole("button", { name: "Criar unidade aqui" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lotar pessoa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apagar" })).toBeInTheDocument();

    await pessoa.click(screen.getByRole("button", { name: "Renomear" }));
    const campo = screen.getByLabelText("Novo nome da unidade");
    await pessoa.clear(campo);
    await pessoa.type(campo, "Produto");
    await pessoa.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(corpoEnviado).toMatchObject({ name: "Produto" }));
    expect(screen.queryByLabelText("Novo nome da unidade")).not.toBeInTheDocument();
  });

  it("a raiz sem filhas mostra o estado vazio onde as unidades entrariam", () => {
    renderUnidade(RAIZ_SEM_FILHAS, true);

    expect(
      screen.getByRole("heading", { name: "Nenhuma unidade abaixo da raiz ainda" }),
    ).toBeInTheDocument();
  });
});

describe("UnidadeNo — bordas", () => {
  it("quem não administra não vê nenhum botão de ação, de criação a promoção", () => {
    renderUnidade(UNIDADE_COM_GENTE, false);

    for (const nome of [
      "Criar unidade aqui",
      "Lotar pessoa",
      "Renomear",
      "Apagar",
      "Desalojar",
      "Tornar administrador",
      "Tornar membro",
    ]) {
      expect(screen.queryByRole("button", { name: nome })).not.toBeInTheDocument();
    }
  });

  it("a raiz não ganha botão de apagar, mesmo para quem administra", () => {
    renderUnidade(RAIZ_SEM_FILHAS, true);

    expect(screen.getByRole("button", { name: "Renomear" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apagar" })).not.toBeInTheDocument();
  });

  it("apagar uma unidade com gente lotada mostra o aviso para esvaziá-la antes", async () => {
    server.use(
      http.delete("*/units/unidade-design", () =>
        HttpResponse.json({ code: "UNIT_NOT_EMPTY", message: "não vazia" }, { status: 409 }),
      ),
    );
    renderUnidade(UNIDADE_COM_GENTE, true);
    const pessoa = userEvent.setup();

    await pessoa.click(screen.getByRole("button", { name: "Apagar" }));

    expect(await screen.findByText("Esvazie a unidade antes de apagar.")).toBeInTheDocument();
  });
});
