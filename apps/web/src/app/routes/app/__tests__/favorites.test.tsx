import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSampleFavorites,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, within } from '@/testing/test-utils';

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

// The real routes of the app, in a memory router.
const renderRoutes = (url: string): void => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

// The sidebar lists the same favorites: the page's own list is only
// addressable inside <main>, once the area heading is on screen.
const findPageContent = async (): Promise<HTMLElement> => {
  await screen.findByRole(
    'heading',
    { level: 1, name: 'Favoritos' },
    LAZY_TIMEOUT,
  );
  return screen.getByRole('main');
};

test('shows a single h1 Favoritos and the support text', async () => {
  renderRoutes(paths.favorites.getHref());

  const headings = await screen.findAllByRole(
    'heading',
    { level: 1 },
    LAZY_TIMEOUT,
  );
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Favoritos');
  expect(
    screen.getByText(
      'Os documentos que você marca como favoritos ficam à mão aqui.',
    ),
  ).toBeInTheDocument();
});

test('lists the favorite documents', async () => {
  seedSampleDocuments();
  seedSampleFavorites();
  const { documents, favorites } = getDb();
  const expectedOrder = [...favorites]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(
      (favorite) =>
        documents.find((item) => item.id === favorite.documentId)?.title,
    );

  renderRoutes(paths.favorites.getHref());

  const main = await findPageContent();

  const list = await within(main).findByRole('list', undefined, LAZY_TIMEOUT);
  expect(
    within(list)
      .getAllByRole('link')
      .map((link) => link.getAttribute('title')),
  ).toEqual(expectedOrder);
});

test('shows the empty state', async () => {
  seedSampleDocuments();

  renderRoutes(paths.favorites.getHref());

  const main = await findPageContent();

  expect(
    await within(main).findByText(
      'Nenhum favorito ainda. Quando você marcar um documento como favorito, ele aparece aqui.',
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('shows the error and retries', async () => {
  const user = userEvent.setup();
  let favoriteCalls = 0;
  server.use(
    http.get(`${env.API_URL}/documents`, ({ request }) => {
      const scope = new URL(request.url).searchParams.get('scope');
      if (scope !== 'favorites') return HttpResponse.json({ data: [] });

      favoriteCalls += 1;
      if (favoriteCalls === 1) {
        return HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        );
      }

      return HttpResponse.json({
        data: [
          {
            id: 'document-1',
            title: 'Ata da reunião de diretoria',
            updatedAt: new Date(2026, 8, 21, 10, 0).toISOString(),
          },
        ],
      });
    }),
  );

  renderRoutes(paths.favorites.getHref());

  const alert = await within(await findPageContent()).findByRole(
    'alert',
    undefined,
    LAZY_TIMEOUT,
  );
  expect(alert).toHaveTextContent('Não foi possível carregar seus favoritos.');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await within(await findPageContent()).findByRole(
      'link',
      { name: 'Ata da reunião de diretoria' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('marks the Favoritos link as current', async () => {
  renderRoutes(paths.favorites.getHref());

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Navegação principal' },
    LAZY_TIMEOUT,
  );

  expect(within(nav).getByRole('link', { name: 'Favoritos' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
