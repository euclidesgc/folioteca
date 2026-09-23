import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import {
  getAdminsQueryOptions,
  useAdmins,
} from '@/features/admin-roles/api/get-admins';
import { usePeopleSearch } from '@/hooks/use-people-search';
import { useUser } from '@/lib/auth';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled, seedSamplePeople } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { demoteAdmin, useDemoteAdmin } from '../demote-admin';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

// Zilda is the last of the seeded people; Ana is the person of the session.
const ZILDA = 'Zilda Marques';
const ZILDA_ID = 'person-sample-12';
const ZILDA_EMAIL = 'zilda.marques@exemplo.com.br';
const SESSION_PERSON_ID = 'person-1';

const DEMOTE_PATH = `${env.API_URL}/admins/:personId`;

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

// The owner of the admins query, mounted next to whoever demotes: on the page
// the route reads the list and the list itself owns the mutation.
function AdminsReader(): React.JSX.Element {
  useAdmins();
  return <div />;
}

// A demotion that always answers 200, so each test below looks at the cache
// and not at the rule of the fake database.
const answerDemotion = (
  person: { id: string; name: string; email: string } = {
    id: ZILDA_ID,
    name: ZILDA,
    email: ZILDA_EMAIL,
  },
): void => {
  server.use(http.delete(DEMOTE_PATH, () => HttpResponse.json({ data: person })));
};

test('sends DELETE to admins personId and returns the envelope', async () => {
  let requestedUrl = '';
  let requestedMethod = '';
  server.use(
    http.delete(DEMOTE_PATH, ({ request }) => {
      requestedUrl = new URL(request.url).pathname;
      requestedMethod = request.method;
      return HttpResponse.json({
        data: { id: ZILDA_ID, name: ZILDA, email: ZILDA_EMAIL },
      });
    }),
  );

  const response = await demoteAdmin({ personId: ZILDA_ID, isSelf: false });

  expect(requestedMethod).toBe('DELETE');
  expect(requestedUrl).toBe(`${env.API_URL}/admins/${ZILDA_ID}`);
  expect(response).toEqual({
    data: { id: ZILDA_ID, name: ZILDA, email: ZILDA_EMAIL },
  });
});

test('demoting someone else invalidates the admins query and the people search by prefix', async () => {
  answerDemotion();

  let adminsCalls = 0;
  let searchCalls = 0;
  server.use(
    http.get(`${env.API_URL}/admins`, () => {
      adminsCalls += 1;
      return HttpResponse.json({ data: [] });
    }),
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
      admins: useAdmins(),
      search: usePeopleSearch({ term: 'zilda' }),
      demote: useDemoteAdmin(),
    }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(adminsCalls).toBe(1), LAZY_TIMEOUT);
  await waitFor(() => expect(searchCalls).toBe(1), LAZY_TIMEOUT);

  await result.current.demote.mutateAsync({
    personId: ZILDA_ID,
    isSelf: false,
  });

  await waitFor(() => expect(adminsCalls).toBe(2), LAZY_TIMEOUT);
  await waitFor(() => expect(searchCalls).toBe(2), LAZY_TIMEOUT);
});

test('the caller onSuccess runs only after the invalidation settled', async () => {
  answerDemotion();

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
      demote: useDemoteAdmin({ mutationConfig: { onSuccess } }),
    }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(adminsCalls).toBe(1), LAZY_TIMEOUT);

  const demotion = result.current.demote.mutateAsync({
    personId: ZILDA_ID,
    isSelf: false,
  });

  await waitFor(() => expect(adminsCalls).toBe(2), LAZY_TIMEOUT);
  // The refetch is still in flight: whoever called the hook has not been told
  // yet.
  expect(onSuccess).not.toHaveBeenCalled();

  releaseAdmins();
  await demotion;

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1), LAZY_TIMEOUT);
});

