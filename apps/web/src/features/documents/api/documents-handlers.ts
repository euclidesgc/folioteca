import { http, HttpResponse } from "msw";
import type {
  DocumentCreatedDto,
  DocumentFavoriteStateDto,
  DocumentSummaryDto,
  DocumentTrashStateDto,
} from "@/shared/api";

export const DOCUMENTO_PROPRIO: DocumentSummaryDto = {
  id: "documento-1",
  title: "Notas da reunião",
  updatedAt: "2026-09-09T00:00:00.000Z",
  deletedAt: null,
  favorited: false,
};

export const DOCUMENTO_NA_LIXEIRA: DocumentSummaryDto = {
  id: "documento-2",
  title: "Rascunho antigo",
  updatedAt: "2026-09-01T00:00:00.000Z",
  deletedAt: "2026-09-10T00:00:00.000Z",
  favorited: false,
};

export function listaDeDocumentos(items: DocumentSummaryDto[]) {
  return http.get("*/documents", () => HttpResponse.json({ items }));
}

export const DOCUMENTO_CRIADO: DocumentCreatedDto = {
  id: "documento-novo",
  title: "Sem título",
  ownerId: "pessoa-1",
  createdById: "pessoa-1",
  createdAt: "2026-09-12T00:00:00.000Z",
  updatedAt: "2026-09-12T00:00:00.000Z",
};

export const criacaoAceita = http.post("*/documents", () =>
  HttpResponse.json(DOCUMENTO_CRIADO),
);

export const criacaoComFalhaDeRede = http.post("*/documents", () => HttpResponse.error());

export function favoritarAceito(favorited: boolean) {
  const corpo: DocumentFavoriteStateDto = { id: DOCUMENTO_PROPRIO.id, favorited };
  return http.put("*/documents/:id/favorite", () => HttpResponse.json(corpo));
}

export function desfavoritarAceito(favorited: boolean) {
  const corpo: DocumentFavoriteStateDto = { id: DOCUMENTO_PROPRIO.id, favorited };
  return http.delete("*/documents/:id/favorite", () => HttpResponse.json(corpo));
}

export const restauroAceito = http.post("*/documents/:id/restore", () => {
  const corpo: DocumentTrashStateDto = { id: DOCUMENTO_NA_LIXEIRA.id, deletedAt: null };
  return HttpResponse.json(corpo);
});

export const apagamentoDefinitivoAceito = http.delete(
  "*/documents/:id/permanent",
  () => new HttpResponse(null, { status: 204 }),
);
