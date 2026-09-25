import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getSpaceQueryOptions,
  type SpaceDetailResponse,
} from '@/features/spaces/api/get-space';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// `silentError` because the control answers a failure with its own alert,
// not with a global notification. Both type arguments are given on purpose:
// the response comes in an envelope (`{ data }`).
export const updateSpaceSettings = ({
  spaceId,
  membersCanInvite,
}: {
  spaceId: string;
  membersCanInvite: boolean;
}): Promise<SpaceDetailResponse> =>
  api.patch<SpaceDetailResponse, SpaceDetailResponse>(
    `/spaces/${spaceId}`,
    { membersCanInvite },
    { silentError: true },
  );

type UseUpdateSpaceSettingsOptions = {
  mutationConfig?: MutationConfig<typeof updateSpaceSettings>;
};

export const useUpdateSpaceSettings = ({
  mutationConfig,
}: UseUpdateSpaceSettingsOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: updateSpaceSettings,
    // Awaited on purpose: the mutation stays pending until the space was read
    // again, so the checked option never flips back to the old mode between
    // the answer and the reread.
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getSpaceQueryOptions(variables.spaceId).queryKey,
      });

      onSuccess?.(data, variables, ...args);
    },
  });
};
