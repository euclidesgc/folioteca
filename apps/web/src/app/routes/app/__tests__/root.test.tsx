import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { screen } from '@/testing/test-utils';

import { ErrorBoundary, Root } from '../root';

// Root runs below the gate, which has already resolved both queries.
const renderRoot = (user: {
  organization: { id: string; name: string };
  person: { id: string; name: string; email: string; isAdmin: boolean };
}) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['installation'], { data: { installed: true } });
  queryClient.setQueryData(['authenticated-user'], user);

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Root />,
        children: [{ index: true, element: <p>Conteúdo do início</p> }],
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

// Same frame, but the gate resolved the session to "nobody is signed in".
const renderRootWithoutSession = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['installation'], { data: { installed: true } });
  queryClient.setQueryData(['authenticated-user'], null);

  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Root />,
        children: [{ index: true, element: <p>Conteúdo do início</p> }],
      },
      { path: '/login', element: <h1>Entrar</h1> },
    ],
    { initialEntries: ['/'] },
  );

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

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

test('renders the identity above the connection indicator in the sidebar footer', async () => {
  seedInstalled({ signedIn: true });

  renderRoot({
    organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
    person: {
      id: 'person-1',
      name: 'Ana Souza',
      email: 'ana.souza@exemplo.com.br',
      isAdmin: true,
    },
  });

  const organization = await screen.findByText(
    'Biblioteca Municipal de Exemplo',
  );
  expect(screen.getByText('Ana Souza')).toBeInTheDocument();

  const connection = await screen.findByText('Conectado');
  expect(
    organization.compareDocumentPosition(connection) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('shows the Novo documento button and the Meus documentos recentes section in the sidebar', async () => {
  seedInstalled({ signedIn: true });

  renderRoot({
    organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
    person: {
      id: 'person-1',
      name: 'Ana Souza',
      email: 'ana.souza@exemplo.com.br',
      isAdmin: true,
    },
  });

  expect(
    await screen.findByRole('button', { name: 'Novo documento' }),
  ).toBeInTheDocument();
  const section = screen.getByRole('navigation', {
    name: 'Meus documentos recentes',
  });
  expect(section).toBeInTheDocument();
  expect(
    await screen.findByText('Nenhum documento ainda.'),
  ).toBeInTheDocument();
});

test('without a session redirects to the login page instead of rendering the layout', async () => {
  const router = renderRootWithoutSession();

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Entrar' }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/login');
  expect(screen.queryByText('Conteúdo do início')).not.toBeInTheDocument();
});
