import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import { screen, within } from '@/testing/test-utils';
import type { CurrentUser } from '@/types/api';

import { SidebarAdmin } from '../sidebar-admin';

const userWith = (isAdmin: boolean): CurrentUser => ({
  organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
  person: {
    id: 'person-1',
    name: 'Ana Souza',
    email: 'ana.souza@exemplo.com.br',
    isAdmin,
  },
});

// The sidebar runs below the gate, which has already resolved the session.
const renderSidebar = (
  user: CurrentUser,
  url = paths.home.getHref(),
): ReturnType<typeof render> => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['authenticated-user'], user);

  const router = createMemoryRouter(
    [
      { path: paths.home.path, element: <SidebarAdmin /> },
      { path: paths.admin.structure.path, element: <SidebarAdmin /> },
    ],
    { initialEntries: [url] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

test('an admin sees the Administração navigation with the Estrutura link', () => {
  renderSidebar(userWith(true));

  const nav = screen.getByRole('navigation', { name: 'Administração' });
  expect(
    within(nav).getByRole('heading', { level: 2, name: 'Administração' }),
  ).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Estrutura' })).toHaveAttribute(
    'href',
    '/admin/structure',
  );
});

test('a person who is not admin does not get the navigation in the DOM', () => {
  renderSidebar(userWith(false));

  expect(
    screen.queryByRole('navigation', { name: 'Administração' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: 'Estrutura' }),
  ).not.toBeInTheDocument();
});

test('marks the Estrutura link as current on its route', () => {
  renderSidebar(userWith(true), paths.admin.structure.getHref());

  expect(screen.getByRole('link', { name: 'Estrutura' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
