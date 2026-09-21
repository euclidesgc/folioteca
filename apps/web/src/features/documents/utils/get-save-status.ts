export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export type SaveStatus = 'connecting' | 'saving' | 'saved' | 'offline';

type SaveStatusInput = {
  connection: ConnectionState;
  hasSynced: boolean;
  unsyncedChanges: number;
};

// "saved" means the server acknowledged the changes; the database write
// happens up to a couple of seconds later, on the server debounce.
export const getSaveStatus = ({
  connection,
  hasSynced,
  unsyncedChanges,
}: SaveStatusInput): SaveStatus => {
  if (connection === 'disconnected') return 'offline';

  if (connection === 'connected') {
    if (unsyncedChanges > 0) return 'saving';
    if (hasSynced) return 'saved';
  }

  return 'connecting';
};
