import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import type {
  CollaborationEvents,
  CollaborationProvider,
} from '@/features/documents/utils/create-collaboration-provider';

// Stand-in for the collaboration server while the API is simulated: it keeps
// the document state in memory and answers with the same events the real
// provider emits.

// Short enough to feel instant, long enough for "Salvando…" to be observable.
const LOCAL_DELAY_MS = 20;

// Marks updates that came from another instance or from the stored state, so
// they are not reported as local changes and never echo back.
const REPLICATION_ORIGIN = 'local-collaboration';

const storedStates = new Map<string, Uint8Array>();
const instances = new Map<string, Set<LocalCollaborationProvider>>();

let storedListener: ((documentId: string) => void) | null = null;

export const setLocalStoredListener = (
  listener: ((documentId: string) => void) | null,
): void => {
  storedListener = listener;
};

export const resetLocalCollaboration = (): void => {
  for (const peers of [...instances.values()]) {
    for (const peer of [...peers]) peer.destroy();
  }

  instances.clear();
  storedStates.clear();
  storedListener = null;
};

export class LocalCollaborationProvider implements CollaborationProvider {
  readonly awareness: Awareness | null = null;

  private readonly documentId: string;
  private readonly document: Y.Doc;
  private readonly handlers = new Map<string, Set<(data: never) => void>>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private unsyncedChanges = 0;
  private isDestroyed = false;

  constructor({
    documentId,
    document,
  }: {
    documentId: string;
    document: Y.Doc;
  }) {
    this.documentId = documentId;
    this.document = document;

    const stored = storedStates.get(documentId);
    if (stored) Y.applyUpdate(document, stored, REPLICATION_ORIGIN);

    document.on('update', this.handleUpdate);

    const peers = instances.get(documentId) ?? new Set();
    peers.add(this);
    instances.set(documentId, peers);

    this.schedule(() => {
      this.emit('status', { status: 'connected' });
      this.emit('synced', { state: true });
    });
  }

  on<Event extends keyof CollaborationEvents>(
    event: Event,
    handler: (data: CollaborationEvents[Event]) => void,
  ): void {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
  }

  off<Event extends keyof CollaborationEvents>(
    event: Event,
    handler: (data: CollaborationEvents[Event]) => void,
  ): void {
    this.handlers.get(event)?.delete(handler);
  }

  destroy(): void {
    this.isDestroyed = true;

    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();

    this.document.off('update', this.handleUpdate);
    this.handlers.clear();

    const peers = instances.get(this.documentId);
    peers?.delete(this);
    if (peers?.size === 0) instances.delete(this.documentId);
  }

  private readonly handleUpdate = (
    update: Uint8Array,
    origin: unknown,
  ): void => {
    if (origin === REPLICATION_ORIGIN) return;

    storedStates.set(this.documentId, Y.encodeStateAsUpdate(this.document));

    for (const peer of instances.get(this.documentId) ?? []) {
      if (peer !== this) peer.receive(update);
    }

    this.unsyncedChanges += 1;
    this.emit('unsyncedChanges', { number: this.unsyncedChanges });

    this.schedule(() => {
      this.unsyncedChanges = 0;
      this.emit('unsyncedChanges', { number: 0 });
      storedListener?.(this.documentId);
      this.emit('stateless', { payload: JSON.stringify({ type: 'stored' }) });
    });
  };

  private receive(update: Uint8Array): void {
    Y.applyUpdate(this.document, update, REPLICATION_ORIGIN);
  }

  private schedule(action: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.isDestroyed) action();
    }, LOCAL_DELAY_MS);

    this.timers.add(timer);
  }

  private emit<Event extends keyof CollaborationEvents>(
    event: Event,
    data: CollaborationEvents[Event],
  ): void {
    for (const handler of this.handlers.get(event) ?? []) {
      (handler as (data: CollaborationEvents[Event]) => void)(data);
    }
  }
}
