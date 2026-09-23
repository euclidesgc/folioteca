import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Button, buttonVariants } from '@/components/ui/button/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog/confirmation-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { Tree, type TreeHandle } from '@/components/ui/tree/tree';
import { paths } from '@/config/paths';
import { useDeleteOrgUnit } from '@/features/org-units/api/delete-org-unit';
import { useOrgUnits } from '@/features/org-units/api/get-org-units';
import { CreateOrgUnitForm } from '@/features/org-units/components/create-org-unit-form';
import { RenameOrgUnitForm } from '@/features/org-units/components/rename-org-unit-form';
import { SpaceAccessControl } from '@/features/org-units/components/space-access-control';
import {
  buildTree,
  collectExpandableIds,
} from '@/features/org-units/utils/build-tree';
import type { OrgUnit } from '@/types/api';

// A tree with only the root (or nothing at all) says what this place is for.
const ONLY_ROOT_LIMIT = 1;

type DialogState = {
  mode: 'create' | 'rename' | 'space-access';
  unitId: string;
};

// What the dialog asks of whichever form is inside it.
type FormFocusHandle = { focusName: () => void };

const PlusIcon = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
  >
    <path d="M10 4v12M4 10h12" />
  </svg>
);

const PencilIcon = (): React.JSX.Element => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
  >
    <path d="M13.5 3.5a2.12 2.12 0 0 1 3 3L7 16l-4 1 1-4 9.5-9.5Z" />
  </svg>
);

// The same drawing the trash button of a document uses, copied on purpose:
// two six-line SVGs do not justify a shared icon component yet, and a feature
// never imports from another feature.
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

// Two silhouettes, drawn here like the other three icons of this file: one
// feature never imports from another, and six lines of SVG do not justify a
// shared icon component yet.
const UsersIcon = (): React.JSX.Element => (
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
    <circle cx="9.5" cy="8" r="3.25" />
    <path d="M3.5 19.5c0-3.05 2.69-5.25 6-5.25s6 2.2 6 5.25" />
    <path d="M16 5.2a3.25 3.25 0 0 1 0 6.3M17.5 14.6c1.9.7 3.2 2.4 3.2 4.6" />
  </svg>
);

