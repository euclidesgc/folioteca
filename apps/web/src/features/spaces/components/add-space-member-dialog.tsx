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
import { useAddSpaceMember } from '@/features/spaces/api/add-space-member';
import type { PersonSummary } from '@/hooks/use-person-lookup';

const GENERIC_ADD_ERROR =
  'Não foi possível adicionar a pessoa. Tente de novo.';

// The server message when it explains the refusal (400, 403), otherwise the
// generic one: a 404 (the space is gone), a 5xx or a network failure has
// nothing useful to show.
const getAddMemberErrorMessage = (error: unknown): string => {
  if (!isAxiosError(error)) return GENERIC_ADD_ERROR;

  const status = error.response?.status;
  if (status !== 400 && status !== 403) return GENERIC_ADD_ERROR;

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

  return GENERIC_ADD_ERROR;
};

type AddSpaceMemberDialogProps = {
  spaceId: string;
  spaceName: string;
  // Hidden from the search: nobody adds the owner to their own space. Unknown
  // while the people of the space load, when nothing is hidden and the server
  // still refuses the owner.
  ownerId?: string;
};

// The trigger and the box. The box opens by state, and the `Dialog` gives the
// focus back to the trigger when it closes, by "Fechar", `Esc` or a click
// outside.
export function AddSpaceMemberDialog({
  spaceId,
  spaceName,
  ownerId,
}: AddSpaceMemberDialogProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsOpen(true)}
      >
        Adicionar pessoa
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogTitle>Adicionar pessoa ao espaço</DialogTitle>
          <DialogDescription>
            Quem você escolher verá “{spaceName}” na barra lateral.
          </DialogDescription>

          {/* Only mounted while the box is open: reopening starts clean. */}
          <AddMemberPanel spaceId={spaceId} ownerId={ownerId} />

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Fechar
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddMemberPanel({
  spaceId,
  ownerId,
}: {
  spaceId: string;
  ownerId?: string;
}): React.JSX.Element {
  const [selected, setSelected] = useState<PersonSummary | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const pickerRef = useRef<PersonPickerHandle>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // `isPending` only turns true on the next render: two clicks in the same
  // batch of events would both get through. The ref closes in the instant.
  const isAddingRef = useRef(false);

  // The "Selecionar" button that was clicked disappears with the list: the
  // focus goes to the action that comes next.
  useEffect(() => {
    if (selected) addButtonRef.current?.focus();
  }, [selected]);

  const addSpaceMemberMutation = useAddSpaceMember({
    mutationConfig: {
      onSettled: () => {
        isAddingRef.current = false;
      },
      onSuccess: (response) => {
        // The name comes from the answer, never from the row of the search.
        setSuccessMessage(
          `${response.data.name} agora é membro deste espaço.`,
        );
        setSelected(null);
        pickerRef.current?.reset();
      },
      // The chosen person stays, so trying again needs no new search.
      onError: (error) => {
        setAddError(getAddMemberErrorMessage(error));
      },
    },
  });

  const isAdding = addSpaceMemberMutation.isPending;

  const handleAdd = (): void => {
    if (isAddingRef.current || !selected) return;
    isAddingRef.current = true;

    setAddError(null);
    setSuccessMessage('');
    addSpaceMemberMutation.mutate({ spaceId, personId: selected.id });
  };

  const handleSelect = (person: PersonSummary): void => {
    setAddError(null);
    setSuccessMessage('');
    setSelected(person);
  };

  // The picker puts the focus back on the field.
  const handleClear = (): void => {
    setAddError(null);
    setSelected(null);
  };

  return (
    <div className="mt-4">
      <PersonPicker
        ref={pickerRef}
        selected={selected}
        onSelect={handleSelect}
        onClear={handleClear}
        hiddenIds={ownerId ? [ownerId] : []}
        selectedAside={
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
            Membro
          </span>
        }
        selectedActions={
          // Never the native `disabled`: the button keeps the focus while the
          // request is on its way.
          <Button
            ref={addButtonRef}
            type="button"
            variant="primary"
            aria-disabled={isAdding ? 'true' : undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={handleAdd}
          >
            {isAdding ? 'Adicionando…' : 'Adicionar'}
          </Button>
        }
      >
        <p className="mt-2 text-sm text-gray-600">
          Esta pessoa verá o espaço na barra lateral.
        </p>
      </PersonPicker>

      <p
        aria-live="polite"
        className="mt-4 text-sm break-words text-green-800 empty:mt-0"
      >
        {successMessage}
      </p>

      {addError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm break-words text-red-800"
        >
          {addError}
        </p>
      ) : null}
    </div>
  );
}
