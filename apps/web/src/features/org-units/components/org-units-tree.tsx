import type React from 'react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button/button';
import { Tree } from '@/components/ui/tree/tree';
import { useOrgUnits } from '@/features/org-units/api/get-org-units';
import {
  buildTree,
  collectExpandableIds,
} from '@/features/org-units/utils/build-tree';
import type { OrgUnit } from '@/types/api';

// A tree with only the root (or nothing at all) says what this place is for.
const ONLY_ROOT_LIMIT = 1;

// Mounts only with data, so the expansion starts fully open once, in the
// initializer of the state — no `useEffect` to keep anything in sync.
function LoadedOrgUnitsTree({
  units,
}: {
  units: OrgUnit[];
}): React.JSX.Element {
  const nodes = useMemo(() => buildTree(units), [units]);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() =>
    collectExpandableIds(nodes),
  );

  return (
    <>
      {nodes.length > 0 ? (
        <Tree
          nodes={nodes}
          expandedIds={expandedIds}
          onExpandedChange={setExpandedIds}
          aria-label="Estrutura de unidades"
        />
      ) : null}

      {units.length <= ONLY_ROOT_LIMIT ? (
        <p className="mt-6 rounded-md border border-dashed border-gray-300 p-6 text-center text-gray-600">
          Por enquanto só existe a raiz. As unidades filhas serão criadas aqui,
          abaixo dela.
        </p>
      ) : null}
    </>
  );
}

export function OrgUnitsTree(): React.JSX.Element {
  const orgUnitsQuery = useOrgUnits();

  // A retry after a failed load goes back to "pending" in TanStack Query v5.
  if (
    orgUnitsQuery.isPending ||
    (orgUnitsQuery.isError && orgUnitsQuery.isFetching)
  ) {
    return (
      <p role="status" className="mt-6 text-gray-600">
        Carregando estrutura…
      </p>
    );
  }

  // A 403 with the tab open lands here too: the person was demoted while the
  // page was open.
  if (orgUnitsQuery.isError) {
    return (
      <div
        role="alert"
        className="mt-6 rounded-md border border-red-200 bg-red-50 p-4"
      >
        <p className="text-red-800">
          Não foi possível carregar a estrutura.
        </p>
        <Button
          variant="destructive"
          type="button"
          className="mt-3"
          onClick={() => void orgUnitsQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return <LoadedOrgUnitsTree units={orgUnitsQuery.data.data} />;
}
