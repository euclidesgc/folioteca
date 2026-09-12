import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { criarSessao } from "./apoio/sessao";

describe("GET /me", () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createApp());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("nega acesso sem sessão", async () => {
    const response = await request(app.getHttpServer()).get("/me");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("devolve o papel de quem está autenticado", async () => {
    const sessao = await criarSessao(app);

    const response = await request(app.getHttpServer())
      .get("/me")
      .set("Cookie", sessao.cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: sessao.user.id,
      name: sessao.user.name,
      email: sessao.user.email,
      role: sessao.user.role,
    });
  });
});
