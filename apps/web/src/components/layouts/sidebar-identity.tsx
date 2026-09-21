import type React from 'react';

import { useUser } from '@/lib/auth';

// Who is signed in, at the foot of the sidebar. Lives in components/layouts
// because it belongs to the app frame, not to a feature.
export function SidebarIdentity(): React.JSX.Element | null {
  const user = useUser();

  if (!user.data) return null;

  const { organization, person } = user.data;

  return (
    <dl className="min-w-0">
      <dt className="sr-only">Organização</dt>
      <dd
        className="truncate text-sm font-medium text-gray-900"
        title={organization.name}
      >
        {organization.name}
      </dd>
      <dt className="sr-only">Pessoa</dt>
      <dd className="truncate text-sm text-gray-600" title={person.name}>
        {person.name}
      </dd>
    </dl>
  );
}
