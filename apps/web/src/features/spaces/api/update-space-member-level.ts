import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type SpaceMemberLevel = 'view' | 'edit';

type SpaceMemberLevelResponse =
  components['schemas']['SpaceMemberLevelResponse'];

// Silent: the list answers a failure with its own notification, which names
// the person. Both type arguments are given on purpose: the response comes in
// an envelope (`{ data }`).
export const updateSpaceMemberLevel = ({
  spaceId,
  personId,
  level,
}: {
  spaceId: string;
  personId: string;
  level: SpaceMemberLevel;
}): Promise<SpaceMemberLevelResponse> =>
  api.patch<SpaceMemberLevelResponse, SpaceMemberLevelResponse>(
    `/spaces/${spaceId}/members/${personId}`,
    { level },
    { silentError: true },
  );

type UseUpdateSpaceMemberLevelOptions = {
  spaceId: string;
  mutationConfig?: MutationConfig<typeof updateSpaceMemberLevel>;
};

export const useUpdateSpaceMemberLevel = ({
  spaceId,
  mutationConfig,
}: UseUpdateSpaceMemberLevelOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: updateSpaceMemberLevel,
    // Awaited on purpose: the mutation stays pending until the list was read
    // again, so the select never flips back to the old level between the
    // answer and the reread. No optimistic update: the value on screen comes
    // from `isPending`/`variables` and goes back by itself on a failure.
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: ['space-members', spaceId],
      });

      onSuccess?.(data, ...args);
    },
  });
};
