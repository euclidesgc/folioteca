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
  seedSampleTrash,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, waitFor, within } from '@/testing/test-utils';

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

// The sidebar lists documents too: the page's own list is only addressable
// inside <main>, once the area heading is on screen.
const findPageContent = async (): Promise<HTMLElement> => {
  await screen.findByRole(
    'heading',
    { level: 1, name: 'Lixeira' },
    LAZY_TIMEOUT,
  );
  return screen.getByRole('main');
};

// The order the trash API answers in: most recently moved first.
const trashedTitlesInApiOrder = (): string[] =>
  getDb()
    .documents.filter((document) => document.trashedAt !== null)
    .sort((a, b) => (b.trashedAt ?? '').localeCompare(a.trashedAt ?? ''))
    .map((document) => document.title);

test('shows a single h1 Lixeira and the support text', async () => {
  renderRoutes(paths.trash.getHref());

  const headings = await screen.findAllByRole(
    'heading',
    { level: 1 },
    LAZY_TIMEOUT,
  );
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Lixeira');
  expect(
    screen.getByText(
      'Documentos excluídos ficam aqui até serem restaurados ou apagados de vez.',
    ),
  ).toBeInTheDocument();
});

test('lists the trashed documents', async () => {
  seedSampleDocuments();
  seedSampleTrash();
  const expectedOrder = trashedTitlesInApiOrder();

  renderRoutes(paths.trash.getHref());

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

  renderRoutes(paths.trash.getHref());

  const main = await findPageContent();

  expect(
    await within(main).findByText(
      'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('shows the error and retries', async () => {
  const user = userEvent.setup();
  let trashCalls = 0;
  server.use(
    http.get(`${env.API_URL}/documents`, ({ request }) => {
      const scope = new URL(request.url).searchParams.get('scope');
      if (scope !== 'trash') return HttpResponse.json({ data: [] });

      trashCalls += 1;
      if (trashCalls === 1) {
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
            updatedAt: new Date(2026, 8, 20, 10, 0).toISOString(),
            trashedAt: new Date(2026, 8, 21, 10, 0).toISOString(),
          },
        ],
      });
    }),
  );

  renderRoutes(paths.trash.getHref());

  const alert = await within(await findPageContent()).findByRole(
    'alert',
    undefined,
    LAZY_TIMEOUT,
  );
  expect(alert).toHaveTextContent('Não foi possível carregar a lixeira.');

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

test('marks the Lixeira link as current', async () => {
  renderRoutes(paths.trash.getHref());

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Navegação principal' },
    LAZY_TIMEOUT,
  );

  expect(within(nav).getByRole('link', { name: 'Lixeira' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('deleting from the list keeps the person on /trash and empties the list', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  const [onlyTrashed] = getDb().documents;
  if (!onlyTrashed) throw new Error('o banco simulado está sem documentos');
  onlyTrashed.trashedAt = new Date(2026, 8, 21, 10, 0).toISOString();

  renderRoutes(paths.trash.getHref());

  const main = await findPageContent();
  const item = (
    await within(main).findByRole(
      'link',
      { name: onlyTrashed.title },
      LAZY_TIMEOUT,
    )
  ).closest('li');
  if (!item) throw new Error('o item da lista não está na tela');

  await user.click(
    within(item).getByRole('button', { name: 'Apagar definitivamente' }),
  );
  const dialog = await screen.findByRole('alertdialog', undefined, LAZY_TIMEOUT);
  await user.click(
    within(dialog).getByRole('button', { name: 'Apagar definitivamente' }),
  );

  expect(
    await within(main).findByText(
      'A lixeira está vazia. Os documentos que você excluir aparecem aqui.',
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { level: 1, name: 'Lixeira' }),
    ).toBeInTheDocument(),
  );
});
