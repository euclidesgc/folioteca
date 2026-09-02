import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // contorno: sem a guarda, um beforeAll que falha produz um segundo erro
    // aqui, e é esse que o CI reporta — escondendo a causa real atrás de um
    // TypeError sobre `app`.
    if (app) {
      await app.close();
    }
  });

  it('deve devolver 200 com o corpo {"status":"ok"}', async () => {
    const response = await request(app.getHttpServer()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
