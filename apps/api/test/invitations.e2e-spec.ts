import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createApp } from "../src/bootstrap";
import type { EnvironmentVariables } from "../src/config/environment-variables";
import { PrismaService } from "../src/prisma/prisma.service";
import { obterTokenDoConvite } from "./apoio/correio";
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
    const tokenAntigo = await obterTokenDoConvite(email);

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

    // regra 6/8: o link antigo, com o hash antigo, vira 404 INVITATION_INVALID
    // na hora — a rota pública não diferencia "trocado" de "nunca existiu".
    const consultaComTokenAntigo = await request(app.getHttpServer()).get(
      `/invitations/by-token/${tokenAntigo}`,
    );
    expect(consultaComTokenAntigo.status).toBe(404);
    expect(consultaComTokenAntigo.body.code).toBe("INVITATION_INVALID");
  });

  it("convite vencido responde convite inválido", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const raizId = await obterRaiz(admin);
    const email = `vencida-${Date.now()}@fora.folioteca`;
    const prisma = app.get(PrismaService);

    const criado = await convidar(admin, email, raizId);
    expect(criado.status).toBe(201);
    const token = await obterTokenDoConvite(email);

    await prisma.invitation.update({
      where: { id: criado.body.id },
      data: { expiresAt: new Date("2020-01-01T00:00:00.000Z") },
    });

    const consulta = await request(app.getHttpServer()).get(`/invitations/by-token/${token}`);

    expect(consulta.status).toBe(404);
    expect(consulta.body.code).toBe("INVITATION_INVALID");
  });

  it("aceita convite cria pessoa lotada e sessão", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const raizId = await obterRaiz(admin);
    const email = `aceita-${Date.now()}@fora.folioteca`;

    const criado = await convidar(admin, email, raizId, "MEMBER");
    expect(criado.status).toBe(201);
    const token = await obterTokenDoConvite(email);

    const consultaPublica = await request(app.getHttpServer()).get(
      `/invitations/by-token/${token}`,
    );
    expect(consultaPublica.status).toBe(200);
    expect(consultaPublica.body.unitName).toBe(criado.body.unitName);

    const aceite = await request(app.getHttpServer())
      .post(`/invitations/${token}/accept`)
      .send({ name: "Pessoa Convidada", password: "senha-de-teste-1234" });

    expect(aceite.status).toBe(200);
    const cookie = (aceite.headers["set-cookie"] as unknown as string[] | undefined)?.[0];
    expect(cookie).toBeDefined();

    const me = await request(app.getHttpServer())
      .get("/me")
      .set("Cookie", cookie ?? "");

    expect(me.status).toBe(200);
    expect(me.body.role).toBe("MEMBER");
    expect(me.body.units.some((unit: { id: string }) => unit.id === raizId)).toBe(true);
  });

  it("recusa membro (não admin) criando convite", async () => {
    const membro = await criarSessao(app);
    const raizId = await obterRaiz(membro);

    const response = await convidar(membro, `alguem-${Date.now()}@fora.folioteca`, raizId);

    expect(response.status).toBe(403);
  });

  // contorno: app isolada, própria para este teste — o freio de taxa conta por
  // IP e por rota num `ThrottlerStorage` que vive na instância Nest; a `app`
  // compartilhada do arquivo já fez outras consultas a `by-token` nos testes
  // acima, e somar os pedidos ali tornaria "a 11ª" uma contagem movente.
  it("recusa a décima primeira consulta pública no mesmo minuto", async () => {
    const isolada = await createApp();
    await isolada.app.init();
    try {
      const servidor = isolada.app.getHttpServer();
      const tokenQualquer = "0".repeat(64);

      for (let tentativa = 1; tentativa <= 10; tentativa += 1) {
        const resposta = await request(servidor).get(`/invitations/by-token/${tokenQualquer}`);
        expect(resposta.status).toBe(404);
      }

      const onzeava = await request(servidor).get(`/invitations/by-token/${tokenQualquer}`);
      expect(onzeava.status).toBe(429);
    } finally {
      await isolada.app.close();
    }
  });
});
