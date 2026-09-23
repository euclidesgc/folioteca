import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import {
  getUnitPeople,
  getUnitPeopleQueryOptions,
} from '@/features/unit-assignments/api/get-unit-people';
import { NotFoundError } from '@/lib/errors';
import {
  addAssignment,
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSamplePeople,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('requests the people of the given org unit', async () => {
  seedSamplePeople();
  addAssignment(ROOT_ORG_UNIT_ID, 'person-sample-2');

  const requested: string[] = [];
  server.use(
    http.get(`${env.API_URL}/org-units/:orgUnitId/people`, ({ request }) => {
      requested.push(new URL(request.url).pathname);
      return HttpResponse.json({
        data: [
          {
            id: 'person-sample-2',
            name: 'Ana Lúcia Ferreira',
            email: 'ana.lucia.ferreira@exemplo.com.br',
          },
        ],
        orgUnit: { id: ROOT_ORG_UNIT_ID, name: 'Biblioteca Municipal de Exemplo' },
      });
    }),
  );

  const response = await getUnitPeople(ROOT_ORG_UNIT_ID);

  await waitFor(
    () =>
      expect(requested).toEqual([
        `${env.API_URL}/org-units/${ROOT_ORG_UNIT_ID}/people`,
      ]),
    LAZY_TIMEOUT,
  );
  expect(response.orgUnit).toEqual({
    id: ROOT_ORG_UNIT_ID,
    name: 'Biblioteca Municipal de Exemplo',
  });
  expect(response.data.map((person) => person.name)).toEqual([
    'Ana Lúcia Ferreira',
  ]);
});

test('uses the org unit scoped query key', () => {
  expect(getUnitPeopleQueryOptions('org-unit-acervo').queryKey).toEqual([
    'org-units',
    'org-unit-acervo',
    'people',
  ]);
});

test('a 404 rejects with the not found error', async () => {
  await expect(getUnitPeople('unidade-que-nao-existe')).rejects.toBeInstanceOf(
    NotFoundError,
  );
});
