import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// Silent: the list answers a failure with its own notification, which names
// the person. No body: the space and the person are both in the path, and
// removing someone who already left answers the same 204.
export const removeSpaceMember = ({
  spaceId,
  personId,
}: {
  spaceId: string;
  personId: string;
}): Promise<void> =>
  api.delete(`/spaces/${spaceId}/members/${personId}`, { silentError: true });

type UseRemoveSpaceMemberOptions = {
  spaceId: string;
  mutationConfig?: MutationConfig<typeof removeSpaceMember>;
};

export const useRemoveSpaceMember = ({
  spaceId,
  mutationConfig,
}: UseRemoveSpaceMemberOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: removeSpaceMember,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so the focus moves once the row is already gone. No optimistic
    // update: the row leaves when the server says so.
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: ['space-members', spaceId],
      });

      onSuccess?.(data, ...args);
    },
  });
};
