import type { components } from '@folioteca/api-contract';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

export type PersonSummary = components['schemas']['PersonSummary'];
export type PeopleResponse = components['schemas']['PeopleResponse'];

// The same term typed again within half a minute does not go back to the
// server.
const SEARCH_STALE_TIME = 1000 * 30;

// Fewer letters than this is the normal state of the field, not a search.
export const SHARE_SEARCH_MIN_LENGTH = 2;

// Its own route, open to any signed-in person, unlike the administration
// search, which is never reused here. There is no timer in this layer — the
// debounce lives in the component that owns the field.
//
// Both type arguments are given on purpose: the response has two keys (`data`
// and `hasMore`), and the default `AxiosResponse<T>` of axios only carries
// `data`.
export const searchPeopleToShare = (term: string): Promise<PeopleResponse> =>
  api.get<PeopleResponse, PeopleResponse>('/people/search', {
    params: { q: term },
  });

export const getSearchPeopleToShareQueryOptions = (term: string) =>
  queryOptions({
    queryKey: ['people', 'share-search', term],
    queryFn: () => searchPeopleToShare(term),
    enabled: term.trim().length >= SHARE_SEARCH_MIN_LENGTH,
    // The list does not blink between keystrokes.
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_TIME,
  });

export const useSearchPeopleToShare = (
  term: string,
  queryConfig?: QueryConfig<typeof getSearchPeopleToShareQueryOptions>,
) =>
  useQuery({
    ...getSearchPeopleToShareQueryOptions(term),
    ...queryConfig,
  });
