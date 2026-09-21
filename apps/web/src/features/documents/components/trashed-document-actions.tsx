import type React from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { useDeleteDocument } from '@/features/documents/api/delete-document';
import { useRestoreDocument } from '@/features/documents/api/restore-document';
import type { Document } from '@/types/api';

export function TrashedDocumentActions({
  document,
  onDeleted,
}: {
  document: Pick<Document, 'id' | 'title'>;
  onDeleted?: () => void;
}): React.JSX.Element {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const addNotification = useNotifications((state) => state.addNotification);

  const restoreDocumentMutation = useRestoreDocument({
    mutationConfig: {
      onSuccess: () => {
        addNotification({ type: 'success', title: 'Documento restaurado' });
      },
    },
  });

  const deleteDocumentMutation = useDeleteDocument({
    mutationConfig: {
      onSuccess: () => {
        // Only success closes the dialog: a failure keeps it open, with the
        // notification from the HTTP client interceptor explaining why.
        setIsDeleteDialogOpen(false);
        addNotification({
          type: 'success',
          title: 'Documento apagado definitivamente',
        });
        onDeleted?.();
      },
    },
  });

  // Either mutation in flight blocks both buttons: restoring and deleting the
  // same document at the same time has no meaning.
  const isPending =
    restoreDocumentMutation.isPending || deleteDocumentMutation.isPending;

  const handleRestore = (): void => {
    // A second click can arrive before the button re-renders as disabled.
    if (isPending) return;

    restoreDocumentMutation.mutate({ documentId: document.id });
  };

  const handleDelete = (): void => {
    if (isPending) return;

    deleteDocumentMutation.mutate({ documentId: document.id });
  };

  return (
    <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
      {/* Restoring is the reversible action: it asks nothing. */}
      <Button
        variant="secondary"
        disabled={isPending}
        isLoading={restoreDocumentMutation.isPending}
        onClick={handleRestore}
      >
        {restoreDocumentMutation.isPending ? 'Restaurando…' : 'Restaurar'}
      </Button>

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        trigger={
          <Button
            variant="ghost"
            className="text-red-700 hover:bg-red-50 focus-visible:outline-red-600"
            disabled={isPending}
          >
            Apagar definitivamente
          </Button>
        }
        title="Apagar definitivamente?"
        description={
          <>
            “{document.title}” e todo o seu conteúdo serão apagados para sempre.
            Esta ação não tem volta.
          </>
        }
        confirmButton={
          <Button
            variant="destructive"
            isLoading={deleteDocumentMutation.isPending}
            onClick={handleDelete}
          >
            {deleteDocumentMutation.isPending
              ? 'Apagando…'
              : 'Apagar definitivamente'}
          </Button>
        }
      />
    </div>
  );
}
