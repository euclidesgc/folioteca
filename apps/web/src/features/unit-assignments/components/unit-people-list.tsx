import type React from 'react';

import { Button } from '@/components/ui/button/button';
import type { useUnitPeople } from '@/features/unit-assignments/api/get-unit-people';

type UnitPeopleListProps = {
  // The query already resolved by whoever owns the page: the list draws its
  // four states and asks the server nothing of its own.
  query: ReturnType<typeof useUnitPeople>;
};

export function UnitPeopleList({ query }: UnitPeopleListProps): React.JSX.Element {
  // The live region has to be on screen *before* the first person arrives:
  // a region that is inserted already filled is not announced by screen
  // readers, and the first assignment is exactly the one leaving the empty
  // state. So every state below renders inside this same element.
  return (
    <div aria-live="polite">
      <UnitPeopleStates query={query} />
    </div>
  );
}

function UnitPeopleStates({
  query,
}: UnitPeopleListProps): React.JSX.Element {
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

  // The order on screen is exactly the one the server sent — the pt-BR
  // collator runs there, and nothing is reordered here.
  return (
    <ul
      aria-label="Pessoas lotadas"
      className="mt-6 divide-y divide-gray-200"
    >
      {people.map((person) => (
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
        </li>
      ))}
    </ul>
  );
}
