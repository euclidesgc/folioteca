import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { addInvitation, seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import {
  getInvitations,
  getInvitationsQueryOptions,
} from '../get-invitations';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('sends GET to /invitations and returns data', async () => {
  const invitation = addInvitation({ email: 'convidado@exemplo.com.br' });

  const requestedPaths: string[] = [];
  server.use(
    http.get(`${env.API_URL}/invitations`, ({ request }) => {
      requestedPaths.push(new URL(request.url).pathname);
      return HttpResponse.json({
        data: [
          {
            id: invitation.id,
            email: invitation.email,
            createdAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
          },
        ],
      });
    }),
  );

  const response = await getInvitations();

  expect(requestedPaths).toEqual([`${env.API_URL}/invitations`]);
  expect(getInvitationsQueryOptions().queryKey).toEqual(['invitations']);
  expect(response.data).toEqual([
    {
      id: invitation.id,
      email: 'convidado@exemplo.com.br',
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    },
  ]);
});

test('an empty list resolves with an empty data array', async () => {
  const response = await getInvitations();

  expect(response.data).toEqual([]);
  expect(useNotifications.getState().notifications).toEqual([]);
});

test('a failure rejects with the global notification', async () => {
  server.use(
    http.get(`${env.API_URL}/invitations`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  await expect(getInvitations()).rejects.toBeDefined();

  // No `silentError` here: the interceptor is the one that warns.
  expect(useNotifications.getState().notifications).toHaveLength(1);
  expect(useNotifications.getState().notifications[0]).toMatchObject({
    type: 'error',
    title: 'Algo deu errado',
  });
});
