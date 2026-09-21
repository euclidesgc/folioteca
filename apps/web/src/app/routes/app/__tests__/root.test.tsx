import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { screen } from '@/testing/test-utils';

import { ErrorBoundary, Root } from '../root';

// A child route that throws so the route ErrorBoundary takes over.
const ThrowingChild = (): never => {
  throw new Error('boom');
};

const renderWithErrorBoundary = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Root />,
        ErrorBoundary,
        children: [{ index: true, element: <ThrowingChild /> }],
      },
    ],
    { initialEntries: ['/'] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

// React Router logs the thrown error to the console; silence it here only.
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

test('renders the alert with the three expected texts when a child route throws', async () => {
  renderWithErrorBoundary();

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Algo deu errado');
  expect(alert).toHaveTextContent(
    'Não foi possível abrir esta página. Tente de novo em instantes.',
  );
  expect(
    await screen.findByRole('link', { name: 'Voltar para o início' }),
  ).toHaveAttribute('href', '/');
});
