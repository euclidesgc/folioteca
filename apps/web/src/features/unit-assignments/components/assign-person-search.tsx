import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import {
  isAssignmentRefusedError,
  useAssignPerson,
} from '@/features/unit-assignments/api/assign-person';
import type { AssignedPerson } from '@/features/unit-assignments/api/get-unit-people';
import { getUnitPeopleQueryOptions } from '@/features/unit-assignments/api/get-unit-people';
import type { PersonSummary } from '@/features/unit-assignments/api/search-people';
import { usePeopleSearch } from '@/features/unit-assignments/api/search-people';

// The debounce lives here, in the component that owns the field, and never in
// the API layer, which must have no hidden timer.
const SEARCH_DEBOUNCE_MS = 250;

type AssignPersonSearchProps = {
  orgUnitId: string;
  orgUnitName: string;
  // Who is already assigned, straight from the list that is on the screen: the
  // marking costs no request of its own.
  assignedPeople: AssignedPerson[];
};

// Not a `combobox`: a field plus a list of buttons. The action here writes,
// it does not pick a text into the field — so there is no listbox keyboard to
// get wrong, and `Tab` walks the results from the first line.
export function AssignPersonSearch({
  orgUnitId,
  orgUnitName,
  assignedPeople,
}: AssignPersonSearchProps): React.JSX.Element {
  const [term, setTerm] = useState('');
  const [deferredTerm, setDeferredTerm] = useState('');
  // The person the request is about, to show "Lotando…" on their row only.
  const [assigningId, setAssigningId] = useState<string | null>(null);
  // The message the server sent when it refused: never a copy of it written
  // here.
  const [refusal, setRefusal] = useState<string | null>(null);

  // `ref` as a plain prop: the focus goes back to the field after a success.
  const fieldRef = useRef<HTMLInputElement>(null);
  // `isPending` only turns true on the next render: two `Enter` in the same
  // batch of events would both get through. The ref closes in the instant.
  const isAssigningRef = useRef(false);

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

  const queryClient = useQueryClient();
  const addNotification = useNotifications((state) => state.addNotification);
  const searchQuery = usePeopleSearch({ term: deferredTerm });
  const assignPersonMutation = useAssignPerson({ orgUnitId });

  const assignedIds = new Set(assignedPeople.map((person) => person.id));

  const hasTerm = term.trim().length > 0;
  // Still waiting for the answer of the term that is in the field: either the
  // debounce has not fired yet or the request is on its way.
  const isSearching =
    hasTerm && (deferredTerm !== term || searchQuery.isFetching);
  const results = searchQuery.data;

  const countText = (): string => {
    if (isSearching || !results) return 'Buscando…';
    if (results.data.length === 0) return 'Ninguém encontrado com esse termo.';
    if (results.data.length === 1) return '1 resultado.';
    return `${results.data.length} resultados.`;
  };

  const handleAssign = (person: PersonSummary): void => {
    // A second click, or a second Enter, sends a single request.
    if (isAssigningRef.current) return;
    isAssigningRef.current = true;

    setRefusal(null);
    setAssigningId(person.id);

    assignPersonMutation.mutate(
      { orgUnitId, personId: person.id },
      {
        onSettled: () => {
          isAssigningRef.current = false;
          setAssigningId(null);
        },
        onSuccess: (response) => {
          // The invalidation is awaited by the hook: the person is already in
          // the list when the field is cleared, refocused and the notification
          // shows up.
          setTerm('');
          setDeferredTerm('');
          fieldRef.current?.focus();
          addNotification({
            type: 'success',
            title: 'Pessoa lotada',
            message: `${response.data.name} agora está lotado em ${orgUnitName}.`,
          });
        },
        onError: (error) => {
          // The 409 and the 404 of the person both mean "the screen is stale":
          // the server's own message is shown next to the field, and what is
          // stale is read again.
          if (!isAssignmentRefusedError(error)) return;

          setRefusal(error.message);
          if (error.kind === 'already-assigned') {
            void queryClient.invalidateQueries({
              queryKey: getUnitPeopleQueryOptions(orgUnitId).queryKey,
            });
            return;
          }

          void searchQuery.refetch();
        },
      },
    );
  };

  return (
    <div className="mt-6">
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-900"
      >
        Buscar pessoa por nome ou e-mail
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
        Digite ao menos uma letra. São mostrados até 10 resultados.
      </p>

      {refusal ? (
        <p
          role="alert"
          className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {refusal}
        </p>
      ) : null}

      {/* With the field empty there is nothing under it. */}
      {hasTerm ? (
        searchQuery.isError ? (
          <div
            role="alert"
            className="mt-2 rounded-md border border-red-200 bg-red-50 p-4"
          >
            <p className="text-red-800">Não foi possível buscar pessoas.</p>
            <Button
              variant="destructive"
              type="button"
              className="mt-3"
              onClick={() => void searchQuery.refetch()}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <p role="status" className="mt-2 text-sm text-gray-600">
              {countText()}
            </p>

            {results && results.data.length > 0 ? (
              <ul
                aria-label="Resultados da busca"
                className="mt-2 divide-y divide-gray-200"
              >
                {results.data.map((person) => (
                  <li
                    key={person.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span
                        className="block min-w-0 truncate text-gray-900"
                        title={person.name}
                      >
                        {person.name}
                      </span>
                      <span className="block break-words text-sm text-gray-600">
                        {person.email}
                      </span>
                    </div>
                    <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                      {assignedIds.has(person.id) ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
                          Já lotado
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          type="button"
                          aria-label={`Lotar ${person.name}`}
                          isLoading={assigningId === person.id}
                          onClick={() => handleAssign(person)}
                        >
                          {assigningId === person.id ? 'Lotando…' : 'Lotar'}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {results?.hasMore && !isSearching ? (
              <p className="mt-2 text-sm text-gray-600">
                Há mais resultados do que os 10 mostrados. Refine a busca.
              </p>
            ) : null}
          </>
        )
      ) : null}
    </div>
  );
}
