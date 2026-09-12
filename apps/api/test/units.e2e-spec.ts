import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createApp } from "../src/bootstrap";
import type { EnvironmentVariables } from "../src/config/environment-variables";
import { PrismaService } from "../src/prisma/prisma.service";
import { criarSessao, type SessaoDeTeste } from "./apoio/sessao";

describe("API de unidades", () => {
  let app: INestApplication;

  // contorno: `Organization` é singleton (D8) — `GET /units` (M7) só
  // responde depois da primeira instalação. Quando este arquivo roda isolado
  // (como a verificação da etapa faz, com `-t "unidade"`), nenhum outro
  // arquivo chega a instalar a instância; instala aqui, e só se ainda não
  // estiver pronta, para não colidir com `installation.e2e-spec.ts` quando a
  // suíte roda inteira.
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
          name: "Administradora de Testes de Unidade",
          organizationName: `Organização de Teste de Unidade ${Date.now()}`,
          email: `admin-unidades-${Date.now()}@teste.folioteca`,
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
      .send({ name: `Tipo de teste ${Date.now()}-${Math.random()}` });
    return response.body.id as string;
  }

  async function obterRaiz(sessao: SessaoDeTeste): Promise<string> {
    const response = await request(app.getHttpServer())
      .get("/units")
      .set("Cookie", sessao.cookie);
    return response.body.id as string;
  }

  async function criarUnidade(
    sessao: SessaoDeTeste,
    name: string,
    parentId: string,
    unitTypeId: string,
  ) {
    return request(app.getHttpServer())
      .post("/units")
      .set("Cookie", sessao.cookie)
      .send({ name, parentId, unitTypeId });
  }

  it("mantém o fecho da árvore depois de unidades aninhadas", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const unitTypeId = await criarTipoDeUnidade(admin);
    const raizId = await obterRaiz(admin);

    const avo = await criarUnidade(admin, `Avó ${Date.now()}`, raizId, unitTypeId);
    expect(avo.status).toBe(201);

    const mae = await criarUnidade(admin, `Mãe ${Date.now()}`, avo.body.id, unitTypeId);
    expect(mae.status).toBe(201);

    const neta = await criarUnidade(admin, `Neta ${Date.now()}`, mae.body.id, unitTypeId);
    expect(neta.status).toBe(201);

    const prisma = app.get(PrismaService);
    const fecho = await prisma.unitClosure.findUnique({
      where: {
        ancestorId_descendantId: {
          ancestorId: avo.body.id,
          descendantId: neta.body.id,
        },
      },
    });

    expect(fecho?.depth).toBe(2);
  });

  it("recusa apagar unidade com gente lotada", async () => {
    const admin = await criarSessao(app, { role: "ADMIN" });
    const pessoa = await criarSessao(app);
    const unitTypeId = await criarTipoDeUnidade(admin);
    const raizId = await obterRaiz(admin);

    const unidade = await criarUnidade(
      admin,
      `Unidade com gente ${Date.now()}`,
      raizId,
      unitTypeId,
    );
    expect(unidade.status).toBe(201);

    const lotacao = await request(app.getHttpServer())
      .put(`/units/${unidade.body.id}/members/${pessoa.user.id}`)
      .set("Cookie", admin.cookie);
    expect(lotacao.status).toBe(204);

    const apagar = await request(app.getHttpServer())
      .delete(`/units/${unidade.body.id}`)
      .set("Cookie", admin.cookie);

    expect(apagar.status).toBe(409);
    expect(apagar.body.code).toBe("UNIT_NOT_EMPTY");
  });

  it("recusa membro criando unidade", async () => {
    const membro = await criarSessao(app);
    const raizId = await obterRaiz(membro);

    const response = await criarUnidade(
      membro,
      `Tentativa de unidade ${Date.now()}`,
      raizId,
      raizId,
    );

    expect(response.status).toBe(403);
  });
});
