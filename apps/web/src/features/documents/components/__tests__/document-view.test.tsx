import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createRoutes } from '@/app/router';
import { env } from '@/config/env';
import { paths } from '@/config/paths';
import { queryConfig } from '@/lib/react-query';
import type { MockDocument } from '@/testing/mocks/db';
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSharedReadOnlyDocument,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { formatDateTime } from '@/utils/format-date-time';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { DocumentView } from '../document-view';

const TIMEOUT = 5000;

// Lazy chunks and route changes resolve after the test's first await: give
// those waits an explicit budget instead of the implicit default.
const LAZY_TIMEOUT = { timeout: TIMEOUT };

// BlockNote does not run under jsdom: the lazy editor is replaced by a marker
// that can also be told to fail on its next render.
const editor = vi.hoisted(() => ({ fails: false }));

vi.mock('@/features/documents/components/document-editor', () => ({
  default: function DocumentEditorDouble({
    editable = true,
  }: {
    editable?: boolean;
  }): React.JSX.Element {
    // Stays broken until the test repairs it: React retries a failed render
    // before handing it to the boundary.
    if (editor.fails) throw new Error('falha ao renderizar o editor');

    // The real editor does not run under jsdom: the double reports the
    // `editable` prop it received so the read-only mode can be checked.
    return <div data-testid="document-editor" data-editable={String(editable)} />;
  },
}));

// The provider double: the same four events of the real one, emitted by hand.
const factory = vi.hoisted(() => {
  type Handler = (data: unknown) => void;

  class FakeProvider {
    readonly awareness = null;
    isDestroyed = false;
    private readonly handlers = new Map<string, Set<Handler>>();

    on(event: string, handler: Handler): void {
      const handlers = this.handlers.get(event) ?? new Set<Handler>();
      handlers.add(handler);
      this.handlers.set(event, handlers);
    }

    off(event: string, handler: Handler): void {
      this.handlers.get(event)?.delete(handler);
    }

    destroy(): void {
      this.isDestroyed = true;
    }

    emit(event: string, data: unknown): void {
      for (const handler of [...(this.handlers.get(event) ?? [])]) {
        handler(data);
      }
    }
  }

  const sessions: Array<{
    ydoc: { destroy: () => void };
    fragment: Record<string, never>;
    provider: FakeProvider;
  }> = [];

  const createCollaborationProvider = vi.fn(() => {
    const session = {
      ydoc: { destroy: (): void => undefined },
      fragment: {},
      provider: new FakeProvider(),
    };
    sessions.push(session);

    return Promise.resolve(session);
  });

  return {
    createCollaborationProvider,
    sessions,
    reset: (): void => {
      sessions.length = 0;
      createCollaborationProvider.mockClear();
    },
  };
});

vi.mock('@/features/documents/utils/create-collaboration-provider', () => ({
  createCollaborationProvider: factory.createCollaborationProvider,
  DOCUMENT_FRAGMENT_NAME: 'document-content',
}));

