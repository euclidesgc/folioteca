export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export type SaveStatus = 'connecting' | 'saving' | 'saved' | 'offline' | 'unreachable';

type SaveStatusInput = {
  connection: ConnectionState;
  hasSynced: boolean;
  unsyncedChanges: number;
};

// "saved" means the server acknowledged the changes; the database write
// happens up to a couple of seconds later, on the server debounce.
// A disconnection before the first sync is "unreachable": there are no local
// changes to send yet, so only after a sync does it become "offline".
export const getSaveStatus = ({
  connection,
  hasSynced,
  unsyncedChanges,
}: SaveStatusInput): SaveStatus => {
  if (connection === 'disconnected') {
    return hasSynced ? 'offline' : 'unreachable';
  }

  if (connection === 'connected') {
    if (unsyncedChanges > 0) return 'saving';
    if (hasSynced) return 'saved';
  }

  return 'connecting';
};
