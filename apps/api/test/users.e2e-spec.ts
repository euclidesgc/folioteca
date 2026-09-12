import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createApp } from "../src/bootstrap";
import type { EnvironmentVariables } from "../src/config/environment-variables";
import { criarSessao, type SessaoDeTeste } from "./apoio/sessao";

type UsuarioListado = { id: string; name: string; email: string; role: string };

describe("API de pessoas", () => {
  let app: INestApplication;

  // contorno: mesmo motivo de `units.e2e-spec.ts` — `Organization` é singleton
  // (D8) e `PATCH /users/:id/role` só decide depois da primeira instalação.
  // Instala aqui, e só se ainda não estiver pronta, para o arquivo não
  // depender da ordem em que a suíte completa roda os outros.
  beforeAll(async () => {
    const boot = await createApp();
    app = boot.app;
    await app.init();

    const status = await request(app.getHttpServer()).get("/organization");
    if (status.body.status === "SETUP_PENDING") {
      const config = boot.config as ConfigService<EnvironmentVariables, true>;
      const installationCode = config.get("INSTALLATION_CODE", { infer: true });
      await request(app.getHttpServer())
        .post("/installation")
        .send({
          installationCode,
          name: "Administradora de Testes de Pessoas",
          organizationName: `Organização de Teste de Pessoas ${Date.now()}`,
          email: `admin-pessoas-${Date.now()}@teste.folioteca`,
          password: "senha-de-teste-1234",
        });
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function listarAdministradores(sessao: SessaoDeTeste): Promise<UsuarioListado[]> {
    const response = await request(app.getHttpServer())
      .get("/users")
      .set("Cookie", sessao.cookie);
    return (response.body as UsuarioListado[]).filter((user) => user.role === "ADMIN");
  }

  // motivo: M3 ("nunca zero administradores") vale para a instância inteira,
  // não para um recorte do teste — outros arquivos da suíte também criam
  // administradoras. Rebaixar todas as outras antes de testar o último
  // administrador é o que torna o cenário determinístico sem depender da
  // ordem de execução dos demais arquivos.
  async function rebaixarOutrosAdministradores(
    sessao: SessaoDeTeste,
    manterId: string,
  ): Promise<void> {
    const administradores = await listarAdministradores(sessao);
    for (const administrador of administradores) {
      if (administrador.id === manterId) {
        continue;
      }
      await request(app.getHttpServer())
        .patch(`/users/${administrador.id}/role`)
        .set("Cookie", sessao.cookie)
        .send({ role: "MEMBER" });
    }
  }

  it("despromove um administrador quando há mais de um", async () => {
    const admin1 = await criarSessao(app, { role: "ADMIN" });
    const admin2 = await criarSessao(app, { role: "ADMIN" });

    const response = await request(app.getHttpServer())
      .patch(`/users/${admin2.user.id}/role`)
      .set("Cookie", admin1.cookie)
      .send({ role: "MEMBER" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: admin2.user.id, role: "MEMBER" });
  });

  it("recusa despromover o último administrador", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    await rebaixarOutrosAdministradores(admin, admin.user.id);

    const response = await request(app.getHttpServer())
      .patch(`/users/${admin.user.id}/role`)
      .set("Cookie", admin.cookie)
      .send({ role: "MEMBER" });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("LAST_ADMIN");
  });
});
