import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { NotFoundError } from '@/lib/errors';
import { queryConfig } from '@/lib/react-query';
import { addInvitation, seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { revokeInvitation, useRevokeInvitation } from '../revoke-invitation';

// The request goes to the fake API and the invalidation waits for the reloaded
// list: every wait here gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('sends POST to /invitations/:id/revoke', async () => {
  const invitation = addInvitation({ email: 'convidado@exemplo.com.br' });

  let method: string | undefined;
  let pathname: string | undefined;
  server.use(
    http.post(
      `${env.API_URL}/invitations/:invitationId/revoke`,
      ({ request }) => {
        method = request.method;
        pathname = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );

  await revokeInvitation({ invitationId: invitation.id });

  expect(method).toBe('POST');
  expect(pathname).toBe(`${env.API_URL}/invitations/${invitation.id}/revoke`);
});

test('a successful revoke invalidates the invitations query key', async () => {
  const invitation = addInvitation({ email: 'convidado@exemplo.com.br' });
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useRevokeInvitation(), { wrapper });

  act(() => {
    result.current.mutate({ invitationId: invitation.id });
  });

  await waitFor(
    () => expect(result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['invitations'],
  });
});

test('a failure rejects with the global notification', async () => {
  // An invitation that is not pending any more answers the single 404 of the
  // route, with the message the interceptor shows: no `silentError` here.
  await expect(
    revokeInvitation({ invitationId: 'invitation-que-nao-existe' }),
  ).rejects.toBeInstanceOf(NotFoundError);

  await waitFor(
    () =>
      expect(useNotifications.getState().notifications).toEqual([
        expect.objectContaining({
          type: 'error',
          title: 'Algo deu errado',
          message: 'Convite indisponível.',
        }),
      ]),
    LAZY_TIMEOUT,
  );
});
