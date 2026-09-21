import type React from 'react';
import { Navigate } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { paths } from '@/config/paths';
import { OrgUnitsTree } from '@/features/org-units/components/org-units-tree';
import { Authorization, ROLES } from '@/lib/authorization';

export function Component(): React.JSX.Element {
  // Whoever is not an administrator goes back to the beginning, and the tree
  // stays inside the check: the request is never fired for them.
  return (
    <Authorization
      allowedRoles={[ROLES.ADMIN]}
      forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}
    >
      <ContentLayout
        title="Estrutura"
        description="As unidades da organização, da raiz até as equipes."
      >
        <OrgUnitsTree />
      </ContentLayout>
    </Authorization>
  );
}
