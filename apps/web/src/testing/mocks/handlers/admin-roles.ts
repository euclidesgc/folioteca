import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';

import { getDb, listAdmins } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type AdminsResponse = components['schemas']['AdminsResponse'];

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const forbidden = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Apenas a administração pode fazer isso.' },
    { status: 403 },
  );

export const adminRolesHandlers = [
  http.get(`${env.API_URL}/admins`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('admins');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation } = getDb();
    if (!installation) return unauthenticated();
    if (!installation.person.isAdmin) return forbidden();

    // The explicit `map` is the barrier: without it the `isAdmin` of the fake
    // database would leak into a body the contract does not have.
    const body: AdminsResponse = {
      data: listAdmins().map(({ id, name, email }) => ({ id, name, email })),
    };
    return HttpResponse.json(body);
  }),
];
