import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type DocumentInstanceShareResponse =
  components['schemas']['DocumentInstanceShareResponse'];

type InstanceShareLevel = components['schemas']['DocumentInstanceShare']['level'];

// Silent: the dialog shows the failure itself, so there is no global
// notification on top of it. Both type arguments are given on purpose: the
// response comes in an envelope (`{ data }`).
export const shareDocumentWithInstance = ({
  documentId,
  level,
}: {
  documentId: string;
  level: InstanceShareLevel;
}): Promise<DocumentInstanceShareResponse> =>
  api.put<DocumentInstanceShareResponse, DocumentInstanceShareResponse>(
    `/documents/${documentId}/instance-share`,
    { level },
    { silentError: true },
  );

type UseShareDocumentWithInstanceOptions = {
  mutationConfig?: MutationConfig<typeof shareDocumentWithInstance>;
};

export const useShareDocumentWithInstance = ({
  mutationConfig,
}: UseShareDocumentWithInstanceOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: shareDocumentWithInstance,
    // Awaited on purpose: the list of who has access is read again before the
    // caller hears of the success, so the organization row is already in it.
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: ['document-shares', variables.documentId],
      });

      onSuccess?.(data, variables, ...args);
    },
  });
};
