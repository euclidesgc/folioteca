import type React from 'react';

import { Button } from '@/components/ui/button/button';
import type { Invitation } from '@/features/invitations/api/get-invitations';
import { useInvitations } from '@/features/invitations/api/get-invitations';
import { formatDateTime } from '@/utils/format-date-time';

// Mounts only with data. Every row here is pending by definition, so there is
// no status badge, and no link of any kind: the shape of the contract has no
// secret in it, and the page shows a link a single time, when it is created.
function LoadedInvitationsList({
  invitations,
}: {
  invitations: Invitation[];
}): React.JSX.Element {
  return (
    <ul
      aria-label="Convites pendentes"
      className="mt-6 divide-y divide-gray-200"
    >
      {invitations.map((invitation) => (
        <li
          key={invitation.id}
          className="flex flex-wrap items-center justify-between gap-4 py-3"
        >
          {/* An address has no space to break on its own, and it is the only
              thing that tells one row from another: it wraps, never truncates. */}
          <span className="min-w-0 break-words text-gray-900">
            {invitation.email}
          </span>
          <dl className="flex shrink-0 flex-wrap gap-x-4 gap-y-1">
            <div>
              <dt className="text-xs text-gray-600">Criado em</dt>
              <dd>
                <time
                  dateTime={invitation.createdAt}
                  className="shrink-0 text-sm text-gray-600"
                >
                  {formatDateTime(invitation.createdAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-600">Expira em</dt>
              <dd>
                <time
                  dateTime={invitation.expiresAt}
                  className="shrink-0 text-sm text-gray-600"
                >
                  {formatDateTime(invitation.expiresAt)}
                </time>
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

export function InvitationsList(): React.JSX.Element {
  const invitationsQuery = useInvitations();

  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (
    invitationsQuery.isPending ||
    (invitationsQuery.isError && invitationsQuery.isFetching)
  ) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        Carregando convites…
      </p>
    );
  }

  // A 403 with the tab open lands here too: the person was demoted while the
  // page was open.
  if (invitationsQuery.isError) {
    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">
          Não foi possível carregar os convites.
        </p>
        <Button
          variant="destructive"
          type="button"
          className="mt-3"
          onClick={() => void invitationsQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const invitations = invitationsQuery.data.data;

  if (invitations.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        Nenhum convite pendente.
      </p>
    );
  }

  // The order on screen is exactly the one the API sent: nothing is reordered.
  return <LoadedInvitationsList invitations={invitations} />;
}
