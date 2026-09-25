import type React from 'react';

import type { SaveStatus } from '@/features/documents/utils/get-save-status';

type SaveIndicatorProps = {
  status: SaveStatus;
};

// "Salvo" means the server acknowledged the change; it writes to the database
// up to two seconds later, on its own debounce.
const messages: Record<SaveStatus, string> = {
  connecting: 'Conectando…',
  saving: 'Salvando…',
  saved: 'Salvo',
  offline: 'Sem conexão — as alterações serão enviadas ao reconectar',
  unreachable: 'Não foi possível conectar ao editor — tentando de novo…',
};

export function SaveIndicator({
  status,
}: SaveIndicatorProps): React.JSX.Element {
  return (
    <p
      role="status"
      className={
        status === 'offline' || status === 'unreachable'
          ? 'mt-2 text-sm text-amber-800'
          : 'mt-2 text-sm text-gray-600'
      }
    >
      {messages[status]}
    </p>
  );
}
