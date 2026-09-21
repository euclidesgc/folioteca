import type React from 'react';
import { NavLink } from 'react-router';

import { paths } from '@/config/paths';
import { Authorization, ROLES } from '@/lib/authorization';
import { cn } from '@/utils/cn';

// Lives in the layouts of the shared folder, not in a feature: the app is who
// mounts it, and the area will list pages of several features.

const sidebarItemClassName =
  'block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

const adminItemClassName = ({ isActive }: { isActive: boolean }): string =>
  cn(sidebarItemClassName, isActive && 'bg-gray-200 text-gray-900');

export function SidebarAdmin(): React.JSX.Element {
  // No `forbiddenFallback`: whoever is not an administrator has no
  // administration area in the DOM at all.
  return (
    <Authorization allowedRoles={[ROLES.ADMIN]}>
      <nav aria-label="Administração" className="px-4 pb-4">
        <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">
          Administração
        </h2>
        <ul className="mt-2 space-y-1">
          <li>
            <NavLink
              to={paths.admin.structure.getHref()}
              className={adminItemClassName}
            >
              Estrutura
            </NavLink>
          </li>
        </ul>
      </nav>
    </Authorization>
  );
}
