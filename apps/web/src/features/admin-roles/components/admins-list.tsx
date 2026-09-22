import type React from 'react';

import { Button } from '@/components/ui/button/button';
import type {
  AdminPerson,
  useAdmins,
} from '@/features/admin-roles/api/get-admins';
import { useUser } from '@/lib/auth';

type AdminsListProps = {
  // The query already resolved by whoever owns the page: the list draws its
  // four states and asks the server nothing of its own.
  query: ReturnType<typeof useAdmins>;
};

// No heading here: the `<h1>` of the route is already "Administradores", and a
// subtitle with the same name would be an echo for whoever uses a screen
// reader. Nothing on this screen writes: no button of action, no confirmation
// and no mutation — the only focusable element is the retry of the error.
export function AdminsList({ query }: AdminsListProps): React.JSX.Element {
  // The live region has to be on screen *before* the first answer arrives: a
  // region inserted already filled is not announced by screen readers. So
  // every state below renders inside this same element.
  return (
    <div aria-live="polite">
      <AdminsStates query={query} />
    </div>
  );
}

function AdminsStates({ query }: AdminsListProps): React.JSX.Element {
  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (query.isPending || (query.isError && query.isFetching)) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        Carregando administradores…
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
          Não foi possível carregar os administradores.
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

  const admins = query.data.data;

  // It cannot happen through the app, but the API answers an empty list if
  // someone clears `isAdmin` in the database: then the screen says what
  // happened and where the way out is, instead of showing an empty list with
  // no explanation.
  if (admins.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Ninguém administra esta instância. Isso não deveria acontecer: para
        voltar a ter uma administração, é preciso marcar alguém direto no banco
        de dados.
      </p>
    );
  }

  return <LoadedAdminsList admins={admins} />;
}

function LoadedAdminsList({
  admins,
}: {
  admins: AdminPerson[];
}): React.JSX.Element {
  // Read here, and not passed by the route: `useUser` is shared infrastructure
  // of `lib/`, and the route is already inside `Authorization`, which only
  // mounts with the user loaded. The comparison is by `id`, never by e-mail or
  // name.
  const sessionPersonId = useUser().data?.person.id;

  return (
    <>
      {/* The count is derived from the list itself: the body has no `count`,
          and two sources for the same number could disagree. */}
      <p className="mt-6 text-gray-600">
        {admins.length === 1
          ? 'Só uma pessoa administra esta instância.'
          : `${admins.length} pessoas administram esta instância.`}
      </p>

      {/* The order on screen is exactly the one the server sent — the pt-BR
          collator runs there, and nothing is reordered here. */}
      <ul aria-label="Administradores" className="mt-6 divide-y divide-gray-200">
        {admins.map((person) => (
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
            {/* Only on the row of whoever is using the app, and rendered with
                the row: an empty block here would take a whole line of its own
                at 360px. */}
            {person.id === sessionPersonId ? (
              <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                {/* The word itself, never colour or icon alone. */}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
                  você
                </span>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
