import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled, seedSamplePeople } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { usePersonLookup } from '../use-person-lookup';

const SEARCH_URL = `${env.API_URL}/people/search`;

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

const renderLookup = (term: string) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, ...renderHook(() => usePersonLookup(term), { wrapper }) };
};

// Records the `q` of every search that reaches the server.
const recordSearches = (): string[] => {
  const terms: string[] = [];
  server.use(
    http.get(SEARCH_URL, ({ request }) => {
      terms.push(new URL(request.url).searchParams.get('q') ?? '');
      return HttpResponse.json({
        data: [
          {
            id: 'person-sample-3',
            name: 'Beatriz Nogueira',
            email: 'beatriz.nogueira@exemplo.com.br',
          },
        ],
        hasMore: false,
      });
    }),
  );
  return terms;
};

test('usePersonLookup does not request with 1 character', async () => {
  const terms = recordSearches();

  const { result } = renderLookup('b');

  await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
  expect(result.current.isPending).toBe(true);
  expect(result.current.data).toBeUndefined();
  expect(terms).toHaveLength(0);
});

test('usePersonLookup requests people search with q from 2 characters', async () => {
  const terms = recordSearches();

  const { result } = renderLookup('be');

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(terms).toEqual(['be']);
  expect(result.current.data?.data.map((person) => person.name)).toEqual([
    'Beatriz Nogueira',
  ]);
  expect(result.current.data?.hasMore).toBe(false);
});

test('usePersonLookup uses the people lookup query key', async () => {
  recordSearches();

  const { result, queryClient } = renderLookup('be');

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  const cached = queryClient
    .getQueryCache()
    .find({ queryKey: ['people', 'lookup', 'be'], exact: true });
  expect(cached?.queryKey).toEqual(['people', 'lookup', 'be']);
  expect(cached?.state.data).toEqual(result.current.data);
});