// A padlock, drawn here like the other icons of this file and for the same
// reason: one feature never imports from another.
const LockIcon = (): React.JSX.Element => (
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
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

// Mounts only with data, so the expansion starts fully open once, in the
// initializer of the state — no `useEffect` to keep anything in sync.
function LoadedOrgUnitsTree({
  units,
}: {
  units: OrgUnit[];
}): React.JSX.Element {
  const nodes = useMemo(() => buildTree(units), [units]);
  const unitsById = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit])),
    [units],
  );
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() =>
    collectExpandableIds(nodes),
  );
  // The state keeps the id: the unit itself is derived from the list at every
  // render, so a unit that left the list closes the dialog by derivation.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  // The deletion keeps a copy of the unit instead of deriving it from the
  // list: after the success the unit is no longer there, and the description
  // must still show its name while the confirmation closes.
  const [deleting, setDeleting] = useState<{
    id: string;
    name: string;
    parentId: string;
  } | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  // The node to be focused after the creation, and the mark that the closing
  // under way is the one of a creation. Both live in refs, read by the effect
  // and by `onCloseAutoFocus` at the moment they run — never in a closure
  // captured by a past render.
  const pendingFocusIdRef = useRef<string | null>(null);
  const closedByCreationRef = useRef(false);
  // Who opened the confirmation, to give the focus back on cancel, on Escape
  // and after a refusal; the mother of the unit that was deleted, to send the
  // focus there instead. Both are read inside `onCloseAutoFocus`, which runs
  // after a render: refs, never state.
  const deleteOpenerRef = useRef<HTMLElement | null>(null);
  const focusAfterDeleteRef = useRef<string | null>(null);
  // Read before the request goes out: once it succeeds the unit is no longer
  // in the list to be asked about its mother.
  const parentOfDeletedRef = useRef<string | null>(null);

  const treeRef = useRef<TreeHandle>(null);
  const formFocusRef = useRef<FormFocusHandle>(null);
  const addNotification = useNotifications((state) => state.addNotification);

  const dialogUnit = dialog
    ? (units.find((unit) => unit.id === dialog.unitId) ?? null)
    : null;

  const deleteOrgUnitMutation = useDeleteOrgUnit({
    mutationConfig: {
      // Only success closes the confirmation: a refusal keeps it open, with
      // the notification from the HTTP client interceptor explaining why.
      onSuccess: () => {
        focusAfterDeleteRef.current = parentOfDeletedRef.current;
        addNotification({ type: 'success', title: 'Unidade apagada' });
        setIsDeleteOpen(false);
      },
    },
  });

  const handleConfirmDelete = (): void => {
    // A second click, or a second Enter, can arrive before the button
    // re-renders as disabled.
    if (deleteOrgUnitMutation.isPending) return;
    if (!deleting) return;

    parentOfDeletedRef.current = deleting.parentId;
    deleteOrgUnitMutation.mutate({ orgUnitId: deleting.id });
  };

  const closeDialog = (): void => {
    setDialog(null);
  };

  const handleCreated = (unit: OrgUnit): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (unit.parentId) next.add(unit.parentId);
      return next;
    });
    closedByCreationRef.current = true;
    pendingFocusIdRef.current = unit.id;
    addNotification({ type: 'success', title: 'Unidade criada' });
    closeDialog();
  };

  // The node that was just born has no row yet: it only appears when the
  // reloaded list brings it. The focus waits for the list, never for a timer.
  useEffect(() => {
    const pendingFocusId = pendingFocusIdRef.current;
    if (!pendingFocusId) return;
    if (!units.some((unit) => unit.id === pendingFocusId)) return;

    pendingFocusIdRef.current = null;
    treeRef.current?.focusNode(pendingFocusId);
  }, [units]);

  const handleRenamed = (): void => {
    addNotification({ type: 'success', title: 'Unidade renomeada' });
    closeDialog();
  };

  return (
    <>
      {nodes.length > 0 ? (
        <Tree
          ref={treeRef}
          nodes={nodes}
          expandedIds={expandedIds}
          onExpandedChange={setExpandedIds}
          aria-label="Estrutura de unidades"
          renderActions={(node, { tabIndex }) => (
            <>
              {/* Navigation, so a link and never a button with `navigate`:
                  it opens in another tab, it is copied, it shows its address.
                  Rendered for every node, the root included — being assigned
                  has nothing to do with having a mother. */}
              <Link
                to={paths.admin.orgUnitPeople.getHref(node.id)}
                className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                tabIndex={tabIndex}
                aria-label={`Pessoas de ${node.label}`}
                title={`Pessoas de ${node.label}`}
              >
                <UsersIcon />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                tabIndex={tabIndex}
                aria-label={`Criar unidade filha em ${node.label}`}
                title={`Criar unidade filha em ${node.label}`}
                onClick={() => setDialog({ mode: 'create', unitId: node.id })}
              >
                <PlusIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                tabIndex={tabIndex}
                aria-label={`Renomear ${node.label}`}
                title={`Renomear ${node.label}`}
                onClick={() => setDialog({ mode: 'rename', unitId: node.id })}
              >
                <PencilIcon />
              </Button>
              {typeof unitsById.get(node.id)?.parentId === 'string' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  tabIndex={tabIndex}
                  aria-label={`Acesso ao espaço de ${node.label}`}
                  title={`Acesso ao espaço de ${node.label}`}
                  onClick={() =>
                    setDialog({ mode: 'space-access', unitId: node.id })
                  }
                >
                  <LockIcon />
                </Button>
              ) : null}
              {typeof unitsById.get(node.id)?.parentId === 'string' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  tabIndex={tabIndex}
                  aria-label={`Apagar ${node.label}`}
                  title={`Apagar ${node.label}`}
                  onClick={(event) => {
                    const unit = unitsById.get(node.id);
                    // The root never gets here: the button is not rendered.
                    if (!unit || unit.parentId === null) return;
                    deleteOpenerRef.current = event.currentTarget;
                    setDeleting({
                      id: unit.id,
                      name: unit.name,
                      parentId: unit.parentId,
                    });
                    setIsDeleteOpen(true);
                  }}
                >
                  <TrashIcon />
                </Button>
              ) : null}
            </>
          )}
        />
      ) : null}

      {units.length <= ONLY_ROOT_LIMIT ? (
        <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
          Por enquanto só existe a raiz. Use “Criar unidade filha” na linha dela
          para começar a estrutura.
        </p>
      ) : null}

      {/* One dialog for the whole tree, not one per node. */}
      <Dialog
        open={dialogUnit !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        {dialog && dialogUnit ? (
          <DialogContent
            onOpenAutoFocus={(event) => {
              // The space access has no field: the focus goes to the checked
              // option, as the radio group pattern asks, not to the first one.
              if (dialog.mode === 'space-access') {
                event.preventDefault();
                (event.currentTarget as HTMLElement | null)
                  ?.querySelector<HTMLInputElement>('input[type=radio]:checked')
                  ?.focus();
                return;
              }
              // The field, not the first focusable of the box.
              event.preventDefault();
              formFocusRef.current?.focusName();
            }}
            onCloseAutoFocus={(event) => {
              // After creating, the focus belongs to the node that was just
              // born, and the effect above takes it there as soon as the node
              // exists: the box must not send it to the button, before or
              // after that. In every other case it returns the focus to
              // whoever opened the dialog.
              if (!closedByCreationRef.current) return;
              closedByCreationRef.current = false;
              event.preventDefault();
            }}
          >
            {dialog.mode === 'create' ? (
              <>
                <DialogTitle>Criar unidade filha</DialogTitle>
                <DialogDescription>
                  A nova unidade ficará dentro de “{dialogUnit.name}”.
                </DialogDescription>
                <CreateOrgUnitForm
                  key={`create-${dialogUnit.id}`}
                  parentId={dialogUnit.id}
                  focusRef={formFocusRef}
                  onSuccess={handleCreated}
                  onCancel={closeDialog}
                />
              </>
            ) : dialog.mode === 'space-access' ? (
              <>
                <DialogTitle>Acesso ao espaço</DialogTitle>
                <DialogDescription>
                  Quem vê o espaço de “{dialogUnit.name}”.
                </DialogDescription>
                <SpaceAccessControl
                  key={`space-access-${dialogUnit.id}`}
                  unit={dialogUnit}
                  parentName={
                    unitsById.get(dialogUnit.parentId ?? '')?.name ?? ''
                  }
                />
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="secondary" type="button">
                      Fechar
                    </Button>
                  </DialogClose>
                </div>
              </>
            ) : (
              <>
                <DialogTitle>Renomear unidade</DialogTitle>
                <DialogDescription>
                  Nome atual: “{dialogUnit.name}”.
                  {dialogUnit.parentId === null
                    ? ' Esta é a raiz: o novo nome também passa a ser o nome da organização.'
                    : null}
                </DialogDescription>
                <RenameOrgUnitForm
                  key={`rename-${dialogUnit.id}`}
                  unit={dialogUnit}
                  focusRef={formFocusRef}
                  onSuccess={handleRenamed}
                  onCancel={closeDialog}
                />
              </>
            )}
          </DialogContent>
        ) : null}
      </Dialog>

      {/* One confirmation for the whole tree, and without a trigger of its
          own: the row that opened it disappears when the reloaded list
          arrives without the unit. */}
      <ConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (!open) setIsDeleteOpen(false);
        }}
        onCloseAutoFocus={(event) => {
          const parentId = focusAfterDeleteRef.current;
          if (parentId) {
            // The unit is gone: the focus belongs to its mother, which is on
            // screen because the deleted child was.
            focusAfterDeleteRef.current = null;
            event.preventDefault();
            treeRef.current?.focusNode(parentId);
            return;
          }

          // Cancel, Escape, or a refusal followed by cancel: back to the
          // button that opened the confirmation, while it is still there.
          const opener = deleteOpenerRef.current;
          if (opener?.isConnected) {
            event.preventDefault();
            opener.focus();
          }
        }}
        title="Apagar unidade?"
        description={
          <>
            “{deleting?.name}” e o espaço de documentos dela serão
            apagados. Esta ação não pode ser desfeita.
          </>
        }
        confirmButton={
          <Button
            variant="destructive"
            type="button"
            isLoading={deleteOrgUnitMutation.isPending}
            onClick={handleConfirmDelete}
          >
            {deleteOrgUnitMutation.isPending ? 'Apagando…' : 'Apagar'}
          </Button>
        }
      />
    </>
  );
}

export function OrgUnitsTree(): React.JSX.Element {
  const orgUnitsQuery = useOrgUnits();

  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (
    orgUnitsQuery.isPending ||
    (orgUnitsQuery.isError && orgUnitsQuery.isFetching)
  ) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        Carregando estrutura…
      </p>
    );
  }

  // A 403 with the tab open lands here too: the person was demoted while the
  // page was open.
  if (orgUnitsQuery.isError) {
    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">
          Não foi possível carregar a estrutura.
        </p>
        <Button
          variant="destructive"
          type="button"
          className="mt-3"
          onClick={() => void orgUnitsQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return <LoadedOrgUnitsTree units={orgUnitsQuery.data.data} />;
}
