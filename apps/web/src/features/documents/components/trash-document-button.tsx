import type React from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { useTrashDocument } from '@/features/documents/api/trash-document';
import type { Document } from '@/types/api';

// The only bin of the app: inline here instead of a shared icon component,
// and with no icon library added to the bundle for a single drawing.
function TrashIcon(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" />
    </svg>
  );
}

export function TrashDocumentButton({
  document,
}: {
  document: Pick<Document, 'id' | 'title'>;
}): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const addNotification = useNotifications((state) => state.addNotification);

  const trashDocumentMutation = useTrashDocument({
    mutationConfig: {
      onSuccess: () => {
        // Only success closes the dialog: a failure keeps it open, with the
        // notification from the HTTP client interceptor explaining why.
        setIsOpen(false);
        addNotification({
          type: 'success',
          title: 'Documento movido para a lixeira',
        });
      },
    },
  });

  const handleConfirm = (): void => {
    // A second click can arrive before the button re-renders as disabled.
    if (trashDocumentMutation.isPending) return;

    trashDocumentMutation.mutate({ documentId: document.id });
  };

  return (
    <ConfirmationDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Button variant="ghost">
          <TrashIcon />
          Mover para a lixeira
        </Button>
      }
      title="Mover para a lixeira?"
      description={
        <>
          “{document.title}” sai das suas listas e dos favoritos. Você pode
          restaurar o documento depois, pela Lixeira.
        </>
      }
      confirmButton={
        <Button
          variant="primary"
          isLoading={trashDocumentMutation.isPending}
          onClick={handleConfirm}
        >
          {trashDocumentMutation.isPending ? 'Movendo…' : 'Mover para a lixeira'}
        </Button>
      }
    />
  );
}
