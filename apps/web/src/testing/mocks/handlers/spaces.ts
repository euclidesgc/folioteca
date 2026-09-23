import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import { spaceNameSchema } from '@/features/spaces/utils/space-name-schema';

import { addFreeSpace, getDb, getSignedInPerson, listSpacesOf } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type SpacesResponse = components['schemas']['SpacesResponse'];
type SpaceResponse = components['schemas']['SpaceResponse'];

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

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
];
