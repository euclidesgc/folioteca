import type React from 'react';
import { NavLink } from 'react-router';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useSpaces } from '@/features/unit-spaces/api/get-spaces';
import { cn } from '@/utils/cn';

const sidebarItemClassName =
  'block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

const spaceItemClassName = ({ isActive }: { isActive: boolean }): string =>
  cn(sidebarItemClassName, isActive && 'bg-gray-200 text-gray-900');

// The "Unidades" section only exists for whoever is assigned to a unit: while
// loading and with an empty list there is nothing in the DOM, not even the
// heading, so the sidebar of everybody else does not change.
export function SidebarUnitSpaces(): React.JSX.Element | null {
  const spacesQuery = useSpaces();

  if (spacesQuery.isPending) return null;

  // A failure keeps its place while the retry runs (the button shows it is
  // busy), instead of the section vanishing and coming back.
  if (spacesQuery.isError && !spacesQuery.data) {
    return (
      <nav aria-label="Unidades" className="px-4 pb-4">
        <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
          Unidades
        </h2>
        <div role="alert" className="mt-2">
          <p className="px-3 text-sm text-red-800">
            Não foi possível carregar suas unidades.
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
      </nav>
    );
  }

  const spaces = (spacesQuery.data?.data ?? []).filter(
    (space) => space.type === 'unit',
  );

  if (spaces.length === 0) return null;

  // In the order the server answered (pt-BR by name): never sorted again here.
  return (
    <nav aria-label="Unidades" className="px-4 pb-4">
      <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Unidades
      </h2>
      <ul className="mt-2 space-y-1">
        {spaces.map((space) => (
          <li key={space.id}>
            <NavLink
              to={paths.unitSpace.getHref(space.id)}
              title={space.name}
              className={spaceItemClassName}
            >
              <span className="block truncate">{space.name}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
