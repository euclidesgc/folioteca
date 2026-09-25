import { isAxiosError } from 'axios';
import type React from 'react';
import { Fragment, useEffect, useId, useRef, useState } from 'react';

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
import { useRemoveDocumentInstanceShare } from '@/features/documents/api/remove-document-instance-share';
import { useRemoveDocumentShare } from '@/features/documents/api/remove-document-share';
import { useShareDocument } from '@/features/documents/api/share-document';
import { useShareDocumentWithInstance } from '@/features/documents/api/share-document-with-instance';
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

// Who the panel shares with: one person, found by the search, or everyone in
// the organization at once.
type ShareTarget = 'person' | 'instance';

const INSTANCE_SUCCESS_MESSAGE =
  'Documento compartilhado com Todos da organização.';

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
  const [target, setTarget] = useState<ShareTarget>('person');
  const [instanceLevel, setInstanceLevel] =
    useState<DocumentShareLevel>('view');
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

  const shareInstanceMutation = useShareDocumentWithInstance({
    mutationConfig: {
      onSettled: () => {
        isSharingRef.current = false;
      },
      // Runs after the list was read again: the row of the organization is
      // already there. The choice of "Todos da organização" stays.
      onSuccess: () => {
        setSuccessMessage(INSTANCE_SUCCESS_MESSAGE);
        setInstanceLevel('view');
      },
      onError: (error) => {
        setShareError(getShareErrorMessage(error));
      },
    },
  });

  const isSharing =
    shareDocumentMutation.isPending || shareInstanceMutation.isPending;
  // While the request is on its way the groups show what was sent, never a
  // change made in the meantime.
  const checkedLevel = shareDocumentMutation.isPending
    ? shareDocumentMutation.variables.level
    : level;
  const checkedInstanceLevel = shareInstanceMutation.isPending
    ? shareInstanceMutation.variables.level
    : instanceLevel;
  const checkedTarget: ShareTarget = shareInstanceMutation.isPending
    ? 'instance'
    : shareDocumentMutation.isPending
      ? 'person'
      : target;

  const handleShare = (): void => {
    if (isSharingRef.current || !selected) return;
    isSharingRef.current = true;

    setShareError(null);
    setSuccessMessage('');
    shareDocumentMutation.mutate({ documentId, personId: selected.id, level });
  };

  const handleShareWithInstance = (): void => {
    if (isSharingRef.current) return;
    isSharingRef.current = true;

    setShareError(null);
    setSuccessMessage('');
    shareInstanceMutation.mutate({ documentId, level: instanceLevel });
  };

  // Ignored while sharing, like the levels. The message of the other target
  // no longer applies.
  const handleTargetChange = (value: ShareTarget): void => {
    if (isSharing) return;
    setShareError(null);
    setSuccessMessage('');
    setTarget(value);
  };

  const handleInstanceLevelChange = (value: DocumentShareLevel): void => {
    if (isSharing) return;
    setInstanceLevel(value);
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
      <ShareTargetGroup
        checkedTarget={checkedTarget}
        isSharing={isSharing}
        onChange={handleTargetChange}
      />

      {checkedTarget === 'person' ? (
        <div className="mt-4">
          <PersonPicker
            ref={pickerRef}
            selected={selected}
            onSelect={handleSelect}
            onClear={handleClear}
            selectedActions={
              // Never the native `disabled`: the button keeps the focus while
              // the request is on its way.
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
        </div>
      ) : (
        <>
          <ShareLevelGroup
            checkedLevel={checkedInstanceLevel}
            isSharing={isSharing}
            onChange={handleInstanceLevelChange}
          />
          <div className="mt-4 flex justify-end">
            {/* Never the native `disabled`: the button keeps the focus while
                the request is on its way. */}
            <Button
              type="button"
              variant="primary"
              aria-disabled={isSharing ? 'true' : undefined}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              onClick={handleShareWithInstance}
            >
              {isSharing ? 'Compartilhando…' : 'Compartilhar'}
            </Button>
          </div>
        </>
      )}

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

const TARGET_OPTIONS: {
  value: ShareTarget;
  label: string;
  hint?: string;
}[] = [
  { value: 'person', label: 'Uma pessoa' },
  {
    value: 'instance',
    label: 'Todos da organização',
    hint: 'Qualquer pessoa da organização, inclusive quem entrar depois.',
  },
];

// Who the panel shares with, in the same recipe as the levels. Choosing an
// option never moves the focus: it stays on the radio, so the arrows keep
// working. While sharing the radios are only `aria-disabled`; an arrow still
// moves the native focus, so it is put back on the checked radio.
function ShareTargetGroup({
  checkedTarget,
  isSharing,
  onChange,
}: {
  checkedTarget: ShareTarget;
  isSharing: boolean;
  onChange: (value: ShareTarget) => void;
}): React.JSX.Element {
  const name = useId();
  const radiosRef = useRef(new Map<ShareTarget, HTMLInputElement>());

  const handleChange = (value: ShareTarget): void => {
    if (isSharing) {
      radiosRef.current.get(checkedTarget)?.focus();
      return;
    }
    onChange(value);
  };

  return (
    <fieldset
      aria-disabled={isSharing ? 'true' : undefined}
      className="min-w-0 space-y-2"
    >
      <legend className="mb-2 text-sm font-medium text-gray-900">
        Compartilhar com
      </legend>
      {TARGET_OPTIONS.map((option) => (
        <label key={option.value} className={LEVEL_OPTION_CLASS_NAME}>
          <input
            ref={(node) => {
              if (node) {
                radiosRef.current.set(option.value, node);
              } else {
                radiosRef.current.delete(option.value);
              }
            }}
            type="radio"
            name={name}
            value={option.value}
            checked={checkedTarget === option.value}
            aria-disabled={isSharing ? 'true' : undefined}
            onChange={() => handleChange(option.value)}
            className="mt-0.5 size-4 shrink-0 accent-gray-900 outline-none aria-disabled:cursor-not-allowed"
          />
          <span className="flex min-w-0 flex-col break-words">
            {option.label}
            {option.hint ? (
              <span className="text-gray-600">{option.hint}</span>
            ) : null}
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

// How the row of everyone in the organization is named on screen.
const INSTANCE_NAME = 'Todos da organização';

// What `aboveId` holds when the row right above a share is the one of everyone
// in the organization: its select is kept apart from the ones of the people.
const INSTANCE_ABOVE_ID = 'instance';

const INSTANCE_LEVEL_ERROR_MESSAGE =
  'Não foi possível mudar o nível de Todos da organização. Tente de novo.';
const INSTANCE_REMOVED_MESSAGE =
  'Todos da organização não têm mais acesso ao documento.';
const INSTANCE_REMOVE_ERROR_MESSAGE =
  'Não foi possível remover o acesso de Todos da organização. Tente de novo.';

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
// row is no longer in the list, and the title still has to show who loses the
// access while the box closes.
type RemovingShare =
  | {
      kind: 'person';
      personId: string;
      personName: string;
      // The share right above (`INSTANCE_ABOVE_ID` for the row of everyone in
      // the organization), or `null` when the owner is right above.
      aboveId: string | null;
    }
  | { kind: 'instance' };

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
  // The select of the row of everyone in the organization, when it is there.
  const instanceSelectRef = useRef<HTMLSelectElement | null>(null);

  const addNotification = useNotifications((state) => state.addNotification);
  // No `onSuccess` of its own here: the name and the row above are the ones
  // of the confirmation that sent the request, passed to `mutate`.
  const removeShareMutation = useRemoveDocumentShare({ documentId });
  const removeInstanceShareMutation = useRemoveDocumentInstanceShare({
    documentId,
  });
  const isRemoving =
    removeShareMutation.isPending || removeInstanceShareMutation.isPending;

  const handleRemoveRequest = (
    entry: DocumentAccessEntry,
    above: DocumentAccessEntry | undefined,
    hasInstanceRow: boolean,
    select: HTMLSelectElement,
  ): void => {
    removeOpenerRef.current = select;
    setRemoveError(null);

    // Right below the owner comes the row of everyone in the organization,
    // when there is one.
    let aboveId: string | null = null;
    if (above && above.level !== 'owner') {
      aboveId = above.personId;
    } else if (hasInstanceRow) {
      aboveId = INSTANCE_ABOVE_ID;
    }

    setRemoving({
      kind: 'person',
      personId: entry.personId,
      personName: entry.name,
      aboveId,
    });
    setIsRemoveOpen(true);
  };

  const handleInstanceRemoveRequest = (select: HTMLSelectElement): void => {
    removeOpenerRef.current = select;
    setRemoveError(null);
    setRemoving({ kind: 'instance' });
    setIsRemoveOpen(true);
  };

  const handleConfirmRemove = (): void => {
    if (isSendingRef.current || !removing) return;
    isSendingRef.current = true;

    // Cleared so a second failure is announced again.
    setRemoveError(null);

    if (removing.kind === 'instance') {
      removeInstanceShareMutation.mutate(
        { documentId },
        {
          // Runs after the list was read again: the row is already gone.
          // The owner is right above it, so the focus goes there.
          onSuccess: () => {
            focusAfterRemoveRef.current = { aboveId: null };
            addNotification({ type: 'success', title: INSTANCE_REMOVED_MESSAGE });
            onAnnounce(INSTANCE_REMOVED_MESSAGE);
            setIsRemoveOpen(false);
          },
          onError: () => {
            addNotification({
              type: 'error',
              title: INSTANCE_REMOVE_ERROR_MESSAGE,
            });
            setRemoveError(INSTANCE_REMOVE_ERROR_MESSAGE);
          },
          onSettled: () => {
            isSendingRef.current = false;
          },
        },
      );
      return;
    }

    const { personId, personName, aboveId } = removing;
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

          const { aboveId } = afterRemove;
          const above =
            aboveId === INSTANCE_ABOVE_ID
              ? instanceSelectRef.current
              : aboveId
                ? levelSelectsRef.current.get(aboveId)
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
      title={
        removing?.kind === 'instance'
          ? 'Remover o acesso de Todos da organização?'
          : `Remover o acesso de ${removing?.personName ?? ''}?`
      }
      description={
        <>
          {removing?.kind === 'instance'
            ? 'Quem só tem acesso pela organização deixa de ver o documento.'
            : 'A pessoa perde o acesso na hora.'}
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
  // What the server says, as it says it: nothing is decided here.
  const instanceLevel = sharesQuery.data.instance.level;

  // No empty state: the row of the owner is always there.
  return (
    <>
      <ul
        aria-label="Quem tem acesso"
        className="mt-2 divide-y divide-gray-200"
      >
        {entries.map((entry, index) =>
          entry.level === 'owner' ? (
            <Fragment key={entry.personId}>
              <AccessListRow entry={entry} ref={ownerRowRef} />
              {instanceLevel === 'none' ? null : (
                <InstanceAccessRow
                  documentId={documentId}
                  level={instanceLevel}
                  selectRef={instanceSelectRef}
                  onAnnounce={onAnnounce}
                  onRemoveRequest={handleInstanceRemoveRequest}
                />
              )}
            </Fragment>
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
                  handleRemoveRequest(
                    entry,
                    entries[index - 1],
                    instanceLevel !== 'none',
                    select,
                  )
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

// Everyone in the organization, right after the owner, with the same layout
// as the row of a person: the name on the left, the level on the right.
function InstanceAccessRow({
  documentId,
  level,
  selectRef,
  onAnnounce,
  onRemoveRequest,
}: {
  documentId: string;
  level: DocumentShareLevel;
  selectRef: React.Ref<HTMLSelectElement>;
  onAnnounce: Announce;
  onRemoveRequest: (select: HTMLSelectElement) => void;
}): React.JSX.Element {
  return (
    <li className={ROW_CLASS_NAME}>
      <span className="flex min-w-0 grow basis-48 flex-col">
        <span className="truncate text-gray-900">{INSTANCE_NAME}</span>
        <span className="break-words text-sm text-gray-600">
          Qualquer pessoa da organização
        </span>
      </span>
      <span className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
        <InstanceLevelControl
          documentId={documentId}
          level={level}
          selectRef={selectRef}
          onAnnounce={onAnnounce}
          onRemoveRequest={onRemoveRequest}
        />
      </span>
    </li>
  );
}

// The select of a level on a row of the list, with "Remover acesso" as the
// last option. Presentation only: whoever renders it owns the mutation.
function LevelSelect({
  name,
  shownLevel,
  isSaving,
  selectRef,
  onLevelChange,
  onRemoveRequest,
}: {
  // Who the level belongs to, for the label read by assistive technology.
  name: string;
  shownLevel: DocumentShareLevel;
  isSaving: boolean;
  selectRef: React.Ref<HTMLSelectElement>;
  onLevelChange: (level: DocumentShareLevel) => void;
  // Opens the confirmation; the select is who gets the focus back.
  onRemoveRequest: (select: HTMLSelectElement) => void;
}): React.JSX.Element {
  const selectId = useId();

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
    onLevelChange(value);
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

// The level of the share of one person. One per row, each with its own
// mutation, so a row being saved never dims the others.
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
  onRemoveRequest: (select: HTMLSelectElement) => void;
}): React.JSX.Element {
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

  // Derived, never copied into state: while sending, the level just chosen;
  // otherwise what the server says.
  const shownLevel: DocumentShareLevel = shareDocumentMutation.isPending
    ? shareDocumentMutation.variables.level
    : level;

  return (
    <LevelSelect
      name={name}
      shownLevel={shownLevel}
      isSaving={shareDocumentMutation.isPending}
      selectRef={selectRef}
      onLevelChange={(value) =>
        shareDocumentMutation.mutate({ documentId, personId, level: value })
      }
      onRemoveRequest={onRemoveRequest}
    />
  );
}

// The level of everyone in the organization, with its own mutation: the same
// PUT that shares with the organization switches the level. No confirmation.
function InstanceLevelControl({
  documentId,
  level,
  selectRef,
  onAnnounce,
  onRemoveRequest,
}: {
  documentId: string;
  level: DocumentShareLevel;
  selectRef: React.Ref<HTMLSelectElement>;
  onAnnounce: Announce;
  onRemoveRequest: (select: HTMLSelectElement) => void;
}): React.JSX.Element {
  const addNotification = useNotifications((state) => state.addNotification);

  const shareInstanceMutation = useShareDocumentWithInstance({
    mutationConfig: {
      // Runs after the list was read again (see
      // `useShareDocumentWithInstance`): the select already shows the new
      // level.
      onSuccess: (_response, variables) => {
        onAnnounce(
          `Nível de ${INSTANCE_NAME} alterado para ${LEVEL_LABELS[variables.level]}.`,
        );
      },
      // Nothing to undo: the value comes back by itself once the mutation is
      // no longer pending.
      onError: () => {
        addNotification({ type: 'error', title: INSTANCE_LEVEL_ERROR_MESSAGE });
        onAnnounce(INSTANCE_LEVEL_ERROR_MESSAGE);
      },
    },
  });

  const shownLevel: DocumentShareLevel = shareInstanceMutation.isPending
    ? shareInstanceMutation.variables.level
    : level;

  return (
    <LevelSelect
      name={INSTANCE_NAME}
      shownLevel={shownLevel}
      isSaving={shareInstanceMutation.isPending}
      selectRef={selectRef}
      onLevelChange={(value) =>
        shareInstanceMutation.mutate({ documentId, level: value })
      }
      onRemoveRequest={onRemoveRequest}
    />
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
