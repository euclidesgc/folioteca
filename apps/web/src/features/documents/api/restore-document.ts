import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { invalidateDocumentLists } from '@/features/documents/api/get-documents';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { DocumentResponse } from '@/types/api';

export const restoreDocument = ({
  documentId,
}: {
  documentId: string;
}): Promise<DocumentResponse> => api.post(`/documents/${documentId}/restore`);

type UseRestoreDocumentOptions = {
  mutationConfig?: MutationConfig<typeof restoreDocument>;
};

export const useRestoreDocument = ({
  mutationConfig,
}: UseRestoreDocumentOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: restoreDocument,
    onSuccess: async (response, ...args) => {
      queryClient.setQueryData(
        getDocumentQueryOptions(response.data.id).queryKey,
        response,
      );
      await invalidateDocumentLists(queryClient);

      onSuccess?.(response, ...args);
    },
  });
};
