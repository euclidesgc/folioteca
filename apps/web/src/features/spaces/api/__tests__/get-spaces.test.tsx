import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

import { getSpaces, getSpacesQueryOptions, useSpaces } from '../get-spaces';

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

test('useSpaces refetches when remounted', async () => {
  let calls = 0;
  server.use(
    http.get(`${env.API_URL}/spaces`, () => {
      calls += 1;
      return HttpResponse.json({
        data: [{ id: 'space-org-unit-root', type: 'unit', name: 'Acervo' }],
      });
    }),
  );
  // One client for both mounts: the second mount finds the list in the cache.
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const first = renderHook(() => useSpaces(), { wrapper });
  await waitFor(
    () => expect(first.result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
  expect(calls).toBe(1);
  first.unmount();

  const second = renderHook(() => useSpaces(), { wrapper });

  await waitFor(() => expect(calls).toBe(2), LAZY_TIMEOUT);
  await waitFor(
    () => expect(second.result.current.isFetching).toBe(false),
    LAZY_TIMEOUT,
  );
});
