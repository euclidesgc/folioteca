import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { queryConfig } from '@/lib/react-query';
import { renderApp, screen } from '@/testing/test-utils';

import { Component as Favorites } from '../favorites';
import { Component as MyDocuments } from '../my-documents';
import { Component as Spaces } from '../spaces';
import { Component as Trash } from '../trash';

const areas = [
  {
    name: 'Favoritos',
    Component: Favorites,
    routePath: '/favorites',
    title: 'Favoritos',
    support: 'Os documentos que você marca como favoritos ficam à mão aqui.',
    empty:
      'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
  },
  {
    name: 'Meus documentos',
    Component: MyDocuments,
    routePath: '/my-documents',
    title: 'Meus documentos',
    support:
      'Os documentos que você cria ficam aqui, visíveis só para você até serem compartilhados.',
    empty:
      'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
  },
  {
    name: 'Espaços',
    Component: Spaces,
    routePath: '/spaces',
    title: 'Espaços',
    support: 'Espaços reúnem os documentos de uma equipe ou de um assunto.',
    empty:
      'Nenhum espaço ainda. Os espaços de que você participa aparecem aqui.',
  },
  {
    name: 'Lixeira',
    Component: Trash,
    routePath: '/trash',
    title: 'Lixeira',
    support:
      'Documentos excluídos ficam aqui até serem restaurados ou apagados de vez.',
    empty: 'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
  },
];

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
        await screen.findByRole('link', { name }),
      ).toHaveAttribute('aria-current', 'page');
    });
  },
);
