import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { createApp as CreateApp } from "../src/bootstrap";

async function bootWithWebOrigin(webOrigin: string): Promise<INestApplication> {
  // contorno: `AppModule` chama `ConfigModule.forRoot` na avaliação do módulo,
  // e o Node só avalia um módulo uma vez por processo — sem isolar o require,
  // o segundo cenário desta suíte herdaria o WEB_ORIGIN validado pelo primeiro.
  process.env.WEB_ORIGIN = webOrigin;
  let boot!: typeof CreateApp;
  jest.isolateModules(() => {
    boot = jest.requireActual<{ createApp: typeof CreateApp }>(
      "../src/bootstrap",
    ).createApp;
  });
  const { app } = await boot();
  await app.init();
  return app;
}

describe("CORS", () => {
  const originalWebOrigin = process.env.WEB_ORIGIN;

  afterAll(() => {
    if (originalWebOrigin === undefined) {
      delete process.env.WEB_ORIGIN;
    } else {
      process.env.WEB_ORIGIN = originalWebOrigin;
    }
  });

  describe("com WEB_ORIGIN contendo duas origens separadas por vírgula", () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await bootWithWebOrigin(
        "http://localhost:5173,https://app.folioteca.exemplo",
      );
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it("deve ecoar access-control-allow-origin para a origem que está na lista", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .set("Origin", "https://app.folioteca.exemplo");

      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://app.folioteca.exemplo",
      );
    });

    it("não deve devolver access-control-allow-origin para uma origem fora da lista", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .set("Origin", "https://intruso.exemplo");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("com WEB_ORIGIN contendo uma única origem, sem vírgula", () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await bootWithWebOrigin("http://localhost:5173");
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it("deve ecoar access-control-allow-origin para a única origem autorizada", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .set("Origin", "http://localhost:5173");

      expect(response.headers["access-control-allow-origin"]).toBe(
        "http://localhost:5173",
      );
    });

    it("não deve devolver access-control-allow-origin para outra origem", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .set("Origin", "https://app.folioteca.exemplo");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});
