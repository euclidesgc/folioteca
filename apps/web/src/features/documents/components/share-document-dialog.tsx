import { isAxiosError } from 'axios';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import {
  PersonPicker,
  type PersonPickerHandle,
} from '@/components/person-picker/person-picker';
import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { paths } from '@/config/paths';
import {
  type DocumentAccessEntry,
  useDocumentShares,
} from '@/features/documents/api/get-document-shares';
import { useRemoveDocumentShare } from '@/features/documents/api/remove-document-share';
import { useShareDocument } from '@/features/documents/api/share-document';
import type { PersonSummary } from '@/hooks/use-person-lookup';
import { isConflictError } from '@/lib/errors';
import type { DocumentShareLevel } from '@/types/api';

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
            Escolha quem vai ter acesso a “{documentTitle}” e o que essa pessoa
            poderá fazer.
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
  const [level, setLevel] = useState<DocumentShareLevel>('view');
  const [successMessage, setSuccessMessage] = useState('');
  const [shareError, setShareError] = useState<string | null>(null);
  // What the list announces (a level changed or not, a person removed). The
  // notifications live outside the modal dialog, which hides them from
  // assistive technology, so the same text is also said from in here.
  const [announcement, setAnnouncement] = useState('');

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
        setLevel('view');
        pickerRef.current?.reset();
      },
      // The chosen person stays, so trying again needs no new search.
      onError: (error) => {
        setShareError(getShareErrorMessage(error));
      },
    },
  });

  const isSharing = shareDocumentMutation.isPending;
  // While the request is on its way the group shows the level that was sent,
  // never a change made in the meantime.
  const checkedLevel = isSharing
    ? (shareDocumentMutation.variables?.level ?? level)
    : level;

  const handleShare = (): void => {
    if (isSharingRef.current || !selected) return;
    isSharingRef.current = true;

    setShareError(null);
    setSuccessMessage('');
    shareDocumentMutation.mutate({ documentId, personId: selected.id, level });
  };

  const handleSelect = (person: PersonSummary): void => {
    setShareError(null);
    setSuccessMessage('');
    setSelected(person);
    setLevel('view');
  };

  // Ignored while sharing: the radios are only `aria-disabled`, so the focus
  // stays on them and the arrows would still reach here.
  const handleLevelChange = (value: DocumentShareLevel): void => {
    if (isSharing) return;
    setLevel(value);
  };

  // The picker puts the focus back on the field.
  const handleClear = (): void => {
    setShareError(null);
    setSelected(null);
    setLevel('view');
  };

  return (
    <div className="mt-4">
      <PersonPicker
        ref={pickerRef}
        selected={selected}
        onSelect={handleSelect}
        onClear={handleClear}
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
        <ShareLevelGroup
          checkedLevel={checkedLevel}
          isSharing={isSharing}
          onChange={handleLevelChange}
        />
      </PersonPicker>

      <AccessListSection
        documentId={documentId}
        sharesQuery={sharesQuery}
        onAnnounce={setAnnouncement}
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

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

const LEVEL_OPTIONS: {
  value: DocumentShareLevel;
  label: string;
  hint: string;
}[] = [
  {
    value: 'view',
    label: 'Pode ver',
    hint: 'Lê o documento, sem alterar nada.',
  },
  {
    value: 'edit',
    label: 'Pode editar',
    hint: 'Edita o título e o conteúdo junto com você.',
  },
];

// Recipe "Escolha entre opções (rádios)": the whole option is the label, so
// the border, the highlight of the checked one, the visible focus and the
// dimmed look while sending all follow the native radio inside it.
const LEVEL_OPTION_CLASS_NAME =
  'flex min-h-10 items-start gap-3 rounded-md border border-gray-200 p-3 text-sm text-gray-900 hover:bg-gray-50 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 has-[[aria-disabled=true]]:cursor-not-allowed has-[[aria-disabled=true]]:opacity-60';

// The level the chosen person gets. Native radios: the arrows switch the
// option and the Tab enters on the checked one. Never the native `disabled`
// while sharing, so the focus of the keyboard is not lost.
function ShareLevelGroup({
  checkedLevel,
  isSharing,
  onChange,
}: {
  checkedLevel: DocumentShareLevel;
  isSharing: boolean;
  onChange: (value: DocumentShareLevel) => void;
}): React.JSX.Element {
  const name = useId();

  return (
    <fieldset
      aria-disabled={isSharing ? 'true' : undefined}
      className="mt-4 min-w-0 space-y-2"
    >
      <legend className="mb-2 text-sm font-medium text-gray-900">
        Nível de acesso
      </legend>
      {LEVEL_OPTIONS.map((option) => (
        <label key={option.value} className={LEVEL_OPTION_CLASS_NAME}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={checkedLevel === option.value}
            aria-disabled={isSharing ? 'true' : undefined}
            onChange={() => onChange(option.value)}
            className="mt-0.5 size-4 shrink-0 accent-gray-900 outline-none aria-disabled:cursor-not-allowed"
          />
          <span className="flex min-w-0 flex-col break-words">
            {option.label}
            <span className="text-gray-600">{option.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
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

const LEVEL_LABELS: Record<DocumentShareLevel, string> = {
  view: 'Pode ver',
  edit: 'Pode editar',
};

// Recipe "Seletor na linha da lista": the field of "Campo de formulário"
// with an automatic width, dimmed while sending.
const LEVEL_SELECT_CLASS_NAME =
  'h-10 w-auto rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-60';

// The value of the option that removes the access instead of changing it.
const REMOVE_OPTION_VALUE = 'remove';

type Announce = (message: string) => void;

// Who has access to the document: the owner first, then the people in the
// order the server sent (pt-BR collator). Nothing is reordered here.
function AccessListSection({
  documentId,
  sharesQuery,
  onAnnounce,
}: {
  documentId: string;
  sharesQuery: SharesQuery;
  onAnnounce: Announce;
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
        <AccessListStates
          documentId={documentId}
          sharesQuery={sharesQuery}
          onAnnounce={onAnnounce}
        />
      </div>
    </section>
  );
}

// What the confirmation needs, copied from the row: after the success the
// person is no longer in the list, and the title still has to show the name
// while the box closes.
type RemovingShare = {
  personId: string;
  personName: string;
  // The share right above, or `null` when the owner is right above.
  aboveId: string | null;
};

function AccessListStates({
  documentId,
  sharesQuery,
  onAnnounce,
}: {
  documentId: string;
  sharesQuery: SharesQuery;
  onAnnounce: Announce;
}): React.JSX.Element {
  // `isRemoveOpen` is separate from `removing` because the closing is
  // animated.
  const [removing, setRemoving] = useState<RemovingShare | null>(null);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // The select that opened the confirmation, to give the focus back on
  // cancel and on Escape; and, once the request succeeded, where the focus
  // goes instead. Both are read inside `onCloseAutoFocus`, which runs after a
  // render: refs, never state.
  const removeOpenerRef = useRef<HTMLSelectElement | null>(null);
  const focusAfterRemoveRef = useRef<{ aboveId: string | null } | null>(null);
  // A second click, or a second Enter, can arrive before the button
  // re-renders as busy.
  const isSendingRef = useRef(false);
  const ownerRowRef = useRef<HTMLLIElement | null>(null);
  // The select of each share, reached by id when the focus has to land on
  // the row above the one that was removed.
  const levelSelectsRef = useRef(new Map<string, HTMLSelectElement>());

  const addNotification = useNotifications((state) => state.addNotification);
  // No `onSuccess` of its own here: the name and the row above are the ones
  // of the confirmation that sent the request, passed to `mutate`.
  const removeShareMutation = useRemoveDocumentShare({ documentId });
  const isRemoving = removeShareMutation.isPending;

  const handleRemoveRequest = (
    entry: DocumentAccessEntry,
    above: DocumentAccessEntry | undefined,
    select: HTMLSelectElement,
  ): void => {
    removeOpenerRef.current = select;
    setRemoveError(null);
    setRemoving({
      personId: entry.personId,
      personName: entry.name,
      aboveId: above && above.level !== 'owner' ? above.personId : null,
    });
    setIsRemoveOpen(true);
  };

  const handleConfirmRemove = (): void => {
    if (isSendingRef.current || !removing) return;
    isSendingRef.current = true;

    const { personId, personName, aboveId } = removing;
    // Cleared so a second failure is announced again.
    setRemoveError(null);
    removeShareMutation.mutate(
      { documentId, personId },
      {
        // Runs after the list was read again (see `useRemoveDocumentShare`):
        // the row is already gone when the box closes. A person already
        // removed elsewhere answers the same 204 and ends up here too.
        onSuccess: () => {
          const message = `${personName} não tem mais acesso ao documento.`;
          focusAfterRemoveRef.current = { aboveId };
          addNotification({ type: 'success', title: message });
          onAnnounce(message);
          setIsRemoveOpen(false);
        },
        // The box stays open and the person stays listed: there is no
        // optimistic update to undo. A 409 (trash) is this same failure.
        onError: () => {
          const message = `Não foi possível remover o acesso de ${personName}. Tente de novo.`;
          addNotification({ type: 'error', title: message });
          setRemoveError(message);
        },
        onSettled: () => {
          isSendingRef.current = false;
        },
      },
    );
  };

  // One confirmation for the whole list, and without a trigger of its own:
  // the row that opened it disappears when the list is read again. Mounted in
  // every state, so a failed reload never takes it away while it closes.
  const confirmation = (
    <ConfirmationDialog
      open={isRemoveOpen}
      onOpenChange={(open) => {
        if (!open) setIsRemoveOpen(false);
      }}
      onCloseAutoFocus={(event) => {
        const afterRemove = focusAfterRemoveRef.current;
        if (afterRemove) {
          focusAfterRemoveRef.current = null;
          event.preventDefault();

          const above = afterRemove.aboveId
            ? levelSelectsRef.current.get(afterRemove.aboveId)
            : undefined;
          // No share above — or it was removed too, in another tab: the row
          // of the owner, which is always there.
          if (above?.isConnected) {
            above.focus();
            return;
          }

          ownerRowRef.current?.focus();
          return;
        }

        // Cancel, Escape, or a failure followed by cancel: back to the
        // select that opened the confirmation.
        const opener = removeOpenerRef.current;
        if (opener?.isConnected) {
          event.preventDefault();
          opener.focus();
        }
      }}
      title={`Remover o acesso de ${removing?.personName ?? ''}?`}
      description={
        <>
          A pessoa perde o acesso na hora.
          {removeError ? (
            <span role="alert" className="sr-only">
              {` ${removeError}`}
            </span>
          ) : null}
        </>
      }
      cancelLabel="Cancelar"
      confirmButton={
        // `aria-disabled`, never `disabled`: a disabled button loses the
        // focus of the keyboard while the request goes out.
        <Button
          variant="destructive"
          type="button"
          aria-disabled={isRemoving || undefined}
          aria-busy={isRemoving || undefined}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          onClick={handleConfirmRemove}
        >
          {isRemoving ? 'Removendo…' : 'Remover'}
        </Button>
      }
    />
  );

  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (sharesQuery.isPending || (sharesQuery.isError && sharesQuery.isFetching)) {
    return (
      <>
        <p role="status" className="mt-4 text-sm text-gray-600">
          Carregando quem tem acesso…
        </p>
        {confirmation}
      </>
    );
  }

  if (sharesQuery.isError) {
    return (
      <>
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
        {confirmation}
      </>
    );
  }

  const entries = sharesQuery.data.data;

  // No empty state: the row of the owner is always there.
  return (
    <>
      <ul
        aria-label="Quem tem acesso"
        className="mt-2 divide-y divide-gray-200"
      >
        {entries.map((entry, index) =>
          entry.level === 'owner' ? (
            <AccessListRow key={entry.personId} entry={entry} ref={ownerRowRef} />
          ) : (
            <AccessListRow key={entry.personId} entry={entry}>
              <AccessLevelControl
                documentId={documentId}
                personId={entry.personId}
                name={entry.name}
                level={entry.level}
                selectRef={(node) => {
                  if (node) {
                    levelSelectsRef.current.set(entry.personId, node);
                  } else {
                    levelSelectsRef.current.delete(entry.personId);
                  }
                }}
                onAnnounce={onAnnounce}
                onRemoveRequest={(select) =>
                  handleRemoveRequest(entry, entries[index - 1], select)
                }
              />
            </AccessListRow>
          ),
        )}
      </ul>
      {confirmation}
    </>
  );
}

// One row of the list. The row of the owner takes a programmatic focus (after
// removing the first share) without ever entering the `Tab` order.
function AccessListRow({
  entry,
  ref,
  children,
}: {
  entry: DocumentAccessEntry;
  ref?: React.Ref<HTMLLIElement>;
  // The control of the level, on the rows of a share.
  children?: React.ReactNode;
}): React.JSX.Element {
  const isOwner = entry.level === 'owner';

  return (
    <li
      ref={ref}
      tabIndex={isOwner ? -1 : undefined}
      className={
        isOwner
          ? `${ROW_CLASS_NAME} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`
          : ROW_CLASS_NAME
      }
    >
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
        {isOwner ? <span className={BADGE_CLASS_NAME}>dono</span> : null}
        {entry.isCurrentPerson ? (
          <span className={BADGE_CLASS_NAME}>você</span>
        ) : null}
        {children}
      </span>
    </li>
  );
}

// The level of one share, chosen by the owner, with "Remover acesso" as the
// last option. One per row, each with its own mutation, so a row being saved
// never dims the others.
function AccessLevelControl({
  documentId,
  personId,
  name,
  level,
  selectRef,
  onAnnounce,
  onRemoveRequest,
}: {
  documentId: string;
  personId: string;
  name: string;
  level: DocumentShareLevel;
  selectRef: React.Ref<HTMLSelectElement>;
  onAnnounce: Announce;
  // Opens the confirmation; the select is who gets the focus back.
  onRemoveRequest: (select: HTMLSelectElement) => void;
}): React.JSX.Element {
  const selectId = useId();
  const addNotification = useNotifications((state) => state.addNotification);

  const shareDocumentMutation = useShareDocument({
    mutationConfig: {
      // Runs after the list was read again (see `useShareDocument`): the
      // select already shows the new level. Announced only: the dialog stays
      // open and the change is visible where it was made.
      onSuccess: (_response, variables) => {
        onAnnounce(
          `Nível de ${name} alterado para ${LEVEL_LABELS[variables.level]}.`,
        );
      },
      // Nothing to undo: the value comes back by itself once the mutation is
      // no longer pending.
      onError: () => {
        const message = `Não foi possível mudar o nível de ${name}. Tente de novo.`;
        addNotification({ type: 'error', title: message });
        onAnnounce(message);
      },
    },
  });

  const isSaving = shareDocumentMutation.isPending;
  // Derived, never copied into state: while sending, the level just chosen;
  // otherwise what the server says.
  const shownLevel: DocumentShareLevel = shareDocumentMutation.isPending
    ? shareDocumentMutation.variables.level
    : level;

  // Ignored while sending (the select is only `aria-disabled`, to keep the
  // focus) and when the level is already the chosen one. "Remover acesso"
  // sends nothing and leaves the controlled value on the current level.
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    if (isSaving) return;

    const { value } = event.target;
    if (value === REMOVE_OPTION_VALUE) {
      onRemoveRequest(event.currentTarget);
      return;
    }

    if ((value !== 'view' && value !== 'edit') || value === shownLevel) return;
    shareDocumentMutation.mutate({ documentId, personId, level: value });
  };

  return (
    <span className="flex items-center">
      <label htmlFor={selectId} className="sr-only">
        {`Nível de ${name}`}
      </label>
      <select
        id={selectId}
        ref={selectRef}
        value={shownLevel}
        aria-disabled={isSaving ? 'true' : undefined}
        onChange={handleChange}
        className={LEVEL_SELECT_CLASS_NAME}
      >
        <option value="view">Pode ver</option>
        <option value="edit">Pode editar</option>
        <option value={REMOVE_OPTION_VALUE}>Remover acesso</option>
      </select>
      {/* Always in the DOM, so the start of the saving is announced. */}
      <span aria-live="polite" className="text-sm text-gray-600">
        {isSaving ? <span className="ml-2">Salvando…</span> : null}
      </span>
    </span>
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
