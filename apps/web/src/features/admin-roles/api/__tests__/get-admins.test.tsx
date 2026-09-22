import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

import { getAdmins, getAdminsQueryOptions } from '../get-admins';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('sends GET to /admins and returns the envelope', async () => {
  const requestedPaths: string[] = [];
  server.use(
    http.get(`${env.API_URL}/admins`, ({ request }) => {
      requestedPaths.push(new URL(request.url).pathname);
      return HttpResponse.json({
        data: [
          {
            id: 'person-1',
            name: 'Ana Souza',
            email: 'ana.souza@exemplo.com.br',
          },
        ],
      });
    }),
  );

  const response = await getAdmins();

  await waitFor(
    () => expect(requestedPaths).toEqual([`${env.API_URL}/admins`]),
    LAZY_TIMEOUT,
  );
  expect(response.data).toEqual([
    { id: 'person-1', name: 'Ana Souza', email: 'ana.souza@exemplo.com.br' },
  ]);
});

test('the query key is admins', () => {
  expect(getAdminsQueryOptions().queryKey).toEqual(['admins']);
});

test('a failure notifies through the interceptor', async () => {
  server.use(
    http.get(`${env.API_URL}/admins`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  await expect(getAdmins()).rejects.toBeDefined();

  // No `silentError` here: the interceptor is the one that warns.
  await waitFor(
    () =>
      expect(useNotifications.getState().notifications).toEqual([
        expect.objectContaining({ type: 'error', title: 'Algo deu errado' }),
      ]),
    LAZY_TIMEOUT,
  );
});
