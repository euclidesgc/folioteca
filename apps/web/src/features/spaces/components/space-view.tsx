import type React from 'react';
import { type ReactNode, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import type { useSpace } from '@/features/spaces/api/get-space';
import { useSpaceMembers } from '@/features/spaces/api/get-space-members';
import type { Space } from '@/features/spaces/api/get-spaces';
import { AddSpaceMemberDialog } from '@/features/spaces/components/add-space-member-dialog';
import { SpaceInviteModeControl } from '@/features/spaces/components/space-invite-mode-control';
import { SpaceMembers } from '@/features/spaces/components/space-members';
import { NotFoundError } from '@/lib/errors';

// What the heading says whenever there is no space name to show: an empty or
// changing `<h1>` would jump in value for whoever uses a screen reader.
const FALLBACK_TITLE = 'Espaço';

// The texts of a found space, by its type. The documents of both types come
// from whoever owns the page (`documentsContent`), followed by the people of
// the space.
const SPACE_TEXTS = {
  unit: {
    description: 'O espaço de documentos da sua unidade.',
  },
  free: {
    description: 'Um espaço livre, de que você é dona.',
    // A member reads the space; it adds people only when the owner opened it.
    memberDescription: 'Um espaço livre de que você é membro.',
  },
} satisfies Record<
  Space['type'],
  { description: string; memberDescription?: string }
>;

// Only asks for the focus when the page was opened right after creating the
// space (see `SidebarFreeSpaces`).
const hasFocusMainState = (state: unknown): boolean =>
  typeof state === 'object' &&
  state !== null &&
  'focusMain' in state &&
  state.focusMain === true;

type SpaceViewProps = {
  // The space of the URL, read by whoever owns the page.
  query: ReturnType<typeof useSpace>;
  spaceId: string;
  // What a space, unit or free, shows in the place of its documents, composed
  // by the route: this feature does not know the documents one.
  documentsContent: ReactNode;
};

// The same page frame as `ContentLayout`, for the states that have no support
// text: the state itself takes the place of the text and of the documents.
function SpaceStatePage({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <main id="main-content" className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">{FALLBACK_TITLE}</h1>
      {children}
    </main>
  );
}

export function SpaceView({
  query,
  spaceId,
  documentsContent,
}: SpaceViewProps): React.JSX.Element {
  const location = useLocation();
  const shouldFocusMain = hasFocusMainState(location.state);
  const mainRef = useRef<HTMLElement>(null);
  const hasFocusedMainRef = useRef(false);
  // A 404 wins over a space still in the cache: coming back to the page after
  // losing the access asks again, and the answer replaces what was shown.
  const isNotFound = query.error instanceof NotFoundError;
  const space = isNotFound ? undefined : query.data?.data;
  const isFound = space !== undefined;
  // The owner of a free space always adds people to it; a member only when
  // the owner opened it. A unit space has nobody adding people.
  const canAddPeople =
    space?.type === 'free' &&
    (space.reach === 'owner' ||
      (space.reach === 'member' && space.membersCanInvite));
  // The same key `SpaceMembers` reads, so the page asks only once. Its owner
  // is hidden from the search of "Adicionar pessoa".
  const membersQuery = useSpaceMembers({
    spaceId,
    queryConfig: { enabled: canAddPeople },
  });
  const ownerId = membersQuery.data?.data.find(
    (member) => member.role === 'owner',
  )?.id;

  // Right after creating a space the focus lands on the page of the new one,
  // once: a later read of the list does not steal it back.
  useEffect(() => {
    if (!shouldFocusMain || !isFound || hasFocusedMainRef.current) return;
    hasFocusedMainRef.current = true;
    mainRef.current?.focus();
  }, [shouldFocusMain, isFound]);

  // The server answers the same 404 for an unknown id, one of another
  // organization, a malformed one, a unit the person does not reach and a
  // free space of another owner: they all end up in the same "not found"
  // state. The id of the URL only reaches the screen as text rendered by
  // React.
  if (!space) {
    // A retry after a failed load shows the loading state again.
    if (!isNotFound && (query.isPending || query.isFetching)) {
      return (
        <SpaceStatePage>
          <p role="status" className="mt-6 text-gray-600">
            Carregando o espaço…
          </p>
        </SpaceStatePage>
      );
    }

    if (isNotFound) {
      return (
        <SpaceStatePage>
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
          >
            <p className="font-medium text-red-800">Espaço não encontrado.</p>
            <p className="mt-1 text-red-800">
              Ele não existe ou você não tem acesso a ele.
            </p>
            <p className="mt-3">
              <Link
                to={paths.home.getHref()}
                className="font-medium text-blue-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Voltar para o início
              </Link>
            </p>
          </div>
        </SpaceStatePage>
      );
    }

    return (
      <SpaceStatePage>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <p className="text-red-800">Não foi possível carregar o espaço.</p>
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      </SpaceStatePage>
    );
  }

  // Only the owner of a free space removes people from it; a member reads
  // the list.
  const { reach } = space;

  // `break-words` on the wrapper: `overflow-wrap` is inherited, so a long
  // space name breaks inside the `<h1>` of `ContentLayout` instead of
  // overflowing the page on a narrow screen.
  return (
    <div className="min-w-0 break-words">
      <ContentLayout
        ref={mainRef}
        tabIndex={-1}
        title={space.name}
        description={
          space.type === 'free' && space.reach === 'member'
            ? SPACE_TEXTS.free.memberDescription
            : SPACE_TEXTS[space.type].description
        }
      >
        {space.type === 'unit' ? (
          <>
            {documentsContent}
            <SpaceMembers
              spaceId={spaceId}
              spaceType="unit"
              canRemove={false}
            />
          </>
        ) : (
          <>
            {reach === 'owner' ? (
              <SpaceInviteModeControl
                spaceId={spaceId}
                membersCanInvite={space.membersCanInvite}
              />
            ) : null}
            {canAddPeople ? (
              <div className="mt-6">
                <AddSpaceMemberDialog
                  spaceId={spaceId}
                  spaceName={space.name}
                  ownerId={ownerId}
                />
              </div>
            ) : null}
            {documentsContent}
            <SpaceMembers
              spaceId={spaceId}
              spaceType="free"
              canRemove={reach === 'owner'}
            />
          </>
        )}
      </ContentLayout>
    </div>
  );
}
