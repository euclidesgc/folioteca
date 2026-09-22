import type { components } from '@folioteca/api-contract';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

// The shapes of the contract the search needs, aliased here for the same
// reason as in `get-unit-people.ts`.
export type PersonSummary = components['schemas']['PersonSummary'];
export type PeopleResponse = components['schemas']['PeopleResponse'];

// A search is worth remembering for a while: the same term typed again within
// half a minute does not go back to the server.
const SEARCH_STALE_TIME = 1000 * 30;

// No `silentError`: a failed search is notified by the api client interceptor,
// like any other read of the app. There is no timer here — the debounce lives
// in the component that owns the field.
//
// Both type arguments are given on purpose: the response has two keys
// (`data` and `hasMore`), and the default `AxiosResponse<T>` of axios only
// carries `data`.
export const searchPeople = (term: string): Promise<PeopleResponse> =>
  api.get<PeopleResponse, PeopleResponse>('/people', { params: { q: term } });

export const getPeopleSearchQueryOptions = (term: string) =>
  queryOptions({
    queryKey: ['people', 'search', term],
    queryFn: () => searchPeople(term),
    // A blank field is the normal state of the screen, not a search: nothing
    // is asked of the server while the term has no letter in it.
    enabled: term.trim().length > 0,
    // The list does not blink between keystrokes.
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_TIME,
  });

type UsePeopleSearchOptions = {
  term: string;
  queryConfig?: QueryConfig<typeof getPeopleSearchQueryOptions>;
};

export const usePeopleSearch = ({
  term,
  queryConfig,
}: UsePeopleSearchOptions) =>
  useQuery({
    ...getPeopleSearchQueryOptions(term),
    ...queryConfig,
  });
