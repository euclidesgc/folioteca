import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import { spaceNameSchema } from '@/features/spaces/utils/space-name-schema';

import {
  addFreeSpace,
  addSpaceMember,
  allPeople,
  getDb,
  getSignedInPerson,
  listSpaceDocuments,
  listSpaceMembers,
  listSpacesOf,
  removeSpaceMember,
  setSpaceMemberLevel,
  setSpaceMembersCanInvite,
  spaceDetailOf,
  spaceMemberLevelOf,
  spaceReachOf,
} from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type SpacesResponse = components['schemas']['SpacesResponse'];
type SpaceResponse = components['schemas']['SpaceResponse'];
type DocumentsResponse = components['schemas']['DocumentsResponse'];
type SpaceDetailResponse = components['schemas']['SpaceDetailResponse'];
type SpaceMembersResponse = components['schemas']['SpaceMembersResponse'];
type SpaceMemberResponse = components['schemas']['SpaceMemberResponse'];
type SpaceMemberLevelResponse =
  components['schemas']['SpaceMemberLevelResponse'];

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const spaceNotFound = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Espaço não encontrado.' }, { status: 404 });

const invalid = (
  field: string,
  message: string,
): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Dados inválidos.', errors: [{ field, message }] },
    { status: 400 },
  );

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
      // space of someone else is `none`. A unit space reached by inheritance
      // lists its documents like one reached directly.
      if (spaceReachOf(person.id, spaceId) === 'none') {
        return HttpResponse.json(
          { message: 'Espaço não encontrado.' },
          { status: 404 },
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

  // Same order of checks the API follows: 401, 404 (a space the person does
  // not reach, or a unit one), 403 (a member), 400 (the body), 200. Marking
  // the mode the space already has is still a 200.
  http.patch(
    `${env.API_URL}/spaces/:spaceId`,
    async ({ cookies, params, request }) => {
      await networkDelay();
      const forced = await devOverride('spaces');
      if (forced) return forced;

      const { installation } = getDb();
      const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
      const person = getSignedInPerson();

      if (!installation || !hasSession || !person) return unauthenticated();

      const spaceId = String(params.spaceId);
      const space = spaceDetailOf(person.id, spaceId);
      if (space?.type !== 'free') return spaceNotFound();

      if (space.reach !== 'owner') {
        return HttpResponse.json(
          { message: 'Só o dono do espaço pode mudar quem adiciona pessoas.' },
          { status: 403 },
        );
      }

      const requestBody: unknown = await request.json().catch(() => null);
      if (typeof requestBody !== 'object' || requestBody === null) {
        return invalid('membersCanInvite', 'Escolha quem adiciona pessoas.');
      }

      if (Object.keys(requestBody).some((key) => key !== 'membersCanInvite')) {
        return invalid('', 'Campo não permitido.');
      }

      const membersCanInvite: unknown =
        'membersCanInvite' in requestBody
          ? requestBody.membersCanInvite
          : undefined;
      if (typeof membersCanInvite !== 'boolean') {
        return invalid('membersCanInvite', 'Escolha quem adiciona pessoas.');
      }

      setSpaceMembersCanInvite(spaceId, membersCanInvite);

      const body: SpaceDetailResponse = { data: { ...space, membersCanInvite } };
      return HttpResponse.json(body);
    },
  ),

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

      const spaceId = String(params.spaceId);
      const personId = String(params.personId);

      // An editor of an open space, after the 404 and the 403s and before
      // the search of the person, like `SpacesService.addMember`: neither the
      // owner nor the member themselves can be added by that member. A viewer
      // is refused by `addSpaceMember` first.
      const space = spaceDetailOf(person.id, spaceId);
      if (space?.reach === 'member' && space.canAddPeople) {
        const freeSpace = getDb().spaces.find((item) => item.id === spaceId);
        if (freeSpace?.type === 'free' && personId === freeSpace.ownerId) {
          return HttpResponse.json(
            { message: 'Esta pessoa é a dona deste espaço.' },
            { status: 400 },
          );
        }

        if (personId === person.id) {
          return HttpResponse.json(
            { message: 'Você já é membro deste espaço.' },
            { status: 400 },
          );
        }
      }

      const result = addSpaceMember(person.id, spaceId, personId);

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

  // Same order of checks as `SpacesService.updateMemberLevel`: 401, 404 (a
  // space the person does not reach, or a unit one), 403 (a member), 400 (the
  // owner, then the body), 404 (not a member), 200. Setting the level the
  // member already has is still a 200.
  http.patch(
    `${env.API_URL}/spaces/:spaceId/members/:personId`,
    async ({ cookies, params, request }) => {
      await networkDelay();
      const forced = await devOverride('spaces');
      if (forced) return forced;

      const { installation } = getDb();
      const hasSession = Boolean(cookies[SESSION_COOKIE_NAME]);
      const person = getSignedInPerson();

      if (!installation || !hasSession || !person) return unauthenticated();

      const spaceId = String(params.spaceId);
      const personId = String(params.personId);
      const space = spaceDetailOf(person.id, spaceId);
      if (space?.type !== 'free') return spaceNotFound();

      if (space.reach !== 'owner') {
        return HttpResponse.json(
          { message: 'Só o dono do espaço pode mudar o nível de um membro.' },
          { status: 403 },
        );
      }

      if (personId === person.id) {
        return HttpResponse.json(
          { message: 'O dono do espaço não tem nível.' },
          { status: 400 },
        );
      }

      const requestBody: unknown = await request.json().catch(() => null);
      if (typeof requestBody !== 'object' || requestBody === null) {
        return invalid('level', 'Escolha o nível do membro.');
      }

      if (Object.keys(requestBody).some((key) => key !== 'level')) {
        return invalid('', 'Campo não permitido.');
      }

      const level: unknown =
        'level' in requestBody ? requestBody.level : undefined;
      if (level !== 'view' && level !== 'edit') {
        return invalid('level', 'Escolha o nível do membro.');
      }

      const member = allPeople().find((item) => item.id === personId);
      if (!member || spaceMemberLevelOf(personId, spaceId) === null) {
        return HttpResponse.json(
          { message: 'Esta pessoa não é membro deste espaço.' },
          { status: 404 },
        );
      }

      setSpaceMemberLevel(spaceId, personId, level);

      const body: SpaceMemberLevelResponse = {
        data: {
          id: member.id,
          name: member.name,
          email: member.email,
          isCurrentPerson: false,
          role: 'member',
          level,
        },
      };
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
