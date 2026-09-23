import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getOrgUnitsQueryOptions } from '@/features/org-units/api/get-org-units';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { OrgUnitResponse, SpaceAccess } from '@/types/api';

// `silentError` because the dialog answers a failure with its own alert, not
// with a global notification.
export const updateOrgUnitSpace = ({
  orgUnitId,
  access,
}: {
  orgUnitId: string;
  access: SpaceAccess;
}): Promise<OrgUnitResponse> =>
  api.patch(`/org-units/${orgUnitId}/space`, { access }, { silentError: true });

type UseUpdateOrgUnitSpaceOptions = {
  mutationConfig?: MutationConfig<typeof updateOrgUnitSpace>;
};

export const useUpdateOrgUnitSpace = ({
  mutationConfig,
}: UseUpdateOrgUnitSpaceOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: updateOrgUnitSpace,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so the checked option never flips back to the old mode between
    // the answer and the reread.
    onSuccess: async (response, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getOrgUnitsQueryOptions().queryKey,
      });

      // The unit spaces of the sidebar too, by the literal key: this feature
      // does not import from another feature, and whoever sees the parent
      // space gains (or loses) this one.
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });

      onSuccess?.(response, ...args);
    },
  });
};
