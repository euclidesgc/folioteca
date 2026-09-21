import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { beforeEach, expect, test } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { screen } from '@/testing/test-utils';

import { AppRouter, createAppRouter } from '../router';

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
