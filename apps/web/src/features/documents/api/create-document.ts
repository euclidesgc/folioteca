import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { invalidateDocumentLists } from '@/features/documents/api/get-documents';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { DocumentResponse } from '@/types/api';

// Without `spaceId` the document goes to the personal space, and no body is
// sent at all.
export const createDocument = (input?: {
  spaceId?: string;
}): Promise<DocumentResponse> => api.post('/documents', input);

type UseCreateDocumentOptions = {
  mutationConfig?: MutationConfig<typeof createDocument>;
};

export const useCreateDocument = ({
  mutationConfig,
}: UseCreateDocumentOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: createDocument,
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
