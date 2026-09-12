import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createApp } from "../src/bootstrap";
import type { EnvironmentVariables } from "../src/config/environment-variables";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarSessao } from "./apoio/sessao";

describe("API de configurações da organização (organization settings)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // contorno: mesma razão de `units.e2e-spec.ts` — `Organization` é singleton
  // (D8) e só existe depois da primeira instalação; instala aqui só se este
  // arquivo estiver rodando isolado.
  beforeAll(async () => {
    const boot = await createApp();
    app = boot.app;
    await app.init();
    prisma = app.get(PrismaService);

    const status = await request(app.getHttpServer()).get("/organization");
    if (status.body.status === "SETUP_PENDING") {
      const config = boot.config as ConfigService<EnvironmentVariables, true>;
      const installationCode = config.get("INSTALLATION_CODE", { infer: true });
      await request(app.getHttpServer())
        .post("/installation")
        .send({
          installationCode,
          name: "Administradora de Testes de Organização",
          organizationName: `Organização de Teste de Configuração ${Date.now()}`,
          email: `admin-org-settings-${Date.now()}@teste.folioteca`,
          password: "senha-de-teste-1234",
        });
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("keeps the inheritance default only for the administration role", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const membro = await criarSessao(app);

    const leituraNegada = await request(app.getHttpServer())
      .get("/organization/settings")
      .set("Cookie", membro.cookie);
    expect(leituraNegada.status).toBe(403);

    const escritaNegada = await request(app.getHttpServer())
      .patch("/organization/settings")
      .set("Cookie", membro.cookie)
      .send({ spacesInheritByDefault: true });
    expect(escritaNegada.status).toBe(403);

    try {
      const atualizado = await request(app.getHttpServer())
        .patch("/organization/settings")
        .set("Cookie", admin.cookie)
        .send({ spacesInheritByDefault: true });
      expect(atualizado.status).toBe(200);
      expect(atualizado.body.spacesInheritByDefault).toBe(true);

      const lido = await request(app.getHttpServer())
        .get("/organization/settings")
        .set("Cookie", admin.cookie);
      expect(lido.status).toBe(200);
      expect(lido.body.spacesInheritByDefault).toBe(true);
    } finally {
      await prisma.organization.update({
        where: { singleton: true },
        data: { spacesInheritByDefault: false },
      });
    }
  });
});
