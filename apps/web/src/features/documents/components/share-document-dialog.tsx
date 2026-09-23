import { isAxiosError } from 'axios';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import {
  PersonPicker,
  type PersonPickerHandle,
} from '@/components/person-picker/person-picker';
import { Button } from '@/components/ui/button/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/dialog';
import { useShareDocument } from '@/features/documents/api/share-document';
import type { PersonSummary } from '@/hooks/use-person-lookup';
import { isConflictError } from '@/lib/errors';

const GENERIC_SHARE_ERROR =
  'Não foi possível compartilhar o documento. Tente de novo.';

// The API client turns a 409 into a `ConflictError` without the body, and the
// only 409 of this route is the document in the trash: this is the message
// the server sends with it.
const IN_TRASH_MESSAGE =
  'Este documento está na lixeira. Restaure-o para editar.';

// The server message when it explains the refusal (400, 403, 409), otherwise
// the generic one: a 5xx or a network failure has nothing useful to show.
const getShareErrorMessage = (error: unknown): string => {
  if (isConflictError(error)) return IN_TRASH_MESSAGE;
  if (!isAxiosError(error)) return GENERIC_SHARE_ERROR;

  const status = error.response?.status;
  if (status !== 400 && status !== 403) return GENERIC_SHARE_ERROR;

  const data: unknown = error.response?.data;
  if (
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof data.message === 'string' &&
    data.message.length > 0
  ) {
    return data.message;
  }

  return GENERIC_SHARE_ERROR;
};

type ShareDocumentDialogProps = {
  documentId: string;
  documentTitle: string;
};

// The trigger and the box. The box opens by state, and the `Dialog` gives the
// focus back to the trigger when it closes, by "Fechar", `Esc` or a click
// outside.
export function ShareDocumentDialog({
  documentId,
  documentTitle,
}: ShareDocumentDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        Compartilhar
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogTitle>Compartilhar documento</DialogTitle>
          <DialogDescription>
            Quem você escolher poderá ler “{documentTitle}”, sem alterar nada.
          </DialogDescription>

          {/* Only mounted while the box is open: reopening starts clean. */}
          <SharePanel documentId={documentId} />

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Fechar</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SharePanel({
  documentId,
}: {
  documentId: string;
}): React.JSX.Element {
  const [selected, setSelected] = useState<PersonSummary | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);

  const pickerRef = useRef<PersonPickerHandle>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  // `isPending` only turns true on the next render: two clicks in the same
  // batch of events would both get through. The ref closes in the instant.
  const isSharingRef = useRef(false);

  // The "Selecionar" button that was clicked disappears with the list: the
  // focus goes to the action that comes next.
  useEffect(() => {
    if (selected) shareButtonRef.current?.focus();
  }, [selected]);

  const shareDocumentMutation = useShareDocument({
    mutationConfig: {
      onSettled: () => {
        isSharingRef.current = false;
      },
      onSuccess: (response) => {
        // The name comes from the answer, never from the row of the search.
        setSuccessMessage(
          `Documento compartilhado com ${response.data.name}.`,
        );
        setSelected(null);
        pickerRef.current?.reset();
      },
      // The chosen person stays, so trying again needs no new search.
      onError: (error) => {
        setShareError(getShareErrorMessage(error));
      },
    },
  });

  const isSharing = shareDocumentMutation.isPending;

  const handleShare = (): void => {
    if (isSharingRef.current || !selected) return;
    isSharingRef.current = true;

    setShareError(null);
    setSuccessMessage('');
    shareDocumentMutation.mutate({ documentId, personId: selected.id });
  };

  const handleSelect = (person: PersonSummary): void => {
    setShareError(null);
    setSuccessMessage('');
    setSelected(person);
  };

  // The picker puts the focus back on the field.
  const handleClear = (): void => {
    setShareError(null);
    setSelected(null);
  };

  return (
    <div className="mt-4">
      <PersonPicker
        ref={pickerRef}
        selected={selected}
        onSelect={handleSelect}
        onClear={handleClear}
        selectedAside={
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
            Pode ver
          </span>
        }
        selectedActions={
          // Never the native `disabled`: the button keeps the focus while the
          // request is on its way.
          <Button
            ref={shareButtonRef}
            variant="primary"
            aria-disabled={isSharing ? 'true' : undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={handleShare}
          >
            {isSharing ? 'Compartilhando…' : 'Compartilhar'}
          </Button>
        }
      >
        <p className="mt-2 text-sm text-gray-600">
          Esta pessoa poderá ler o documento.
        </p>
      </PersonPicker>

      <p aria-live="polite" className="mt-4 text-sm text-green-800 empty:mt-0">
        {successMessage}
      </p>

      {shareError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {shareError}
        </p>
      ) : null}
    </div>
  );
}
