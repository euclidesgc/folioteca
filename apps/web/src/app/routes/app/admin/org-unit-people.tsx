import type React from 'react';
import { Link, Navigate, useParams } from 'react-router';

import { ContentLayout } from '@/components/layouts/content-layout';
import { paths } from '@/config/paths';
import { useUnitPeople } from '@/features/unit-assignments/api/get-unit-people';
import { AssignPersonSearch } from '@/features/unit-assignments/components/assign-person-search';
import { UnitPeopleList } from '@/features/unit-assignments/components/unit-people-list';
import { Authorization, ROLES } from '@/lib/authorization';
import { isNotFoundError } from '@/lib/errors';

const BackToStructureLink = (): React.JSX.Element => (
  <Link
    to={paths.admin.structure.getHref()}
    className="font-medium text-blue-600 underline-offset-4 hover:underline"
  >
    Voltar para a estrutura
  </Link>
);

// Inside the authorization check, so the request never goes out for whoever
// is not an administrator.
function OrgUnitPeople({ orgUnitId }: { orgUnitId: string }): React.JSX.Element {
  const unitPeopleQuery = useUnitPeople({ orgUnitId });

  // The unit is gone, belongs to another organization or the id is made up:
  // the whole page is the alert, and the way out is back to the structure.
  if (isNotFoundError(unitPeopleQuery.error)) {
    return (
      <main id="main-content" className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-bold">Pessoas da unidade</h1>
        <div
          role="alert"
          className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
        >
          <p className="text-red-800">Unidade não encontrada.</p>
          <p className="mt-3">
            <BackToStructureLink />
          </p>
        </div>
      </main>
    );
  }

  const orgUnit = unitPeopleQuery.data?.orgUnit;

  return (
    <ContentLayout
      // While the name has not arrived the heading still says what the page
      // is: an empty `<h1>` would jump in value for whoever uses a screen
      // reader.
      title={orgUnit?.name ?? 'Pessoas da unidade'}
      description="As pessoas lotadas nesta unidade."
    >
      <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Lotação ainda não dá acesso a documento: ninguém passa a ver nada por
        estar lotado aqui. O acesso chega com os espaços de unidade e o
        compartilhamento com unidade.
      </p>
      <p className="mt-6">
        <BackToStructureLink />
      </p>

      <section>
        <h2 className="mt-8 text-lg font-semibold">Lotar alguém</h2>
        {/* The search marks who is already assigned by comparing with the
            list that is on the screen: without that list there is nothing to
            compare against, so it waits for the same answer the list waits
            for. */}
        {unitPeopleQuery.data ? (
          <AssignPersonSearch
            orgUnitId={orgUnitId}
            orgUnitName={unitPeopleQuery.data.orgUnit.name}
            assignedPeople={unitPeopleQuery.data.data}
          />
        ) : null}
      </section>

      <section>
        <h2 className="mt-8 text-lg font-semibold">Pessoas lotadas</h2>
        <UnitPeopleList query={unitPeopleQuery} />
      </section>
    </ContentLayout>
  );
}

export function Component(): React.JSX.Element {
  const { orgUnitId } = useParams();

  // Whoever is not an administrator goes back to the beginning.
  return (
    <Authorization
      allowedRoles={[ROLES.ADMIN]}
      forbiddenFallback={<Navigate to={paths.home.getHref()} replace />}
    >
      <OrgUnitPeople orgUnitId={orgUnitId ?? ''} />
    </Authorization>
  );
}
