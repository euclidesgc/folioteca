import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

import { createSpace, useCreateSpace } from '../create-space';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const makeWrapper = (
  queryClient: QueryClient,
): (({ children }: { children: React.ReactNode }) => React.JSX.Element) => {
  const Wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

test('createSpace calls POST spaces and returns the envelope', async () => {
  const requested: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.post(`${env.API_URL}/spaces`, async ({ request }) => {
      requested.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: await request.json(),
      });
      return HttpResponse.json(
        {
          data: { id: 'space-free-99', type: 'free', name: 'Comissão de Leitura' },
        },
        { status: 201 },
      );
    }),
  );

  const response = await createSpace({ name: 'Comissão de Leitura' });

  expect(requested).toEqual([
    {
      method: 'POST',
      path: `${env.API_URL}/spaces`,
      body: { name: 'Comissão de Leitura' },
    },
  ]);
  expect(response).toEqual({
    data: { id: 'space-free-99', type: 'free', name: 'Comissão de Leitura' },
  });
});

test('useCreateSpace awaits the spaces invalidation before onSuccess', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const events: string[] = [];
  const invalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
    async (...args) => {
      events.push(`invalidate:start:${JSON.stringify(args[0]?.queryKey)}`);
      await invalidateQueries(...args);
      events.push('invalidate:end');
    },
  );
  const onSuccess = vi.fn(() => {
    events.push('onSuccess');
  });

  const { result } = renderHook(
    () => useCreateSpace({ mutationConfig: { onSuccess } }),
    { wrapper: makeWrapper(queryClient) },
  );

  result.current.mutate({ name: 'Comissão de Leitura' });

  await waitFor(() => expect(result.current.isSuccess).toBe(true), LAZY_TIMEOUT);

  expect(events).toEqual([
    'invalidate:start:["spaces"]',
    'invalidate:end',
    'onSuccess',
  ]);
  expect(onSuccess).toHaveBeenCalledTimes(1);
});
