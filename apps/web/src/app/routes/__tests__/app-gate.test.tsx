import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, it, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent } from '@/testing/test-utils';

// The whole app, on the real routes, in a memory router.
const renderRoutes = (url: string): ReturnType<typeof render> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

test('shows Carregando… with role status while the two queries are pending', () => {
  server.use(
    http.get(`${env.API_URL}/installation`, async () => {
      await new Promise(() => {});
    }),
    http.get(`${env.API_URL}/auth/me`, async () => {
      await new Promise(() => {});
    }),
  );

  renderRoutes('/');

  expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
});

it.each(['/', '/favorites', '/trash'])(
  'not installed redirects every app address to /install',
  async (url) => {
    renderRoutes(url);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Instalar a Folioteca',
      }),
    ).toBeInTheDocument();
  },
);

test('installed without session shows the login page instead of the layout', async () => {
  seedInstalled({ signedIn: false });

  renderRoutes('/');

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Entrar' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('navigation', { name: 'Navegação principal' }),
  ).not.toBeInTheDocument();
});

test('installed with session renders the app', async () => {
  seedInstalled({ signedIn: true });

  renderRoutes('/');

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('navigation', { name: 'Navegação principal' }),
  ).toBeInTheDocument();
});

test('shows Não foi possível abrir a Folioteca. with role alert when installation fails', async () => {
  server.use(
    http.get(`${env.API_URL}/installation`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  renderRoutes('/');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível abrir a Folioteca.',
  );
  expect(
    screen.getByRole('button', { name: 'Tentar de novo' }),
  ).toBeInTheDocument();
});

test('shows the same error when auth me fails with 500', async () => {
  seedInstalled({ signedIn: true });
  server.use(
    http.get(`${env.API_URL}/auth/me`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  renderRoutes('/');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível abrir a Folioteca.',
  );
});

test('Tentar de novo refetches both queries and opens the app', async () => {
  const user = userEvent.setup();
  seedInstalled({ signedIn: true });
  server.use(
    http.get(
      `${env.API_URL}/installation`,
      () => HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
      { once: true },
    ),
  );

  renderRoutes('/');

  await screen.findByRole('alert');

  await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Boas-vindas à Folioteca',
    }),
  ).toBeInTheDocument();
});

test('unknown address still renders the not found page outside the gate', async () => {
  renderRoutes('/endereco-que-nao-existe');

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Página não encontrada',
    }),
  ).toBeInTheDocument();
});
