import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getUnitPeopleQueryOptions } from '@/features/unit-assignments/api/get-unit-people';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// A DELETE, and not a POST like the revoke of an invitation: the row of the
// assignment is erased for good, and the composite key `(orgUnitId, personId)`
// is exactly what the two path parameters address.
//
// `silentError` because the message the 404 of this route carries is about a
// person who was not found, which on a removal screen sounds like an
// accusation against whoever clicked when the wanted result already holds. The
// component decides what to say instead.
export const removeAssignment = ({
  orgUnitId,
  personId,
}: {
  orgUnitId: string;
  personId: string;
}): Promise<void> =>
  api.delete(`/org-units/${orgUnitId}/people/${personId}`, {
    silentError: true,
  });

type UseRemoveAssignmentOptions = {
  orgUnitId: string;
  mutationConfig?: MutationConfig<typeof removeAssignment>;
};

export const useRemoveAssignment = ({
  orgUnitId,
  mutationConfig,
}: UseRemoveAssignmentOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: removeAssignment,
    // Awaited on purpose: the mutation stays pending until the new list
    // arrived, so whoever closes the dialog already finds the list without the
    // person who was just removed.
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getUnitPeopleQueryOptions(orgUnitId).queryKey,
      });

      // The unit spaces of the sidebar too, by the literal key: this feature
      // does not import from `unit-spaces`, and the section has to show up (or
      // go away) for whoever just assigned or removed themselves.
      await queryClient.invalidateQueries({ queryKey: ['spaces'] });

      onSuccess?.(data, ...args);
    },
  });
};
