import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getAdminsQueryOptions } from '@/features/admin-roles/api/get-admins';
import type { AdminResponse } from '@/features/admin-roles/api/promote-admin';
import { api } from '@/lib/api-client';
import { getUserQueryOptions } from '@/lib/auth';
import type { MutationConfig } from '@/lib/react-query';

// `isSelf` is decided by the screen (`person.id === sessionPersonId`) and is
// ignored by the request: it is the only thing this hook cannot derive without
// reading the session, and it is what chooses between the two cache paths
// below. Reading `useUser()` in here would hide, inside an `api/` layer, a
// dependency on the session the screen already resolves to draw the dialog.
export type DemoteAdminVariables = {
  personId: string;
  isSelf: boolean;
};

// A DELETE with no body: the path itself says whose role goes away, and
// demoting is idempotent — the same request twice answers 200 twice.
//
// The failure is not quieted here: the 409 of the last administration and the
// 404 of someone who left the instance are real errors for whoever clicked,
// and the message of the server is the right sentence in both cases. One
// notification only, the one of the interceptor.
//
// Both type arguments are given on purpose: the response comes in an envelope
// (`{ data }`), and the default `AxiosResponse<T>` of axios only carries
// `data`.
export const demoteAdmin = ({
  personId,
}: DemoteAdminVariables): Promise<AdminResponse> =>
  api.delete<AdminResponse, AdminResponse>(`/admins/${personId}`);

type UseDemoteAdminOptions = {
  mutationConfig?: MutationConfig<typeof demoteAdmin>;
};

export const useDemoteAdmin = ({
  mutationConfig,
}: UseDemoteAdminOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: demoteAdmin,
    onSuccess: async (data, variables, ...args) => {
      if (variables.isSelf) {
        // Removed, never invalidated: the key still has observers mounted on
        // this screen, and invalidating would fire a `GET /admins` the server
        // already answers with a 403, throwing a permission denied
        // notification onto the screen. `remove` asks the server nothing.
        queryClient.removeQueries({
          queryKey: getAdminsQueryOptions().queryKey,
        });

        // Still an administration in the eyes of the session cache: the screen
        // notifies and goes back to the beginning without ever rendering the
        // forbidden fallback.
        onSuccess?.(data, variables, ...args);

        // Only now: `GET /auth/me` comes back with `isAdmin: false` and the
        // sidebar loses the "Administração" area with the person already at
        // the beginning.
        await queryClient.invalidateQueries({
          queryKey: getUserQueryOptions().queryKey,
        });
        return;
      }

      // Awaited on purpose: when the dialog closes and the notification shows
      // up, the list has already lost the row and the count has already gone
      // down.
      await queryClient.invalidateQueries({
        queryKey: getAdminsQueryOptions().queryKey,
      });

      // The search too, by prefix: the "Já é administração" badge of the
      // search disappears from the row without depending on the in-memory
      // crossing surviving a refetch.
      await queryClient.invalidateQueries({
        queryKey: ['people', 'search'],
      });

      onSuccess?.(data, variables, ...args);
    },
  });
};
