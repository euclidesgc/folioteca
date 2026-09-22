import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import {
  getPeopleSearchQueryOptions,
  usePeopleSearch,
} from '@/features/unit-assignments/api/search-people';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled, seedSamplePeople } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

// Counts the searches that leave the app, answering what the fake API would.
const countSearches = (): { calls: () => number; terms: () => string[] } => {
  const terms: string[] = [];
  server.use(
    http.get(`${env.API_URL}/people`, ({ request }) => {
      terms.push(new URL(request.url).searchParams.get('q') ?? '');
      return HttpResponse.json({ data: [], hasMore: false });
    }),
  );

  return { calls: () => terms.length, terms: () => terms };
};

const wrapperFor = (
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

const renderSearch = (
  term: string,
): ReturnType<typeof renderHook<ReturnType<typeof usePeopleSearch>, string>> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  return renderHook((current: string) => usePeopleSearch({ term: current }), {
    initialProps: term,
    wrapper: wrapperFor(queryClient),
  });
};

test('sends the term as q', async () => {
  const search = countSearches();

  const { result } = renderSearch('ana');

  await waitFor(() => expect(result.current.isSuccess).toBe(true), LAZY_TIMEOUT);
  expect(search.terms()).toEqual(['ana']);
});

test('an empty term sends no request', async () => {
  const search = countSearches();

  const { result } = renderSearch('');

  expect(getPeopleSearchQueryOptions('').enabled).toBe(false);
  await waitFor(
    () => expect(result.current.fetchStatus).toBe('idle'),
    LAZY_TIMEOUT,
  );
  expect(search.calls()).toBe(0);
});

test('a blank term sends no request', async () => {
  const search = countSearches();

  const { result } = renderSearch('   ');

  expect(getPeopleSearchQueryOptions('   ').enabled).toBe(false);
  await waitFor(
    () => expect(result.current.fetchStatus).toBe('idle'),
    LAZY_TIMEOUT,
  );
  expect(search.calls()).toBe(0);
});

test('previous results are kept between terms', async () => {
  const { result, rerender } = renderSearch('ana');

  await waitFor(() => expect(result.current.isSuccess).toBe(true), LAZY_TIMEOUT);
  const first = result.current.data;
  expect(first?.data.length).toBeGreaterThan(0);

  rerender('zilda');

  // The list does not blink while the answer of the new term is on its way.
  expect(result.current.data).toEqual(first);
  expect(result.current.isPlaceholderData).toBe(true);

  await waitFor(
    () => expect(result.current.isPlaceholderData).toBe(false),
    LAZY_TIMEOUT,
  );
  expect(result.current.data?.data.map((person) => person.name)).toEqual([
    'Zilda Marques',
  ]);
});
