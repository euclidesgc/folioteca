import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getOrgUnitsQueryOptions } from '@/features/org-units/api/get-org-units';
import { orgUnitNameSchema } from '@/features/org-units/utils/org-unit-name-schema';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { OrgUnitResponse } from '@/types/api';

// The parent is not a form field: it comes from the row the person acted on.
export const createOrgUnitInputSchema = z.object({ name: orgUnitNameSchema });

export type CreateOrgUnitInput = z.infer<typeof createOrgUnitInputSchema>;

export const createOrgUnit = ({
  parentId,
  data,
}: {
  parentId: string;
  data: CreateOrgUnitInput;
}): Promise<OrgUnitResponse> =>
  // A duplicated name is answered on the field by the form, not by a global
  // notification.
  api.post('/org-units', { parentId, ...data }, { silentError: true });

type UseCreateOrgUnitOptions = {
  mutationConfig?: MutationConfig<typeof createOrgUnit>;
};

export const useCreateOrgUnit = ({
  mutationConfig,
}: UseCreateOrgUnitOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: createOrgUnit,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so whoever closes the dialog already finds the new node.
    onSuccess: async (response, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getOrgUnitsQueryOptions().queryKey,
      });

      onSuccess?.(response, ...args);
    },
  });
};
