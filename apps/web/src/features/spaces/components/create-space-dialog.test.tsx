import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { CreateSpaceDialog } from "./create-space-dialog";

const ME = {
  id: "pessoa-1",
  name: "Marina Lopes",
  email: "marina@arcabouco.com.br",
  role: "MEMBER",
  organization: { id: "org-1", name: "Arcabouço Tecnologia" },
  units: [{ id: "unidade-design", name: "Design", path: ["Arcabouço Tecnologia", "Design"] }],
};

const ARVORE = [
  {
    id: "espaco-design",
    kind: "UNIT",
    name: "Design",
    unitId: "unidade-design",
    restricted: false,
    inheritsFromParent: false,
    managerId: null,
    children: [],
  },
];

const server = setupServer(
  http.get("*/me", () => HttpResponse.json(ME)),
  http.get("*/spaces", () => HttpResponse.json(ARVORE)),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateSpaceDialog />
    </QueryClientProvider>,
  );
}

describe("CreateSpaceDialog — contrato", () => {
  it("recusa criar quando o campo Nome está vazio", async () => {
    const pessoa = userEvent.setup();
    renderDialog();

    await pessoa.click(await screen.findByRole("button", { name: "Criar espaço" }));
    const dialogo = await screen.findByRole("dialog");

    await pessoa.click(within(dialogo).getByRole("button", { name: "Criar espaço" }));

    expect(
      await within(dialogo).findByText("Informe o nome do espaço."),
    ).toBeInTheDocument();
  });
});
