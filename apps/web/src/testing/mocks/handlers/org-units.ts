import { http, HttpResponse } from 'msw';

import { env } from '@/config/env';
import type { OrgUnitsResponse } from '@/types/api';

import { getDb, type MockOrgUnit } from '../db';
import { devOverride, networkDelay, SESSION_COOKIE_NAME } from '../utils';

const unauthenticated = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });

const forbidden = (): ReturnType<typeof HttpResponse.json> =>
  HttpResponse.json(
    { message: 'Apenas a administração pode fazer isso.' },
    { status: 403 },
  );

// Same ordering the API does in memory: pt-BR collator ignoring accents and
// case, with a deterministic tie-break by id.
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

const byName = (a: MockOrgUnit, b: MockOrgUnit): number =>
  collator.compare(a.name, b.name) || a.id.localeCompare(b.id);

export const orgUnitsHandlers = [
  http.get(`${env.API_URL}/org-units`, async ({ cookies }) => {
    await networkDelay();
    const forced = await devOverride('org-units');
    if (forced) return forced;

    if (!cookies[SESSION_COOKIE_NAME]) return unauthenticated();

    const { installation, orgUnits } = getDb();
    if (!installation) return unauthenticated();

    if (!installation.person.isAdmin) return forbidden();

    const body: OrgUnitsResponse = { data: [...orgUnits].sort(byName) };
    return HttpResponse.json(body);
  }),
];
