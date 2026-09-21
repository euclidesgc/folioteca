import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

// The sources themselves, not what the bundler made of them: what matters is
// how the route reaches the editor.
import documentViewSource from '@/features/documents/components/document-view.tsx?raw';

import documentRouteSource from '../routes/app/document.tsx?raw';

import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { SESSION_COOKIE_NAME } from '@/testing/mocks/utils';
import { screen } from '@/testing/test-utils';

import { AppRouter, createAppRouter, createRoutes } from '../router';

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

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
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Boas-vindas à Folioteca' },
      LAZY_TIMEOUT,
    ),
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
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Entrar' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
  expect(router.state.location.search).toBe('?redirectTo=%2Ffavorites');
});

test('registers /documents/:documentId inside the layout route', () => {
  const gatedRoutes = createRoutes()[0]?.children ?? [];
  const layoutRoute = gatedRoutes.find((route) => route.path === '/');

  const childPaths = layoutRoute?.children?.map((route) => route.path) ?? [];
  expect(childPaths).toContain('documents/:documentId');

  const documentRoute = layoutRoute?.children?.find(
    (route) => route.path === 'documents/:documentId',
  );
  expect(documentRoute?.lazy).toBeTypeOf('function');
});

test('the document route does not import the editor statically', () => {
  const sources = [documentRouteSource, documentViewSource];
  const valueImports = sources.flatMap((source) =>
    [...source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'([^']+)';/gm)].map(
      (match) => match[1] ?? '',
    ),
  );

  expect(
    valueImports.filter((specifier) =>
      /^(@blocknote|@hocuspocus|yjs|y-)/.test(specifier),
    ),
  ).toEqual([]);

  // The editor arrives through the lazy boundary instead.
  expect(documentViewSource).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(/);
  expect(documentViewSource).toContain('document-editor');
});

test('registers the admin structure route before the catch-all', () => {
  const routes = createRoutes();
  const gatedRoutes = routes[0]?.children ?? [];
  const layoutRoute = gatedRoutes.find((route) => route.path === '/');

  const childPaths = layoutRoute?.children?.map((route) => route.path) ?? [];
  expect(childPaths).toContain('admin/structure');

  const structureRoute = layoutRoute?.children?.find(
    (route) => route.path === 'admin/structure',
  );
  expect(structureRoute?.lazy).toBeTypeOf('function');

  const topLevelPaths = routes.map((route) => route.path);
  expect(topLevelPaths.indexOf('*')).toBe(topLevelPaths.length - 1);
});

test('registers /login outside the layout route', () => {
  const gatedRoutes = createRoutes()[0]?.children ?? [];

  expect(gatedRoutes.map((route) => route.path)).toContain('/login');

  const layoutRoute = gatedRoutes.find((route) => route.path === '/');
  expect(layoutRoute?.children?.map((route) => route.path)).not.toContain(
    '/login',
  );
});
