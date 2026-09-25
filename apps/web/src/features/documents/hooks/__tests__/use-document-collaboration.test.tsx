import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { StrictMode, useEffect } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { reportError } from '@/lib/report-error';

import { resetLocalCollaboration } from '@/features/documents/utils/local-collaboration-provider';

import { useDocumentCollaboration } from '../use-document-collaboration';

// The error path must not print to the console.
vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }));

// Under Strict Mode the effect runs twice and fires two concurrent `import()`
// of the factory; Vitest can serve the real module to one of them. With API
// mocking on, that stray session is the in-memory provider and never opens a
// WebSocket from jsdom.
vi.mock('@/config/env', () => ({
  env: { API_URL: '/api', ENABLE_API_MOCKING: true },
}));

// A provider double with the four events of the real one, plus a way to emit
// them from the test; the factory is replaced so no socket and no `Y.Doc` is
// created here.
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

  type FakeSession = {
    documentId: string;
    ydoc: { destroy: ReturnType<typeof vi.fn> };
    fragment: Record<string, never>;
    provider: FakeProvider;
  };

  const sessions: FakeSession[] = [];
  let pending: Array<() => void> = [];
  let isManual = false;

  const createCollaborationProvider = vi.fn(
    async ({ documentId }: { documentId: string }): Promise<FakeSession> => {
      const session: FakeSession = {
        documentId,
        ydoc: { destroy: vi.fn() },
        fragment: {},
        provider: new FakeProvider(),
      };
      sessions.push(session);

      // Holds the promise open until the test resolves it, to exercise what
      // happens when the cleanup runs first.
      if (isManual) {
        await new Promise<void>((resolve) => {
          pending.push(resolve);
        });
      }

      return session;
    },
  );

  return {
    createCollaborationProvider,
    sessions,
    holdFactory: (): void => {
      isManual = true;
    },
    releaseFactory: (): void => {
      const waiting = pending;
      pending = [];
      for (const resolve of waiting) resolve();
    },
    reset: (): void => {
      sessions.length = 0;
      pending = [];
      isManual = false;
      createCollaborationProvider.mockClear();
    },
  };
});

vi.mock('@/features/documents/utils/create-collaboration-provider', () => ({
  createCollaborationProvider: factory.createCollaborationProvider,
  DOCUMENT_FRAGMENT_NAME: 'document-content',
}));

const TIMEOUT = 2000;

let queryClient: QueryClient;

const wrapper = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

// Only used by the Strict Mode case, where the hook has to live in a real
// component tree (the hook test renderer does not replay the effects).
type ExposedSession = { ydoc: object; provider: object };

let exposedSession: ExposedSession | null = null;

// Both the double and the real provider/`Y.Doc` carry this flag.
const isDestroyed = (value: object): boolean =>
  (value as { isDestroyed?: boolean }).isDestroyed === true;

function StrictProbe(): React.JSX.Element {
  const { session } = useDocumentCollaboration('doc-1');

  // Outside the render: the test needs the session the hook settled on.
  useEffect(() => {
    exposedSession = session;
  }, [session]);

  return <p>{session ? 'com sessão' : 'sem sessão'}</p>;
}

const liveSession = (index = 0) => {
  const session = factory.sessions[index];
  if (!session) throw new Error(`nenhuma sessão criada no índice ${index}`);
  return session;
};

// The held promise only exists after the factory was called.
const releaseFactory = async (): Promise<void> => {
  await waitFor(
    () => expect(factory.createCollaborationProvider).toHaveBeenCalled(),
    { timeout: TIMEOUT },
  );

  await act(async () => {
    factory.releaseFactory();
    await Promise.resolve();
  });
};

const emit = async (
  event: string,
  data: unknown,
  index = 0,
): Promise<void> => {
  await act(async () => {
    liveSession(index).provider.emit(event, data);
    await Promise.resolve();
  });
};

beforeEach(() => {
  factory.reset();
  vi.mocked(reportError).mockClear();
  queryClient = new QueryClient({ defaultOptions: queryConfig });
});

