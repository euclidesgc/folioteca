import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The real Hocuspocus provider would open a WebSocket: the double only records
// the options it was built with.
const hocuspocus = vi.hoisted(() => ({ construct: vi.fn() }));

vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class {
    readonly awareness = null;

    constructor(options: unknown) {
      hocuspocus.construct(options);
    }

    on(): void {}
    off(): void {}
    destroy(): void {}
  },
}));

// The factory reads `env.ENABLE_API_MOCKING` when the module is evaluated by
// the import, so each mode needs its own module graph.
const loadFactory = async (
  enableApiMocking: boolean,
): Promise<typeof import('../create-collaboration-provider')> => {
  vi.resetModules();
  vi.doMock('@/config/env', () => ({
    env: { API_URL: '/api', ENABLE_API_MOCKING: enableApiMocking },
  }));

  return import('../create-collaboration-provider');
};

beforeEach(() => {
  hocuspocus.construct.mockClear();
});

afterEach(() => {
  vi.doUnmock('@/config/env');
});

test('returns a session with ydoc, fragment and provider', async () => {
  const { createCollaborationProvider, DOCUMENT_FRAGMENT_NAME } =
    await loadFactory(true);

  const session = await createCollaborationProvider({ documentId: 'doc-1' });

  expect(session.fragment).toBe(session.ydoc.getXmlFragment('document-content'));
  expect(DOCUMENT_FRAGMENT_NAME).toBe('document-content');
  expect(session.provider).toHaveProperty('on');
  expect(session.provider).toHaveProperty('off');
  expect(session.provider).toHaveProperty('destroy');

  session.provider.destroy();
  session.ydoc.destroy();
});

test('uses the local provider when API mocking is on', async () => {
  const { createCollaborationProvider } = await loadFactory(true);
  const { LocalCollaborationProvider, resetLocalCollaboration } = await import(
    '../local-collaboration-provider'
  );

  const session = await createCollaborationProvider({ documentId: 'doc-1' });

  expect(session.provider).toBeInstanceOf(LocalCollaborationProvider);
  expect(hocuspocus.construct).not.toHaveBeenCalled();

  resetLocalCollaboration();
  session.ydoc.destroy();
});

test('uses the Hocuspocus provider with the collab url and the document id when mocking is off', async () => {
  const { createCollaborationProvider } = await loadFactory(false);

  const session = await createCollaborationProvider({ documentId: 'doc-42' });

  expect(hocuspocus.construct).toHaveBeenCalledTimes(1);
  expect(hocuspocus.construct).toHaveBeenCalledWith(
    expect.objectContaining({
      url: `ws://${window.location.host}/collab`,
      name: 'doc-42',
      document: session.ydoc,
    }),
  );

  session.provider.destroy();
  session.ydoc.destroy();
});

test('sends no credential other than the fixed marker', async () => {
  const { createCollaborationProvider } = await loadFactory(false);

  const session = await createCollaborationProvider({ documentId: 'doc-42' });

  const options = hocuspocus.construct.mock.calls[0]?.[0] as Record<
    string,
    unknown
  >;

  // The session is the httpOnly cookie the browser sends on the upgrade: past
  // the address, the name and the document, the only value allowed here is the
  // fixed marker.
  const extras = Object.entries(options)
    .filter(([key]) => !['url', 'name', 'document'].includes(key))
    .map(([key, value]) => `${key}=${String(value)}`)
    .filter((entry) => entry !== 'token=cookie-session');

  expect(extras).toEqual([]);

  session.provider.destroy();
  session.ydoc.destroy();
});
