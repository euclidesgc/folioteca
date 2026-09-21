import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { screen } from '@/testing/test-utils';

// The home page behind the gate needs an installed instance with a session.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The real route tree (root layout + lazy children + catch-all), so we can
// check that the 404 page renders outside the app layout.
const renderRoutes = (initialEntries: string[]) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

test('unknown address renders Página não encontrada as the only h1', async () => {
  renderRoutes(['/unknown-address']);

  const headings = await screen.findAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Página não encontrada');
});

test('shows the support text', async () => {
  renderRoutes(['/unknown-address']);

  expect(
    await screen.findByText(
      'O endereço que você abriu não existe ou foi movido.',
    ),
  ).toBeInTheDocument();
});

test('renders outside the app layout without the main navigation', async () => {
  renderRoutes(['/unknown-address']);

  await screen.findByRole('heading', { level: 1 });
  expect(
    screen.queryByRole('navigation', { name: 'Navegação principal' }),
  ).not.toBeInTheDocument();
});

test('Voltar para o início link leads to the home page', async () => {
  const user = userEvent.setup();
  renderRoutes(['/unknown-address']);

  await user.click(
    await screen.findByRole('link', { name: 'Voltar para o início' }),
  );

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
});
