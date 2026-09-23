import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';

// The shapes of the contract this list needs. They are aliased here, and not
// in `types/api.ts`, because no other feature reads an invitation yet. The
// `Invitation` of the contract has no token: the server never answers one here.
export type Invitation = components['schemas']['Invitation'];
export type InvitationsResponse = components['schemas']['InvitationsResponse'];

// Every pending invitation comes in one request: no parameters and no paging.
// No `silentError`: a failure to load is notified by the api client
// interceptor, as in every other list of the app.
export const getInvitations = (): Promise<InvitationsResponse> =>
  api.get('/invitations');

export const getInvitationsQueryOptions = () =>
  queryOptions({
    queryKey: ['invitations'],
    queryFn: getInvitations,
  });

type UseInvitationsOptions = {
  queryConfig?: QueryConfig<typeof getInvitationsQueryOptions>;
};

export const useInvitations = ({ queryConfig }: UseInvitationsOptions = {}) =>
  useQuery({
    ...getInvitationsQueryOptions(),
    ...queryConfig,
  });
