import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import type { CollaborationEvents } from '../create-collaboration-provider';
import {
  LocalCollaborationProvider,
  resetLocalCollaboration,
  setLocalStoredListener,
} from '../local-collaboration-provider';

// The delay is our own timer, so the tests drive the clock.
const DELAY_MS = 50;

type Recorded = {
  status: string[];
  synced: boolean[];
  unsyncedChanges: number[];
  stateless: string[];
};

const record = (provider: LocalCollaborationProvider): Recorded => {
  const events: Recorded = {
    status: [],
    synced: [],
    unsyncedChanges: [],
    stateless: [],
  };

  provider.on('status', ({ status }: CollaborationEvents['status']) => {
    events.status.push(status);
  });
  provider.on('synced', ({ state }: CollaborationEvents['synced']) => {
    events.synced.push(state);
  });
  provider.on(
    'unsyncedChanges',
    ({ number }: CollaborationEvents['unsyncedChanges']) => {
      events.unsyncedChanges.push(number);
    },
  );
  provider.on('stateless', ({ payload }: CollaborationEvents['stateless']) => {
    events.stateless.push(payload);
  });

  return events;
};

const createSession = (
  documentId: string,
): { document: Y.Doc; provider: LocalCollaborationProvider } => {
  const document = new Y.Doc();
  const provider = new LocalCollaborationProvider({ documentId, document });

  return { document, provider };
};

const write = (document: Y.Doc, text: string): void => {
  document.getText('content').insert(0, text);
};

const readText = (document: Y.Doc): string =>
  document.getText('content').toJSON();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  resetLocalCollaboration();
  vi.useRealTimers();
});

test('emits connected and synced after the delay', () => {
  const { provider } = createSession('doc-1');
  const events = record(provider);

  expect(events.status).toEqual([]);
  expect(events.synced).toEqual([]);

  vi.advanceTimersByTime(DELAY_MS);

  expect(events.status).toEqual(['connected']);
  expect(events.synced).toEqual([true]);
});

test('reports pending changes and then zero after a local edit', () => {
  const { document, provider } = createSession('doc-1');
  const events = record(provider);
  vi.advanceTimersByTime(DELAY_MS);

  write(document, 'olá');

  expect(events.unsyncedChanges).toEqual([1]);

  vi.advanceTimersByTime(DELAY_MS);

  expect(events.unsyncedChanges).toEqual([1, 0]);
});

test('calls the stored listener with the document id and emits the stored message', () => {
  const stored = vi.fn();
  setLocalStoredListener(stored);

  const { document, provider } = createSession('doc-7');
  const events = record(provider);
  vi.advanceTimersByTime(DELAY_MS);

  write(document, 'olá');
  expect(stored).not.toHaveBeenCalled();

  vi.advanceTimersByTime(DELAY_MS);

  expect(stored).toHaveBeenCalledWith('doc-7');
  expect(events.stateless).toEqual([JSON.stringify({ type: 'stored' })]);
});

test('replicates edits between two instances of the same document', () => {
  const first = createSession('doc-1');
  const second = createSession('doc-1');
  vi.advanceTimersByTime(DELAY_MS);

  write(first.document, 'olá');

  expect(readText(second.document)).toBe('olá');
});

test('does not replicate between different documents', () => {
  const first = createSession('doc-1');
  const other = createSession('doc-2');
  vi.advanceTimersByTime(DELAY_MS);

  write(first.document, 'olá');

  expect(readText(other.document)).toBe('');
});

test('a new instance receives the content written before it existed', () => {
  const first = createSession('doc-1');
  vi.advanceTimersByTime(DELAY_MS);
  write(first.document, 'olá');
  vi.advanceTimersByTime(DELAY_MS);
  first.provider.destroy();
  first.document.destroy();

  const later = createSession('doc-1');
  vi.advanceTimersByTime(DELAY_MS);

  expect(readText(later.document)).toBe('olá');
});

test('destroy stops events and timers', () => {
  const { document, provider } = createSession('doc-1');
  const events = record(provider);
  vi.advanceTimersByTime(DELAY_MS);

  provider.destroy();
  write(document, 'olá');
  vi.advanceTimersByTime(DELAY_MS);

  expect(vi.getTimerCount()).toBe(0);
  expect(events.unsyncedChanges).toEqual([]);
  expect(events.stateless).toEqual([]);
});

test('works without a stored listener', () => {
  setLocalStoredListener(null);
  const { document, provider } = createSession('doc-1');
  const events = record(provider);
  vi.advanceTimersByTime(DELAY_MS);

  write(document, 'olá');
  vi.advanceTimersByTime(DELAY_MS);

  expect(events.stateless).toEqual([JSON.stringify({ type: 'stored' })]);
});
