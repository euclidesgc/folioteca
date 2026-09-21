import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, waitFor, within } from '@/testing/test-utils';

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

// The real routes of the app, in a memory router.
const renderRoutes = (url: string) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return router;
};

// The lazy route shows its own <main> while loading: the area's content is
// only addressable after its heading is on screen.
const findPageContent = async (): Promise<HTMLElement> => {
  await screen.findByRole('heading', { level: 1, name: 'Meus documentos' });
  return screen.getByRole('main');
};

test('renders Meus documentos as the only h1 with the support text', async () => {
  renderRoutes(paths.myDocuments.getHref());

  const headings = await screen.findAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent('Meus documentos');
  expect(
    screen.getByText(
      'Os documentos que você cria ficam aqui, visíveis só para você até serem compartilhados.',
    ),
  ).toBeInTheDocument();
});

test('shows the empty text when there are no documents', async () => {
  renderRoutes(paths.myDocuments.getHref());

  expect(
    await screen.findByText(
      'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
    ),
  ).toBeInTheDocument();
});

test('marks the Meus documentos sidebar link as the current page', async () => {
  renderRoutes(paths.myDocuments.getHref());

  const nav = await screen.findByRole('navigation', {
    name: 'Navegação principal',
  });

  expect(
    within(nav).getByRole('link', { name: 'Meus documentos' }),
  ).toHaveAttribute('aria-current', 'page');
});

test(
  'journey: creates from the sidebar, renames and finds the document in the list',
  { timeout: 20_000 },
  async () => {
    const user = userEvent.setup();
    renderRoutes(paths.myDocuments.getHref());

    // Empty area, then the sidebar button creates a document and opens it.
    await screen.findByText(
      'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
    );

    await user.click(
      await screen.findByRole('button', { name: 'Novo documento' }),
    );

    const field = await screen.findByLabelText('Título');
    expect(field).toHaveValue('Sem título');

    // Renaming with Enter saves and the sidebar section picks the name up.
    await user.clear(field);
    await user.type(field, 'Ata da reunião de diretoria{Enter}');

    const section = screen.getByRole('navigation', {
      name: 'Meus documentos recentes',
    });
    expect(
      await within(section).findByRole('link', {
        name: /Ata da reunião de diretoria/,
      }),
    ).toBeInTheDocument();

    // Back to the area: the document is in the list and opens from there.
    const mainNav = screen.getByRole('navigation', {
      name: 'Navegação principal',
    });
    await user.click(
      within(mainNav).getByRole('link', { name: 'Meus documentos' }),
    );

    const listLink = await within(await findPageContent()).findByRole('link', {
      name: 'Ata da reunião de diretoria',
    });

    await user.click(listLink);

    await waitFor(() =>
      expect(screen.getByLabelText('Título')).toHaveValue(
        'Ata da reunião de diretoria',
      ),
    );
  },
);

test('a 500 shows the error and Tentar novamente loads the list', async () => {
  const user = userEvent.setup();
  server.use(
    http.get(
      `${env.API_URL}/documents`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );

  renderRoutes(paths.myDocuments.getHref());

  const alert = await within(await findPageContent()).findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar seus documentos.');

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await within(await findPageContent()).findByText(
      'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
    ),
  ).toBeInTheDocument();
});
