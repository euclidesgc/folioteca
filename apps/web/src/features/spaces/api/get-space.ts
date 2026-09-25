import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

export type SpaceDetail = components['schemas']['SpaceDetail'];
export type SpaceDetailResponse = components['schemas']['SpaceDetailResponse'];

// `silentError`: a 404 is a state of the page ("Espaço não encontrado."), not
// a notification.
export const getSpace = (spaceId: string): Promise<SpaceDetailResponse> =>
  api.get<SpaceDetailResponse, SpaceDetailResponse>(`/spaces/${spaceId}`, {
    silentError: true,
  });

// `['space', …]` and not `['spaces', …]`: the `['spaces']` prefix is
// invalidated when a space is created and when an assignment is added or
// removed, and it would drag the open space along with it.
//
// `staleTime: 0` instead of the app-wide minute: the only mutation that
// invalidates this key is the one of the space settings
// (`useUpdateSpaceSettings`), in the tab of the owner. Everyone else — a
// member whose space was opened or closed, whoever lost their assignment —
// only sees the change because coming back to the page asks the server again.
export const getSpaceQueryOptions = (spaceId: string) =>
  queryOptions({
    queryKey: ['space', spaceId],
    queryFn: () => getSpace(spaceId),
    staleTime: 0,
  });

type UseSpaceOptions = {
  spaceId: string;
  queryConfig?: QueryConfig<typeof getSpaceQueryOptions>;
};

export const useSpace = ({ spaceId, queryConfig }: UseSpaceOptions) =>
  useQuery({
    ...getSpaceQueryOptions(spaceId),
    ...queryConfig,
  });
