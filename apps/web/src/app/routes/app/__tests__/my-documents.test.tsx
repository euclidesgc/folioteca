import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import { resetLocalCollaboration } from '@/features/documents/utils/local-collaboration-provider';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { screen, userEvent, waitFor, within } from '@/testing/test-utils';

// The journey navigates into a document page, so the simulated API needs to
// be on here too: the real factory builds the in-memory collaboration
// provider instead of opening a WebSocket.
vi.mock('@/config/env', () => ({
  env: { API_URL: '/api', ENABLE_API_MOCKING: true },
}));

// BlockNote does not run under jsdom, and this file is not testing the
// editor itself: a double stands in for the lazy component.
vi.mock('@/features/documents/components/document-editor', () => ({
  default: (): React.JSX.Element => <div data-testid="document-editor" />,
}));

// The whole route tree only opens past the gate once installed and signed in.
beforeEach(() => {
  seedInstalled({ signedIn: true });
});

afterEach(() => {
  resetLocalCollaboration();
});

// Lazy routes resolve after their chunk loads: give those waits an explicit
// budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: 5000 };

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
  await screen.findByRole(
    'heading',
    { level: 1, name: 'Meus documentos' },
    LAZY_TIMEOUT,
  );
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
      undefined,
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

test('marks the Meus documentos sidebar link as the current page', async () => {
  renderRoutes(paths.myDocuments.getHref());

  const nav = await screen.findByRole(
    'navigation',
    { name: 'Navegação principal' },
    LAZY_TIMEOUT,
  );

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
      undefined,
      LAZY_TIMEOUT,
    );

    await user.click(
      await screen.findByRole(
        'button',
        { name: 'Novo documento' },
        LAZY_TIMEOUT,
      ),
    );

    const field = await screen.findByLabelText('Título', undefined, LAZY_TIMEOUT);
    expect(field).toHaveValue('Sem título');

    // Renaming with Enter saves and the sidebar section picks the name up.
    await user.clear(field);
    await user.type(field, 'Ata da reunião de diretoria{Enter}');

    const section = screen.getByRole('navigation', {
      name: 'Meus documentos recentes',
    });
    expect(
      await within(section).findByRole(
        'link',
        { name: /Ata da reunião de diretoria/ },
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();

    // Back to the area: the document is in the list and opens from there.
    const mainNav = screen.getByRole('navigation', {
      name: 'Navegação principal',
    });
    await user.click(
      within(mainNav).getByRole('link', { name: 'Meus documentos' }),
    );

    const listLink = await within(await findPageContent()).findByRole(
      'link',
      { name: 'Ata da reunião de diretoria' },
      LAZY_TIMEOUT,
    );

    await user.click(listLink);

    await waitFor(() =>
      expect(screen.getByLabelText('Título')).toHaveValue(
        'Ata da reunião de diretoria',
      ),
    );
  },
);

test(
  'a 500 shows the error and Tentar novamente loads the list',
  { timeout: 15_000 },
  async () => {
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

    const alert = await within(await findPageContent()).findByRole(
      'alert',
      undefined,
      LAZY_TIMEOUT,
    );
    expect(alert).toHaveTextContent(
      'Não foi possível carregar seus documentos.',
    );

    await user.click(
      within(alert).getByRole('button', { name: 'Tentar novamente' }),
    );

    expect(
      await within(await findPageContent()).findByText(
        'Nenhum documento ainda. Os documentos que você criar aparecem aqui.',
        undefined,
        LAZY_TIMEOUT,
      ),
    ).toBeInTheDocument();
  },
);
