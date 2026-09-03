import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { ApiError } from "@/shared/api";
import { getHealth } from "./get-health";
import { healthHandlers } from "./health-handlers";

const server = setupServer(...healthHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("getHealth", () => {
  it("deve fazer uma requisição GET para /health quando é chamada", async () => {
    let requestSeen: Request | undefined;
    server.use(
      http.get("*/health", ({ request }) => {
        requestSeen = request;
        return HttpResponse.json({ status: "ok" });
      }),
    );

    await getHealth();

    expect(requestSeen?.method).toBe("GET");
    expect(new URL(requestSeen?.url ?? "").pathname).toBe("/health");
  });

  it("deve resolver com o corpo tipado quando a API responde 200", async () => {
    const result = await getHealth();

    expect(result).toEqual({ status: "ok" });
  });

  it("deve rejeitar com o status e a mensagem da API quando a API responde com erro", async () => {
    server.use(http.get("*/health", () => HttpResponse.json({ message: "falhou" }, { status: 500 })));

    const error = await getHealth().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).message).toBe("falhou");
  });

  it("deve rejeitar com status nulo quando o sinal já está abortado antes da requisição", async () => {
    const controller = new AbortController();
    controller.abort();

    const error = await getHealth(controller.signal).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBeNull();
  });
});
