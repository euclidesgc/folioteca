import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import type {
  AssignedPerson,
  useUnitPeople,
} from '@/features/unit-assignments/api/get-unit-people';
import { getUnitPeopleQueryOptions } from '@/features/unit-assignments/api/get-unit-people';
import { useRemoveAssignment } from '@/features/unit-assignments/api/remove-assignment';
import { NotFoundError } from '@/lib/errors';

type UnitPeopleListProps = {
  // The query already resolved by whoever owns the page: the list draws its
  // four states and asks the server nothing of its own.
  query: ReturnType<typeof useUnitPeople>;
};

// The row is really erased here, so the icon is the trash can and nothing
// else — six lines of SVG copied into the file, as `OrgUnitsTree` already does
// with its own icons, since one feature never imports from another.
const TrashIcon = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
  >
    <path d="M4 7h16M10 11v6M14 11v6M9 7V4.5h6V7M6 7l1 13h10l1-13" />
  </svg>
);

// The heading of the section lives here, and not in the route, because it is
// where the focus goes when the last person is removed and the list turns
// empty: the component has no way to focus an element that lives elsewhere.
export function UnitPeopleList({
  query,
}: UnitPeopleListProps): React.JSX.Element {
  // `tabIndex={-1}` and nothing else: the heading takes a programmatic focus
  // without ever entering the `Tab` order.
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <section>
      <h2 ref={headingRef} tabIndex={-1} className="mt-8 text-lg font-semibold">
        Pessoas lotadas
      </h2>
      {/* The live region has to be on screen *before* the first person
          arrives: a region that is inserted already filled is not announced by
          screen readers, and the first assignment is exactly the one leaving
          the empty state. So every state below renders inside this same
          element. */}
      <div aria-live="polite">
        <UnitPeopleStates query={query} headingRef={headingRef} />
      </div>
    </section>
  );
}

function UnitPeopleStates({
  query,
  headingRef,
}: UnitPeopleListProps & {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}): React.JSX.Element {
  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (query.isPending || (query.isError && query.isFetching)) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        Carregando as pessoas lotadas…
      </p>
    );
  }

  if (query.isError) {
    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">
          Não foi possível carregar as pessoas lotadas.
        </p>
        <Button
          variant="destructive"
          type="button"
          className="mt-3"
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const people = query.data.data;

  if (people.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Ninguém está lotado nesta unidade ainda. Use a busca acima para lotar a
        primeira pessoa.
      </p>
    );
  }

  return (
    <LoadedUnitPeopleList
      people={people}
      orgUnit={query.data.orgUnit}
      headingRef={headingRef}
    />
  );
}

