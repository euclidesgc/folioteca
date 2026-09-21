import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitForElementToBeRemoved } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, expect, test } from 'vitest';

import { createRoutes } from '@/app/router';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { screen, userEvent, waitFor, within } from '@/testing/test-utils';

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

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

const seededDocument = (title: string): MockDocument => {
  const document = getDb().documents.find((item) => item.title === title);
  if (!document) throw new Error(`documento "${title}" não está no banco`);
  return document;
};

test('opens a document from its address and shows the title field', async () => {
  const seeded = seededDocument('Ata da reunião de diretoria');

  renderRoutes(paths.document.getHref(seeded.id));

  expect(
    await screen.findByLabelText('Título', {}, { timeout: 5000 }),
  ).toHaveValue(seeded.title);
});

test(
  'an unknown id shows Documento não encontrado',
  { timeout: 10000 },
  async () => {
    renderRoutes(paths.document.getHref('id-desconhecido'));

    // The lazy route and the query both need to resolve first; a plain
    // connection-status region stays in the DOM the whole time, so wait on
    // the "Documento" heading text instead of a generic role.
    const loading = screen.queryByText('Carregando documento…');
    if (loading) {
      await waitForElementToBeRemoved(loading, { timeout: 5000 });
    }

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Documento não encontrado' },
        { timeout: 5000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir para Meus documentos' }),
    ).toHaveAttribute('href', paths.myDocuments.getHref());
  },
);

test('switching documents resets the title field', async () => {
  const user = userEvent.setup();
  const first = seededDocument('Ata da reunião de diretoria');
  const second = seededDocument('Plano de leitura do trimestre');

  renderRoutes(paths.document.getHref(first.id));

  expect(
    await screen.findByLabelText('Título', {}, { timeout: 5000 }),
  ).toHaveValue(first.title);

  const section = await screen.findByRole(
    'navigation',
    { name: 'Meus documentos recentes' },
    { timeout: 5000 },
  );
  await user.click(
    within(section).getByRole('link', { name: new RegExp(second.title) }),
  );

  await waitFor(() =>
    expect(screen.getByLabelText('Título')).toHaveValue(second.title),
  );
});
