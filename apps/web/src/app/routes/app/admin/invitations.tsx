import type React from 'react';
import { useState } from 'react';
import { Navigate } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { paths } from '@/config/paths';
import type { CreatedInvitation } from '@/features/invitations/api/create-invitation';
import { CreateInvitationForm } from '@/features/invitations/components/create-invitation-form';
import { InvitationLink } from '@/features/invitations/components/invitation-link';
import { buildInvitationLink } from '@/features/invitations/utils/build-invitation-link';
import { Authorization, ROLES } from '@/lib/authorization';

export function Component(): React.JSX.Element {
  // The invitation just created lives here and nowhere else: never in a global
  // store, never in the React Query cache, never in browser storage. Creating
  // another one replaces it, and leaving the route drops the token.
  const [createdInvitation, setCreatedInvitation] =
    useState<CreatedInvitation | null>(null);

  // Whoever is not an administrator goes back to the beginning, and the form
  // stays inside the check: no request is ever fired for them.
  return (
    <Authorization
      allowedRoles={[ROLES.ADMIN]}
      forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}
    >
      <ContentLayout
        title="Convites"
        description="Convide novas pessoas informando o e-mail. O link do convite aparece aqui, uma única vez, e vale por 7 dias."
      >
        <CreateInvitationForm onSuccess={setCreatedInvitation} />

        {createdInvitation ? (
          <InvitationLink
            key={createdInvitation.id}
            email={createdInvitation.email}
            // The origin comes from the browser: the API does not know where
            // the app is served from.
            link={buildInvitationLink({
              origin: window.location.origin,
              token: createdInvitation.token,
            })}
          />
        ) : null}
      </ContentLayout>
    </Authorization>
  );
}
