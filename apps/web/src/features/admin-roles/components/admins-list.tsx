import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { paths } from '@/config/paths';
import { useDemoteAdmin } from '@/features/admin-roles/api/demote-admin';
import type {
  AdminPerson,
  useAdmins,
} from '@/features/admin-roles/api/get-admins';
import { getAdminsQueryOptions } from '@/features/admin-roles/api/get-admins';
import { useUser } from '@/lib/auth';
import { ConflictError, NotFoundError } from '@/lib/errors';

// The phrase of the domain, the same one the server answers on the 409: it is
// shown here *before* the click, so the refusal never surprises anyone.
const LAST_ADMIN_HINT =
  'Esta é a única administração da instância. Promova outra pessoa antes de tirar o papel desta.';

// The two voices of the confirmation, kept whole here so each sentence reads
// as it shows up on screen. What changes between them is not the tone: taking
// the role away from someone else is undone by promoting them again, and
// taking your own role away is not undone by you.
const describeDemotingOther = (name: string): string =>
  `${name} deixa de administrar esta instância: perde a área "Administração" e não poderá mais criar unidades, convidar pessoas nem mudar quem administra. A pessoa continua na instância como membro, e nada do que é dela é apagado. Para devolver o papel, basta promover de novo pela busca acima.`;

const DEMOTING_YOURSELF_DESCRIPTION =
  'Você deixa de administrar esta instância agora: a área "Administração" some do seu app e você volta ao início. Você não poderá devolver o papel a si mesmo — só outra administração poderá. Você continua na instância como membro, com os seus documentos e as suas lotações.';

type AdminsListProps = {
  // The query already resolved by whoever owns the page: the list draws its
  // four states and asks the server nothing of its own.
  query: ReturnType<typeof useAdmins>;
  // The search field of the page, which is a sibling of this list: the focus
  // lands there when no row is left to take it. The route owns the ref,
  // because one feature component never imports another.
  fallbackFocusRef: React.RefObject<HTMLInputElement | null>;
};

// No heading here: the `<h1>` of the route is already "Administradores", and a
// subtitle with the same name would be an echo for whoever uses a screen
// reader. The only thing this screen writes is taking the administration role
// away, which always goes through the confirmation below — including when the
// person takes their own role away.
export function AdminsList({
  query,
  fallbackFocusRef,
}: AdminsListProps): React.JSX.Element {
  // The live region has to be on screen *before* the first answer arrives: a
  // region inserted already filled is not announced by screen readers. So
  // every state below renders inside this same element.
  return (
    <div aria-live="polite">
      <AdminsStates query={query} fallbackFocusRef={fallbackFocusRef} />
    </div>
  );
}

function AdminsStates({
  query,
  fallbackFocusRef,
}: AdminsListProps): React.JSX.Element {
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

  return (
    <LoadedAdminsList admins={admins} fallbackFocusRef={fallbackFocusRef} />
  );
}

