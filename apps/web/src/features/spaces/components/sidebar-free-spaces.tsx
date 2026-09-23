import type React from 'react';
import { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog/dialog';
import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { paths } from '@/config/paths';
import { type Space, useSpaces } from '@/features/spaces/api/get-spaces';
import { CreateSpaceForm } from '@/features/spaces/components/create-space-form';
import { cn } from '@/utils/cn';

const sidebarItemClassName =
  'block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

const DIALOG_DESCRIPTION =
  'Um lugar para um grupo de trabalho, um projeto ou uma comissão. Você será a pessoa dona dele.';

const spaceItemClassName = ({ isActive }: { isActive: boolean }): string =>
  cn(sidebarItemClassName, isActive && 'bg-gray-200 text-gray-900');

// What goes between the heading and the "Novo espaço" button, by state.
function FreeSpacesContent(): React.JSX.Element {
  const spacesQuery = useSpaces();

  if (spacesQuery.isPending) {
    return (
      <p role="status" className="mt-2 px-3 text-sm text-gray-600">
        Carregando espaços…
      </p>
    );
  }

  // A failure keeps its place while the retry runs (the button shows it is
  // busy), instead of the section jumping between states.
  if (spacesQuery.isError && !spacesQuery.data) {
    return (
      <div role="alert" className="mt-2">
        <p className="px-3 text-sm text-red-800">
          Não foi possível carregar seus espaços.
        </p>
        <Button
          variant="secondary"
          className="mt-2 w-full"
          isLoading={spacesQuery.isFetching}
          onClick={() => void spacesQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const spaces = (spacesQuery.data?.data ?? []).filter(
    (space) => space.type === 'free',
  );

  if (spaces.length === 0) {
    return (
      <p className="mt-2 px-3 text-sm text-gray-600">
        Você ainda não tem espaços.
      </p>
    );
  }

  // In the order the server answered (pt-BR by name): never sorted again here.
  return (
    <ul className="mt-2 space-y-1">
      {spaces.map((space) => (
        <li key={space.id}>
          <NavLink
            to={paths.space.getHref(space.id)}
            title={space.name}
            className={spaceItemClassName}
          >
            <span className="block truncate">{space.name}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

// The "Espaços" section is always there, even empty: it carries the action of
// creating a free space.
export function SidebarFreeSpaces(): React.JSX.Element {
  const navigate = useNavigate();
  const addNotification = useNotifications((state) => state.addNotification);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // A new key on every opening: the form is born clean each time.
  const [formKey, setFormKey] = useState(0);
  // Closing because a space was just created: the focus goes to the page of
  // the new space, not back to the "Novo espaço" button (on a narrow screen
  // the sidebar closes with the route change and the button is hidden).
  const closedByCreationRef = useRef(false);

  const openDialog = (): void => {
    setFormKey((key) => key + 1);
    setIsDialogOpen(true);
  };

  const handleCreated = (space: Space): void => {
    closedByCreationRef.current = true;
    addNotification({ type: 'success', title: 'Espaço criado' });
    setIsDialogOpen(false);
    void navigate(paths.space.getHref(space.id), {
      state: { focusMain: true },
    });
  };

  return (
    <nav aria-label="Espaços" className="px-4 pb-4">
      <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Espaços
      </h2>

      <FreeSpacesContent />

      <Button
        type="button"
        variant="secondary"
        className="mt-2 w-full"
        onClick={openDialog}
      >
        Novo espaço
      </Button>

      {/* Outside the states above and always rendered: a new read of the list
          or a change of state never takes the dialog out of the tree before
          the focus is back. Radix mounts and unmounts the box by `open`. */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            if (!closedByCreationRef.current) return;
            closedByCreationRef.current = false;
            event.preventDefault();
          }}
        >
          <DialogTitle>Novo espaço</DialogTitle>
          <DialogDescription>{DIALOG_DESCRIPTION}</DialogDescription>
          <CreateSpaceForm key={formKey} onSuccess={handleCreated} />
        </DialogContent>
      </Dialog>
    </nav>
  );
}