// Mounts only with data: it is the one that holds the state of a removal, and
// the unit name of the confirmation comes from the same envelope as the
// people, so the route passes nothing extra.
function LoadedUnitPeopleList({
  people,
  orgUnit,
  headingRef,
}: {
  people: AssignedPerson[];
  orgUnit: { id: string; name: string };
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}): React.JSX.Element {
  // A copy of what the dialog needs, not a reference to the row: after the
  // success the person is no longer in the list, and the description still has
  // to show the name while the box closes. `isRemoveOpen` is separate from it
  // because the closing is animated.
  const [removing, setRemoving] = useState<{
    personId: string;
    personName: string;
    neighbourId: string | null;
  } | null>(null);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  // Who opened the confirmation, to give the focus back on cancel, on Escape
  // and after a refusal; and, once the request succeeded, where the focus goes
  // instead. Both are read inside `onCloseAutoFocus`, which runs after a
  // render: refs, never state.
  const removeOpenerRef = useRef<HTMLElement | null>(null);
  const focusAfterRemoveRef = useRef<{ neighbourId: string | null } | null>(
    null,
  );
  // Read before the request goes out: once it succeeds the person is no longer
  // in the list to be asked about.
  const removedNameRef = useRef<string | null>(null);
  const neighbourOfRemovedRef = useRef<string | null>(null);
  // The remove button of each row, reached by id when the focus has to land on
  // a row that is not the one that was acted upon.
  const removeButtonsRef = useRef(new Map<string, HTMLButtonElement>());

  const addNotification = useNotifications((state) => state.addNotification);
  const queryClient = useQueryClient();

  const removeAssignmentMutation = useRemoveAssignment({
    orgUnitId: orgUnit.id,
    mutationConfig: {
      onSuccess: () => {
        focusAfterRemoveRef.current = {
          neighbourId: neighbourOfRemovedRef.current,
        };
        addNotification({
          type: 'success',
          title: 'Pessoa removida',
          message: `${removedNameRef.current} saiu de ${orgUnit.name}.`,
        });
        setIsRemoveOpen(false);
      },
      // Only the success and the 404 close the confirmation: a 404 means the
      // person is not assigned here any more, so the wanted result already
      // holds and there is nothing left to confirm. Any other failure keeps
      // the box open, with the notification from the HTTP client interceptor
      // explaining why.
      onError: (error) => {
        if (!(error instanceof NotFoundError)) {
          // `silentError` keeps the interceptor quiet for the 404 of this
          // route, and that silence would cover every other failure too: the
          // box stays open, so the explanation is given here instead of
          // leaving the screen without an answer. Same title and same generic
          // message the interceptor would have shown.
          addNotification({
            type: 'error',
            title: 'Algo deu errado',
            message:
              'Não foi possível concluir a operação. Tente novamente em instantes.',
          });
          return;
        }

        // The row is gone from the reloaded list just like after a success, so
        // the focus follows the same rule: without this the box would try to
        // give it back to a button that no longer exists and it would land on
        // the body.
        focusAfterRemoveRef.current = {
          neighbourId: neighbourOfRemovedRef.current,
        };
        setIsRemoveOpen(false);
        // Neutral on purpose: the message of the server is about a person who
        // was not found, which here would accuse whoever clicked of a mistake
        // that did not happen.
        addNotification({
          type: 'info',
          title: 'Lista atualizada',
          message:
            'A lista foi atualizada: essa pessoa já não estava lotada nesta unidade.',
        });
        // The screen is still showing a row the server does not have any
        // more: the same reload the success gets, asked for by hand.
        void queryClient.invalidateQueries({
          queryKey: getUnitPeopleQueryOptions(orgUnit.id).queryKey,
        });
      },
    },
  });

  const handleConfirmRemove = (): void => {
    // A second click, or a second Enter, can arrive before the button
    // re-renders as disabled.
    if (removeAssignmentMutation.isPending) return;
    if (!removing) return;

    removedNameRef.current = removing.personName;
    neighbourOfRemovedRef.current = removing.neighbourId;
    removeAssignmentMutation.mutate({
      orgUnitId: orgUnit.id,
      personId: removing.personId,
    });
  };

  // The row that keeps the focus once this one is gone, chosen over the list
  // that is on screen now: the one right above, or the one that becomes the
  // first when the first is the one leaving. Null means the list is about to
  // be empty, and the focus belongs to the heading.
  const neighbourOf = (index: number): string | null => {
    if (index > 0) return people[index - 1]?.id ?? null;
    return people[1]?.id ?? null;
  };

  return (
    <>
      {/* The order on screen is exactly the one the server sent — the pt-BR
          collator runs there, and nothing is reordered here. */}
      <ul aria-label="Pessoas lotadas" className="mt-6 divide-y divide-gray-200">
        {people.map((person, index) => (
          <li
            key={person.id}
            className="flex flex-wrap items-center justify-between gap-4 py-3"
          >
            <span
              className="min-w-0 flex-1 truncate text-gray-900"
              title={person.name}
            >
              {person.name}
            </span>
            {/* An address has no space to break on its own: it wraps, never
                truncates. */}
            <span className="min-w-0 break-words text-sm text-gray-600">
              {person.email}
            </span>
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button
                ref={(node) => {
                  if (node) {
                    removeButtonsRef.current.set(person.id, node);
                  } else {
                    removeButtonsRef.current.delete(person.id);
                  }
                }}
                variant="ghost"
                size="icon"
                type="button"
                aria-label={`Remover ${person.name} desta unidade`}
                title={`Remover ${person.name} desta unidade`}
                onClick={(event) => {
                  removeOpenerRef.current = event.currentTarget;
                  setRemoving({
                    personId: person.id,
                    personName: person.name,
                    neighbourId: neighbourOf(index),
                  });
                  setIsRemoveOpen(true);
                }}
              >
                <TrashIcon />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* One confirmation for the whole list, and without a trigger of its
          own: the row that opened it disappears when the reloaded list arrives
          without the person. */}
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

            const neighbour = afterRemove.neighbourId
              ? removeButtonsRef.current.get(afterRemove.neighbourId)
              : undefined;
            // No row left — or the neighbour left too, in another tab: the
            // heading of the section takes the focus.
            if (neighbour?.isConnected) {
              neighbour.focus();
              return;
            }

            headingRef.current?.focus();
            return;
          }

          // Cancel, Escape, or a refusal followed by cancel: back to the
          // button that opened the confirmation, while it is still there.
          const opener = removeOpenerRef.current;
          if (opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        title="Remover da unidade?"
        description={
          <>
            {removing?.personName} sai de “{orgUnit.name}”. A pessoa continua na
            instância e continua lotada nas outras unidades em que estiver; nada
            além desta lotação é apagado. Para voltar atrás, basta lotar de novo
            pela busca acima.
          </>
        }
        confirmButton={
          <Button
            variant="destructive"
            type="button"
            isLoading={removeAssignmentMutation.isPending}
            onClick={handleConfirmRemove}
          >
            {removeAssignmentMutation.isPending ? 'Removendo…' : 'Remover'}
          </Button>
        }
      />
    </>
  );
}
