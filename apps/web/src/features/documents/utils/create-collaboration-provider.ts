import { HocuspocusProvider } from '@hocuspocus/provider';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';

import { getCollabUrl } from '@/config/collab';
import { env } from '@/config/env';
import type { ConnectionState } from '@/features/documents/utils/get-save-status';

// The single Yjs fragment the editor writes into; the server stores the whole
// document state, so this name must never change.
export const DOCUMENT_FRAGMENT_NAME = 'document-content';

// The four events both modes emit, with the payload shape of
// `@hocuspocus/provider`.
export type CollaborationEvents = {
  status: { status: ConnectionState };
  synced: { state: boolean };
  unsyncedChanges: { number: number };
  stateless: { payload: string };
};

// The smallest surface the app depends on: the four events, the teardown and
// the awareness BlockNote reads for collaboration cursors.
export type CollaborationProvider = {
  on<Event extends keyof CollaborationEvents>(
    event: Event,
    handler: (data: CollaborationEvents[Event]) => void,
  ): unknown;
  off<Event extends keyof CollaborationEvents>(
    event: Event,
    handler: (data: CollaborationEvents[Event]) => void,
  ): unknown;
  destroy(): void;
  readonly awareness: Awareness | null;
};

export type CollaborationSession = {
  ydoc: Y.Doc;
  fragment: Y.XmlFragment;
  provider: CollaborationProvider;
};

// This is the only place in the app that creates a `Y.Doc` and a provider, and
// it is only ever reached through `import()`: the editor libraries stay out of
// the initial download.
export const createCollaborationProvider = async ({
  documentId,
}: {
  documentId: string;
}): Promise<CollaborationSession> => {
  const ydoc = new Y.Doc();
  const fragment = ydoc.getXmlFragment(DOCUMENT_FRAGMENT_NAME);

  if (env.ENABLE_API_MOCKING) {
    const { LocalCollaborationProvider } = await import(
      '@/features/documents/utils/local-collaboration-provider'
    );

    return {
      ydoc,
      fragment,
      provider: new LocalCollaborationProvider({ documentId, document: ydoc }),
    };
  }

  // No credential travels through JavaScript: the session is the httpOnly
  // cookie the browser sends by itself on the upgrade request.
  const provider = new HocuspocusProvider({
    url: getCollabUrl(),
    name: documentId,
    document: ydoc,
  });

  return { ydoc, fragment, provider };
};
