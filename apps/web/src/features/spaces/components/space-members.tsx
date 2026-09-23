import type React from 'react';
import { useId } from 'react';

import { Button } from '@/components/ui/button/button';
import { useSpaceMembers } from '@/features/spaces/api/get-space-members';

type SpaceMembersProps = {
  spaceId: string;
};

// Who is assigned directly to the unit of a space. Read only: the row has no
// action, assignments are managed in the administration.
export function SpaceMembers({
  spaceId,
}: SpaceMembersProps): React.JSX.Element {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mt-8 text-lg font-semibold">
        Pessoas nesta unidade
      </h2>
      {/* Every state renders inside this same region, already on screen, so
          the arrival of the list (or of the empty text) is announced. */}
      <div aria-live="polite">
        <SpaceMembersStates spaceId={spaceId} />
      </div>
    </section>
  );
}

function SpaceMembersStates({
  spaceId,
}: SpaceMembersProps): React.JSX.Element {
  const query = useSpaceMembers({ spaceId });

  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (query.isPending || (query.isError && query.isFetching)) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        Carregando as pessoas desta unidade…
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
          Não foi possível carregar as pessoas desta unidade.
        </p>
        <Button
          variant="secondary"
          type="button"
          className="mt-3"
          onClick={() => void query.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const members = query.data.data;

  if (members.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Ninguém está lotado diretamente nesta unidade.
      </p>
    );
  }

  // The order on screen is exactly the one the server sent: whoever asks
  // first, then the pt-BR collator. Nothing is reordered here.
  return (
    <ul
      aria-label="Pessoas nesta unidade"
      className="mt-6 divide-y divide-gray-200"
    >
      {members.map((member) => (
        <li
          key={member.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="min-w-0 truncate text-gray-900" title={member.name}>
              {member.name}
            </span>
            {member.isCurrentPerson ? (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
                você
              </span>
            ) : null}
          </span>
          {/* An address has no space to break on its own: it wraps, never
              truncates. */}
          <span className="min-w-0 break-words text-sm text-gray-600">
            {member.email}
          </span>
        </li>
      ))}
    </ul>
  );
}
