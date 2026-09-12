import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createApp } from "../src/bootstrap";
import type { EnvironmentVariables } from "../src/config/environment-variables";

describe("Instalação", () => {
  let app: INestApplication;
  let codigoCerto: string;

  beforeAll(async () => {
    const boot = await createApp();
    app = boot.app;
    await app.init();
    const config = boot.config as ConfigService<EnvironmentVariables, true>;
    codigoCerto = config.get("INSTALLATION_CODE", { infer: true });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("recusa o código de instalação errado", async () => {
    const response = await request(app.getHttpServer())
      .post("/installation")
      .send({
        installationCode: "codigo-errado-com-mais-de-dezesseis",
        name: "Administradora",
        organizationName: "Empresa de Teste",
        email: `instalacao-${Date.now()}@teste.folioteca`,
        password: "senha-de-teste-1234",
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("INSTALLATION_CODE_INVALID");
  });

  it("instala a instância com o código certo e abre sessão do primeiro administrador", async () => {
    const email = `instalacao-${Date.now()}@teste.folioteca`;
    const organizationName = `Empresa Instalada ${Date.now()}`;

    const response = await request(app.getHttpServer())
      .post("/installation")
      .send({
        installationCode: codigoCerto,
        name: "Primeira Administradora",
        organizationName,
        email,
        password: "senha-de-teste-1234",
      });

    expect(response.status).toBe(201);
    const cookie = response.headers["set-cookie"];
    expect(cookie).toBeDefined();

    const status = await request(app.getHttpServer()).get("/organization");
    expect(status.status).toBe(200);
    expect(status.body).toEqual({ status: "READY", name: organizationName });

    const me = await request(app.getHttpServer())
      .get("/me")
      .set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
    expect(me.body.role).toBe("ADMIN");
  });

  it("recusa a segunda instalação", async () => {
    const response = await request(app.getHttpServer())
      .post("/installation")
      .send({
        installationCode: codigoCerto,
        name: "Segunda Tentativa",
        organizationName: "Outra Empresa",
        email: `segunda-instalacao-${Date.now()}@teste.folioteca`,
        password: "senha-de-teste-1234",
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("INSTALLATION_ALREADY_DONE");
  });
});
