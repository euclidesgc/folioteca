import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { NotFoundError } from '@/lib/errors';
import {
  getDb,
  type MockInvitation,
  seedInstalled,
  seedSampleInvitations,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { getInvitation } from '../get-invitation';

beforeEach(() => {
  // The invitation screen is public: nobody is signed in.
  seedInstalled({ signedIn: false });
  seedSampleInvitations();
});

const seededInvitation = (): MockInvitation => {
  const invitation = getDb().invitations[0];
  if (!invitation) throw new Error('The sample invitation was not seeded');
  return invitation;
};

test('sends GET to the invitation path with the escaped token', async () => {
  const seeded = seededInvitation();

  const response = await getInvitation({ token: seeded.token });

  expect(response.data).toEqual({
    email: 'convidado@exemplo.com.br',
    organizationName: 'Biblioteca Municipal de Exemplo',
  });

  let requestedPath = '';
  server.use(
    http.get(`${env.API_URL}/invitations/:token`, ({ request }) => {
      requestedPath = new URL(request.url).pathname;
      return HttpResponse.json({
        data: { email: seeded.email, organizationName: 'Exemplo' },
      });
    }),
  );

  await getInvitation({ token: 'a b/c' });

  expect(requestedPath).toBe(`${env.API_URL}/invitations/a%20b%2Fc`);
});

test('a 404 rejects without a global notification', async () => {
  await expect(
    getInvitation({ token: 'token-que-nao-existe' }),
  ).rejects.toBeInstanceOf(NotFoundError);

  expect(useNotifications.getState().notifications).toEqual([]);
});
