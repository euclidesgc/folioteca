import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import {
  usePageWidth,
  usePageWidthStore,
} from '@/features/documents/stores/page-width-store';
import { getUserQueryOptions, useUser } from '@/lib/auth';
import { queryConfig } from '@/lib/react-query';
import type { MutationConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import type { updatePageWidth } from '../update-page-width';
import { useUpdatePageWidth } from '../update-page-width';

beforeEach(() => {
  usePageWidthStore.setState(usePageWidthStore.getInitialState());
  seedInstalled({ signedIn: true });
});

// The mutation, the width the sheet reads and the session, side by side: the
// choice is only recorded once the session says who the person is.
const renderMutation = (
  mutationConfig?: MutationConfig<typeof updatePageWidth>,
) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(
    () => ({
      mutation: useUpdatePageWidth({ mutationConfig }),
      width: usePageWidth(),
      user: useUser(),
    }),
    { wrapper },
  );
  return { ...view, queryClient };
};

test('useUpdatePageWidth sets the session choice before the request resolves', async () => {
  server.use(
    http.patch(`${env.API_URL}/auth/me/preferences`, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );

  const { result } = renderMutation();
  await waitFor(() => expect(result.current.user.data).toBeTruthy());

  result.current.mutation.mutate({ documentPageWidth: 'large' });

  await waitFor(() => expect(result.current.width).toBe('large'));
  expect(result.current.mutation.isPending).toBe(true);
  expect(usePageWidthStore.getState().sessionChoice).toEqual({
    personId: result.current.user.data?.person.id,
    width: 'large',
  });
});

test('useUpdatePageWidth awaits the user invalidation before the caller onSuccess', async () => {
  const order: string[] = [];
  const onSuccess = vi.fn(() => {
    order.push('caller onSuccess');
  });

  const { result, queryClient } = renderMutation({ onSuccess });
  await waitFor(() => expect(result.current.user.data).toBeTruthy());

  const invalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  const spy = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockImplementation(async (...args) => {
      await invalidateQueries(...args);
      order.push('user invalidated');
    });

  result.current.mutation.mutate({ documentPageWidth: 'full' });

  await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));

  expect(spy).toHaveBeenCalledWith(getUserQueryOptions());
  expect(order).toEqual(['user invalidated', 'caller onSuccess']);
  expect(result.current.user.data?.person.documentPageWidth).toBe('full');
});

test('useUpdatePageWidth keeps the chosen width after a failed request', async () => {
  server.use(
    http.patch(`${env.API_URL}/auth/me/preferences`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  const { result } = renderMutation();
  await waitFor(() =>
    expect(result.current.user.data?.person.documentPageWidth).toBe('medium'),
  );

  result.current.mutation.mutate({ documentPageWidth: 'large' });

  await waitFor(() => expect(result.current.mutation.isError).toBe(true));

  expect(result.current.width).toBe('large');
  expect(result.current.user.data?.person.documentPageWidth).toBe('medium');
});
