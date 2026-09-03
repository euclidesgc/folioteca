import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HealthStatus } from "./health-status";

const server = setupServer(http.get("*/health", () => HttpResponse.json({ status: "ok" })));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderHealthStatus() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

describe("HealthStatus", () => {
  it("deve mostrar carregando enquanto a consulta está pendente", () => {
    renderHealthStatus();

    expect(screen.getByRole("status")).toHaveTextContent("carregando");
  });

  it("deve mostrar o status da API quando a consulta resolve com sucesso", async () => {
    renderHealthStatus();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ok"));
  });

  it("deve mostrar indisponível quando a consulta falha", async () => {
    server.use(http.get("*/health", () => HttpResponse.json({ message: "falhou" }, { status: 500 })));

    renderHealthStatus();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("indisponível"));
  });
});
