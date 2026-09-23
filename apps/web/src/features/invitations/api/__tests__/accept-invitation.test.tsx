import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { NotFoundError } from '@/lib/errors';
import { queryConfig } from '@/lib/react-query';
import {
  getDb,
  type MockInvitation,
  seedInstalled,
  seedSampleInvitations,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { MOCK_PASSWORD } from '@/testing/mocks/utils';

import { acceptInvitation, useAcceptInvitation } from '../accept-invitation';

beforeEach(() => {
  seedInstalled({ signedIn: false });
  seedSampleInvitations();
});

const seededInvitation = (): MockInvitation => {
  const invitation = getDb().invitations[0];
  if (!invitation) throw new Error('The sample invitation was not seeded');
  return invitation;
};

const renderMutation = (token: string) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(() => useAcceptInvitation({ token }), { wrapper });
  return { ...view, queryClient };
};

test('sends POST to the accept path with name and password only', async () => {
  const seeded = seededInvitation();
  let requestedPath = '';
  let requestedBody: unknown = null;

  server.use(
    http.post(
      `${env.API_URL}/invitations/:token/accept`,
      async ({ request }) => {
        requestedPath = new URL(request.url).pathname;
        requestedBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              person: {
                id: 'person-invited-1',
                name: 'Carlos Lima',
                email: seeded.email,
                isAdmin: false,
              },
              organization: { id: 'org-1', name: 'Exemplo' },
            },
          },
          { status: 201 },
        );
      },
    ),
  );

  await acceptInvitation({
    token: seeded.token,
    data: { name: 'Carlos Lima', password: MOCK_PASSWORD },
  });

  expect(requestedPath).toBe(
    `${env.API_URL}/invitations/${seeded.token}/accept`,
  );
  expect(requestedBody).toEqual({
    name: 'Carlos Lima',
    password: MOCK_PASSWORD,
  });
});

test('escapes the token in the path', async () => {
  let requestedPath = '';
  server.use(
    http.post(`${env.API_URL}/invitations/:token/accept`, ({ request }) => {
      requestedPath = new URL(request.url).pathname;
      return HttpResponse.json({ message: 'Convite indisponível.' }, {
        status: 404,
      });
    }),
  );

  await expect(
    acceptInvitation({
      token: 'a b/c',
      data: { name: 'Carlos Lima', password: MOCK_PASSWORD },
    }),
  ).rejects.toBeInstanceOf(NotFoundError);

  expect(requestedPath).toBe(`${env.API_URL}/invitations/a%20b%2Fc/accept`);
});

test('on success it writes the user into the current user query cache', async () => {
  const { result, queryClient } = renderMutation(seededInvitation().token);

  result.current.mutate({ name: 'Carlos Lima', password: MOCK_PASSWORD });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(queryClient.getQueryData(['authenticated-user'])).toMatchObject({
    person: {
      name: 'Carlos Lima',
      email: 'convidado@exemplo.com.br',
      isAdmin: false,
    },
    organization: { name: 'Biblioteca Municipal de Exemplo' },
  });
});

test('a 404 rejects without a global notification', async () => {
  await expect(
    acceptInvitation({
      token: 'token-que-nao-existe',
      data: { name: 'Carlos Lima', password: MOCK_PASSWORD },
    }),
  ).rejects.toBeInstanceOf(NotFoundError);

  expect(useNotifications.getState().notifications).toEqual([]);
});