afterEach(() => {
  queryClient.clear();
  exposedSession = null;
  resetLocalCollaboration();
});

test('starts as connecting with no session', async () => {
  factory.holdFactory();

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  expect(result.current.session).toBeNull();
  expect(result.current.hasSynced).toBe(false);
  expect(result.current.saveStatus).toBe('connecting');

  await releaseFactory();
});

test('exposes the session after the factory resolves', async () => {
  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });

  expect(result.current.session).toBe(liveSession());
  expect(factory.createCollaborationProvider).toHaveBeenCalledWith({
    documentId: 'doc-1',
  });
});

test('maps provider events to connecting, saving, saved and offline', async () => {
  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  expect(result.current.saveStatus).toBe('connecting');

  await emit('status', { status: 'connected' });
  expect(result.current.saveStatus).toBe('connecting');

  await emit('synced', { state: true });
  expect(result.current.saveStatus).toBe('saved');

  await emit('unsyncedChanges', { number: 2 });
  expect(result.current.saveStatus).toBe('saving');

  await emit('unsyncedChanges', { number: 0 });
  expect(result.current.saveStatus).toBe('saved');

  await emit('status', { status: 'disconnected' });
  expect(result.current.saveStatus).toBe('offline');
});

test('goes unreachable when disconnected before sync and offline when disconnected after sync', async () => {
  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });

  await emit('status', { status: 'disconnected' });
  expect(result.current.saveStatus).toBe('unreachable');

  await emit('status', { status: 'connected' });
  await emit('synced', { state: true });
  expect(result.current.saveStatus).toBe('saved');

  await emit('status', { status: 'disconnected' });
  expect(result.current.saveStatus).toBe('offline');
});

test('hasSynced stays true after a disconnect', async () => {
  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });

  await emit('status', { status: 'connected' });
  await emit('synced', { state: true });
  expect(result.current.hasSynced).toBe(true);

  await emit('status', { status: 'disconnected' });
  await emit('synced', { state: false });

  expect(result.current.hasSynced).toBe(true);
  expect(result.current.saveStatus).toBe('offline');
});

test('destroys provider and ydoc on unmount', async () => {
  const { result, unmount } = renderHook(
    () => useDocumentCollaboration('doc-1'),
    { wrapper },
  );

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });

  unmount();

  expect(liveSession().provider.isDestroyed).toBe(true);
  expect(liveSession().ydoc.destroy).toHaveBeenCalledTimes(1);
});

test('destroys a session that resolves after unmount and never exposes it', async () => {
  factory.holdFactory();

  const { result, unmount } = renderHook(
    () => useDocumentCollaboration('doc-1'),
    { wrapper },
  );

  unmount();

  await releaseFactory();

  await waitFor(() => expect(liveSession().provider.isDestroyed).toBe(true), {
    timeout: TIMEOUT,
  });
  expect(liveSession().ydoc.destroy).toHaveBeenCalledTimes(1);
  expect(result.current.session).toBeNull();
});

test('strict mode ends with a single live session and every other one destroyed', async () => {
  const { unmount } = render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <StrictProbe />
      </QueryClientProvider>
    </StrictMode>,
  );

  expect(
    await screen.findByText('com sessão', {}, { timeout: TIMEOUT }),
  ).toBeInTheDocument();

  // Strict Mode creates, destroys and creates again: the session the person
  // writes in is alive, and every other one created along the way is dead.
  const live = exposedSession;
  expect(live).not.toBeNull();
  expect(isDestroyed(live?.provider ?? {})).toBe(false);
  expect(isDestroyed(live?.ydoc ?? {})).toBe(false);

  await waitFor(
    () => {
      const others = factory.sessions.filter(
        (session) => session.provider !== live?.provider,
      );

      expect(others.map((session) => session.provider.isDestroyed)).toEqual(
        others.map(() => true),
      );
    },
    { timeout: TIMEOUT },
  );

  unmount();

  expect(
    factory.sessions.every((session) => session.provider.isDestroyed),
  ).toBe(true);
});

