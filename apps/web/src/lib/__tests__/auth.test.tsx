import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { MOCK_PASSWORD } from '@/testing/mocks/utils';
import { renderApp, screen } from '@/testing/test-utils';
import type { CurrentUser } from '@/types/api';

import { UnauthenticatedError } from '../errors';
import {
  AuthLoader,
  getUser,
  getUserQueryOptions,
  loginInputSchema,
  ProtectedRoute,
  useLogin,
  useLogout,
  useUser,
} from '../auth';

const SEED_EMAIL = 'ana.souza@exemplo.com.br';

const SEED_USER: CurrentUser = {
  organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
  person: {
    id: 'person-1',
    name: 'Ana Souza',
    email: SEED_EMAIL,
    isAdmin: true,
  },
};

const createWrapper = (
  queryClient: QueryClient,
): ((props: { children: React.ReactNode }) => React.JSX.Element) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

// ProtectedRoute runs below the gate, which has already resolved the session.
const renderProtectedRoute = (
  user: CurrentUser | null,
): ReturnType<typeof createMemoryRouter> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['authenticated-user'], user);

  const router = createMemoryRouter(
    [
      {
        path: '/favorites',
        element: (
          <ProtectedRoute>
            <p>Conteúdo protegido</p>
          </ProtectedRoute>
        ),
      },
      { path: '/login', element: <h1>Entrar</h1> },
    ],
    { initialEntries: ['/favorites?x=1'] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

const renderAuthLoader = (): ReturnType<typeof renderApp> =>
  renderApp(
    <AuthLoader
      renderLoading={(): React.JSX.Element => <p>Carregando sessão…</p>}
      renderError={(): React.JSX.Element => (
        <p role="alert">Não foi possível abrir a sessão.</p>
      )}
    >
      <p>Conteúdo protegido</p>
    </AuthLoader>,
  );

test('getUser returns the current user from the data envelope', async () => {
  seedInstalled({ signedIn: true });

  const user = await getUser();

  expect(user?.organization.name).toBe('Biblioteca Municipal de Exemplo');
  expect(user?.person.name).toBe('Ana Souza');
});

test('getUser returns null on 401', async () => {
  await expect(getUser()).resolves.toBeNull();
});

test('getUser rethrows on 500', async () => {
  server.use(
    http.get(`${env.API_URL}/auth/me`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  await expect(getUser()).rejects.toMatchObject({
    response: { status: 500 },
  });
});

test('AuthLoader renders renderLoading while pending', () => {
  server.use(
    http.get(`${env.API_URL}/auth/me`, async () => {
      await new Promise(() => {});
    }),
  );

  renderAuthLoader();

  expect(screen.getByText('Carregando sessão…')).toBeInTheDocument();
});

test('AuthLoader renders children when the user resolves to null', async () => {
  renderAuthLoader();

  expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
});

test('AuthLoader renders renderError on failure', async () => {
  server.use(
    http.get(`${env.API_URL}/auth/me`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  renderAuthLoader();

  expect(await screen.findByRole('alert')).toBeInTheDocument();
});

test('loginInputSchema lowercases and trims the email', () => {
  const result = loginInputSchema.safeParse({
    email: '  Ana.Souza@Exemplo.COM.BR  ',
    password: MOCK_PASSWORD,
  });

  expect(result.success).toBe(true);
  expect(result.data?.email).toBe(SEED_EMAIL);
});

test('loginInputSchema rejects empty fields with the literal messages', () => {
  const result = loginInputSchema.safeParse({ email: '', password: '' });

  expect(result.success).toBe(false);
  const messages = result.error?.issues.map((issue) => issue.message) ?? [];
  expect(messages).toContain('Informe o e-mail.');
  expect(messages).toContain('Informe a senha.');
});

test('useLogin writes the user to the cache without a second GET /auth/me', async () => {
  seedInstalled({ signedIn: false });
  const meRequests = vi.fn();
  server.use(
    http.get(`${env.API_URL}/auth/me`, () => {
      meRequests();
      return HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(
    () => ({ user: useUser(), login: useLogin() }),
    { wrapper: createWrapper(queryClient) },
  );

  await waitFor(() => expect(result.current.user.isSuccess).toBe(true));
  expect(meRequests).toHaveBeenCalledTimes(1);

  await result.current.login.mutateAsync({
    data: { email: SEED_EMAIL, password: MOCK_PASSWORD },
  });

  await waitFor(() =>
    expect(queryClient.getQueryData(['authenticated-user'])).toEqual(SEED_USER),
  );
  expect(meRequests).toHaveBeenCalledTimes(1);
});

test('useLogin rejects with UnauthenticatedError on 401 and notifies nothing', async () => {
  seedInstalled({ signedIn: false });

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const { result } = renderHook(() => useLogin(), {
    wrapper: createWrapper(queryClient),
  });

  await expect(
    result.current.mutateAsync({
      data: { email: SEED_EMAIL, password: 'senha-que-nao-confere' },
    }),
  ).rejects.toBeInstanceOf(UnauthenticatedError);

  expect(useNotifications.getState().notifications).toHaveLength(0);
  expect(queryClient.getQueryData(['authenticated-user'])).toBeUndefined();
});

test('useLogout clears the query cache and calls onSuccess', async () => {
  seedInstalled({ signedIn: true });
  const onSuccess = vi.fn();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['authenticated-user'], SEED_USER);

  const { result } = renderHook(() => useLogout({ onSuccess }), {
    wrapper: createWrapper(queryClient),
  });

  await result.current.mutateAsync();

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(queryClient.getQueryData(['authenticated-user'])).toBeUndefined();
});

test('useLogout does not clear the cache when the request fails', async () => {
  seedInstalled({ signedIn: true });
  const onSuccess = vi.fn();
  server.use(
    http.post(`${env.API_URL}/auth/logout`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['authenticated-user'], SEED_USER);

  const { result } = renderHook(() => useLogout({ onSuccess }), {
    wrapper: createWrapper(queryClient),
  });

  await expect(result.current.mutateAsync()).rejects.toBeDefined();

  expect(queryClient.getQueryData(['authenticated-user'])).toEqual(SEED_USER);
  expect(onSuccess).not.toHaveBeenCalled();
});

test('ProtectedRoute redirects to /login with the path and the search in redirectTo', async () => {
  const router = renderProtectedRoute(null);

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Entrar' }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
  expect(router.state.location.search).toBe(
    `?redirectTo=${encodeURIComponent('/favorites?x=1')}`,
  );
});

test('ProtectedRoute renders the children when there is a user', async () => {
  const router = renderProtectedRoute(SEED_USER);

  expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/favorites');
});

// The waits of the session below get an explicit budget instead of the
// implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

test('getUserQueryOptions uses a finite staleTime of 30 seconds', () => {
  expect(getUserQueryOptions().staleTime).toBe(30_000);
});

test('getUserQueryOptions refetches on window focus', () => {
  expect(getUserQueryOptions().refetchOnWindowFocus).toBe(true);
});

test('a stale session is refetched on a new mount', async () => {
  seedInstalled({ signedIn: true });
  let meCalls = 0;
  server.use(
    http.get(`${env.API_URL}/auth/me`, () => {
      meCalls += 1;
      return HttpResponse.json({ data: SEED_USER });
    }),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['authenticated-user'], SEED_USER);

  const first = renderHook(() => useUser(), {
    wrapper: createWrapper(queryClient),
  });

  // Fresh within the 30 seconds: nothing is asked of the server.
  expect(meCalls).toBe(0);
  first.unmount();

  // The role may have changed on the screen: the session is marked stale.
  await queryClient.invalidateQueries({ queryKey: ['authenticated-user'] });

  const second = renderHook(() => useUser(), {
    wrapper: createWrapper(queryClient),
  });

  await waitFor(() => expect(meCalls).toBe(1), LAZY_TIMEOUT);
  await waitFor(
    () => expect(second.result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
});
