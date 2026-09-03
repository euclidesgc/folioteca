import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { createApp as CreateApp } from "../src/bootstrap";

async function bootWithNodeEnv(
  nodeEnv: string,
  webOrigin?: string,
): Promise<INestApplication> {
  // contorno: `AppModule` chama `ConfigModule.forRoot` na avaliação do módulo,
  // e o Node só avalia um módulo uma vez por processo — sem isolar o require,
  // o cenário de produção desta suíte herdaria o NODE_ENV validado pelo
  // cenário anterior.
  process.env.NODE_ENV = nodeEnv;
  if (webOrigin === undefined) {
    delete process.env.WEB_ORIGIN;
  } else {
    process.env.WEB_ORIGIN = webOrigin;
  }
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

describe("Security headers", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWebOrigin = process.env.WEB_ORIGIN;

  afterAll(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalWebOrigin === undefined) {
      delete process.env.WEB_ORIGIN;
    } else {
      process.env.WEB_ORIGIN = originalWebOrigin;
    }
  });

  describe("fora de produção", () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await bootWithNodeEnv("test");
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it("deve devolver x-content-type-options igual a nosniff em GET /health", async () => {
      const response = await request(app.getHttpServer()).get("/health");

      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("não deve devolver x-powered-by em GET /health", async () => {
      const response = await request(app.getHttpServer()).get("/health");

      expect(response.headers["x-powered-by"]).toBeUndefined();
    });

    it("não deve devolver content-security-policy em GET /health", async () => {
      const response = await request(app.getHttpServer()).get("/health");

      expect(response.headers["content-security-policy"]).toBeUndefined();
    });

    it("não deve devolver strict-transport-security em GET /health fora de produção", async () => {
      const response = await request(app.getHttpServer()).get("/health");

      expect(
        response.headers["strict-transport-security"],
      ).toBeUndefined();
    });

    it("deve devolver x-frame-options igual a DENY em GET /health", async () => {
      const response = await request(app.getHttpServer()).get("/health");

      expect(response.headers["x-frame-options"]).toBe("DENY");
    });

    it("deve devolver cross-origin-resource-policy igual a same-origin em GET /health", async () => {
      const response = await request(app.getHttpServer()).get("/health");

      expect(response.headers["cross-origin-resource-policy"]).toBe(
        "same-origin",
      );
    });
  });

  describe("em produção", () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await bootWithNodeEnv("production", "https://app.folioteca.exemplo");
    });

    afterAll(async () => {
      if (app) {
        await app.close();
      }
    });

    it("deve devolver strict-transport-security com max-age de um ano e includeSubDomains, sem preload", async () => {
      const response = await request(app.getHttpServer()).get("/health");

      expect(response.headers["strict-transport-security"]).toBe(
        "max-age=31536000; includeSubDomains",
      );
    });
  });
});
