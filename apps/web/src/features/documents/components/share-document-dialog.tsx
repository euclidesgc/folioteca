import { isAxiosError } from 'axios';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

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
import { paths } from '@/config/paths';
import {
  type DocumentAccessEntry,
  useDocumentShares,
} from '@/features/documents/api/get-document-shares';
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
  // Independent of the share mutation: the picker and "Compartilhar" work
  // while the list loads or after it failed.
  const sharesQuery = useDocumentShares({ documentId, enabled: isOpen });

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
          <SharePanel documentId={documentId} sharesQuery={sharesQuery} />

          {/* Same: the copy state starts at "idle" on every opening. */}
          <CopyLinkFooter documentId={documentId} />
        </DialogContent>
      </Dialog>
    </>
  );
}

type SharesQuery = ReturnType<typeof useDocumentShares>;

function SharePanel({
  documentId,
  sharesQuery,
}: {
  documentId: string;
  sharesQuery: SharesQuery;
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

      <AccessListSection sharesQuery={sharesQuery} />

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

// The recipe "Selo de status" with the gray pair, as in the list of the
// people of a space.
const BADGE_CLASS_NAME =
  'shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700';

// `flex-wrap`: on a narrow screen the badges drop below the name instead of
// scrolling sideways.
const ROW_CLASS_NAME =
  'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3';

const LEVEL_BADGES: Record<'view' | 'edit', string> = {
  view: 'Pode ver',
  edit: 'Pode editar',
};

// Who has access to the document: the owner first, then the people in the
// order the server sent (pt-BR collator). Nothing is reordered here.
function AccessListSection({
  sharesQuery,
}: {
  sharesQuery: SharesQuery;
}): React.JSX.Element {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="mt-8 text-lg font-semibold">
        Quem tem acesso
      </h3>
      {/* Every state renders inside this same region, already on screen, so
          the arrival of the list (and of a person just shared) is
          announced. */}
      <div aria-live="polite">
        <AccessListStates sharesQuery={sharesQuery} />
      </div>
    </section>
  );
}

function AccessListStates({
  sharesQuery,
}: {
  sharesQuery: SharesQuery;
}): React.JSX.Element {
  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (sharesQuery.isPending || (sharesQuery.isError && sharesQuery.isFetching)) {
    return (
      <p role="status" className="mt-4 text-sm text-gray-600">
        Carregando quem tem acesso…
      </p>
    );
  }

  if (sharesQuery.isError) {
    return (
      <div
        role="alert"
        className="mt-4 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-sm text-red-800">
          Não foi possível carregar quem tem acesso.
        </p>
        <Button
          variant="secondary"
          type="button"
          className="mt-3"
          onClick={() => void sharesQuery.refetch()}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  // No empty state: the row of the owner is always there.
  return (
    <ul aria-label="Quem tem acesso" className="mt-2 divide-y divide-gray-200">
      {sharesQuery.data.data.map((entry) => (
        <AccessListRow key={entry.personId} entry={entry} />
      ))}
    </ul>
  );
}

function AccessListRow({
  entry,
}: {
  entry: DocumentAccessEntry;
}): React.JSX.Element {
  return (
    <li className={ROW_CLASS_NAME}>
      <span className="flex min-w-0 grow basis-48 flex-col">
        <span className="truncate text-gray-900" title={entry.name}>
          {entry.name}
        </span>
        {/* An address has no space to break on its own: it wraps, never
            truncates. */}
        <span className="break-words text-sm text-gray-600">
          {entry.email}
        </span>
      </span>
      <span className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
        {entry.level === 'owner' ? (
          <span className={BADGE_CLASS_NAME}>dono</span>
        ) : (
          <span className={BADGE_CLASS_NAME}>{LEVEL_BADGES[entry.level]}</span>
        )}
        {entry.isCurrentPerson ? (
          <span className={BADGE_CLASS_NAME}>você</span>
        ) : null}
      </span>
    </li>
  );
}

type CopyState = 'idle' | 'copied' | 'manual';

// The copy pattern of the invitation link: the clipboard when there is one,
// otherwise the address in a read-only field, already selected, to copy by
// keyboard. Then "Copiar link" and "Fechar".
function CopyLinkFooter({
  documentId,
}: {
  documentId: string;
}): React.JSX.Element {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const fieldId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);

  const link = `${window.location.origin}${paths.document.getHref(documentId)}`;

  // The field only exists in the "manual" state: selected as soon as it
  // appears.
  useEffect(() => {
    if (copyState === 'manual') fieldRef.current?.select();
  }, [copyState]);

  const copyLink = async (): Promise<void> => {
    // No clipboard at all (insecure context, old browser) and a refused write
    // (permission denied) take the same path.
    if (typeof navigator.clipboard?.writeText !== 'function') {
      setCopyState('manual');
      return;
    }

    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
    }
  };

  return (
    <>
      <p aria-live="polite" className="mt-4 text-sm text-gray-600 empty:mt-0">
        {copyState === 'copied' ? 'Link copiado' : ''}
      </p>

      {copyState === 'manual' ? (
        <div className="mt-4">
          <label
            htmlFor={fieldId}
            className="block text-sm font-medium text-gray-900"
          >
            Endereço do documento
          </label>
          <input
            id={fieldId}
            ref={fieldRef}
            readOnly
            value={link}
            className="mt-1 block h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 font-mono text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void copyLink();
          }}
        >
          Copiar link
        </Button>
        <DialogClose asChild>
          <Button variant="secondary">Fechar</Button>
        </DialogClose>
      </div>
    </>
  );
}
