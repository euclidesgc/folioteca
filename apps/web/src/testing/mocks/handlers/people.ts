import type { components } from '@folioteca/api-contract';
import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';

import { allPeople, getDb, type MockPerson } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

type PeopleResponse = components['schemas']['PeopleResponse'];

// The same hard limit the server has, with no parameter to raise it.
const PEOPLE_SEARCH_LIMIT = 10;

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const forbidden = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Apenas a administração pode fazer isso.' },
    { status: 403 },
  );

// Same ordering the API asks the database for, so which ten are cut is the
// same here and there.
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

const byName = (a: MockPerson, b: MockPerson): number =>
  collator.compare(a.name, b.name) || a.id.localeCompare(b.id);

// Case and accents ignored, name or e-mail: whoever looks for "silva" finds
// "Maria da Silva".
const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const peopleHandlers = [
  http.get(`${env.API_URL}/people`, async ({ request, cookies }) => {
    await networkDelay();
    const forced = await devOverride('people');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation } = getDb();
    if (!installation) return unauthenticated();
    if (!installation.person.isAdmin) return forbidden();

    // A missing, empty or blank term is the normal state of the field, not an
    // error: the answer is an empty list, and nothing is looked up.
    const term = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (term.length === 0) {
      const empty: PeopleResponse = { data: [], hasMore: false };
      return HttpResponse.json(empty);
    }

    const needle = normalize(term);
    // Eleven are read to answer ten: the eleventh is what says there is more,
    // and costs no second query.
    const matches = allPeople()
      .filter(
        (person) =>
          normalize(person.name).includes(needle) ||
          normalize(person.email).includes(needle),
      )
      .sort(byName)
      .slice(0, PEOPLE_SEARCH_LIMIT + 1);

    const body: PeopleResponse = {
      data: matches
        .slice(0, PEOPLE_SEARCH_LIMIT)
        .map(({ id, name, email }) => ({ id, name, email })),
      hasMore: matches.length > PEOPLE_SEARCH_LIMIT,
    };
    return HttpResponse.json(body);
  }),
];
