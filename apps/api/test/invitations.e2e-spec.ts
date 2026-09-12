import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createApp } from "../src/bootstrap";
import type { EnvironmentVariables } from "../src/config/environment-variables";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarSessao, type SessaoDeTeste } from "./apoio/sessao";

describe("API de convites", () => {
  let app: INestApplication;

  // contorno: mesma razão de `units.e2e-spec.ts` — `Organization` é singleton
  // (D8) e a rota só responde depois da primeira instalação; instala aqui só
  // se este arquivo estiver rodando isolado.
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
          name: "Administradora de Testes de Convite",
          organizationName: `Organização de Teste de Convite ${Date.now()}`,
          email: `admin-convites-${Date.now()}@teste.folioteca`,
          password: "senha-de-teste-1234",
        });
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function obterRaiz(sessao: SessaoDeTeste): Promise<string> {
    const response = await request(app.getHttpServer())
      .get("/units")
      .set("Cookie", sessao.cookie);
    return response.body.id as string;
  }

  async function convidar(
    admin: SessaoDeTeste,
    email: string,
    unitId: string,
    role: "ADMIN" | "MEMBER" = "MEMBER",
  ) {
    return request(app.getHttpServer())
      .post("/invitations")
      .set("Cookie", admin.cookie)
      .send({ email, unitId, role });
  }

  it("recusa convite para e-mail que já tem conta", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const pessoaComConta = await criarSessao(app);
    const raizId = await obterRaiz(admin);

    const response = await convidar(admin, pessoaComConta.user.email, raizId);

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("USER_ALREADY_EXISTS");
  });

  it("recusa segundo convite pendente para o mesmo e-mail", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const raizId = await obterRaiz(admin);
    const email = `convidada-${Date.now()}@fora.folioteca`;

    const primeiro = await convidar(admin, email, raizId);
    expect(primeiro.status).toBe(201);

    const segundo = await convidar(admin, email, raizId);

    expect(segundo.status).toBe(409);
    expect(segundo.body.code).toBe("INVITATION_PENDING");
  });

  // contorno: a rota pública `GET /invitations/by-token/:token` nasce na
  // etapa 3 deste plano; até lá, "o link antigo para de bater" (regra 6) só é
  // provável no nível em que a etapa 2 entrega — o hash antigo, único na
  // tabela, deixa de casar com qualquer convite assim que o reenvio grava o
  // novo. A etapa 3 estende esta prova para o 404 `INVITATION_INVALID` via
  // HTTP, quando a rota pública existir.
  it("invalida o token anterior ao reenviar", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const raizId = await obterRaiz(admin);
    const email = `reenviada-${Date.now()}@fora.folioteca`;
    const prisma = app.get(PrismaService);

    const criado = await convidar(admin, email, raizId);
    expect(criado.status).toBe(201);
    const antes = await prisma.invitation.findUniqueOrThrow({
      where: { id: criado.body.id },
      select: { tokenHash: true },
    });

    const reenviado = await request(app.getHttpServer())
      .post(`/invitations/${criado.body.id}/resend`)
      .set("Cookie", admin.cookie);

    expect(reenviado.status).toBe(200);
    const depois = await prisma.invitation.findUniqueOrThrow({
      where: { id: criado.body.id },
      select: { tokenHash: true },
    });
    expect(depois.tokenHash).not.toBe(antes.tokenHash);
    const buscaPeloHashAntigo = await prisma.invitation.findUnique({
      where: { tokenHash: antes.tokenHash },
    });
    expect(buscaPeloHashAntigo).toBeNull();
  });

  it("recusa membro (não admin) criando convite", async () => {
    const membro = await criarSessao(app);
    const raizId = await obterRaiz(membro);

    const response = await convidar(membro, `alguem-${Date.now()}@fora.folioteca`, raizId);

    expect(response.status).toBe(403);
  });
});
