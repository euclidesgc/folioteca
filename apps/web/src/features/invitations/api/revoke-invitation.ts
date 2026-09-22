import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getInvitationsQueryOptions } from '@/features/invitations/api/get-invitations';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// A POST and not a DELETE: the row is kept — revoking writes `revokedAt` — and
// `/invitations/{invitationId}` would collide with the public
// `/invitations/{token}`.
//
// No `silentError`: the 404 of this request (an invitation that was accepted,
// expired, was already revoked or never existed) is explained by the single
// message the server sends, which the HTTP client interceptor already shows as
// a notification — and which on purpose never says which of those it was.
export const revokeInvitation = ({
  invitationId,
}: {
  invitationId: string;
}): Promise<void> => api.post(`/invitations/${invitationId}/revoke`);

type UseRevokeInvitationOptions = {
  mutationConfig?: MutationConfig<typeof revokeInvitation>;
};

export const useRevokeInvitation = ({
  mutationConfig,
}: UseRevokeInvitationOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: revokeInvitation,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so whoever closes the dialog already finds the list without
    // the invitation that was just revoked.
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getInvitationsQueryOptions().queryKey,
      });

      onSuccess?.(data, ...args);
    },
  });
};
