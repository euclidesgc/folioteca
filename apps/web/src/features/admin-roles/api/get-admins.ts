import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

// The shapes of the contract this screen needs. They are aliased here, and not
// in `types/api.ts`, because no other feature reads who administers yet.
export type AdminPerson = components['schemas']['AdminPerson'];
export type AdminsResponse = components['schemas']['AdminsResponse'];

// Both type arguments are given on purpose: the response comes in an envelope
// (`{ data }`), and the default `AxiosResponse<T>` of axios only carries
// `data`.
export const getAdmins = (): Promise<AdminsResponse> =>
  api.get<AdminsResponse, AdminsResponse>('/admins');

// A short key, with no person prefix: this is the whole list of a single
// resource, and it is this key that promoting and demoting will invalidate.
export const getAdminsQueryOptions = () =>
  queryOptions({
    queryKey: ['admins'],
    queryFn: getAdmins,
  });

type UseAdminsOptions = {
  queryConfig?: QueryConfig<typeof getAdminsQueryOptions>;
};

// An ordinary read of the app: it keeps the default cache lifetime and its
// failures are reported by the interceptor like every other one.
export const useAdmins = ({ queryConfig }: UseAdminsOptions = {}) =>
  useQuery({
    ...getAdminsQueryOptions(),
    ...queryConfig,
  });
