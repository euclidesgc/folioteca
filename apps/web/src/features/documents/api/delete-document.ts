import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { invalidateDocumentLists } from '@/features/documents/api/get-documents';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

export const deleteDocument = ({
  documentId,
}: {
  documentId: string;
}): Promise<void> => api.delete(`/documents/${documentId}`);

type UseDeleteDocumentOptions = {
  mutationConfig?: MutationConfig<typeof deleteDocument>;
};

export const useDeleteDocument = ({
  mutationConfig,
}: UseDeleteDocumentOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: deleteDocument,
    onSuccess: async (data, variables, ...args) => {
      queryClient.removeQueries({
        queryKey: getDocumentQueryOptions(variables.documentId).queryKey,
      });
      await invalidateDocumentLists(queryClient);

      onSuccess?.(data, variables, ...args);
    },
  });
};
