import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import { spaceNameSchema } from '@/features/spaces/utils/space-name-schema';

import {
  addFreeSpace,
  getDb,
  getSignedInPerson,
  listSpaceDocuments,
  listSpaceMembers,
  listSpacesOf,
  spaceDetailOf,
  spaceReachOf,
} from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type SpacesResponse = components['schemas']['SpacesResponse'];
type SpaceResponse = components['schemas']['SpaceResponse'];
type DocumentsResponse = components['schemas']['DocumentsResponse'];
type SpaceDetailResponse = components['schemas']['SpaceDetailResponse'];
type SpaceMembersResponse = components['schemas']['SpaceMembersResponse'];

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const spaceNotFound = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Espaço não encontrado.' }, { status: 404 });

export const spacesHandlers = [
  http.get(`${env.API_URL}/spaces`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('spaces');
    if (forced) return forced;

    const { installation } = getDb();
    const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
    // Whoever the session belongs to, not the installed person: accepting an
    // invitation signs someone else in. No 403: every signed-in person may
    // list their own spaces, and administration sees nothing more.
    const person = getSignedInPerson();

    if (!installation || !hasSession || !person) return unauthenticated();

    const body: SpacesResponse = { data: listSpacesOf(person.id) };
    return HttpResponse.json(body);
  }),

  http.post(`${env.API_URL}/spaces`, async ({ cookies, request }) => {
    await networkDelay();
    const forced = await devOverride('spaces');
    if (forced) return forced;

    const { installation } = getDb();
    const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
    // The owner is always the person of the session, never someone named in
    // the body.
    const person = getSignedInPerson();

    if (!installation || !hasSession || !person) return unauthenticated();

    const requestBody = (await request.json()) as Record<string, unknown>;
    const parsed = spaceNameSchema.safeParse(requestBody.name);

    if (!parsed.success) {
      return HttpResponse.json(
        { message: parsed.error.issues[0]?.message ?? 'Informe o nome.' },
        { status: 400 },
      );
    }

    const space = addFreeSpace(person.id, parsed.data);
    const body: SpaceResponse = {
      data: { id: space.id, type: 'free', name: parsed.data },
    };
    return HttpResponse.json(body, { status: 201 });
  }),

  http.get(
    `${env.API_URL}/spaces/:spaceId/documents`,
    async ({ cookies, params }) => {
      await networkDelay();
      const forced = await devOverride('spaces');
      if (forced) return forced;

      const { installation, favorites } = getDb();
      const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
      const person = getSignedInPerson();

      if (!installation || !hasSession || !person) return unauthenticated();

      const spaceId = String(params.spaceId);
      const reach = spaceReachOf(person.id, spaceId);

      if (reach === 'none') {
        return HttpResponse.json(
          { message: 'Espaço não encontrado.' },
          { status: 404 },
        );
      }

      if (reach === 'inherited') {
        return HttpResponse.json(
          {
            message:
              'Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.',
          },
          { status: 403 },
        );
      }

      const body: DocumentsResponse = {
        data: listSpaceDocuments(spaceId).map((document) => ({
          ...document,
          isFavorite: favorites.some(
            (favorite) => favorite.documentId === document.id,
          ),
        })),
      };
      return HttpResponse.json(body);
    },
  ),
  // One segment only: `/spaces/:spaceId` does not match `/documents` nor
  // `/members`, which have their own handlers.
  http.get(`${env.API_URL}/spaces/:spaceId`, async ({ cookies, params }) => {
    await networkDelay();
    const forced = await devOverride('spaces');
    if (forced) return forced;

    const { installation } = getDb();
    const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
    const person = getSignedInPerson();

    if (!installation || !hasSession || !person) return unauthenticated();

    // The same 404 for every space the person cannot see: it never tells an
    // unknown id from one of someone else.
    const space = spaceDetailOf(person.id, String(params.spaceId));
    if (!space) return spaceNotFound();

    const body: SpaceDetailResponse = { data: space };
    return HttpResponse.json(body);
  }),

  http.get(
    `${env.API_URL}/spaces/:spaceId/members`,
    async ({ cookies, params }) => {
      await networkDelay();
      const forced = await devOverride('spaces');
      if (forced) return forced;

      const { installation } = getDb();
      const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
      const person = getSignedInPerson();

      if (!installation || !hasSession || !person) return unauthenticated();

      // No 403: whoever reaches the unit, directly or by inheritance, sees
      // who is assigned to it.
      const members = listSpaceMembers(person.id, String(params.spaceId));
      if (!members) return spaceNotFound();

      const body: SpaceMembersResponse = { data: members };
      return HttpResponse.json(body);
    },
  ),
];
