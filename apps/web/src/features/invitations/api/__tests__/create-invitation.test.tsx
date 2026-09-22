import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { ConflictError } from '@/lib/errors';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';

import { createInvitation, useCreateInvitation } from '../create-invitation';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('sends POST to the invitations path with the e-mail', async () => {
  const response = await createInvitation({
    data: { email: 'novo.convidado@exemplo.com.br' },
  });

  expect(response.data).toMatchObject({
    email: 'novo.convidado@exemplo.com.br',
  });
  expect(response.data.id).toEqual(expect.any(String));
  expect(response.data.token).toEqual(expect.any(String));
  expect(response.data.token.length).toBeGreaterThan(0);
});

test('rejects on 409 without a global notification', async () => {
  // The e-mail of the installed person: already part of the organization.
  await expect(
    createInvitation({ data: { email: 'ana.souza@exemplo.com.br' } }),
  ).rejects.toBeInstanceOf(ConflictError);

  expect(useNotifications.getState().notifications).toEqual([]);
});

test('a successful POST invalidates the invitations query key', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useCreateInvitation(), { wrapper });

  act(() => {
    result.current.mutate({ data: { email: 'novo.convidado@exemplo.com.br' } });
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['invitations'],
  });
});
