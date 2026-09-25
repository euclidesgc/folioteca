import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type {
  Document,
  DocumentResponse,
  DocumentsResponse,
  UpdateDocumentBody,
} from '@/types/api';

import {
  allPeople,
  createDocumentIn,
  getDb,
  getSignedInPerson,
  listDocumentShares,
  type MockDocument,
  type MockDocumentShare,
  shareDocument,
  spaceMemberLevelOf,
  spaceReachOf,
} from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type DocumentShareResponse = components['schemas']['DocumentShareResponse'];
type DocumentAccessListResponse =
  components['schemas']['DocumentAccessListResponse'];

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

const invalidShareBody = (
  field: string,
  message: string,
): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Dados inválidos.', errors: [{ field, message }] },
    { status: 400 },
  );

// The body the real schema accepts: exactly `{ level: 'view' }` or
// `{ level: 'edit' }`. Answers the refusal, or null when the body is right.
const checkShareBody = (
  body: unknown,
): ReturnType<typeof HttpResponse.json> | null => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return invalidShareBody('level', 'Escolha o nível de acesso.');
  }

  const extra = Object.keys(body).find((key) => key !== 'level');
  if (extra !== undefined) return invalidShareBody(extra, 'Campo não permitido.');

  if (!('level' in body) || !isShareLevel(body.level)) {
    return invalidShareBody('level', 'Escolha o nível de acesso.');
  }

  return null;
};

const isShareLevel = (value: unknown): value is MockDocumentShare['level'] =>
  value === 'view' || value === 'edit';

// What the space gives a person who does not own the document: the level of a
// member of a free space, otherwise the level the fake database keeps for the
// document when the person reaches the space. `null` when the space gives
// nothing.
const spaceLevelOf = (
  personId: string,
  document: MockDocument,
): 'view' | 'edit' | null => {
  const memberLevel = spaceMemberLevelOf(personId, document.spaceId);
  if (memberLevel) return memberLevel;
  if (spaceReachOf(personId, document.spaceId) === 'none') return null;

  return document.accessLevel === 'view' ? 'view' : 'edit';
};

// The level of a person who does not own the document, the way the real
// `resolveAccess` answers: the higher of the share and the space (`edit` wins
// over `view`). `null` is no access at all, the 404 of the handler.
const readerLevelOf = (
  personId: string,
  document: MockDocument,
): 'view' | 'edit' | null => {
  const shareLevel =
    getDb().shares.find(
      (item) => item.documentId === document.id && item.personId === personId,
    )?.level ?? null;
  const spaceLevel = spaceLevelOf(personId, document);

  if (shareLevel === 'edit' || spaceLevel === 'edit') return 'edit';
  return shareLevel ?? spaceLevel;
};

export const documentsHandlers = [
  http.post(`${env.API_URL}/documents`, async ({ cookies, request }) => {
    await networkDelay();
    const forced = await devOverride('documents');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation } = getDb();
    if (!installation) return unauthenticated();

    // The body is optional: without it the document goes to the personal
    // space, as it always did.
    const text = await request.text();
    const requestBody: unknown = text ? JSON.parse(text) : {};
    const spaceId =
      typeof requestBody === 'object' &&
      requestBody !== null &&
      'spaceId' in requestBody &&
      typeof requestBody.spaceId === 'string'
        ? requestBody.spaceId
        : undefined;

    const { person } = installation;
    let document: MockDocument;

    if (spaceId === undefined) {
      document = createDocumentIn(person.id, `space-${person.id}`);
    } else {
      // Only whoever is directly assigned to the unit, or the owner or a
      // member of the free space, creates there; any other reach answers the
      // same 404 as an unknown space.
      const creator = getSignedInPerson() ?? person;
      if (spaceReachOf(creator.id, spaceId) !== 'direct') {
        return HttpResponse.json(
          { message: 'Espaço não encontrado.' },
          { status: 404 },
        );
      }
      // A member of a free space who only reads creates nothing there; the
      // owner has no level and always creates.
      if (spaceMemberLevelOf(creator.id, spaceId) === 'view') {
        return HttpResponse.json(
          { message: 'Só quem pode editar cria documentos neste espaço.' },
          { status: 403 },
        );
      }
      document = createDocumentIn(creator.id, spaceId);
    }

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

    // Only what the signed-in person owns: a document shared with them opens
    // by its address, but is not theirs.
    const ownerId = getSignedInPerson()?.id;
    const list = [...documents]
      .filter(
        (document) =>
          document.trashedAt === null && document.ownerId === ownerId,
      )
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

    // The same order as the real service: the owner, then the trash (opaque
    // to everyone else), then the higher of the share and the space.
    const reader = getSignedInPerson();
    if (reader === null || reader.id === document.ownerId) {
      const body: DocumentResponse = { data: toDocumentBody(document) };
      return HttpResponse.json(body);
    }

    if (document.trashedAt !== null) return notFound();

    const accessLevel = readerLevelOf(reader.id, document);
    if (!accessLevel) return notFound();

    const body: DocumentResponse = {
      data: toDocumentBody({ ...document, accessLevel }),
    };
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

  // The same order as the real service: 404 without access, 403 for whoever
  // has access but does not own the document. The trash does not block it.
  http.get(
    `${env.API_URL}/documents/:documentId/shares`,
    async ({ params, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const requester = getSignedInPerson();
      if (!requester) return unauthenticated();

      const { documents } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();

      if (document.accessLevel !== 'owner') {
        return HttpResponse.json(
          {
            message:
              'Só o proprietário pode ver quem tem acesso a este documento.',
          },
          { status: 403 },
        );
      }

      const body: DocumentAccessListResponse = {
        data: listDocumentShares(document.id),
      };
      return HttpResponse.json(body);
    },
  ),

  http.put(
    `${env.API_URL}/documents/:documentId/shares/:personId`,
    async ({ params, request, cookies }) => {
      await networkDelay();
      const forced = await devOverride('documents');
      if (forced) return forced;

      if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

      const requester = getSignedInPerson();
      if (!requester) return unauthenticated();

      // The same order as the real service: access before the body, so an
      // invalid body never reveals that a document of someone else exists.
      const { documents } = getDb();
      const document = documents.find((item) => item.id === params.documentId);
      if (!document) return notFound();

      if (document.accessLevel !== 'owner') {
        return HttpResponse.json(
          { message: 'Só o proprietário pode compartilhar este documento.' },
          { status: 403 },
        );
      }

      if (document.trashedAt !== null) return inTrash();

      const requestBody: unknown = await request.json().catch(() => null);
      const bodyRefusal = checkShareBody(requestBody);
      if (bodyRefusal) return bodyRefusal;

      if (params.personId === requester.id) {
        return HttpResponse.json(
          { message: 'Você já é o proprietário deste documento.' },
          { status: 400 },
        );
      }

      const person = allPeople().find((item) => item.id === params.personId);
      if (!person) {
        return HttpResponse.json(
          { message: 'Pessoa não encontrada nesta instância.' },
          { status: 400 },
        );
      }

      // Checked by `checkShareBody` above.
      const { level } = requestBody as { level: MockDocumentShare['level'] };
      const share = shareDocument(document.id, person.id, level);

      const body: DocumentShareResponse = {
        data: {
          personId: person.id,
          name: person.name,
          email: person.email,
          level: share.level,
        },
      };
      return HttpResponse.json(body);
    },
  ),
];
