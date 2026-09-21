import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { OrgUnitsResponse } from '@/types/api';

// The whole organization comes flat in one request: no parameters and no
// paging. A failure is notified by the api client interceptor.
export const getOrgUnits = (): Promise<OrgUnitsResponse> =>
  api.get('/org-units');

export const getOrgUnitsQueryOptions = () =>
  queryOptions({
    queryKey: ['org-units'],
    queryFn: getOrgUnits,
  });

type UseOrgUnitsOptions = {
  queryConfig?: QueryConfig<typeof getOrgUnitsQueryOptions>;
};

export const useOrgUnits = ({ queryConfig }: UseOrgUnitsOptions = {}) =>
  useQuery({
    ...getOrgUnitsQueryOptions(),
    ...queryConfig,
  });