beforeEach(() => {
  seedInstalled({ signedIn: true });
  editor.fails = false;
  factory.reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

// Moves the seeded document to the trash directly in the fake database.
const trashInDb = (document: MockDocument): string => {
  const trashedAt = new Date(2026, 8, 20, 15, 30).toISOString();
  document.trashedAt = trashedAt;
  return trashedAt;
};

const noticeText = (trashedAt: string): string =>
  `Este documento está na lixeira desde ${formatDateTime(trashedAt)}. Restaure-o para voltar a editar.`;

// The real routes of the app, in a memory router: the only way to see where
// the page sends the person after the document is gone.
const renderRoutes = (url: string): void => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const router = createMemoryRouter(createRoutes(), { initialEntries: [url] });

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

const emit = async (event: string, data: unknown): Promise<void> => {
  await waitFor(() => expect(factory.sessions).toHaveLength(1), {
    timeout: TIMEOUT,
  });

  await act(async () => {
    factory.sessions[0]?.provider.emit(event, data);
    await Promise.resolve();
  });
};

// The editor only mounts after the first sync, so every case that needs it
// walks through the same two events.
const connectAndSync = async (): Promise<void> => {
  await emit('status', { status: 'connected' });
  await emit('synced', { state: true });
};

test('shows Documento and Carregando documento… while loading', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  server.use(
    http.get(`${env.API_URL}/documents/:documentId`, async () => {
      await delay(200);
      return HttpResponse.json({ data: { ...seeded, isFavorite: false } });
    }),
  );

  renderApp(<DocumentView documentId={seeded.id} />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Documento' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando documento…',
  );

  await screen.findByRole('textbox', { name: 'Título do documento' });
});

test('shows Documento não encontrado with the link to Meus documentos on 404', async () => {
  renderApp(<DocumentView documentId="id-desconhecido" />);

  expect(
    await screen.findByRole('heading', {
      level: 1,
      name: 'Documento não encontrado',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Este documento não existe ou você não tem acesso a ele.'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Ir para Meus documentos' }),
  ).toHaveAttribute('href', paths.myDocuments.getHref());
});

test('the not found state has no alert', async () => {
  renderApp(<DocumentView documentId="id-desconhecido" />);

  await screen.findByRole('heading', {
    level: 1,
    name: 'Documento não encontrado',
  });

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows the error alert on 500 and Tentar novamente loads the document', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  server.use(
    http.get(
      `${env.API_URL}/documents/:documentId`,
      () =>
        HttpResponse.json(
          { message: 'Erro interno do servidor.' },
          { status: 500 },
        ),
      { once: true },
    ),
  );

  renderApp(<DocumentView documentId={seeded.id} />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Não foi possível carregar o documento.');
  expect(
    screen.getAllByRole('heading', { level: 1, name: 'Documento' }),
  ).toHaveLength(1);

  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(await screen.findByRole('textbox', { name: 'Título do documento' })).toHaveValue(seeded.title);
});

test('shows the Título field, the sr-only h1 and the save indicator', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  const field = await screen.findByRole('textbox', { name: 'Título do documento' });
  expect(field).toHaveValue(seeded.title);

  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading).toHaveTextContent(seeded.title);
  expect(heading).toHaveClass('sr-only');

  const indicator = screen.getByText('Conectando…');
  expect(indicator).toHaveAttribute('role', 'status');

  // Order on the page: heading, title field, indicator.
  expect(
    heading.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
  expect(
    field.compareDocumentPosition(indicator) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
});

test('does not show the editor notice from the previous delivery', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  await connectAndSync();
  await screen.findByTestId('document-editor', undefined, {
    timeout: TIMEOUT,
  });

  expect(screen.queryByText(/próxima entrega/)).not.toBeInTheDocument();
});

test('shows Carregando editor… until the first sync', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });

  expect(
    await screen.findByText('Carregando editor…', undefined, {
      timeout: TIMEOUT,
    }),
  ).toHaveAttribute('role', 'status');
  expect(screen.queryByTestId('document-editor')).not.toBeInTheDocument();

  await emit('status', { status: 'connected' });

  expect(screen.getByText('Carregando editor…')).toBeInTheDocument();
  expect(screen.queryByTestId('document-editor')).not.toBeInTheDocument();
});

test('mounts the editor only after the first sync', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  expect(screen.queryByTestId('document-editor')).not.toBeInTheDocument();

  await connectAndSync();

  expect(
    await screen.findByTestId('document-editor', undefined, {
      timeout: TIMEOUT,
    }),
  ).toBeInTheDocument();
  await waitFor(
    () =>
      expect(screen.queryByText('Carregando editor…')).not.toBeInTheDocument(),
    { timeout: TIMEOUT },
  );
  expect(screen.getByText('Salvo')).toBeInTheDocument();
});

