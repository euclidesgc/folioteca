import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import { renderApp, screen, within } from '@/testing/test-utils';

import { Component as Home } from '../home';

test('renders Boas-vindas à Folioteca as the only h1 with the support text', () => {
  renderApp(<Home />);

  const headings = screen.getAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Boas-vindas à Folioteca');
  expect(
    screen.getByText(
      'Aqui você escreve, organiza e compartilha os documentos da sua organização.',
    ),
  ).toBeInTheDocument();
});

test('renders the Como a Folioteca se organiza heading as h2', () => {
  renderApp(<Home />);

  expect(
    screen.getByRole('heading', {
      level: 2,
      name: 'Como a Folioteca se organiza',
    }),
  ).toBeInTheDocument();
});

test('lists the four areas with their descriptions', () => {
  renderApp(<Home />);

  const items = within(screen.getByRole('list')).getAllByRole('listitem');
  expect(items).toHaveLength(4);
  expect(items[0]).toHaveTextContent(
    'Os documentos que você marca para ter sempre à mão.',
  );
  expect(items[1]).toHaveTextContent(
    'O que você cria, visível só para você até compartilhar.',
  );
  expect(items[2]).toHaveTextContent(
    'Documentos reunidos por equipe ou por assunto.',
  );
  expect(items[3]).toHaveTextContent(
    'Documentos excluídos, até serem restaurados ou apagados de vez.',
  );
});

test('each area link navigates to its page', () => {
  renderApp(<Home />);

  expect(screen.getByRole('link', { name: 'Favoritos' })).toHaveAttribute(
    'href',
    paths.favorites.getHref(),
  );
  expect(
    screen.getByRole('link', { name: 'Meus documentos' }),
  ).toHaveAttribute('href', paths.myDocuments.getHref());
  expect(screen.getByRole('link', { name: 'Espaços' })).toHaveAttribute(
    'href',
    paths.spaces.getHref(),
  );
  expect(screen.getByRole('link', { name: 'Lixeira' })).toHaveAttribute(
    'href',
    paths.trash.getHref(),
  );
});

test('renders inside the app layout with the connection indicator', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: ['/'] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByRole('navigation', { name: 'Navegação principal' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('status')).toBeInTheDocument();
});
