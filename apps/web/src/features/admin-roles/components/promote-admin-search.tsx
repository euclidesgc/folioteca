import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import type { AdminPerson } from '@/features/admin-roles/api/get-admins';
import { usePromoteAdmin } from '@/features/admin-roles/api/promote-admin';
import type { PersonSummary } from '@/hooks/use-people-search';
import { usePeopleSearch } from '@/hooks/use-people-search';

// The debounce lives here, in the component that owns the field, and never in
// the API layer, which must have no hidden timer.
const SEARCH_DEBOUNCE_MS = 250;

type PromoteAdminSearchProps = {
  // Who already administers, straight from the list that is on the screen: the
  // marking costs no request of its own and no new field in the contract.
  admins: AdminPerson[];
};

// Not an autocomplete widget: a field plus a list of buttons. The action here
// writes, it does not pick a text into the field — so there is no listbox
// keyboard to get wrong, and `Tab` walks the results from the first line.
export function PromoteAdminSearch({
  admins,
}: PromoteAdminSearchProps): React.JSX.Element {
  const [term, setTerm] = useState('');
  const [deferredTerm, setDeferredTerm] = useState('');
  // A copy of what the dialog needs, not a reference to the row: after the
  // success the results are cleared, and the description still has to show the
  // name while the box closes. `isPromoteOpen` is separate from it because the
  // closing is animated.
  const [promoting, setPromoting] = useState<PersonSummary | null>(null);
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  // The person the request is about, to show "Promovendo…" on their row only.
  const [promotingId, setPromotingId] = useState<string | null>(null);

  // `ref` as a plain prop: the focus goes back to the field after a success.
  const fieldRef = useRef<HTMLInputElement>(null);
  // Who opened the confirmation, to give the focus back on cancel, on Escape
  // and after a failure. Read inside `onCloseAutoFocus`, which runs after a
  // render: a ref, never state.
  const openerRef = useRef<HTMLElement | null>(null);
  // Set by the success, so the closing box knows the focus goes to the field
  // instead: the "Promover" button of that row stops existing when the row
  // turns into the badge of who already administers.
  const focusFieldAfterRef = useRef(false);
  // `isPending` only turns true on the next render: two clicks, or two
  // `Enter`, in the same batch of events would both get through. The ref
  // closes in the instant.
  const isPromotingRef = useRef(false);

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

  const addNotification = useNotifications((state) => state.addNotification);
  const searchQuery = usePeopleSearch({ term: deferredTerm });

  const promoteAdminMutation = usePromoteAdmin({
    mutationConfig: {
      onSettled: () => {
        isPromotingRef.current = false;
        setPromotingId(null);
      },
      onSuccess: (response) => {
        // The invalidations are awaited by the hook: the admins list already
        // has the person, and the count has already gone up, when the box
        // closes and the notification shows up.
        focusFieldAfterRef.current = true;
        setIsPromoteOpen(false);
        // Like in the search of the assignments: the next promotion starts
        // from an empty field, and a stale list does not stay on the screen
        // contradicting the admins list that was just updated.
        setTerm('');
        setDeferredTerm('');
        addNotification({
          type: 'success',
          title: 'Pessoa promovida',
          // The name comes from the body of the answer, never from the row of
          // the search.
          message: `${response.data.name} agora administra esta instância.`,
        });
      },
      // A failure keeps the box open, so whoever clicked can try again without
      // redoing the search. The notification comes from the HTTP client
      // interceptor: there is no `silentError` on this route.
    },
  });

  const adminIds = new Set(admins.map((person) => person.id));

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

  const handleConfirmPromote = (): void => {
    // A second click, or a second Enter, sends a single request.
    if (isPromotingRef.current) return;
    if (!promoting) return;
    isPromotingRef.current = true;

    setPromotingId(promoting.id);
    promoteAdminMutation.mutate({ personId: promoting.id });
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
                      {/* An address has no space to break on its own: it
                          wraps, never truncates. */}
                      <span className="block break-words text-sm text-gray-600">
                        {person.email}
                      </span>
                    </div>
                    <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
                      {adminIds.has(person.id) ? (
                        // Text, never colour alone.
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
                          Já é administração
                        </span>
                      ) : (
                        <Button
                          variant="secondary"
                          type="button"
                          aria-label={`Promover ${person.name} a administração`}
                          isLoading={promotingId === person.id}
                          onClick={(event) => {
                            // Clicking the row sends nothing: it only opens
                            // the confirmation.
                            openerRef.current = event.currentTarget;
                            setPromoting(person);
                            setIsPromoteOpen(true);
                          }}
                        >
                          {promotingId === person.id
                            ? 'Promovendo…'
                            : 'Promover'}
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

      {/* One confirmation for the whole list, and without a trigger of its
          own: the row that opened it stops having a button when the person
          becomes administration. */}
      <ConfirmationDialog
        open={isPromoteOpen}
        onOpenChange={(open) => {
          if (!open) setIsPromoteOpen(false);
        }}
        onCloseAutoFocus={(event) => {
          if (focusFieldAfterRef.current) {
            focusFieldAfterRef.current = false;
            event.preventDefault();
            fieldRef.current?.focus();
            return;
          }

          // Cancel, Escape or a failure followed by cancel: back to the button
          // that opened the confirmation, while it is still there.
          const opener = openerRef.current;
          if (opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        title="Promover a administração?"
        description={
          <>
            {promoting?.name} passa a administrar esta instância inteira, como
            qualquer outra administração: cria e renomeia unidades, convida
            pessoas e vê quem administra. Isso não dá acesso a nenhum documento
            que a pessoa já não visse. Tirar o papel depois ainda não é possível
            por aqui.
          </>
        }
        confirmButton={
          <Button
            variant="primary"
            type="button"
            isLoading={promoteAdminMutation.isPending}
            onClick={handleConfirmPromote}
          >
            {promoteAdminMutation.isPending ? 'Promovendo…' : 'Promover'}
          </Button>
        }
      />
    </div>
  );
}
