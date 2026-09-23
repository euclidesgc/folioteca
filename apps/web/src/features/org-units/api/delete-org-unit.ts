import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getOrgUnitsQueryOptions } from '@/features/org-units/api/get-org-units';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// No `silentError`: every refusal of this request (the root, children still
// there, documents in the space) is explained by the message the server
// sends, which the HTTP client interceptor already shows as a notification.
export const deleteOrgUnit = ({
  orgUnitId,
}: {
  orgUnitId: string;
}): Promise<void> => api.delete(`/org-units/${orgUnitId}`);

type UseDeleteOrgUnitOptions = {
  mutationConfig?: MutationConfig<typeof deleteOrgUnit>;
};

export const useDeleteOrgUnit = ({
  mutationConfig,
}: UseDeleteOrgUnitOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: deleteOrgUnit,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so whoever closes the dialog already finds the tree without
    // the unit that was just deleted.
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getOrgUnitsQueryOptions().queryKey,
      });

      onSuccess?.(data, ...args);
    },
  });
};
