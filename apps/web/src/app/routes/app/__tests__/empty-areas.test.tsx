import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { renderApp, screen } from '@/testing/test-utils';

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

import { Component as Spaces } from '../spaces';

// "Meus documentos", "Favoritos" and "Lixeira" left this set when they stopped
// being empty pages: their emptiness now comes from the API, and each has its
// own file, my-documents.test.tsx, favorites.test.tsx and trash.test.tsx.
const areas = [
  {
    name: 'Espaços',
    Component: Spaces,
    routePath: '/spaces',
    title: 'Espaços',
    support: 'Espaços reúnem os documentos de uma equipe ou de um assunto.',
    empty:
      'Nenhum espaço ainda. Os espaços de que você participa aparecem aqui.',
  },
];

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

const renderRoutes = (initialEntries: string[]) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

describe.each(areas)(
  '$name',
  ({ name, Component, routePath, title, support, empty }) => {
    test(`${name} renders its title as the only h1`, () => {
      renderApp(<Component />);

      const headings = screen.getAllByRole('heading', { level: 1 });
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent(title);
    });

    test(`${name} renders its support text`, () => {
      renderApp(<Component />);

      expect(screen.getByText(support)).toBeInTheDocument();
    });

    test(`${name} renders its empty state text`, () => {
      renderApp(<Component />);

      expect(screen.getByText(empty)).toBeInTheDocument();
    });

    test(`${name} marks its sidebar link as the current page`, async () => {
      renderRoutes([routePath]);

      expect(
        await screen.findByRole('link', { name }, LAZY_TIMEOUT),
      ).toHaveAttribute('aria-current', 'page');
    });
  },
);
