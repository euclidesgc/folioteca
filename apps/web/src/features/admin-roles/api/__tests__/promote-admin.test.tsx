import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { useAdmins } from '@/features/admin-roles/api/get-admins';
import { usePeopleSearch } from '@/hooks/use-people-search';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled, seedSamplePeople } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { promoteAdmin, usePromoteAdmin } from '../promote-admin';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

// Zilda is the last of the seeded people, and she does not administer yet.
const ZILDA = 'Zilda Marques';
const ZILDA_ID = 'person-sample-12';
const ZILDA_EMAIL = 'zilda.marques@exemplo.com.br';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

const createWrapper = (
  queryClient: QueryClient,
): ((props: { children: React.ReactNode }) => React.JSX.Element) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

test('sends PUT to admins personId and returns the envelope', async () => {
  let requestedUrl = '';
  let requestedMethod = '';
  server.use(
    http.put(`${env.API_URL}/admins/:personId`, ({ request }) => {
      requestedUrl = new URL(request.url).pathname;
      requestedMethod = request.method;
      return HttpResponse.json({
        data: { id: ZILDA_ID, name: ZILDA, email: ZILDA_EMAIL },
      });
    }),
  );

  const response = await promoteAdmin({ personId: ZILDA_ID });

  expect(requestedMethod).toBe('PUT');
  expect(requestedUrl).toBe(`${env.API_URL}/admins/${ZILDA_ID}`);
  expect(response).toEqual({
    data: { id: ZILDA_ID, name: ZILDA, email: ZILDA_EMAIL },
  });
});

test('a success invalidates the admins query', async () => {
  let adminsCalls = 0;
  server.use(
    http.get(`${env.API_URL}/admins`, () => {
      adminsCalls += 1;
      return HttpResponse.json({ data: [] });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(
    () => ({ admins: useAdmins(), promote: usePromoteAdmin() }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(adminsCalls).toBe(1), LAZY_TIMEOUT);

  await result.current.promote.mutateAsync({ personId: ZILDA_ID });

  await waitFor(() => expect(adminsCalls).toBe(2), LAZY_TIMEOUT);
});

test('the caller onSuccess runs only after the invalidation settled', async () => {
  // The refetch of the admins is held until the test lets it go, so the
  // caller's onSuccess can only run after it resolves — no timer anywhere.
  let adminsCalls = 0;
  let releaseAdmins = (): void => {};
  const held = new Promise<void>((resolve) => {
    releaseAdmins = resolve;
  });
  server.use(
    http.get(`${env.API_URL}/admins`, async () => {
      adminsCalls += 1;
      if (adminsCalls > 1) await held;
      return HttpResponse.json({ data: [] });
    }),
  );

  const onSuccess = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(
    () => ({
      admins: useAdmins(),
      promote: usePromoteAdmin({ mutationConfig: { onSuccess } }),
    }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(adminsCalls).toBe(1), LAZY_TIMEOUT);

  const promotion = result.current.promote.mutateAsync({
    personId: ZILDA_ID,
  });

  await waitFor(() => expect(adminsCalls).toBe(2), LAZY_TIMEOUT);
  // The refetch is still in flight: whoever called the hook has not been
  // told yet.
  expect(onSuccess).not.toHaveBeenCalled();

  releaseAdmins();
  await promotion;

  await waitFor(
    () => expect(onSuccess).toHaveBeenCalledTimes(1),
    LAZY_TIMEOUT,
  );
});

test('a success invalidates the people search by prefix', async () => {
  let searchCalls = 0;
  server.use(
    http.get(`${env.API_URL}/people`, () => {
      searchCalls += 1;
      return HttpResponse.json({
        data: [{ id: ZILDA_ID, name: ZILDA, email: ZILDA_EMAIL }],
        hasMore: false,
      });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(
    () => ({
      search: usePeopleSearch({ term: 'zilda' }),
      promote: usePromoteAdmin(),
    }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(searchCalls).toBe(1), LAZY_TIMEOUT);

  await result.current.promote.mutateAsync({ personId: ZILDA_ID });

  await waitFor(() => expect(searchCalls).toBe(2), LAZY_TIMEOUT);
});

test('a failure notifies through the interceptor', async () => {
  server.use(
    http.put(`${env.API_URL}/admins/:personId`, () =>
      HttpResponse.json({ message: 'Pessoa não encontrada.' }, { status: 404 }),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(() => usePromoteAdmin(), {
    wrapper: createWrapper(queryClient),
  });

  await expect(
    result.current.mutateAsync({ personId: ZILDA_ID }),
  ).rejects.toBeDefined();

  await waitFor(
    () =>
      expect(
        useNotifications
          .getState()
          .notifications.map((item) => item.message),
      ).toContain('Pessoa não encontrada.'),
    LAZY_TIMEOUT,
  );
});
