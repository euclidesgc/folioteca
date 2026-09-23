import type React from 'react';
import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import {
  type SpaceMember,
  useSpaceMembers,
} from '@/features/spaces/api/get-space-members';
import { useRemoveSpaceMember } from '@/features/spaces/api/remove-space-member';

type SpaceType = 'unit' | 'free';

// The texts of the section, by the type of the space. A free space always has
// its owner in the list, so it has no empty text.
const MEMBERS_TEXTS = {
  unit: {
    heading: 'Pessoas nesta unidade',
    loading: 'Carregando as pessoas desta unidade…',
    error: 'Não foi possível carregar as pessoas desta unidade.',
    retry: 'Tentar novamente',
    empty: 'Ninguém está lotado diretamente nesta unidade.',
  },
  free: {
    heading: 'Pessoas neste espaço',
    loading: 'Carregando as pessoas deste espaço…',
    error: 'Não foi possível carregar as pessoas deste espaço.',
    retry: 'Tentar de novo',
    empty: null,
  },
} satisfies Record<
  SpaceType,
  {
    heading: string;
    loading: string;
    error: string;
    retry: string;
    empty: string | null;
  }
>;

const ROW_CLASS_NAME = 'flex items-center justify-between gap-4 py-3';

const BADGE_CLASS_NAME =
  'shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700';

type SpaceMembersProps = {
  spaceId: string;
  spaceType: SpaceType;
  // Only the owner of a free space removes people from it.
  canRemove: boolean;
};

// The people of a space. A unit space: who is assigned directly to its unit,
// read only (assignments are managed in the administration). A free space:
// its owner and its members; the owner removes members.
export function SpaceMembers({
  spaceId,
  spaceType,
  canRemove,
}: SpaceMembersProps): React.JSX.Element {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="mt-8 text-lg font-semibold">
        {MEMBERS_TEXTS[spaceType].heading}
      </h2>
      {/* Every state renders inside this same region, already on screen, so
          the arrival of the list (or of the empty text) is announced. */}
      <div aria-live="polite">
        <SpaceMembersStates
          spaceId={spaceId}
          spaceType={spaceType}
          canRemove={canRemove}
        />
      </div>
    </section>
  );
}

function SpaceMembersStates({
  spaceId,
  spaceType,
  canRemove,
}: SpaceMembersProps): React.JSX.Element {
  const query = useSpaceMembers({ spaceId });
  const texts = MEMBERS_TEXTS[spaceType];

  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (query.isPending || (query.isError && query.isFetching)) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        {texts.loading}
      </p>
    );
  }

  if (query.isError) {
    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">{texts.error}</p>
        <Button
          variant="secondary"
          type="button"
          className="mt-3"
          onClick={() => void query.refetch()}
        >
          {texts.retry}
        </Button>
      </div>
    );
  }

  const members = query.data.data;

  if (members.length === 0 && texts.empty) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
        {texts.empty}
      </p>
    );
  }

  if (spaceType === 'unit') {
    return <UnitMembersList members={members} />;
  }

  // A unit space never has a remove button, whatever `canRemove` says.
  return canRemove ? (
    <RemovableFreeMembersList spaceId={spaceId} members={members} />
  ) : (
    <FreeMembersList members={members} />
  );
}

