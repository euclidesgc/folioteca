import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { useDocument } from "./use-document";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderUseDocument(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return renderHook(() => useDocument(id), { wrapper: Wrapper });
}

describe("useDocument — caminho feliz", () => {
  it("devolve o documento quando a API o encontra", async () => {
    server.use(
      http.get("*/documents/documento-1", () =>
        HttpResponse.json({
          id: "documento-1",
          title: "Notas",
          ownerId: "pessoa-1",
          createdById: "pessoa-1",
          content: [],
          deletedAt: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          updatedAt: "2026-09-01T00:00:00.000Z",
          favorited: false,
        }),
      ),
    );

    const { result } = renderUseDocument("documento-1");

    await waitFor(() => expect(result.current.data?.id).toBe("documento-1"));
  });
});

describe("useDocument — bordas", () => {
  it("traduz 404 DOCUMENT_NOT_FOUND em null, não em erro", async () => {
    server.use(
      http.get("*/documents/inexistente", () =>
        HttpResponse.json({ code: "DOCUMENT_NOT_FOUND" }, { status: 404 }),
      ),
    );

    const { result } = renderUseDocument("inexistente");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it("outros erros de servidor continuam erro, não se disfarçam de 'não encontrado'", async () => {
    server.use(
      http.get("*/documents/instavel", () => HttpResponse.json({}, { status: 500 })),
    );

    const { result } = renderUseDocument("instavel");

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