test('changing the document id destroys the old session and creates a new one', async () => {
  const { result, rerender } = renderHook(
    ({ documentId }: { documentId: string }) =>
      useDocumentCollaboration(documentId),
    { wrapper, initialProps: { documentId: 'doc-1' } },
  );

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  const first = liveSession();

  rerender({ documentId: 'doc-2' });

  await waitFor(
    () => expect(result.current.session).toBe(factory.sessions[1]),
    { timeout: TIMEOUT },
  );

  expect(first.provider.isDestroyed).toBe(true);
  expect(first.ydoc.destroy).toHaveBeenCalledTimes(1);
  expect(liveSession(1).documentId).toBe('doc-2');
  expect(liveSession(1).provider.isDestroyed).toBe(false);
});

test('invalidates the documents list and the document on a stored message', async () => {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  invalidate.mockClear();

  await emit('stateless', { payload: JSON.stringify({ type: 'stored' }) });

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'mine' }],
  });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['documents', 'doc-1'] });
});

test('invalidates the favorites list on a stored message', async () => {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  invalidate.mockClear();

  await emit('stateless', { payload: JSON.stringify({ type: 'stored' }) });

  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'favorites' }],
  });
});

test('ignores stateless messages that are not stored or not JSON', async () => {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  invalidate.mockClear();

  await emit('stateless', { payload: 'isto não é json' });
  await emit('stateless', { payload: JSON.stringify({ type: 'outra-coisa' }) });
  await emit('stateless', { payload: JSON.stringify('stored') });

  expect(invalidate).not.toHaveBeenCalled();
  expect(result.current.saveStatus).toBe('connecting');
});

test('does not invalidate when pending changes drop to zero', async () => {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  await emit('status', { status: 'connected' });
  await emit('synced', { state: true });
  invalidate.mockClear();

  await emit('unsyncedChanges', { number: 1 });
  await emit('unsyncedChanges', { number: 0 });

  expect(result.current.saveStatus).toBe('saved');
  expect(invalidate).not.toHaveBeenCalled();
});

test('reports the error and goes unreachable when the factory fails', async () => {
  const failure = new Error('falha ao abrir a colaboração');
  factory.createCollaborationProvider.mockRejectedValueOnce(failure);

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.saveStatus).toBe('unreachable'), {
    timeout: TIMEOUT,
  });

  expect(result.current.session).toBeNull();
  expect(vi.mocked(reportError)).toHaveBeenCalledWith(failure, {
    documentId: 'doc-1',
  });
});

test('access-changed invalidates the document and the document lists', async () => {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  invalidate.mockClear();

  await emit('stateless', {
    payload: JSON.stringify({ type: 'access-changed' }),
  });

  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['documents', 'doc-1'],
    }),
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'mine' }],
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'favorites' }],
  });
});

test('an invalid stateless payload is ignored', async () => {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  invalidate.mockClear();

  await emit('stateless', { payload: '{"type":"access-changed"' });
  await emit('stateless', { payload: JSON.stringify(null) });
  await emit('stateless', { payload: JSON.stringify({ type: 42 }) });
  await emit('stateless', {
    payload: JSON.stringify({ type: 'access-revoked' }),
  });
  await emit('stateless', { payload: JSON.stringify('access-changed') });

  expect(invalidate).not.toHaveBeenCalled();
  expect(result.current.session).toBe(liveSession());
  expect(vi.mocked(reportError)).not.toHaveBeenCalled();
});

test('stored still invalidates the document and the lists', async () => {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDocumentCollaboration('doc-1'), {
    wrapper,
  });

  await waitFor(() => expect(result.current.session).not.toBeNull(), {
    timeout: TIMEOUT,
  });
  invalidate.mockClear();

  await emit('stateless', { payload: JSON.stringify({ type: 'stored' }) });

  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['documents', 'doc-1'],
    }),
  );
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'mine' }],
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'favorites' }],
  });
});