test('keeps the editor mounted and shows the offline sentence when the connection drops', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  await connectAndSync();
  const mounted = await screen.findByTestId('document-editor', undefined, {
    timeout: TIMEOUT,
  });

  await emit('status', { status: 'disconnected' });

  expect(screen.getByTestId('document-editor')).toBe(mounted);
  expect(
    screen.getByText(
      'Sem conexão — as alterações serão enviadas ao reconectar',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows the editor error with Tentar novamente when the editor fails to render', async () => {
  // React prints the caught render error; this is the only case that silences
  // the console, and the spy is restored in afterEach.
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  editor.fails = true;

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  await connectAndSync();

  const alert = await screen.findByRole('alert', undefined, {
    timeout: TIMEOUT,
  });
  expect(alert).toHaveTextContent('Não foi possível carregar o editor.');
  expect(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  ).toHaveClass('bg-red-600');
  expect(screen.queryByTestId('document-editor')).not.toBeInTheDocument();
});

test('Tentar novamente remounts the editor', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const user = userEvent.setup();
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  editor.fails = true;

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  await connectAndSync();

  const alert = await screen.findByRole('alert', undefined, {
    timeout: TIMEOUT,
  });

  editor.fails = false;
  await user.click(
    within(alert).getByRole('button', { name: 'Tentar novamente' }),
  );

  expect(
    await screen.findByTestId('document-editor', undefined, {
      timeout: TIMEOUT,
    }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('shows the title field first and the favorite button to its right when the document is loaded', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  const field = await screen.findByRole('textbox', { name: 'Título do documento' });
  const favorite = screen.getByRole('button', {
    name: 'Adicionar aos favoritos',
  });
  const heading = screen.getByRole('heading', { level: 1 });

  expect(favorite).toHaveClass('text-gray-700');
  // Since 169 the actions sit to the right of the title field, in the same row.
  expect(favorite.parentElement).toHaveClass('flex', 'ml-auto');

  // Order on the page: heading, title field, actions.
  expect(
    heading.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
  expect(
    field.compareDocumentPosition(favorite) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
});

test('shows no favorite button while loading, when not found and on error', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  server.use(
    http.get(`${env.API_URL}/documents/:documentId`, async () => {
      await delay(200);
      return HttpResponse.json({ data: { ...seeded, isFavorite: false } });
    }),
  );

  const loading = renderApp(<DocumentView documentId={seeded.id} />);

  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando documento…',
  );
  expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();

  await screen.findByRole('textbox', { name: 'Título do documento' });
  loading.unmount();

  // Back to the seeded database, where the unknown id answers 404.
  server.resetHandlers();

  const notFound = renderApp(<DocumentView documentId="id-desconhecido" />);

  await screen.findByRole('heading', {
    level: 1,
    name: 'Documento não encontrado',
  });
  expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();

  notFound.unmount();

  server.use(
    http.get(`${env.API_URL}/documents/:documentId`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  renderApp(<DocumentView documentId={seeded.id} />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível carregar o documento.',
  );
  expect(screen.queryByRole('button', { name: /favoritos/ })).not.toBeInTheDocument();
});

test('opens no collaboration session for a document that was not found', async () => {
  renderApp(<DocumentView documentId="id-desconhecido" />);

  await screen.findByRole('heading', {
    level: 1,
    name: 'Documento não encontrado',
  });

  expect(factory.createCollaborationProvider).not.toHaveBeenCalled();
  expect(screen.queryByText('Conectando…')).not.toBeInTheDocument();
  expect(screen.queryByTestId('document-editor')).not.toBeInTheDocument();
});

test('shows Mover para a lixeira before the favorite button for the owner', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  const trash = screen.getByRole('button', { name: 'Mover para a lixeira' });
  const favorite = screen.getByRole('button', {
    name: 'Adicionar aos favoritos',
  });

  expect(trash.parentElement).toBe(favorite.parentElement);
  expect(
    trash.compareDocumentPosition(favorite) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
});

test('hides Mover para a lixeira when accessLevel is not owner', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  seeded.accessLevel = 'edit';

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });

  expect(
    screen.queryByRole('button', { name: 'Mover para a lixeira' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Adicionar aos favoritos' }),
  ).toBeInTheDocument();
});

test('trashed document shows the notice with the date and the two actions', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  const trashedAt = trashInDb(seeded);

  renderApp(<DocumentView documentId={seeded.id} />);

  const notice = await screen.findByText(noticeText(trashedAt));
  expect(notice).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Restaurar' })).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Apagar definitivamente' }),
  ).toBeInTheDocument();
});

test('trashed document shows a visible h1 and no title field, favorite button or save indicator', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  trashInDb(seeded);

  renderApp(<DocumentView documentId={seeded.id} />);

  const heading = await screen.findByRole('heading', {
    level: 1,
    name: seeded.title,
  });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(heading).not.toHaveClass('sr-only');

  expect(screen.queryByRole('textbox', { name: 'Título do documento' })).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /favoritos/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Conectando…')).not.toBeInTheDocument();
});

