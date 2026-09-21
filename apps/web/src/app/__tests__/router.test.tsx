import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { SESSION_COOKIE_NAME } from '@/testing/mocks/utils';
import { screen } from '@/testing/test-utils';

import { AppRouter, createAppRouter, createRoutes } from '../router';

// The seed above signs the person in; these cases start signed out.
const signOut = (): void => {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('createAppRouter builds a router with the home and catch-all routes', () => {
  const router = createAppRouter();

  // The home area lives under the pathless gate; the catch-all stays outside.
  const paths = router.routes.map((route) => route.path);
  expect(paths).toContain('*');

  const gatedPaths = router.routes[0]?.children?.map((route) => route.path);
  expect(gatedPaths).toContain('/');
  expect(gatedPaths).toContain('/install');
});

test('AppRouter renders the home page at the default location', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  render(
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
});

test('/favorites without a session ends at /login?redirectTo=%2Ffavorites', async () => {
  signOut();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), {
    initialEntries: ['/favorites'],
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Entrar' }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
  expect(router.state.location.search).toBe('?redirectTo=%2Ffavorites');
});

test('registers /login outside the layout route', () => {
  const gatedRoutes = createRoutes()[0]?.children ?? [];

  expect(gatedRoutes.map((route) => route.path)).toContain('/login');

  const layoutRoute = gatedRoutes.find((route) => route.path === '/');
  expect(layoutRoute?.children?.map((route) => route.path)).not.toContain(
    '/login',
  );
});
