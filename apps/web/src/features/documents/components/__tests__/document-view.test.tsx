import { act } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { paths } from '@/config/paths';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import {
  renderApp,
  screen,
  userEvent,
  waitFor,
  within,
} from '@/testing/test-utils';

import { DocumentView } from '../document-view';

const TIMEOUT = 5000;

// BlockNote does not run under jsdom: the lazy editor is replaced by a marker
// that can also be told to fail on its next render.
const editor = vi.hoisted(() => ({ fails: false }));

vi.mock('@/features/documents/components/document-editor', () => ({
  default: function DocumentEditorDouble(): React.JSX.Element {
    // Stays broken until the test repairs it: React retries a failed render
    // before handing it to the boundary.
    if (editor.fails) throw new Error('falha ao renderizar o editor');

    return <div data-testid="document-editor" />;
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
      return HttpResponse.json({ data: seeded });
    }),
  );

  renderApp(<DocumentView documentId={seeded.id} />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Documento' }),
  ).toBeInTheDocument();
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Carregando documento…',
  );

  await screen.findByLabelText('Título');
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

  expect(await screen.findByLabelText('Título')).toHaveValue(seeded.title);
});

test('shows the Título field, the sr-only h1 and the save indicator', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  renderApp(<DocumentView documentId={seeded.id} />);

  const field = await screen.findByLabelText('Título');
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

  await screen.findByLabelText('Título');
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

  await screen.findByLabelText('Título');

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

  await screen.findByLabelText('Título');
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

  await screen.findByLabelText('Título');
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

  await screen.findByLabelText('Título');
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

  await screen.findByLabelText('Título');
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