test('mounts the editor with editable false in the trash and true outside it', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  trashInDb(seeded);

  const trashed = renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('heading', { level: 1, name: seeded.title });
  await connectAndSync();

  expect(
    await screen.findByTestId('document-editor', undefined, LAZY_TIMEOUT),
  ).toHaveAttribute('data-editable', 'false');

  trashed.unmount();
  factory.reset();
  seeded.trashedAt = null;

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  await connectAndSync();

  expect(
    await screen.findByTestId('document-editor', undefined, LAZY_TIMEOUT),
  ).toHaveAttribute('data-editable', 'true');
});

test('trashed document still opens the collaboration session', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  const trashedAt = trashInDb(seeded);

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByText(noticeText(trashedAt));

  await waitFor(
    () => expect(factory.createCollaborationProvider).toHaveBeenCalled(),
    { timeout: TIMEOUT },
  );
});

test('moves focus to the trash notice after moving the document', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  await user.click(screen.getByRole('button', { name: 'Mover para a lixeira' }));

  const dialog = await screen.findByRole('alertdialog');
  await user.click(
    within(dialog).getByRole('button', { name: 'Mover para a lixeira' }),
  );

  const notice = await screen.findByText(/Este documento está na lixeira desde/);
  await waitFor(() =>
    expect(notice.closest('div[tabindex="-1"]')).toHaveFocus(),
  );
});

test('a document that opens already trashed does not steal focus', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  const trashedAt = trashInDb(seeded);

  renderApp(<DocumentView documentId={seeded.id} />);

  const notice = await screen.findByText(noticeText(trashedAt));

  expect(notice.closest('div[tabindex="-1"]')).not.toHaveFocus();
  expect(document.body).toHaveFocus();
});

test('Restaurar brings back the title field and the action row', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  const trashedAt = trashInDb(seeded);

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByText(noticeText(trashedAt));
  await user.click(screen.getByRole('button', { name: 'Restaurar' }));

  expect(await screen.findByRole('textbox', { name: 'Título do documento' })).toHaveValue(seeded.title);
  expect(
    screen.getByRole('button', { name: 'Mover para a lixeira' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Este documento está na lixeira desde/),
  ).not.toBeInTheDocument();
});

test('navigates to /trash after deleting permanently', async () => {
  const user = userEvent.setup();
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  const trashedAt = trashInDb(seeded);

  renderRoutes(paths.document.getHref(seeded.id));

  await screen.findByText(noticeText(trashedAt), undefined, LAZY_TIMEOUT);
  await user.click(
    screen.getByRole('button', { name: 'Apagar definitivamente' }),
  );

  const dialog = await screen.findByRole('alertdialog', undefined, LAZY_TIMEOUT);
  await user.click(
    within(dialog).getByRole('button', { name: 'Apagar definitivamente' }),
  );

  expect(
    await screen.findByRole(
      'heading',
      { level: 1, name: 'Lixeira' },
      LAZY_TIMEOUT,
    ),
  ).toBeInTheDocument();
});

// The document another person shared with the signed-in one, in `view`.
const sharedReadOnlyDocument = (): MockDocument => {
  const id = seedSharedReadOnlyDocument();
  const document = getDb().documents.find((item) => item.id === id);
  if (!document) {
    throw new Error('o banco simulado está sem o documento compartilhado');
  }
  return document;
};

test('the owner sees the Compartilhar button', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByRole('textbox', { name: 'Título do documento' });
  const share = screen.getByRole('button', { name: 'Compartilhar' });
  const trash = screen.getByRole('button', { name: 'Mover para a lixeira' });

  expect(share.parentElement).toBe(trash.parentElement);
  expect(
    share.compareDocumentPosition(trash) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeGreaterThan(0);
});

test('the owner of a trashed document has no Compartilhar button', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  const trashedAt = trashInDb(seeded);

  renderApp(<DocumentView documentId={seeded.id} />);

  await screen.findByText(noticeText(trashedAt));

  expect(
    screen.queryByRole('button', { name: 'Compartilhar' }),
  ).not.toBeInTheDocument();
});

test('a view person sees Somente leitura and a read only editor', async () => {
  const shared = sharedReadOnlyDocument();

  renderApp(<DocumentView documentId={shared.id} />);

  expect(await screen.findByText('Somente leitura')).toBeInTheDocument();
  expect(screen.queryByText('Conectando…')).not.toBeInTheDocument();

  await connectAndSync();

  expect(
    await screen.findByTestId('document-editor', undefined, LAZY_TIMEOUT),
  ).toHaveAttribute('data-editable', 'false');
  expect(screen.queryByText('Salvo')).not.toBeInTheDocument();
});