test('demoting yourself removes the admins key and sends no GET admins', async () => {
  answerDemotion({
    id: SESSION_PERSON_ID,
    name: 'Ana Souza',
    email: 'ana.souza@exemplo.com.br',
  });

  let adminsCalls = 0;
  server.use(
    http.get(`${env.API_URL}/admins`, () => {
      adminsCalls += 1;
      return HttpResponse.json({ data: [] });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  // The list lives in a component of its own, like on the page: the route
  // owns the query and the list owns the mutation.
  const { result } = renderHook(() => useDemoteAdmin(), {
    wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <AdminsReader />
          {children}
        </QueryClientProvider>
      );
    },
  });

  // The first load of the mounted query, which is not what this test counts.
  await waitFor(() => expect(adminsCalls).toBe(1), LAZY_TIMEOUT);
  adminsCalls = 0;

  await result.current.mutateAsync({
    personId: SESSION_PERSON_ID,
    isSelf: true,
  });

  // The key was removed, never invalidated: nothing asked the server for a
  // list it now answers with a 403.
  await waitFor(
    () =>
      expect(
        queryClient.getQueryData(getAdminsQueryOptions().queryKey),
      ).toBeUndefined(),
    LAZY_TIMEOUT,
  );
  expect(adminsCalls).toBe(0);
});

test('demoting yourself runs the caller onSuccess before invalidating the session', async () => {
  answerDemotion({
    id: SESSION_PERSON_ID,
    name: 'Ana Souza',
    email: 'ana.souza@exemplo.com.br',
  });

  const order: string[] = [];
  let meCalls = 0;
  server.use(
    http.get(`${env.API_URL}/auth/me`, () => {
      meCalls += 1;
      if (meCalls > 1) order.push('session');
      return HttpResponse.json({
        data: {
          person: {
            id: SESSION_PERSON_ID,
            name: 'Ana Souza',
            email: 'ana.souza@exemplo.com.br',
            isAdmin: false,
          },
          organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
        },
      });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(
    () => ({
      user: useUser(),
      demote: useDemoteAdmin({
        mutationConfig: {
          onSuccess: () => {
            order.push('caller');
          },
        },
      }),
    }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(meCalls).toBe(1), LAZY_TIMEOUT);

  await result.current.demote.mutateAsync({
    personId: SESSION_PERSON_ID,
    isSelf: true,
  });

  await waitFor(() => expect(order).toEqual(['caller', 'session']), LAZY_TIMEOUT);
});

test('demoting yourself invalidates the authenticated user afterwards', async () => {
  answerDemotion({
    id: SESSION_PERSON_ID,
    name: 'Ana Souza',
    email: 'ana.souza@exemplo.com.br',
  });

  let meCalls = 0;
  server.use(
    http.get(`${env.API_URL}/auth/me`, () => {
      meCalls += 1;
      return HttpResponse.json({
        data: {
          person: {
            id: SESSION_PERSON_ID,
            name: 'Ana Souza',
            email: 'ana.souza@exemplo.com.br',
            isAdmin: meCalls === 1,
          },
          organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
        },
      });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(
    () => ({ user: useUser(), demote: useDemoteAdmin() }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(meCalls).toBe(1), LAZY_TIMEOUT);

  await result.current.demote.mutateAsync({
    personId: SESSION_PERSON_ID,
    isSelf: true,
  });

  await waitFor(() => expect(meCalls).toBe(2), LAZY_TIMEOUT);
  await waitFor(
    () => expect(result.current.user.data?.person.isAdmin).toBe(false),
    LAZY_TIMEOUT,
  );
});

test('a failure notifies through the interceptor', async () => {
  server.use(
    http.delete(DEMOTE_PATH, () =>
      HttpResponse.json(
        {
          message:
            'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.',
        },
        { status: 409 },
      ),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(() => useDemoteAdmin(), {
    wrapper: createWrapper(queryClient),
  });

  await expect(
    result.current.mutateAsync({ personId: ZILDA_ID, isSelf: false }),
  ).rejects.toBeDefined();

  await waitFor(
    () =>
      expect(
        useNotifications.getState().notifications.map((item) => item.message),
      ).toContain(
        'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.',
      ),
    LAZY_TIMEOUT,
  );
});
