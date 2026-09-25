import type { components } from '@folioteca/api-contract';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

// Distinct from `usePeopleSearch`: that one is the administration search
// (route `/people`, from 1 letter); this one is the lookup open to any
// signed-in person (route `/people/search`, from 2 letters).

export type PersonSummary = components['schemas']['PersonSummary'];
export type PeopleResponse = components['schemas']['PeopleResponse'];

// The same term typed again within half a minute does not go back to the
// server.
const LOOKUP_STALE_TIME = 1000 * 30;

// Fewer letters than this is the normal state of the field, not a search.
export const PERSON_LOOKUP_MIN_LENGTH = 2;

// There is no timer in this layer — the debounce lives in the component that
// owns the field.
//
// Both type arguments are given on purpose: the response has two keys (`data`
// and `hasMore`), and the default `AxiosResponse<T>` of axios only carries
// `data`.
export const lookupPeople = (term: string): Promise<PeopleResponse> =>
  api.get<PeopleResponse, PeopleResponse>('/people/search', {
    params: { q: term },
  });

export const getPersonLookupQueryOptions = (term: string) =>
  queryOptions({
    queryKey: ['people', 'lookup', term],
    queryFn: () => lookupPeople(term),
    enabled: term.trim().length >= PERSON_LOOKUP_MIN_LENGTH,
    // The list does not blink between keystrokes.
    placeholderData: keepPreviousData,
    staleTime: LOOKUP_STALE_TIME,
  });

export const usePersonLookup = (
  term: string,
  queryConfig?: QueryConfig<typeof getPersonLookupQueryOptions>,
) =>
  useQuery({
    ...getPersonLookupQueryOptions(term),
    ...queryConfig,
  });
