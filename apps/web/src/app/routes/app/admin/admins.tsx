import type React from 'react';
import { Navigate } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { paths } from '@/config/paths';
import { useAdmins } from '@/features/admin-roles/api/get-admins';
import { AdminsList } from '@/features/admin-roles/components/admins-list';
import { Authorization, ROLES } from '@/lib/authorization';

// Inside the authorization check, so the request never goes out for whoever is
// not an administrator.
function Admins(): React.JSX.Element {
  const adminsQuery = useAdmins();

  return (
    <ContentLayout
      title="Administradores"
      description="Quem administra esta instância hoje."
    >
      <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Administrar a instância não dá acesso a documento: ninguém vê um
        documento por ser administração. O acesso chega com os espaços de
        unidade e o compartilhamento.
      </p>
      {/* Said out loud so nobody looks for a button that does not exist. */}
      <p className="mt-6 text-gray-600">
        Esta página é só de leitura. Promover alguém a administração e tirar o
        papel de quem não deve mais tê-lo ainda não é possível por aqui — por
        enquanto, isso só acontece direto no banco de dados.
      </p>

      {/* No heading of its own: the `<h1>` above is already
          "Administradores". */}
      <AdminsList query={adminsQuery} />
    </ContentLayout>
  );
}

export function Component(): React.JSX.Element {
  // Whoever is not an administrator goes back to the beginning.
  return (
    <Authorization
      allowedRoles={[ROLES.ADMIN]}
      forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}
    >
      <Admins />
    </Authorization>
  );
}
