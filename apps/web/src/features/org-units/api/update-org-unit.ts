import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getOrgUnitsQueryOptions } from '@/features/org-units/api/get-org-units';
import { orgUnitNameSchema } from '@/features/org-units/utils/org-unit-name-schema';
import { api } from '@/lib/api-client';
import { getUserQueryOptions } from '@/lib/auth';
import type { MutationConfig } from '@/lib/react-query';
import type { OrgUnitResponse } from '@/types/api';

// The parent is immutable: renaming carries the name and nothing else.
export const updateOrgUnitInputSchema = z.object({ name: orgUnitNameSchema });

export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitInputSchema>;

export const updateOrgUnit = ({
  orgUnitId,
  data,
}: {
  orgUnitId: string;
  data: UpdateOrgUnitInput;
}): Promise<OrgUnitResponse> =>
  // A duplicated name is answered on the field by the form, not by a global
  // notification.
  api.patch(`/org-units/${orgUnitId}`, data, { silentError: true });

type UseUpdateOrgUnitOptions = {
  mutationConfig?: MutationConfig<typeof updateOrgUnit>;
};

export const useUpdateOrgUnit = ({
  mutationConfig,
}: UseUpdateOrgUnitOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: updateOrgUnit,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so whoever closes the dialog already finds the new name.
    onSuccess: async (response, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getOrgUnitsQueryOptions().queryKey,
      });

      // Renaming the root renames the organization: the identity shown in the
      // app comes from the authenticated user, so it has to be read again.
      if (response.data.parentId === null) {
        await queryClient.invalidateQueries({
          queryKey: getUserQueryOptions().queryKey,
        });
      }

      onSuccess?.(response, ...args);
    },
  });
};