// The order on screen is exactly the one the server sent: whoever asks
// first, then the pt-BR collator. Nothing is reordered here. `role:
// 'assigned'` changes nothing on screen.
function UnitMembersList({
  members,
}: {
  members: SpaceMember[];
}): React.JSX.Element {
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
              <span className={BADGE_CLASS_NAME}>você</span>
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

type FreeMembersListProps = {
  members: SpaceMember[];
  // Where the focus lands after removing the first member: the row of the
  // owner, which always comes first.
  ownerRowRef?: React.RefObject<HTMLLIElement | null>;
  // The last item of the row of a member, when the owner can remove it.
  renderAction?: (member: SpaceMember, index: number) => React.ReactNode;
};

// The owner comes first, then whoever asks, then the pt-BR collator, all in
// the order the server sent.
function FreeMembersList({
  members,
  ownerRowRef,
  renderAction,
}: FreeMembersListProps): React.JSX.Element {
  return (
    <ul
      aria-label="Pessoas neste espaço"
      className="mt-6 divide-y divide-gray-200"
    >
      {members.map((member, index) => {
        const isOwner = member.role === 'owner';
        const content = (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-gray-900" title={member.name}>
                {member.name}
              </span>
              {/* An address has no space to break on its own: it wraps,
                  never truncates. */}
              <span className="break-words text-sm text-gray-600">
                {member.email}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {isOwner ? <span className={BADGE_CLASS_NAME}>dono</span> : null}
              {member.isCurrentPerson && !isOwner ? (
                <span className={BADGE_CLASS_NAME}>você</span>
              ) : null}
              {member.role === 'member' && renderAction
                ? renderAction(member, index)
                : null}
            </span>
          </>
        );

        // The row of the owner takes a programmatic focus without ever
        // entering the `Tab` order.
        return isOwner ? (
          <li
            key={member.id}
            ref={ownerRowRef}
            tabIndex={-1}
            className={`${ROW_CLASS_NAME} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`}
          >
            {content}
          </li>
        ) : (
          <li key={member.id} className={ROW_CLASS_NAME}>
            {content}
          </li>
        );
      })}
    </ul>
  );
}

// The action removes the person from the space, not from the instance; the
// trash can is the icon of the recipe for removing an item of a list — six
// lines of SVG copied into the file, since one feature never imports from
// another.
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

// Mounted only for the owner: it holds the state of a removal and the single
// confirmation of the list.
function RemovableFreeMembersList({
  spaceId,
  members,
}: {
  spaceId: string;
  members: SpaceMember[];
}): React.JSX.Element {
  // A copy of what the dialog needs, not a reference to the row: after the
  // success the person is no longer in the list, and the title still has to
  // show the name while the box closes. `isRemoveOpen` is separate from it
  // because the closing is animated.
  const [removing, setRemoving] = useState<{
    personId: string;
    personName: string;
    // The member right above, or `null` when the owner is right above.
    aboveId: string | null;
  } | null>(null);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  // Who opened the confirmation, to give the focus back on cancel, on Escape
  // and after a failure; and, once the request succeeded, where the focus goes
  // instead. Both are read inside `onCloseAutoFocus`, which runs after a
  // render: refs, never state.
  const removeOpenerRef = useRef<HTMLElement | null>(null);
  const focusAfterRemoveRef = useRef<{ aboveId: string | null } | null>(null);
  // A second click, or a second Enter, can arrive before the button
  // re-renders as busy.
  const isSendingRef = useRef(false);
  const ownerRowRef = useRef<HTMLLIElement | null>(null);
  // The remove button of each row, reached by id when the focus has to land
  // on a row that is not the one that was acted upon.
  const removeButtonsRef = useRef(new Map<string, HTMLButtonElement>());

  const addNotification = useNotifications((state) => state.addNotification);

  // No `onSuccess` of its own here: the name and the row above are the ones
  // of the confirmation that sent the request, passed to `mutate`.
  const removeMemberMutation = useRemoveSpaceMember({ spaceId });

  const handleConfirmRemove = (): void => {
    if (isSendingRef.current || !removing) return;
    isSendingRef.current = true;

    const { personId, personName, aboveId } = removing;
    removeMemberMutation.mutate(
      { spaceId, personId },
      {
        // Runs after the list was read again (see `useRemoveSpaceMember`):
        // the row is already gone when the box closes. A person who had
        // already left answers the same 204 and ends up here too.
        onSuccess: () => {
          focusAfterRemoveRef.current = { aboveId };
          addNotification({
            type: 'success',
            title: `${personName} foi removida do espaço.`,
          });
          setIsRemoveOpen(false);
        },
        // The box stays open and the person stays listed: there is no
        // optimistic update to undo.
        onError: () => {
          addNotification({
            type: 'error',
            title: `Não foi possível remover ${personName}. Tente de novo.`,
          });
        },
        onSettled: () => {
          isSendingRef.current = false;
        },
      },
    );
  };

  const isSending = removeMemberMutation.isPending;

  return (
    <>
      <FreeMembersList
        members={members}
        ownerRowRef={ownerRowRef}
        renderAction={(member, index) => (
          <Button
            ref={(node) => {
              if (node) {
                removeButtonsRef.current.set(member.id, node);
              } else {
                removeButtonsRef.current.delete(member.id);
              }
            }}
            variant="ghost"
            size="icon"
            type="button"
            className="text-red-700 hover:bg-red-50 focus-visible:outline-red-600"
            aria-label={`Remover ${member.name}`}
            title={`Remover ${member.name}`}
            onClick={(event) => {
              const above = members[index - 1];
              removeOpenerRef.current = event.currentTarget;
              setRemoving({
                personId: member.id,
                personName: member.name,
                aboveId: above?.role === 'member' ? above.id : null,
              });
              setIsRemoveOpen(true);
            }}
          >
            <TrashIcon />
          </Button>
        )}
      />

      {/* One confirmation for the whole list, and without a trigger of its
          own: the row that opened it disappears when the list is read
          again. */}
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

            const above = afterRemove.aboveId
              ? removeButtonsRef.current.get(afterRemove.aboveId)
              : undefined;
            // No member above — or it left too, in another tab: the row of
            // the owner, which is always there.
            if (above?.isConnected) {
              above.focus();
              return;
            }

            ownerRowRef.current?.focus();
            return;
          }

          // Cancel, Escape, or a failure followed by cancel: back to the
          // button that opened the confirmation.
          const opener = removeOpenerRef.current;
          if (opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        title={`Remover ${removing?.personName ?? ''} do espaço?`}
        description="A pessoa perde o acesso na hora."
        cancelLabel="Cancelar"
        confirmButton={
          // `aria-disabled`, never `disabled`: a disabled button loses the
          // focus of the keyboard while the request goes out.
          <Button
            variant="destructive"
            type="button"
            aria-disabled={isSending || undefined}
            aria-busy={isSending || undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            onClick={handleConfirmRemove}
          >
            {isSending ? 'Removendo…' : 'Remover'}
          </Button>
        }
      />
    </>
  );
}
