import type { components } from '@folioteca/api-contract';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export type DocumentShareResponse =
  components['schemas']['DocumentShareResponse'];

// Silent: the dialog shows the failure itself, so there is no global
// notification on top of it. Both type arguments are given on purpose: the
// response comes in an envelope (`{ data }`).
export const shareDocument = ({
  documentId,
  personId,
}: {
  documentId: string;
  personId: string;
}): Promise<DocumentShareResponse> =>
  api.put<DocumentShareResponse, DocumentShareResponse>(
    `/documents/${documentId}/shares/${personId}`,
    { level: 'view' },
    { silentError: true },
  );

type UseShareDocumentOptions = {
  mutationConfig?: MutationConfig<typeof shareDocument>;
};

export const useShareDocument = ({
  mutationConfig,
}: UseShareDocumentOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: shareDocument,
    // Awaited on purpose: the list of who has access is read again before the
    // caller hears of the success, so the person is already in it.
    onSuccess: async (data, variables, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: ['document-shares', variables.documentId],
      });

      onSuccess?.(data, variables, ...args);
    },
  });
};
