import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

// The shapes of the contract this feature needs. Aliased here, and not in
// `types/api.ts`, because no other feature reads the spaces yet.
export type Space = components['schemas']['Space'];
export type SpacesResponse = components['schemas']['SpacesResponse'];
export type SpaceResponse = components['schemas']['SpaceResponse'];

// Both type arguments are given on purpose: the response comes in an envelope
// (`{ data }`), and the default `AxiosResponse<T>` of axios only carries
// `data`.
export const getSpaces = (): Promise<SpacesResponse> =>
  api.get<SpacesResponse, SpacesResponse>('/spaces');

// A short key: the whole list of the signed-in person. Assigning and removing
// an assignment invalidate this same key, written as a literal over there.
export const getSpacesQueryOptions = () =>
  queryOptions({
    queryKey: ['spaces'],
    queryFn: getSpaces,
  });

type UseSpacesOptions = {
  queryConfig?: QueryConfig<typeof getSpacesQueryOptions>;
};

// Read by both sidebar sections and the space page: they share the
// cache, so opening a space from the sidebar asks the server nothing more.
export const useSpaces = ({ queryConfig }: UseSpacesOptions = {}) =>
  useQuery({
    ...getSpacesQueryOptions(),
    ...queryConfig,
  });
