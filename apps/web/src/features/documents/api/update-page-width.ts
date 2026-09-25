import { useMutation, useQueryClient } from '@tanstack/react-query';

import { usePageWidthStore } from '@/features/documents/stores/page-width-store';
import { api } from '@/lib/api-client';
import { getUserQueryOptions, useUser } from '@/lib/auth';
import type { MutationConfig } from '@/lib/react-query';
import type { CurrentUserResponse, UpdatePreferencesBody } from '@/types/api';

// Not silent: a failure is announced by the api client interceptor, and the
// menu shows no alert of its own.
export const updatePageWidth = (
  body: UpdatePreferencesBody,
): Promise<CurrentUserResponse> =>
  api.patch<CurrentUserResponse, CurrentUserResponse>(
    '/auth/me/preferences',
    body,
  );

type UseUpdatePageWidthOptions = {
  mutationConfig?: MutationConfig<typeof updatePageWidth>;
};

export const useUpdatePageWidth = ({
  mutationConfig,
}: UseUpdatePageWidthOptions = {}) => {
  const queryClient = useQueryClient();
  const user = useUser();
  const setSessionChoice = usePageWidthStore((state) => state.setSessionChoice);
  const { onMutate, onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: updatePageWidth,
    // The sheet changes right away. There is no `onError` undoing it: the
    // choice holds for the rest of the session even when the save fails.
    onMutate: (variables, ...args) => {
      const personId = user.data?.person.id;
      if (personId) {
        setSessionChoice({ personId, width: variables.documentPageWidth });
      }

      return onMutate?.(variables, ...args);
    },
    // Awaited on purpose: the caller only hears of the success once the
    // session already carries the new width.
    onSuccess: async (response, ...args) => {
      await queryClient.invalidateQueries(getUserQueryOptions());

      await onSuccess?.(response, ...args);
    },
  });
};
