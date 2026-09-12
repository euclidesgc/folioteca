import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../src/bootstrap";
import { criarSessao, type SessaoDeTeste } from "./apoio/sessao";

describe("API de documentos", () => {
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

  async function criarDocumento(sessao: SessaoDeTeste) {
    const response = await request(app.getHttpServer())
      .post("/documents")
      .set("Cookie", sessao.cookie)
      .send({});
    return response;
  }

  it("nega acesso sem sessão", async () => {
    const response = await request(app.getHttpServer()).get("/documents?filter=OWNED");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("cria um documento em branco com o dono igual a quem criou", async () => {
    const sessao = await criarSessao(app);

    const response = await criarDocumento(sessao);

    expect(response.status).toBe(201);
    expect(response.body.ownerId).toBe(sessao.user.id);
    expect(response.body.createdById).toBe(sessao.user.id);
    expect(response.body.title).toBe("Sem título");
  });

  it("nega acesso a documento de outra pessoa sem revelar que ele existe", async () => {
    const dona = await criarSessao(app);
    const outraPessoa = await criarSessao(app);
    const { body: documento } = await criarDocumento(dona);

    const response = await request(app.getHttpServer())
      .get(`/documents/${documento.id}`)
      .set("Cookie", outraPessoa.cookie);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("devolve 404 para um id que não existe, igual ao de um documento alheio", async () => {
    const sessao = await criarSessao(app);

    const response = await request(app.getHttpServer())
      .get("/documents/00000000-0000-0000-0000-000000000000")
      .set("Cookie", sessao.cookie);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("atualiza o título dentro do limite e rejeita título vazio", async () => {
    const sessao = await criarSessao(app);
    const { body: documento } = await criarDocumento(sessao);

    const aceita = await request(app.getHttpServer())
      .patch(`/documents/${documento.id}`)
      .set("Cookie", sessao.cookie)
      .send({ title: "Ata da reunião" });
    expect(aceita.status).toBe(200);
    expect(aceita.body.title).toBe("Ata da reunião");

    const rejeitada = await request(app.getHttpServer())
      .patch(`/documents/${documento.id}`)
      .set("Cookie", sessao.cookie)
      .send({ title: "" });
    expect(rejeitada.status).toBe(400);
  });

  it("lista por filtro: OWNED exclui a lixeira, TRASH só traz a lixeira", async () => {
    const sessao = await criarSessao(app);
    const { body: ativo } = await criarDocumento(sessao);
    const { body: naLixeira } = await criarDocumento(sessao);

    await request(app.getHttpServer())
      .delete(`/documents/${naLixeira.id}`)
      .set("Cookie", sessao.cookie);

    const owned = await request(app.getHttpServer())
      .get("/documents?filter=OWNED")
      .set("Cookie", sessao.cookie);
    const ownedIds = owned.body.items.map((item: { id: string }) => item.id);
    expect(ownedIds).toContain(ativo.id);
    expect(ownedIds).not.toContain(naLixeira.id);

    const trash = await request(app.getHttpServer())
      .get("/documents?filter=TRASH")
      .set("Cookie", sessao.cookie);
    const trashIds = trash.body.items.map((item: { id: string }) => item.id);
    expect(trashIds).toContain(naLixeira.id);
    expect(trashIds).not.toContain(ativo.id);
  });

  it("devolve 400 para um filtro que não existe no enum", async () => {
    const sessao = await criarSessao(app);

    const response = await request(app.getHttpServer())
      .get("/documents?filter=QUALQUER_COISA")
      .set("Cookie", sessao.cookie);

    expect(response.status).toBe(400);
  });

  it("favorita, aparece em FAVORITES, e some dela ao desfavoritar", async () => {
    const sessao = await criarSessao(app);
    const { body: documento } = await criarDocumento(sessao);

    const favoritado = await request(app.getHttpServer())
      .put(`/documents/${documento.id}/favorite`)
      .set("Cookie", sessao.cookie);
    expect(favoritado.status).toBe(200);
    expect(favoritado.body).toEqual({ id: documento.id, favorited: true });

    const favoritos = await request(app.getHttpServer())
      .get("/documents?filter=FAVORITES")
      .set("Cookie", sessao.cookie);
    expect(favoritos.body.items.map((item: { id: string }) => item.id)).toContain(documento.id);

    const desfavoritado = await request(app.getHttpServer())
      .delete(`/documents/${documento.id}/favorite`)
      .set("Cookie", sessao.cookie);
    expect(desfavoritado.status).toBe(200);
    expect(desfavoritado.body).toEqual({ id: documento.id, favorited: false });

    const favoritosDepois = await request(app.getHttpServer())
      .get("/documents?filter=FAVORITES")
      .set("Cookie", sessao.cookie);
    expect(
      favoritosDepois.body.items.map((item: { id: string }) => item.id),
    ).not.toContain(documento.id);
  });

  it("um documento na lixeira some de FAVORITES sem apagar o favorito, e reaparece ao restaurar", async () => {
    const sessao = await criarSessao(app);
    const { body: documento } = await criarDocumento(sessao);

    await request(app.getHttpServer())
      .put(`/documents/${documento.id}/favorite`)
      .set("Cookie", sessao.cookie);

    await request(app.getHttpServer())
      .delete(`/documents/${documento.id}`)
      .set("Cookie", sessao.cookie);

    const favoritosComDocNaLixeira = await request(app.getHttpServer())
      .get("/documents?filter=FAVORITES")
      .set("Cookie", sessao.cookie);
    expect(
      favoritosComDocNaLixeira.body.items.map((item: { id: string }) => item.id),
    ).not.toContain(documento.id);

    await request(app.getHttpServer())
      .post(`/documents/${documento.id}/restore`)
      .set("Cookie", sessao.cookie);

    const favoritosDepoisDeRestaurar = await request(app.getHttpServer())
      .get("/documents?filter=FAVORITES")
      .set("Cookie", sessao.cookie);
    expect(
      favoritosDepoisDeRestaurar.body.items.map((item: { id: string }) => item.id),
    ).toContain(documento.id);
  });

  it("move para a lixeira e restaura, saindo e voltando a OWNED", async () => {
    const sessao = await criarSessao(app);
    const { body: documento } = await criarDocumento(sessao);

    const trashed = await request(app.getHttpServer())
      .delete(`/documents/${documento.id}`)
      .set("Cookie", sessao.cookie);
    expect(trashed.status).toBe(200);
    expect(trashed.body.id).toBe(documento.id);
    expect(trashed.body.deletedAt).not.toBeNull();

    const restored = await request(app.getHttpServer())
      .post(`/documents/${documento.id}/restore`)
      .set("Cookie", sessao.cookie);
    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({ id: documento.id, deletedAt: null });
  });

  it("DELETE /documents/:id/permanent sobre um documento ativo devolve o mesmo 404 da regra 2", async () => {
    const sessao = await criarSessao(app);
    const { body: documento } = await criarDocumento(sessao);

    const response = await request(app.getHttpServer())
      .delete(`/documents/${documento.id}/permanent`)
      .set("Cookie", sessao.cookie);

    expect(response.status).toBe(404);
    expect(response.body.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("apaga em definitivo um documento já na lixeira, e a leitura seguinte é 404", async () => {
    const sessao = await criarSessao(app);
    const { body: documento } = await criarDocumento(sessao);

    await request(app.getHttpServer())
      .delete(`/documents/${documento.id}`)
      .set("Cookie", sessao.cookie);

    const apagado = await request(app.getHttpServer())
      .delete(`/documents/${documento.id}/permanent`)
      .set("Cookie", sessao.cookie);
    expect(apagado.status).toBe(204);
    expect(apagado.body).toEqual({});

    const leitura = await request(app.getHttpServer())
      .get(`/documents/${documento.id}`)
      .set("Cookie", sessao.cookie);
    expect(leitura.status).toBe(404);
    expect(leitura.body.code).toBe("DOCUMENT_NOT_FOUND");
  });
});
