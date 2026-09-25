import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { invalidateDocumentLists } from '@/features/documents/api/get-documents';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { DocumentResponse } from '@/types/api';

export const trashDocument = ({
  documentId,
}: {
  documentId: string;
}): Promise<DocumentResponse> => api.post(`/documents/${documentId}/trash`);

type UseTrashDocumentOptions = {
  mutationConfig?: MutationConfig<typeof trashDocument>;
};

export const useTrashDocument = ({
  mutationConfig,
}: UseTrashDocumentOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: trashDocument,
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
