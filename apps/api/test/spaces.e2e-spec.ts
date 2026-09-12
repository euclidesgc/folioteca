import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createApp } from "../src/bootstrap";
import type { EnvironmentVariables } from "../src/config/environment-variables";
import { AccessRepository } from "../src/access/access.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarSessao, type SessaoDeTeste } from "./apoio/sessao";

describe("API de espaços (spaces)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let access: AccessRepository;

  // contorno: mesma razão de `units.e2e-spec.ts` — `Organization` é singleton
  // (D8) e a raiz só existe depois da primeira instalação; instala aqui só se
  // este arquivo estiver rodando isolado (como a verificação da etapa faz,
  // com `-t "spaces"`).
  beforeAll(async () => {
    const boot = await createApp();
    app = boot.app;
    await app.init();
    prisma = app.get(PrismaService);
    access = app.get(AccessRepository);

    const status = await request(app.getHttpServer()).get("/organization");
    if (status.body.status === "SETUP_PENDING") {
      const config = boot.config as ConfigService<EnvironmentVariables, true>;
      const installationCode = config.get("INSTALLATION_CODE", { infer: true });
      await request(app.getHttpServer())
        .post("/installation")
        .send({
          installationCode,
          name: "Administradora de Testes de Espaço",
          organizationName: `Organização de Teste de Espaço ${Date.now()}`,
          email: `admin-espacos-${Date.now()}@teste.folioteca`,
          password: "senha-de-teste-1234",
        });
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function criarTipoDeUnidade(admin: SessaoDeTeste): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/unit-types")
      .set("Cookie", admin.cookie)
      .send({ name: `Tipo de espaço ${Date.now()}-${Math.random()}` });
    return response.body.id as string;
  }

  async function obterRaiz(sessao: SessaoDeTeste): Promise<string> {
    const response = await request(app.getHttpServer())
      .get("/units")
      .set("Cookie", sessao.cookie);
    return response.body.id as string;
  }

  async function criarUnidade(
    admin: SessaoDeTeste,
    name: string,
    parentId: string,
    unitTypeId: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/units")
      .set("Cookie", admin.cookie)
      .send({ name, parentId, unitTypeId });
    return response.body.id as string;
  }

  async function espacoDaUnidade(unitId: string) {
    return prisma.space.findUnique({ where: { unitId } });
  }

  it("backfills one space per existing unit with the parent's space as parent", async () => {
    // contorno: o Postgres do Testcontainers roda as migrations sobre um
    // banco sempre vazio — não há como uma unidade existir "antes" da
    // migration `spaces` num banco de teste. A mesma garantia (M8: uma
    // unidade, um espaço, com o pai certo) vale aqui pelo gatilho
    // `space_for_unit_after_insert_trigger`, que a migration cria ao lado do
    // backfill para cobrir toda unidade nascida depois dela — o backfill em
    // si já rodou, sem unidade nenhuma para encontrar, na base de teste que
    // este `beforeAll` acabou de instalar.
    const admin = await criarSessao(app, { role: "ADMIN" });
    const unitTypeId = await criarTipoDeUnidade(admin);
    const raizId = await obterRaiz(admin);

    const avoId = await criarUnidade(admin, `Avó ${Date.now()}`, raizId, unitTypeId);
    const maeId = await criarUnidade(admin, `Mãe ${Date.now()}`, avoId, unitTypeId);
    const netaId = await criarUnidade(admin, `Neta ${Date.now()}`, maeId, unitTypeId);

    const [espacoRaiz, espacoAvo, espacoMae, espacoNeta] = await Promise.all([
      espacoDaUnidade(raizId),
      espacoDaUnidade(avoId),
      espacoDaUnidade(maeId),
      espacoDaUnidade(netaId),
    ]);

    expect(espacoRaiz).not.toBeNull();
    expect(espacoAvo).not.toBeNull();
    expect(espacoMae).not.toBeNull();
    expect(espacoNeta).not.toBeNull();

    expect(espacoRaiz?.parentId).toBeNull();
    expect(espacoAvo?.parentId).toBe(espacoRaiz?.id);
    expect(espacoMae?.parentId).toBe(espacoAvo?.id);
    expect(espacoNeta?.parentId).toBe(espacoMae?.id);
    expect([espacoAvo?.kind, espacoMae?.kind, espacoNeta?.kind]).toEqual([
      "UNIT",
      "UNIT",
      "UNIT",
    ]);
  });

  it("stops the inheritance chain at the first space that does not inherit", async () => {
    const gestor = await criarSessao(app);
    const pessoa = await criarSessao(app);

    const avo = await prisma.space.create({
      data: {
        kind: "FREE",
        name: `Avô ${Date.now()}`,
        parentId: null,
        inheritsFromParent: false,
        restricted: true,
        managerId: gestor.user.id,
      },
    });
    const filho = await prisma.space.create({
      data: {
        kind: "FREE",
        name: `Filho ${Date.now()}`,
        parentId: avo.id,
        inheritsFromParent: false,
        restricted: false,
        managerId: gestor.user.id,
      },
    });
    const neto = await prisma.space.create({
      data: {
        kind: "FREE",
        name: `Neto ${Date.now()}`,
        parentId: filho.id,
        inheritsFromParent: true,
        restricted: false,
        managerId: gestor.user.id,
      },
    });

    await prisma.spaceMember.create({
      data: { spaceId: avo.id, userId: pessoa.user.id },
    });

    const audiencia = await access.getAudienceSpaceIds(pessoa.user.id);

    expect(audiencia).toContain(avo.id);
    expect(audiencia).not.toContain(filho.id);
    expect(audiencia).not.toContain(neto.id);
  });

  it("hides a restricted space from someone outside its audience", async () => {
    const gestor = await criarSessao(app);
    const estranha = await criarSessao(app);

    const espaco = await prisma.space.create({
      data: {
        kind: "FREE",
        name: `Orçamento ${Date.now()}`,
        parentId: null,
        inheritsFromParent: false,
        restricted: true,
        managerId: gestor.user.id,
      },
    });

    const resposta = await request(app.getHttpServer())
      .get(`/spaces/${espaco.id}`)
      .set("Cookie", estranha.cookie);

    expect(resposta.status).toBe(404);
    expect(resposta.body.code).toBe("SPACE_NOT_FOUND");
  });

  it("shows a restricted space to a member and to someone with inherited access", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const gestor = await criarSessao(app);
    const membro = await criarSessao(app);
    const lotada = await criarSessao(app);

    const membroDireto = await prisma.space.create({
      data: {
        kind: "FREE",
        name: `Comitê ${Date.now()}`,
        parentId: null,
        inheritsFromParent: false,
        restricted: true,
        managerId: gestor.user.id,
      },
    });
    await prisma.spaceMember.create({
      data: { spaceId: membroDireto.id, userId: membro.user.id },
    });

    const unitTypeId = await criarTipoDeUnidade(admin);
    const raizId = await obterRaiz(admin);
    const unidadeId = await criarUnidade(admin, `Financeiro ${Date.now()}`, raizId, unitTypeId);
    const espacoDaUnidadeFinanceiro = await espacoDaUnidade(unidadeId);
    await request(app.getHttpServer())
      .put(`/units/${unidadeId}/members/${lotada.user.id}`)
      .set("Cookie", admin.cookie);

    const herdado = await prisma.space.create({
      data: {
        kind: "FREE",
        name: `Orçamento 2027 ${Date.now()}`,
        parentId: espacoDaUnidadeFinanceiro?.id,
        inheritsFromParent: true,
        restricted: true,
        managerId: gestor.user.id,
      },
    });

    const [respostaMembro, respostaHerdada] = await Promise.all([
      request(app.getHttpServer())
        .get(`/spaces/${membroDireto.id}`)
        .set("Cookie", membro.cookie),
      request(app.getHttpServer())
        .get(`/spaces/${herdado.id}`)
        .set("Cookie", lotada.cookie),
    ]);

    expect(respostaMembro.status).toBe(200);
    expect(respostaHerdada.status).toBe(200);
  });

  it("counts only direct staffing as unit space membership", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const lotadaNaUnidade = await criarSessao(app);
    const lotadaNaSubunidade = await criarSessao(app);

    const unitTypeId = await criarTipoDeUnidade(admin);
    const raizId = await obterRaiz(admin);
    const unidadeId = await criarUnidade(admin, `Operações ${Date.now()}`, raizId, unitTypeId);
    const subunidadeId = await criarUnidade(
      admin,
      `Logística ${Date.now()}`,
      unidadeId,
      unitTypeId,
    );

    await request(app.getHttpServer())
      .put(`/units/${unidadeId}/members/${lotadaNaUnidade.user.id}`)
      .set("Cookie", admin.cookie);
    await request(app.getHttpServer())
      .put(`/units/${subunidadeId}/members/${lotadaNaSubunidade.user.id}`)
      .set("Cookie", admin.cookie);

    const espacoDaUnidadeOperacoes = await espacoDaUnidade(unidadeId);

    const resposta = await request(app.getHttpServer())
      .get(`/spaces/${espacoDaUnidadeOperacoes?.id}/members`)
      .set("Cookie", admin.cookie);

    expect(resposta.status).toBe(200);
    const ids = (resposta.body as { userId: string }[]).map((member) => member.userId);
    expect(ids).toContain(lotadaNaUnidade.user.id);
    expect(ids).not.toContain(lotadaNaSubunidade.user.id);
  });
});
