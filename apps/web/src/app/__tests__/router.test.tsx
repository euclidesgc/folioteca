import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { expect, test } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { screen } from '@/testing/test-utils';

import { AppRouter, createAppRouter } from '../router';

test('createAppRouter builds a router with the home and catch-all routes', () => {
  const router = createAppRouter();

  const paths = router.routes.map((route) => route.path);
  expect(paths).toContain('/');
  expect(paths).toContain('*');
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
