import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { invalidateDocumentLists } from '@/features/documents/api/get-documents';
// Types only: `yjs`, the provider and the factory itself must stay out of the
// initial download. The factory arrives through `import()` inside the effect.
import type {
  CollaborationEvents,
  CollaborationSession,
} from '@/features/documents/utils/create-collaboration-provider';
import type {
  ConnectionState,
  SaveStatus,
} from '@/features/documents/utils/get-save-status';
import { getSaveStatus } from '@/features/documents/utils/get-save-status';
import { reportError } from '@/lib/report-error';

type DocumentCollaboration = {
  session: CollaborationSession | null;
  hasSynced: boolean;
  saveStatus: SaveStatus;
};

type StatelessType = 'stored' | 'access-changed';

// `stored`: the server sends it after writing the content to the database,
// which is the moment the document's `updatedAt` really changed.
// `access-changed`: the server reevaluated this person's access after a share
// changed. The message carries no level: the level always comes from the GET.
const parseStatelessType = (payload: string): StatelessType | null => {
  let message: unknown;

  try {
    message = JSON.parse(payload);
  } catch {
    return null;
  }

  if (typeof message !== 'object' || message === null) return null;

  const type = (message as { type?: unknown }).type;

  return type === 'stored' || type === 'access-changed' ? type : null;
};

export const useDocumentCollaboration = (
  documentId: string,
): DocumentCollaboration => {
  const queryClient = useQueryClient();

  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [hasSynced, setHasSynced] = useState(false);
  const [unsyncedChanges, setUnsyncedChanges] = useState(0);

  useEffect(() => {
    // Local to this run of the effect: in Strict Mode (and when the document
    // changes) React creates, destroys and creates again, and every run has to
    // clean up only after itself.
    let isCancelled = false;
    let teardown: (() => void) | null = null;

    setSession(null);
    setConnection('connecting');
    setHasSynced(false);
    setUnsyncedChanges(0);

    const start = async (): Promise<void> => {
      const { createCollaborationProvider } = await import(
        '@/features/documents/utils/create-collaboration-provider'
      );

      const created = await createCollaborationProvider({ documentId });

      // The cleanup already ran while the factory was loading: this session
      // must die right where it was born and never reach the state.
      if (isCancelled) {
        created.provider.destroy();
        created.ydoc.destroy();
        return;
      }

      const handleStatus = ({
        status,
      }: CollaborationEvents['status']): void => {
        setConnection(status);
      };

      // Only ever goes up: losing the connection after the first sync must not
      // unmount the editor the person is writing in.
      const handleSynced = ({ state }: CollaborationEvents['synced']): void => {
        if (state) setHasSynced(true);
      };

      const handleUnsyncedChanges = ({
        number,
      }: CollaborationEvents['unsyncedChanges']): void => {
        setUnsyncedChanges(number);
      };

      const handleStateless = ({
        payload,
      }: CollaborationEvents['stateless']): void => {
        const type = parseStatelessType(payload);

        if (type === null) return;

        // Both reread the document and the lists: after `access-changed` the
        // new `accessLevel` (or a 404, when the access is gone) drives the page.
        void refreshDocument();
      };

      const refreshDocument = async (): Promise<void> => {
        await Promise.all([
          invalidateDocumentLists(queryClient),
          queryClient.invalidateQueries({
            queryKey: getDocumentQueryOptions(documentId).queryKey,
          }),
        ]);
      };

      created.provider.on('status', handleStatus);
      created.provider.on('synced', handleSynced);
      created.provider.on('unsyncedChanges', handleUnsyncedChanges);
      created.provider.on('stateless', handleStateless);

      teardown = () => {
        created.provider.off('status', handleStatus);
        created.provider.off('synced', handleSynced);
        created.provider.off('unsyncedChanges', handleUnsyncedChanges);
        created.provider.off('stateless', handleStateless);
        created.provider.destroy();
        created.ydoc.destroy();
      };

      setSession(created);
    };

    start().catch((error: unknown) => {
      if (isCancelled) return;

      reportError(error, { documentId });
      setConnection('disconnected');
    });

    return () => {
      isCancelled = true;
      teardown?.();
      teardown = null;
    };
  }, [documentId, queryClient]);

  return {
    session,
    hasSynced,
    saveStatus: getSaveStatus({ connection, hasSynced, unsyncedChanges }),
  };
};
