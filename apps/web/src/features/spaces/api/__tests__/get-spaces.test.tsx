import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

import { getSpaces, getSpacesQueryOptions } from '../get-spaces';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('getSpaces calls GET spaces and returns the envelope', async () => {
  const requested: { method: string; path: string }[] = [];
  server.use(
    http.get(`${env.API_URL}/spaces`, ({ request }) => {
      requested.push({
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return HttpResponse.json({
        data: [{ id: 'space-org-unit-root', type: 'unit', name: 'Acervo' }],
      });
    }),
  );

  const response = await getSpaces();

  await waitFor(
    () =>
      expect(requested).toEqual([
        { method: 'GET', path: `${env.API_URL}/spaces` },
      ]),
    LAZY_TIMEOUT,
  );
  expect(response).toEqual({
    data: [{ id: 'space-org-unit-root', type: 'unit', name: 'Acervo' }],
  });
});

test('getSpacesQueryOptions uses the spaces query key', () => {
  expect(getSpacesQueryOptions().queryKey).toEqual(['spaces']);
});
