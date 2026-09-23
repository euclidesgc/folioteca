import type React from 'react';
import { useRef } from 'react';
import { Navigate } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { paths } from '@/config/paths';
import { useAdmins } from '@/features/admin-roles/api/get-admins';
import { AdminsList } from '@/features/admin-roles/components/admins-list';
import { PromoteAdminSearch } from '@/features/admin-roles/components/promote-admin-search';
import { Authorization, ROLES } from '@/lib/authorization';

// Inside the authorization check, so the request never goes out for whoever is
// not an administrator.
function Admins(): React.JSX.Element {
  const adminsQuery = useAdmins();
  // The search field and the list are siblings, and one feature component
  // never imports another: whoever puts them together on the page is the one
  // that hands the same ref to both, so the focus can go from the list back to
  // the field when no row is left to take it.
  const searchFieldRef = useRef<HTMLInputElement>(null);

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
      {/* Said out loud so nobody has to guess what each action does, and what
          it does not do: the role is the whole instance, and taking it away
          invalidates only the role. */}
      <p className="mt-6 text-gray-600">
        Promover alguém a administração dá o papel de administrar a instância
        inteira, igual ao seu. Tirar o papel invalida só a administração: a
        pessoa continua na instância como membro, com os documentos e as
        lotações que já tinha. A instância nunca fica sem nenhuma administração.
      </p>

      {/* The search crosses its results with the list that is already on the
          screen, so it takes the admins from the same query below. */}
      <PromoteAdminSearch
        admins={adminsQuery.data?.data ?? []}
        fieldRef={searchFieldRef}
      />

      {/* No heading of its own: the `<h1>` above is already
          "Administradores". */}
      <AdminsList query={adminsQuery} fallbackFocusRef={searchFieldRef} />
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
