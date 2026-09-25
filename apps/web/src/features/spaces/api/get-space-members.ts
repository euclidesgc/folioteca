import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

export type SpaceMember = components['schemas']['SpaceMember'];
export type SpaceMembersResponse =
  components['schemas']['SpaceMembersResponse'];

// `silentError`: a failure is shown by the section itself, with its own
// "Tentar novamente".
export const getSpaceMembers = (
  spaceId: string,
): Promise<SpaceMembersResponse> =>
  api.get<SpaceMembersResponse, SpaceMembersResponse>(
    `/spaces/${spaceId}/members`,
    { silentError: true },
  );

// `staleTime: 0` instead of the app-wide minute, for the same reason as the
// space itself: coming back to the page shows who is assigned now.
export const getSpaceMembersQueryOptions = (spaceId: string) =>
  queryOptions({
    queryKey: ['space-members', spaceId],
    queryFn: () => getSpaceMembers(spaceId),
    staleTime: 0,
  });

type UseSpaceMembersOptions = {
  spaceId: string;
  queryConfig?: QueryConfig<typeof getSpaceMembersQueryOptions>;
};

export const useSpaceMembers = ({
  spaceId,
  queryConfig,
}: UseSpaceMembersOptions) =>
  useQuery({
    ...getSpaceMembersQueryOptions(spaceId),
    ...queryConfig,
  });
