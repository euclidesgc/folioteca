import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // contorno: usa a mesma fábrica que `main.ts` chama entre NestFactory.create
    // e app.listen, para que este teste exercite a montagem de produção — não
    // uma réplica dela que continua verde quando a montagem real muda.
    ({ app } = await createApp());
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
