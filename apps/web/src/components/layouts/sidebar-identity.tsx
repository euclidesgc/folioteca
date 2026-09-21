import type React from 'react';

import { Button } from '@/components/ui/button/button';
import { paths } from '@/config/paths';
import { useLogout, useUser } from '@/lib/auth';
import { hardRedirect } from '@/lib/hard-redirect';

// Who is signed in, at the foot of the sidebar. Lives in components/layouts
// because it belongs to the app frame, not to a feature.
export function SidebarIdentity(): React.JSX.Element | null {
  const user = useUser();
  // Ending a session is a full page load, never a router navigation: it wipes
  // the in-memory cache and every screen left from the session.
  const logoutMutation = useLogout({
    onSuccess: () => hardRedirect(paths.login.getHref()),
  });

  if (!user.data) return null;

  const { organization, person } = user.data;

  return (
    <div className="min-w-0">
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

      <Button
        variant="secondary"
        className="mt-3 w-full"
        isLoading={logoutMutation.isPending}
        onClick={() => {
          // A second click can arrive before the button re-renders as disabled.
          if (logoutMutation.isPending) return;

          // A failure keeps the person here: the global notification of the
          // API client already says what happened.
          logoutMutation.mutate();
        }}
      >
        {logoutMutation.isPending ? 'Saindo…' : 'Sair'}
      </Button>
    </div>
  );
}