function LoadedAdminsList({
  admins,
  fallbackFocusRef,
}: {
  admins: AdminPerson[];
  fallbackFocusRef: React.RefObject<HTMLInputElement | null>;
}): React.JSX.Element {
  // Read here, and not passed by the route: `useUser` is shared infrastructure
  // of `lib/`, and the route is already inside `Authorization`, which only
  // mounts with the user loaded. The comparison is by `id`, never by e-mail or
  // name.
  const sessionPersonId = useUser().data?.person.id;

  // A copy of what the dialog needs, not a reference to the row: after the
  // success the row no longer exists, and the description still has to show
  // the name while the box closes. `isDemoteOpen` is separate from it because
  // the closing is animated.
  const [demoting, setDemoting] = useState<{
    personId: string;
    personName: string;
    isSelf: boolean;
    neighbourId: string | null;
  } | null>(null);
  const [isDemoteOpen, setIsDemoteOpen] = useState(false);
  // The person the request is about, to show "Tirando…" on their row only.
  const [demotingId, setDemotingId] = useState<string | null>(null);

  // Who opened the confirmation, to give the focus back on cancel, on Escape
  // and after a failure; and, once the request settled the row away, where the
  // focus goes instead. Both are read inside `onCloseAutoFocus`, which runs
  // after a render: refs, never state.
  const openerRef = useRef<HTMLElement | null>(null);
  const focusAfterDemoteRef = useRef<{ neighbourId: string | null } | null>(
    null,
  );
  // What the confirmation was about, read after the answer comes back: by then
  // the state may already have been replaced by another row.
  const demotedRef = useRef<{
    isSelf: boolean;
    neighbourId: string | null;
  } | null>(null);
  // The action button of each row, reached by id when the focus has to land on
  // a row that is not the one that was acted upon.
  const demoteButtonsRef = useRef(new Map<string, HTMLButtonElement>());
  // `isPending` only turns true on the next render: two clicks, or two
  // `Enter`, in the same batch of events would both get through. The ref
  // closes in the instant.
  const isDemotingRef = useRef(false);

  const lastAdminHintId = useId();

  const addNotification = useNotifications((state) => state.addNotification);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const demoteAdminMutation = useDemoteAdmin({
    mutationConfig: {
      onSettled: () => {
        isDemotingRef.current = false;
        setDemotingId(null);
      },
      onSuccess: (response) => {
        const demoted = demotedRef.current;
        focusAfterDemoteRef.current = {
          neighbourId: demoted?.neighbourId ?? null,
        };
        setIsDemoteOpen(false);

        if (demoted?.isSelf) {
          // The hook already removed the admins key, so nothing asks the
          // server for a list it now answers with a 403: the person is
          // notified and goes back to the beginning, and only afterwards does
          // the session reload and the sidebar lose the "Administração" area.
          addNotification({
            type: 'success',
            title: 'Você deixou de administrar',
            message:
              'Você não administra mais esta instância. Continua na instância como membro.',
          });
          void navigate(paths.home.getHref(), { replace: true });
          return;
        }

        addNotification({
          type: 'success',
          title: 'Papel de administração retirado',
          // The name comes from the body of the answer, never from the row
          // that was clicked.
          message: `${response.data.name} deixou de administrar esta instância e continua como membro.`,
        });
      },
      onError: (error) => {
        // The notification is always the one of the HTTP client interceptor,
        // with the message of the server: there is no `silentError` on this
        // route, and a second notification here would say the same thing
        // twice.
        if (error instanceof ConflictError) {
          // The refusal is about the state of the list, not about the click:
          // the box stays open and the list reloads, so the screen starts
          // showing the very state that caused the refusal.
          void queryClient.invalidateQueries({
            queryKey: getAdminsQueryOptions().queryKey,
          });
          return;
        }

        if (error instanceof NotFoundError) {
          // The person is not in the list of the server any more, so the
          // wanted result already holds: there is nothing left to confirm, and
          // the focus follows the same rule of the success, because the row is
          // about to disappear from the reloaded list.
          focusAfterDemoteRef.current = {
            neighbourId: demotedRef.current?.neighbourId ?? null,
          };
          setIsDemoteOpen(false);
          void queryClient.invalidateQueries({
            queryKey: getAdminsQueryOptions().queryKey,
          });
        }

        // Any other failure keeps the box open, so whoever clicked can try
        // again without opening it back.
      },
    },
  });

  // The row that keeps the focus once this one loses its button: the one right
  // above, or the one that becomes the first when the first is the one
  // leaving. Null means no row is left to take it.
  const neighbourOf = (index: number): string | null => {
    if (index > 0) return admins[index - 1]?.id ?? null;
    return admins[1]?.id ?? null;
  };

  const handleConfirmDemote = (): void => {
    // A second click, or a second Enter, sends a single request.
    if (isDemotingRef.current) return;
    if (!demoting) return;
    isDemotingRef.current = true;

    demotedRef.current = {
      isSelf: demoting.isSelf,
      neighbourId: demoting.neighbourId,
    };
    setDemotingId(demoting.personId);
    demoteAdminMutation.mutate({
      personId: demoting.personId,
      isSelf: demoting.isSelf,
    });
  };

  // The rule is by count, never by identity: with a single administration left
  // nobody can be demoted, not even themselves.
  const isLastAdmin = admins.length === 1;

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
        {admins.map((person, index) => (
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
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              {/* Only on the row of whoever is using the app, and the word
                  itself, never colour or icon alone. */}
              {person.id === sessionPersonId ? (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
                  você
                </span>
              ) : null}
              {/* Visible text, never only colour or position: the reason the
                  action is refused is written next to it. */}
              {isLastAdmin ? (
                <span
                  id={lastAdminHintId}
                  className="w-full text-sm text-gray-600 sm:w-auto sm:max-w-xs sm:text-right"
                >
                  {LAST_ADMIN_HINT}
                </span>
              ) : null}
              {/* No trash can: the role is invalidated and the person stays,
                  and a trash can would read as deletion. */}
              <Button
                ref={(node) => {
                  if (node) {
                    demoteButtonsRef.current.set(person.id, node);
                  } else {
                    demoteButtonsRef.current.delete(person.id);
                  }
                }}
                variant="secondary"
                type="button"
                aria-label={`Tirar o papel de administração de ${person.name}`}
                aria-describedby={isLastAdmin ? lastAdminHintId : undefined}
                disabled={isLastAdmin}
                isLoading={demotingId === person.id}
                onClick={(event) => {
                  // Clicking the row sends nothing: it only opens the
                  // confirmation.
                  openerRef.current = event.currentTarget;
                  setDemoting({
                    personId: person.id,
                    personName: person.name,
                    isSelf: person.id === sessionPersonId,
                    neighbourId: neighbourOf(index),
                  });
                  setIsDemoteOpen(true);
                }}
              >
                {demotingId === person.id ? 'Tirando…' : 'Tirar o papel'}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* One confirmation for the whole list, and without a trigger of its
          own: the row that opened it stops existing when the reloaded list
          arrives without the person. */}
      <ConfirmationDialog
        open={isDemoteOpen}
        onOpenChange={(open) => {
          if (!open) setIsDemoteOpen(false);
        }}
        onCloseAutoFocus={(event) => {
          const afterDemote = focusAfterDemoteRef.current;
          if (afterDemote) {
            focusAfterDemoteRef.current = null;
            event.preventDefault();

            const neighbour = afterDemote.neighbourId
              ? demoteButtonsRef.current.get(afterDemote.neighbourId)
              : undefined;
            // The neighbour button may be born disabled: demoting can leave a
            // single administration, and that one cannot be demoted. Then, and
            // when no row is left, the focus goes to the search field of the
            // page.
            if (neighbour?.isConnected && !neighbour.disabled) {
              neighbour.focus();
              return;
            }

            fallbackFocusRef.current?.focus();
            return;
          }

          // Cancel, Escape, or a refusal followed by cancel: back to the
          // button that opened the confirmation, while it is still there.
          const opener = openerRef.current;
          if (opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        title={
          demoting?.isSelf
            ? 'Tirar o seu próprio papel de administração?'
            : 'Tirar o papel de administração?'
        }
        description={
          demoting?.isSelf
            ? DEMOTING_YOURSELF_DESCRIPTION
            : describeDemotingOther(demoting?.personName ?? '')
        }
        confirmButton={
          <Button
            variant="primary"
            type="button"
            isLoading={demoteAdminMutation.isPending}
            onClick={handleConfirmDemote}
          >
            {demoteAdminMutation.isPending ? 'Tirando…' : 'Tirar o papel'}
          </Button>
        }
      />
    </>
  );
}
