import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import { spaceNameSchema } from '@/features/spaces/utils/space-name-schema';

import {
  addFreeSpace,
  addSpaceMember,
  getDb,
  getSignedInPerson,
  listSpaceDocuments,
  listSpaceMembers,
  listSpacesOf,
  removeSpaceMember,
  spaceDetailOf,
  spaceReachOf,
} from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type SpacesResponse = components['schemas']['SpacesResponse'];
type SpaceResponse = components['schemas']['SpaceResponse'];
type DocumentsResponse = components['schemas']['DocumentsResponse'];
type SpaceDetailResponse = components['schemas']['SpaceDetailResponse'];
type SpaceMembersResponse = components['schemas']['SpaceMembersResponse'];
type SpaceMemberResponse = components['schemas']['SpaceMemberResponse'];

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

    // Like the real API: one free space name per owner, ignoring case.
    const lowerName = parsed.data.toLowerCase();
    const isRepeated = getDb().spaces.some(
      (item) =>
        item.type === 'free' &&
        item.ownerId === person.id &&
        item.name.toLowerCase() === lowerName,
    );

    if (isRepeated) {
      return HttpResponse.json(
        { message: 'Você já tem um espaço com esse nome.' },
        { status: 409 },
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
      // The owner and the members of a free space reach it `direct`; a free
      // space of someone else is `none`. The 403 below is only of a unit.
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
      // who is assigned to it, and the owner and the members of a free space
      // see its people.
      const members = listSpaceMembers(person.id, String(params.spaceId));
      if (!members) return spaceNotFound();

      const body: SpaceMembersResponse = { data: members };
      return HttpResponse.json(body);
    },
  ),

  // No body: the space and the person are both in the path, and adding the
  // same person again answers the same 200.
  http.put(
    `${env.API_URL}/spaces/:spaceId/members/:personId`,
    async ({ cookies, params }) => {
      await networkDelay();
      const forced = await devOverride('spaces');
      if (forced) return forced;

      const { installation } = getDb();
      const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
      const person = getSignedInPerson();

      if (!installation || !hasSession || !person) return unauthenticated();

      const result = addSpaceMember(
        person.id,
        String(params.spaceId),
        String(params.personId),
      );

      if (!result.ok) {
        if (result.status === 404) return spaceNotFound();
        return HttpResponse.json(
          { message: result.message },
          { status: result.status },
        );
      }

      const body: SpaceMemberResponse = { data: result.person };
      return HttpResponse.json(body);
    },
  ),

  // Idempotent: removing someone who is not a member answers the same 204.
  http.delete(
    `${env.API_URL}/spaces/:spaceId/members/:personId`,
    async ({ cookies, params }) => {
      await networkDelay();
      const forced = await devOverride('spaces');
      if (forced) return forced;

      const { installation } = getDb();
      const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
      const person = getSignedInPerson();

      if (!installation || !hasSession || !person) return unauthenticated();

      const result = removeSpaceMember(
        person.id,
        String(params.spaceId),
        String(params.personId),
      );

      if (!result.ok) {
        if (result.status === 404) return spaceNotFound();
        return HttpResponse.json(
          { message: result.message },
          { status: result.status },
        );
      }

      return new HttpResponse(null, { status: 204 });
    },
  ),
];
