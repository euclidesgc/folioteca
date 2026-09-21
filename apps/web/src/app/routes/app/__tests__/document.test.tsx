import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitForElementToBeRemoved } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createRoutes } from '@/app/router';
import { paths } from '@/config/paths';
import { resetLocalCollaboration } from '@/features/documents/utils/local-collaboration-provider';
import { queryConfig } from '@/lib/react-query';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { screen, userEvent, waitFor, within } from '@/testing/test-utils';

// The simulated API is on here, so the real factory builds the in-memory
// collaboration provider instead of opening a WebSocket.
vi.mock('@/config/env', () => ({
  env: { API_URL: '/api', ENABLE_API_MOCKING: true },
}));

// BlockNote does not run under jsdom; the double shows which provider it was
// handed, so a new collaboration session is visible from the outside.
const editor = vi.hoisted(() => ({ ids: new Map<object, number>() }));

vi.mock('@/features/documents/components/document-editor', () => ({
  default: function DocumentEditorDouble({
    provider,
  }: {
    provider: object;
  }): React.JSX.Element {
    const known = editor.ids.get(provider) ?? editor.ids.size + 1;
    editor.ids.set(provider, known);

    return (
      <div data-testid="document-editor" data-provider={String(known)} />
    );
  },
}));

const TIMEOUT = 5000;

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
  editor.ids.clear();
});

afterEach(() => {
  resetLocalCollaboration();
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
    await screen.findByLabelText('Título', {}, { timeout: TIMEOUT }),
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
      await waitForElementToBeRemoved(loading, { timeout: TIMEOUT });
    }

    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Documento não encontrado' },
        { timeout: TIMEOUT },
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
    await screen.findByLabelText('Título', {}, { timeout: TIMEOUT }),
  ).toHaveValue(first.title);

  const section = await screen.findByRole(
    'navigation',
    { name: 'Meus documentos recentes' },
    { timeout: TIMEOUT },
  );
  await user.click(
    within(section).getByRole('link', { name: new RegExp(second.title) }),
  );

  await waitFor(
    () => expect(screen.getByLabelText('Título')).toHaveValue(second.title),
    { timeout: TIMEOUT },
  );
});

test(
  'journey: opens the document, goes from Conectando… to Salvo and shows the editor',
  { timeout: 10000 },
  async () => {
    const seeded = seededDocument('Ata da reunião de diretoria');

    renderRoutes(paths.document.getHref(seeded.id));

    expect(
      await screen.findByLabelText('Título', {}, { timeout: TIMEOUT }),
    ).toHaveValue(seeded.title);
    expect(screen.getByText('Conectando…')).toBeInTheDocument();
    expect(screen.getByText('Carregando editor…')).toBeInTheDocument();

    expect(
      await screen.findByTestId('document-editor', {}, { timeout: TIMEOUT }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Salvo')).toBeInTheDocument(), {
      timeout: TIMEOUT,
    });

    expect(screen.queryByText('Carregando editor…')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  },
);

test(
  'the notice from the previous delivery is gone',
  { timeout: 10000 },
  async () => {
    const seeded = seededDocument('Ata da reunião de diretoria');

    renderRoutes(paths.document.getHref(seeded.id));

    await screen.findByLabelText('Título', {}, { timeout: TIMEOUT });
    await screen.findByTestId('document-editor', {}, { timeout: TIMEOUT });

    expect(screen.queryByText(/próxima entrega/)).not.toBeInTheDocument();
  },
);

test(
  'switching documents opens a new collaboration session',
  { timeout: 10000 },
  async () => {
    const user = userEvent.setup();
    const first = seededDocument('Ata da reunião de diretoria');
    const second = seededDocument('Plano de leitura do trimestre');

    renderRoutes(paths.document.getHref(first.id));

    await screen.findByLabelText('Título', {}, { timeout: TIMEOUT });
    const mounted = await screen.findByTestId(
      'document-editor',
      {},
      { timeout: TIMEOUT },
    );
    const firstProvider = mounted.getAttribute('data-provider');

    const section = await screen.findByRole(
      'navigation',
      { name: 'Meus documentos recentes' },
      { timeout: TIMEOUT },
    );
    await user.click(
      within(section).getByRole('link', { name: new RegExp(second.title) }),
    );

    await waitFor(
      () => expect(screen.getByLabelText('Título')).toHaveValue(second.title),
      { timeout: TIMEOUT },
    );
    await waitFor(
      () =>
        expect(
          screen.getByTestId('document-editor').getAttribute('data-provider'),
        ).not.toBe(firstProvider),
      { timeout: TIMEOUT },
    );

    expect(screen.getByText('Salvo')).toBeInTheDocument();
  },
);
