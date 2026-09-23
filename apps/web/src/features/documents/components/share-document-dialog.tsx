import { isAxiosError } from 'axios';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/dialog';
import {
  type PersonSummary,
  SHARE_SEARCH_MIN_LENGTH,
  useSearchPeopleToShare,
} from '@/features/documents/api/search-people-to-share';
import { useShareDocument } from '@/features/documents/api/share-document';
import { isConflictError } from '@/lib/errors';

// The debounce lives here, in the component that owns the field, and never in
// the API layer, which must have no hidden timer.
const SEARCH_DEBOUNCE_MS = 300;

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
  const [term, setTerm] = useState('');
  const [deferredTerm, setDeferredTerm] = useState('');
  const [selected, setSelected] = useState<PersonSummary | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);

  const fieldRef = useRef<HTMLInputElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  // `isPending` only turns true on the next render: two clicks in the same
  // batch of events would both get through. The ref closes in the instant.
  const isSharingRef = useRef(false);

  const fieldId = useId();
  const hintId = useId();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDeferredTerm(term);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [term]);

  // The "Selecionar" button that was clicked disappears with the list: the
  // focus goes to the action that comes next.
  useEffect(() => {
    if (selected) shareButtonRef.current?.focus();
  }, [selected]);

  const searchQuery = useSearchPeopleToShare(deferredTerm);

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
        setTerm('');
        setDeferredTerm('');
        fieldRef.current?.focus();
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

  const handleChangePerson = (): void => {
    setShareError(null);
    setSelected(null);
    fieldRef.current?.focus();
  };

  const hasEnoughLetters = term.trim().length >= SHARE_SEARCH_MIN_LENGTH;
  // Still waiting for the answer of the term in the field: either the
  // debounce has not fired yet or the request is on its way.
  const isSearching =
    hasEnoughLetters && (deferredTerm !== term || searchQuery.isFetching);
  const results = searchQuery.data;

  const renderResults = (): React.JSX.Element => {
    if (!hasEnoughLetters) {
      return (
        <p className="mt-4 text-sm text-gray-600">
          Digite pelo menos 2 letras para buscar.
        </p>
      );
    }

    if (searchQuery.isError && !isSearching) {
      return (
        <div
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3"
        >
          <p className="text-sm text-red-800">
            Não foi possível buscar pessoas.
          </p>
          <Button
            variant="destructive"
            className="mt-3"
            onClick={() => void searchQuery.refetch()}
          >
            Tentar de novo
          </Button>
        </div>
      );
    }

    if (isSearching || !results) {
      return (
        <p role="status" className="mt-4 text-sm text-gray-600">
          Buscando…
        </p>
      );
    }

    if (results.data.length === 0) {
      return (
        <p
          role="status"
          className="mt-4 rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600"
        >
          Nenhuma pessoa encontrada.
        </p>
      );
    }

    return (
      <>
        <p role="status" className="mt-4 text-sm text-gray-600">
          {results.data.length === 1
            ? '1 resultado.'
            : `${results.data.length} resultados.`}
        </p>
        <ul
          aria-label="Pessoas encontradas"
          className="mt-2 divide-y divide-gray-200"
        >
          {results.data.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <span
                  className="block min-w-0 truncate text-sm font-medium text-gray-900"
                  title={person.name}
                >
                  {person.name}
                </span>
                {/* An address has no space to break on its own: it wraps,
                    never truncates. */}
                <span className="block break-words text-sm text-gray-600">
                  {person.email}
                </span>
              </div>
              <Button
                variant="ghost"
                aria-label={`Selecionar ${person.name}`}
                onClick={() => handleSelect(person)}
              >
                Selecionar
              </Button>
            </li>
          ))}
        </ul>
      </>
    );
  };

  return (
    <div className="mt-4">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-900"
      >
        Buscar pessoa
      </label>
      <input
        ref={fieldRef}
        id={fieldId}
        type="search"
        autoComplete="off"
        value={term}
        aria-describedby={hintId}
        onChange={(event) => setTerm(event.target.value)}
        className="mt-1 block h-10 w-full rounded-md border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
      />
      <p id={hintId} className="mt-1 text-sm text-gray-600">
        Nome ou e-mail, com pelo menos 2 letras.
      </p>

      {selected ? (
        <div className="mt-4 rounded-md border border-gray-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-sm font-medium text-gray-900"
                title={selected.name}
              >
                {selected.name}
              </p>
              <p className="break-words text-sm text-gray-600">
                {selected.email}
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
              Pode ver
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Esta pessoa poderá ler o documento.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={handleChangePerson}>
              Trocar pessoa
            </Button>
            {/* Never the native `disabled`: the button keeps the focus while
                the request is on its way. */}
            <Button
              ref={shareButtonRef}
              variant="primary"
              aria-disabled={isSharing ? 'true' : undefined}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              onClick={handleShare}
            >
              {isSharing ? 'Compartilhando…' : 'Compartilhar'}
            </Button>
          </div>
        </div>
      ) : (
        renderResults()
      )}

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
