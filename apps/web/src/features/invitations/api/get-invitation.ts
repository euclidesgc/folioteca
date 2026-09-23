import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

// The shapes of the contract this screen needs. They are aliased here, and not
// in `types/api.ts`, because no other feature reads an invitation yet.
export type InvitationPreview = components['schemas']['InvitationPreview'];
export type InvitationPreviewResponse =
  components['schemas']['InvitationPreviewResponse'];

export const getInvitation = ({
  token,
}: {
  token: string;
}): Promise<InvitationPreviewResponse> =>
  // `silentError` because the whole screen is already the warning: the global
  // notification would say the same thing on top of it.
  api.get(`/invitations/${encodeURIComponent(token)}`, { silentError: true });

export const getInvitationQueryOptions = (token: string) =>
  queryOptions({
    queryKey: ['invitation', token],
    queryFn: () => getInvitation({ token }),
    // A link that is gone does not come back on a second try.
    retry: false,
  });

type UseInvitationOptions = {
  token: string;
};

export const useInvitation = ({ token }: UseInvitationOptions) =>
  useQuery(getInvitationQueryOptions(token));
