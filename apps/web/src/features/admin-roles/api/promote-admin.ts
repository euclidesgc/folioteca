import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getAdminsQueryOptions } from '@/features/admin-roles/api/get-admins';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type AdminResponse = components['schemas']['AdminResponse'];

// A PUT with no body: the path itself says who is promoted, and promoting is
// idempotent — the same request twice answers 200 twice.
//
// The failure is not quieted here, unlike the removal of an assignment: a 404
// is a real error for whoever clicked (the person left the instance between
// the search and the confirmation), and the server's own message says exactly
// that. One notification only, the one of the interceptor.
//
// Both type arguments are given on purpose: the response comes in an envelope
// (`{ data }`), and the default `AxiosResponse<T>` of axios only carries
// `data`.
export const promoteAdmin = ({
  personId,
}: {
  personId: string;
}): Promise<AdminResponse> =>
  api.put<AdminResponse, AdminResponse>(`/admins/${personId}`);

type UsePromoteAdminOptions = {
  mutationConfig?: MutationConfig<typeof promoteAdmin>;
};

export const usePromoteAdmin = ({
  mutationConfig,
}: UsePromoteAdminOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: promoteAdmin,
    // Awaited on purpose: when the notification shows up and the dialog
    // closes, the list on the screen already has the person and the count has
    // already gone up.
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: getAdminsQueryOptions().queryKey,
      });

      // The search too, by prefix: the badge of who already administers shows
      // up on the row without depending on the in-memory crossing surviving a
      // refetch. The cost is one search request, and it is accepted — writing
      // that cache entry by hand here would make two places change the same
      // cache by different paths.
      await queryClient.invalidateQueries({
        queryKey: ['people', 'search'],
      });

      onSuccess?.(data, ...args);
    },
  });
};