test('a view person sees the title as a heading without the title field', async () => {
  const shared = sharedReadOnlyDocument();

  renderApp(<DocumentView documentId={shared.id} />);

  const heading = await screen.findByRole('heading', {
    level: 1,
    name: shared.title,
  });
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(heading).not.toHaveClass('sr-only');
  expect(screen.queryByRole('textbox', { name: 'Título do documento' })).not.toBeInTheDocument();
});

test('a view person has no Compartilhar nor trash button', async () => {
  const shared = sharedReadOnlyDocument();

  renderApp(<DocumentView documentId={shared.id} />);

  await screen.findByText('Somente leitura');

  expect(
    screen.queryByRole('button', { name: 'Compartilhar' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Mover para a lixeira' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /favoritos/ }),
  ).toBeInTheDocument();
});

const titleField = (): Promise<HTMLElement> =>
  screen.findByRole('textbox', { name: 'Título do documento' });

const isBefore = (first: Node, second: Node): boolean =>
  (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) >
  0;

test('an editor sees the title field in the actions row', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  const field = await titleField();
  expect(field).toHaveValue(seeded.title);

  const favorite = screen.getByRole('button', {
    name: 'Adicionar aos favoritos',
  });
  const share = screen.getByRole('button', { name: 'Compartilhar' });
  const actions = favorite.parentElement;
  const row = actions?.parentElement;

  expect(actions).toHaveClass('ml-auto');
  expect(row).toHaveClass('flex-wrap');
  expect(row).toContainElement(field);
  expect(row).toContainElement(share);
  expect(isBefore(field, share)).toBe(true);
});

test('a viewer sees the title as a heading and Somente leitura', async () => {
  const shared = sharedReadOnlyDocument();

  renderApp(<DocumentView documentId={shared.id} />);

  const heading = await screen.findByRole('heading', {
    level: 1,
    name: shared.title,
  });
  const badge = screen.getByText('Somente leitura');

  expect(heading).not.toHaveClass('sr-only');
  expect(heading).toHaveClass('truncate');
  expect(heading).toHaveAttribute('title', shared.title);
  expect(isBefore(heading, badge)).toBe(true);
  expect(
    screen.queryByRole('textbox', { name: 'Título do documento' }),
  ).not.toBeInTheDocument();
});

test('a trashed document shows the title as a heading below the trash notice', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();
  const trashedAt = trashInDb(seeded);

  renderApp(<DocumentView documentId={seeded.id} />);

  const notice = await screen.findByText(noticeText(trashedAt));
  const heading = screen.getByRole('heading', {
    level: 1,
    name: seeded.title,
  });

  expect(heading).not.toHaveClass('sr-only');
  expect(heading).toHaveAttribute('title', seeded.title);
  expect(isBefore(notice, heading)).toBe(true);
  expect(
    screen.queryByRole('textbox', { name: 'Título do documento' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Somente leitura')).not.toBeInTheDocument();
});

test('renders a single h1 for each access level', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  const editing = renderApp(<DocumentView documentId={seeded.id} />);
  await titleField();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  editing.unmount();

  const shared = sharedReadOnlyDocument();
  const viewing = renderApp(<DocumentView documentId={shared.id} />);
  await screen.findByText('Somente leitura');
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  viewing.unmount();

  const trashedAt = trashInDb(seeded);
  renderApp(<DocumentView documentId={seeded.id} />);
  await screen.findByText(noticeText(trashedAt));
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

test('no longer renders the title below the actions row', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  const field = await titleField();
  const favorite = screen.getByRole('button', {
    name: 'Adicionar aos favoritos',
  });
  const row = favorite.parentElement?.parentElement;

  // The only text with the title is the heading kept for screen readers,
  // before the row; the field carries it as a value.
  const texts = screen.getAllByText(seeded.title);
  expect(texts).toHaveLength(1);
  expect(texts[0]).toHaveClass('sr-only');
  expect(row).toContainElement(field);
  expect(row?.nextElementSibling).not.toHaveTextContent(seeded.title);
});
