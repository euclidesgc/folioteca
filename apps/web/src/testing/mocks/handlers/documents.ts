import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type {
  Document,
  DocumentResponse,
  DocumentsResponse,
  UpdateDocumentBody,
} from '@/types/api';

import { getDb, type MockDocument } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

const DEFAULT_TITLE = 'Sem título';
const TITLE_MAX_LENGTH = 200;

const FAVORITES_LIMIT = 100;

// The fake database keeps documents without `isFavorite`; the body adds it,
// read from the favorites of the single person of this fake database.
const toDocumentBody = (document: MockDocument): Document => ({
  ...document,
  isFavorite: getDb().favorites.some(
    (favorite) => favorite.documentId === document.id,
  ),
});

const TRASH_LIMIT = 100;

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const notFound = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });

const outsideTrash = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Mova o documento para a lixeira antes de apagá-lo definitivamente.' },
    { status: 409 },
  );

const inTrash = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Este documento está na lixeira. Restaure-o para editar.' },
    { status: 409 },
  );

export const documentsHandlers = [
  http.post(`${env.API_URL}/documents`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('documents');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation, documents } = getDb();
    if (!installation) return unauthenticated();

    const { person } = installation;
    const now = new Date().toISOString();
    const document: MockDocument = {
      id: crypto.randomUUID(),
      title: DEFAULT_TITLE,
      spaceId: `space-${person.id}`,
      authorId: person.id,
      ownerId: person.id,
      createdAt: now,
      updatedAt: now,
      trashedAt: null,
      accessLevel: 'owner',
    };
    documents.push(document);

    const body: DocumentResponse = { data: toDocumentBody(document) };
    return HttpResponse.json(body, { status: 201 });
  }),

  http.get(`${env.API_URL}/documents`, async ({ request, cookies }) => {
    await networkDelay();
    const forced = await devOverride('documents');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const scope = new URL(request.url).searchParams.get('scope');
    if (scope !== 'mine' && scope !== 'favorites' && scope !== 'trash') {
      return HttpResponse.json(
        {
          message: 'Dados inválidos.',
          errors: [{ field: 'scope', message: 'Informe um escopo válido.' }],
        },
        { status: 400 },
      );
    }

    const { documents, favorites } = getDb();

    if (scope === 'trash') {
      const trashList = [...documents]
        .filter((document) => document.trashedAt !== null)
        .sort((a, b) => (b.trashedAt ?? '').localeCompare(a.trashedAt ?? ''))
        .slice(0, TRASH_LIMIT)
        .map(({ id, title, updatedAt, trashedAt }) => ({
          id,
          title,
          updatedAt,
          trashedAt,
        }));

      const trashBody: DocumentsResponse = { data: trashList };
      return HttpResponse.json(trashBody);
    }

    if (scope === 'favorites') {
      // From the most recently marked to the oldest, and only the favorites
      // whose document still exists and is not in the trash.
      const favoriteList = [...favorites]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((favorite) =>
          documents.find((item) => item.id === favorite.documentId),
        )
        .filter(
          (item): item is MockDocument =>
            item !== undefined && item.trashedAt === null,
        )
        .slice(0, FAVORITES_LIMIT)
        .map(({ id, title, updatedAt }) => ({
          id,
          title,
          updatedAt,
          trashedAt: null,
        }));

      const favoritesBody: DocumentsResponse = { data: favoriteList };
      return HttpResponse.json(favoritesBody);
    }

    const list = [...documents]
      .filter((document) => document.trashedAt === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 100)
      .map(({ id, title, updatedAt }) => ({
        id,
        title,
        updatedAt,
        trashedAt: null,
      }));

    const body: DocumentsResponse = { data: list };
    return HttpResponse.json(body);
  }),

  http.get(`${env.API_URL}/documents/:documentId`, async ({ params, cookies }) => {
    await networkDelay();
    const forced = await devOverride('documents');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { documents } = getDb();
    const document = documents.find((item) => item.id === params.documentId);
    if (!document) return notFound();

    const body: DocumentResponse = { data: toDocumentBody(document) };
    return HttpResponse.json(body);
  }),

  http.patch(
    `${env.API_URL}/documents/:documentId`,
    async ({ params, request, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { documents } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();
      if (document.trashedAt !== null) return inTrash();

      const requestBody = (await request.json()) as Partial<UpdateDocumentBody>;
      if (typeof requestBody.title !== 'string') {
        return HttpResponse.json(
          {
            message: 'Dados inválidos.',
            errors: [{ field: 'title', message: 'Informe o título.' }],
          },
          { status: 400 },
        );
      }

      const trimmed = requestBody.title.trim();
      if (trimmed.length > TITLE_MAX_LENGTH) {
        return HttpResponse.json(
          {
            message: 'Dados inválidos.',
            errors: [
              {
                field: 'title',
                message: 'O título pode ter no máximo 200 caracteres.',
              },
            ],
          },
          { status: 400 },
        );
      }

      document.title = trimmed === '' ? DEFAULT_TITLE : trimmed;
      document.updatedAt = new Date().toISOString();

      const body: DocumentResponse = { data: toDocumentBody(document) };
      return HttpResponse.json(body);
    },
  ),

  http.post(
    `${env.API_URL}/documents/:documentId/trash`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { documents } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();

      // Repeating does not renew the date, like the real API.
      if (document.trashedAt === null) {
        document.trashedAt = new Date().toISOString();
      }

      const body: DocumentResponse = { data: toDocumentBody(document) };
      return HttpResponse.json(body);
    },
  ),

  http.post(
    `${env.API_URL}/documents/:documentId/restore`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { documents } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();

      document.trashedAt = null;

      const body: DocumentResponse = { data: toDocumentBody(document) };
      return HttpResponse.json(body);
    },
  ),

  http.delete(
    `${env.API_URL}/documents/:documentId`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { documents, favorites } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();
      if (document.trashedAt === null) return outsideTrash();

      const documentIndex = documents.indexOf(document);
      documents.splice(documentIndex, 1);

      let favoriteIndex = favorites.findIndex(
        (favorite) => favorite.documentId === document.id,
      );
      while (favoriteIndex !== -1) {
        favorites.splice(favoriteIndex, 1);
        favoriteIndex = favorites.findIndex(
          (favorite) => favorite.documentId === document.id,
        );
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.put(
    `${env.API_URL}/documents/:documentId/favorite`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { documents, favorites } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();

      // Idempotent, like the API: marking twice neither duplicates the row
      // nor renews its date.
      const alreadyFavorite = favorites.some(
        (favorite) => favorite.documentId === document.id,
      );
      if (!alreadyFavorite) {
        favorites.push({
          documentId: document.id,
          createdAt: new Date().toISOString(),
        });
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),

  http.delete(
    `${env.API_URL}/documents/:documentId/favorite`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const { documents, favorites } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();

      // Removing what was never a favorite also answers 204.
      const index = favorites.findIndex(
        (favorite) => favorite.documentId === document.id,
      );
      if (index !== -1) favorites.splice(index, 1);

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
