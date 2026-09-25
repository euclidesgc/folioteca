import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type SpaceMemberResponse = components['schemas']['SpaceMemberResponse'];

// Silent: the dialog shows the failure itself, so there is no global
// notification on top of it. No body: the space and the person are both in
// the path. Both type arguments are given on purpose: the response comes in
// an envelope (`{ data }`).
export const addSpaceMember = ({
  spaceId,
  personId,
}: {
  spaceId: string;
  personId: string;
}): Promise<SpaceMemberResponse> =>
  api.put<SpaceMemberResponse, SpaceMemberResponse>(
    `/spaces/${spaceId}/members/${personId}`,
    undefined,
    { silentError: true },
  );

type UseAddSpaceMemberOptions = {
  mutationConfig?: MutationConfig<typeof addSpaceMember>;
};

// Only the people of the space are read again: the list of spaces of the
// owner does not change, and the new member sees the space because that list
// is read again (see `get-spaces.ts`). The key is the one of
// `getSpaceMembersQueryOptions`, for the space of the mutation.
export const useAddSpaceMember = ({
  mutationConfig,
}: UseAddSpaceMemberOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: addSpaceMember,
    // Awaited on purpose: whoever closes the dialog already finds the person
    // in the list.
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: ['space-members', variables.spaceId],
      });

      onSuccess?.(data, variables, ...args);
    },
  });
};
