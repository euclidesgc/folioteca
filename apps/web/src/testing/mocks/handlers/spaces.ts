import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';

import { getDb, getSignedInPerson, listSpacesOf } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type SpacesResponse = components['schemas']['SpacesResponse'];

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

    if (!installation || !hasSession || !person) {
      return HttpResponse.json(
        { message: 'Sessão não encontrada.' },
        { status: 401 },
      );
    }

    const body: SpacesResponse = { data: listSpacesOf(person.id) };
    return HttpResponse.json(body);
  }),
];
