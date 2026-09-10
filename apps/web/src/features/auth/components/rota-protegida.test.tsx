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
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { setupServer } from "msw/node";
import { comSessao, semSessao } from "../api/auth-handlers";

const server = setupServer(semSessao);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// motivo: o cliente do Better Auth guarda a sessão num store de módulo, global e
// compartilhado. Sem zerar os módulos entre os casos, a sessão que um deles
// obteve continua valendo no seguinte, e o caso "sem sessão" passaria a medir o
// resto do anterior em vez do que diz medir.
beforeEach(() => {
  vi.resetModules();
});

function DestinoGuardado() {
  const location = useLocation();
  const de = (location.state as { de?: string } | null)?.de;
  return <p>entrada, voltando para {de ?? "nenhum destino"}</p>;
}

async function renderEm(rota: string) {
  const { RotaProtegida } = await import("./rota-protegida");
  const router = createMemoryRouter(
    [
      {
        element: <RotaProtegida />,
        children: [{ path: "/canais", element: <p>Área de canais</p> }],
      },
      { path: "/entrar", element: <DestinoGuardado /> },
    ],
    { initialEntries: [rota] },
  );
  return render(<RouterProvider router={router} />);
}

describe("RotaProtegida — contrato", () => {
  it("enquanto a sessão não resolve, anuncia a verificação em vez de piscar a tela", async () => {
    await renderEm("/canais");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Verificando sua sessão",
    );
  });
});

describe("RotaProtegida — caminho feliz", () => {
  it("com sessão, entrega o conteúdo protegido", async () => {
    server.use(comSessao);
    await renderEm("/canais");

    expect(await screen.findByText("Área de canais")).toBeInTheDocument();
  });
});

describe("RotaProtegida — bordas", () => {
  it("sem sessão, leva à entrada carregando o destino que foi pedido", async () => {
    await renderEm("/canais");

    expect(
      await screen.findByText("entrada, voltando para /canais"),
    ).toBeInTheDocument();
  });
});
