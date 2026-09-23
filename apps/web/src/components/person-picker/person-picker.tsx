import type React from 'react';
import type { ReactNode, Ref } from 'react';
import { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import {
  PERSON_LOOKUP_MIN_LENGTH,
  type PersonSummary,
  usePersonLookup,
} from '@/hooks/use-person-lookup';

// The debounce lives here, in the component that owns the field, and never in
// the API layer, which must have no hidden timer.
const SEARCH_DEBOUNCE_MS = 300;

export type PersonPickerHandle = {
  // Clears the search and puts the focus back on the field, for the consumer
  // to call once its action on the chosen person is done.
  reset: () => void;
};

type PersonPickerProps = {
  selected: PersonSummary | null;
  onSelect: (person: PersonSummary) => void;
  onClear: () => void;
  ref?: Ref<PersonPickerHandle>;
  // Beside the name of the chosen person (a badge, for instance).
  selectedAside?: ReactNode;
  // After "Trocar pessoa", on the same row of buttons.
  selectedActions?: ReactNode;
  // Between the header of the chosen person and the row of buttons.
  children?: ReactNode;
};

// Search and choice of a person. The consumer owns `selected`; the picker owns
// the term and its debounce. Rendered without a wrapper: the consumer gives
// the container, so the markup stays the same wherever it goes.
export function PersonPicker({
  selected,
  onSelect,
  onClear,
  ref,
  selectedAside,
  selectedActions,
  children,
}: PersonPickerProps): React.JSX.Element {
  const [term, setTerm] = useState('');
  const [deferredTerm, setDeferredTerm] = useState('');

  const fieldRef = useRef<HTMLInputElement>(null);

  const fieldId = useId();
  const hintId = useId();

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        setTerm('');
        setDeferredTerm('');
        fieldRef.current?.focus();
      },
    }),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDeferredTerm(term);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [term]);

  const lookupQuery = usePersonLookup(deferredTerm);

  // The term stays: going back shows the same results.
  const handleChangePerson = (): void => {
    onClear();
    fieldRef.current?.focus();
  };

  const hasEnoughLetters = term.trim().length >= PERSON_LOOKUP_MIN_LENGTH;
  // Still waiting for the answer of the term in the field: either the
  // debounce has not fired yet or the request is on its way.
  const isSearching =
    hasEnoughLetters && (deferredTerm !== term || lookupQuery.isFetching);
  const results = lookupQuery.data;

  const renderResults = (): React.JSX.Element => {
    if (!hasEnoughLetters) {
      return (
        <p className="mt-4 text-sm text-gray-600">
          Digite pelo menos 2 letras para buscar.
        </p>
      );
    }

    if (lookupQuery.isError && !isSearching) {
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
            onClick={() => void lookupQuery.refetch()}
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
                onClick={() => onSelect(person)}
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
    <>
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
            {selectedAside}
          </div>
          {children}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={handleChangePerson}>
              Trocar pessoa
            </Button>
            {selectedActions}
          </div>
        </div>
      ) : (
        renderResults()
      )}
    </>
  );
}
