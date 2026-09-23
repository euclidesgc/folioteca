import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import type { Invitation } from '@/features/invitations/api/get-invitations';
import {
  getInvitationsQueryOptions,
  useInvitations,
} from '@/features/invitations/api/get-invitations';
import { useRevokeInvitation } from '@/features/invitations/api/revoke-invitation';
import { NotFoundError } from '@/lib/errors';
import { formatDateTime } from '@/utils/format-date-time';

// A circle with a diagonal bar: the invitation is invalidated, not erased.
// Never the trash can, which in this app means "deleted for good" — six lines
// of SVG copied here, as `OrgUnitsTree` already does with its own icons, since
// one feature never imports from another.
const BanIcon = (): React.JSX.Element => (
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
    <circle cx="12" cy="12" r="8.25" />
    <path d="M6.2 17.8 17.8 6.2" />
  </svg>
);

// Mounts only with data. Every row here is pending by definition, so there is
// no status badge, and no link of any kind: the shape of the contract has no
// secret in it, and the page shows a link a single time, when it is created.
function LoadedInvitationsList({
  invitations,
  headingRef,
}: {
  invitations: Invitation[];
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}): React.JSX.Element {
  // A copy of what the dialog needs, not a reference to the row: after the
  // success the invitation is no longer in the list, and the description still
  // has to show the e-mail while the box closes. `isRevokeOpen` is separate
  // from it because the closing is animated.
  const [revoking, setRevoking] = useState<{
    id: string;
    email: string;
    neighbourId: string | null;
  } | null>(null);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  // Who opened the confirmation, to give the focus back on cancel, on Escape
  // and after a refusal; and, once the request succeeded, where the focus
  // goes instead. Both are read inside `onCloseAutoFocus`, which runs after a
  // render: refs, never state.
  const revokeOpenerRef = useRef<HTMLElement | null>(null);
  const focusAfterRevokeRef = useRef<{ neighbourId: string | null } | null>(
    null,
  );
  // Read before the request goes out: once it succeeds the invitation is no
  // longer in the list to be asked about.
  const revokedEmailRef = useRef<string | null>(null);
  const neighbourOfRevokedRef = useRef<string | null>(null);
  // The revoke button of each row, reached by id when the focus has to land
  // on a row that is not the one that was acted upon.
  const revokeButtonsRef = useRef(new Map<string, HTMLButtonElement>());

  const addNotification = useNotifications((state) => state.addNotification);
  const queryClient = useQueryClient();

  const revokeInvitationMutation = useRevokeInvitation({
    mutationConfig: {
      onSuccess: () => {
        focusAfterRevokeRef.current = {
          neighbourId: neighbourOfRevokedRef.current,
        };
        addNotification({
          type: 'success',
          title: 'Convite revogado',
          message: `O convite de ${revokedEmailRef.current} não vale mais.`,
        });
        setIsRevokeOpen(false);
      },
      // Only the success and the 404 close the confirmation: the invitation
      // of a 404 is not pending any more, so there is nothing left to confirm
      // and the list is reloaded. Any other failure keeps the box open, with
      // the notification from the HTTP client interceptor explaining why —
      // and no text of this screen ever says a revoke was the reason.
      onError: (error) => {
        if (!(error instanceof NotFoundError)) return;

        // The row is gone from the reloaded list just like after a success, so
        // the focus follows the same rule: without this the box would try to
        // give it back to a button that no longer exists and it would land on
        // the body.
        focusAfterRevokeRef.current = {
          neighbourId: neighbourOfRevokedRef.current,
        };
        setIsRevokeOpen(false);
        void queryClient.invalidateQueries({
          queryKey: getInvitationsQueryOptions().queryKey,
        });
      },
    },
  });

  const handleConfirmRevoke = (): void => {
    // A second click, or a second Enter, can arrive before the button
    // re-renders as disabled.
    if (revokeInvitationMutation.isPending) return;
    if (!revoking) return;

    revokedEmailRef.current = revoking.email;
    neighbourOfRevokedRef.current = revoking.neighbourId;
    revokeInvitationMutation.mutate({ invitationId: revoking.id });
  };

  // The row that keeps the focus once this one is gone, chosen over the list
  // that is on screen now: the one right above, or the one that becomes the
  // first when the first is the one leaving. Null means the list is about to
  // be empty, and the focus belongs to the heading.
  const neighbourOf = (index: number): string | null => {
    if (index > 0) return invitations[index - 1]?.id ?? null;
    return invitations[1]?.id ?? null;
  };

  return (
    <>
      <ul
        aria-label="Convites pendentes"
        className="mt-6 divide-y divide-gray-200"
      >
        {invitations.map((invitation, index) => (
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
            <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
              <Button
                ref={(node) => {
                  if (node) {
                    revokeButtonsRef.current.set(invitation.id, node);
                  } else {
                    revokeButtonsRef.current.delete(invitation.id);
                  }
                }}
                variant="ghost"
                size="icon"
                type="button"
                aria-label={`Revogar ${invitation.email}`}
                title={`Revogar ${invitation.email}`}
                onClick={(event) => {
                  revokeOpenerRef.current = event.currentTarget;
                  setRevoking({
                    id: invitation.id,
                    email: invitation.email,
                    neighbourId: neighbourOf(index),
                  });
                  setIsRevokeOpen(true);
                }}
              >
                <BanIcon />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* One confirmation for the whole list, and without a trigger of its
          own: the row that opened it disappears when the reloaded list
          arrives without the invitation. */}
      <ConfirmationDialog
        open={isRevokeOpen}
        onOpenChange={(open) => {
          if (!open) setIsRevokeOpen(false);
        }}
        onCloseAutoFocus={(event) => {
          const afterRevoke = focusAfterRevokeRef.current;
          if (afterRevoke) {
            focusAfterRevokeRef.current = null;
            event.preventDefault();

            const neighbour = afterRevoke.neighbourId
              ? revokeButtonsRef.current.get(afterRevoke.neighbourId)
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
          const opener = revokeOpenerRef.current;
          if (opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        title="Revogar convite?"
        description={
          <>
            O convite de “{revoking?.email}” deixa de valer agora, e o link
            enviado para de funcionar. Não é possível desfazer nem reenviar:
            para este e-mail voltar a ter um convite válido, convide de novo no
            formulário acima, o que gera um link novo.
          </>
        }
        confirmButton={
          <Button
            variant="destructive"
            type="button"
            isLoading={revokeInvitationMutation.isPending}
            onClick={handleConfirmRevoke}
          >
            {revokeInvitationMutation.isPending ? 'Revogando…' : 'Revogar'}
          </Button>
        }
      />
    </>
  );
}

// The heading of the section lives here, and not in the route, because it is
// where the focus goes when the last invitation is revoked and the list turns
// empty: the component has no way to focus an element that lives elsewhere.
export function InvitationsList(): React.JSX.Element {
  const invitationsQuery = useInvitations();
  // `tabIndex={-1}` and nothing else: the heading takes a programmatic focus
  // without ever entering the `Tab` order.
  const headingRef = useRef<HTMLHeadingElement>(null);

  const body = (): React.JSX.Element => {
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

    // The order on screen is exactly the one the API sent: nothing is
    // reordered.
    return (
      <LoadedInvitationsList
        invitations={invitations}
        headingRef={headingRef}
      />
    );
  };

  return (
    <section>
      <h2 ref={headingRef} tabIndex={-1} className="mt-8 text-lg font-semibold">
        Convites pendentes
      </h2>
      <p className="mt-2 text-gray-600">
        O link de cada convite aparece uma única vez, quando ele é criado, e não
        pode ser mostrado de novo. Para gerar um link novo, convide o mesmo
        e-mail outra vez.
      </p>
      {body()}
    </section>
  );
}
