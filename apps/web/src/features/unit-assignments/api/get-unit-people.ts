import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

// The shapes of the contract this page needs. They are aliased here, and not
// in `types/api.ts`, because no other feature reads an assignment yet.
export type AssignedPerson = components['schemas']['AssignedPerson'];
export type AssignedPeopleResponse =
  components['schemas']['AssignedPeopleResponse'];

// The unit comes in the same envelope as its people: the page needs the name
// for the heading, and asking for it apart would mean a second request and a
// second "not found" that could disagree with this one.
//
// Both type arguments are given on purpose: the response has two keys
// (`data` and `orgUnit`), and the default `AxiosResponse<T>` of axios only
// carries `data`.
export const getUnitPeople = (
  orgUnitId: string,
): Promise<AssignedPeopleResponse> =>
  api.get<AssignedPeopleResponse, AssignedPeopleResponse>(
    `/org-units/${orgUnitId}/people`,
  );

// The key starts with the unit because everything that will be invalidated
// around this screen is "what is known about this unit".
export const getUnitPeopleQueryOptions = (orgUnitId: string) =>
  queryOptions({
    queryKey: ['org-units', orgUnitId, 'people'],
    queryFn: () => getUnitPeople(orgUnitId),
  });

type UseUnitPeopleOptions = {
  orgUnitId: string;
  queryConfig?: QueryConfig<typeof getUnitPeopleQueryOptions>;
};

export const useUnitPeople = ({
  orgUnitId,
  queryConfig,
}: UseUnitPeopleOptions) =>
  useQuery({
    ...getUnitPeopleQueryOptions(orgUnitId),
    ...queryConfig,
  });
