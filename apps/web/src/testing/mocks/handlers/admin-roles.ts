import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';

import { demotePerson, getDb, listAdmins, promotePerson } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type AdminsResponse = components['schemas']['AdminsResponse'];
type AdminResponse = components['schemas']['AdminResponse'];

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

  http.put(`${env.API_URL}/admins/:personId`, async ({ cookies, params }) => {
    await networkDelay();
    const forced = await devOverride('promote-admin');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation } = getDb();
    if (!installation) return unauthenticated();
    if (!installation.person.isAdmin) return forbidden();

    const person = promotePerson(String(params.personId));
    if (!person) {
      return HttpResponse.json(
        { message: 'Pessoa não encontrada.' },
        { status: 404 },
      );
    }

    // The explicit destructuring is the barrier, like in the `get` above:
    // without it the `isAdmin` of the fake database would leak into a body the
    // contract does not have.
    const { id, name, email } = person;
    const body: AdminResponse = { data: { id, name, email } };
    return HttpResponse.json(body);
  }),

  http.delete(`${env.API_URL}/admins/:personId`, async ({ cookies, params }) => {
    await networkDelay();
    const forced = await devOverride('demote-admin');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation } = getDb();
    if (!installation) return unauthenticated();
    if (!installation.person.isAdmin) return forbidden();

    const person = demotePerson(String(params.personId));
    if (!person) {
      return HttpResponse.json(
        { message: 'Pessoa não encontrada.' },
        { status: 404 },
      );
    }

    if (person === 'last-admin') {
      // The very phrase of `LAST_ADMIN_MESSAGE` in the service: the screen
      // shows it before the click and the server repeats it on the refusal.
      return HttpResponse.json(
        {
          message:
            'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.',
        },
        { status: 409 },
      );
    }

    // The explicit destructuring is the barrier, like in the handlers above:
    // without it the `isAdmin` of the fake database would leak into a body the
    // contract does not have.
    const { id, name, email } = person;
    const body: AdminResponse = { data: { id, name, email } };
    return HttpResponse.json(body);
  }),
];
