import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, waitFor, within } from '@/testing/test-utils';

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The real routes of the app, in a memory router.
const renderRoutes = (url: string): ReturnType<typeof createMemoryRouter> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

test('an admin opens /admin/admins and sees the heading, both notices and the list', async () => {
  renderRoutes(paths.admin.admins.getHref());

  const headings = await screen.findAllByRole(
    'heading',
    { level: 1 },
    LAZY_TIMEOUT,
  );
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Administradores');
  expect(
    screen.getByText('Quem administra esta instância hoje.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Administrar a instância não dá acesso a documento: ninguém vê um documento por ser administração. O acesso chega com os espaços de unidade e o compartilhamento.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'Esta página é só de leitura. Promover alguém a administração e tirar o papel de quem não deve mais tê-lo ainda não é possível por aqui — por enquanto, isso só acontece direto no banco de dados.',
    ),
  ).toBeInTheDocument();

  const list = await screen.findByRole(
    'list',
    { name: 'Administradores' },
    LAZY_TIMEOUT,
  );
  expect(within(list).getAllByRole('listitem')).toHaveLength(1);
  expect(within(list).getByText('Ana Souza')).toBeInTheDocument();
  expect(
    screen.getByText('Só uma pessoa administra esta instância.'),
  ).toBeInTheDocument();
});

test('a member is sent home and no request goes to /admins', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  let adminsCalls = 0;
  server.use(
    http.get(`${env.API_URL}/admins`, () => {
      adminsCalls += 1;
      return HttpResponse.json({ data: [] });
    }),
  );

  const router = renderRoutes(paths.admin.admins.getHref());

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Boas-vindas à Folioteca' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(
    () => expect(router.state.location.pathname).toBe(paths.home.path),
    LAZY_TIMEOUT,
  );

  expect(
    screen.queryByRole('heading', { level: 1, name: 'Administradores' }),
  ).not.toBeInTheDocument();
  expect(adminsCalls).toBe(0);
});

test('the Administradores sidebar item shows for an admin and not for a member', async () => {
  renderRoutes(paths.home.getHref());

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Administração' },
    LAZY_TIMEOUT,
  );
  const items = within(nav).getAllByRole('listitem');
  expect(items.map((item) => item.textContent)).toEqual([
    'Estrutura',
    'Convites',
    'Administradores',
  ]);
  expect(
    within(nav).getByRole('link', { name: 'Administradores' }),
  ).toHaveAttribute('href', paths.admin.admins.getHref());

  // The same address, now for someone who is not an administrator: the app is
  // unmounted first so a single tree answers the queries below.
  cleanup();
  seedInstalled({ signedIn: true, isAdmin: false });
  renderRoutes(paths.home.getHref());

  await screen.findByRole(
    'heading',
    { level: 1, name: 'Boas-vindas à Folioteca' },
    LAZY_TIMEOUT,
  );
  expect(
    screen.queryByRole('link', { name: 'Administradores' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('navigation', { name: 'Administração' }),
  ).not.toBeInTheDocument();
});
