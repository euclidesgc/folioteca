import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { getDocumentsQueryOptions } from '@/features/documents/api/get-documents';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { DocumentResponse } from '@/types/api';

export const createDocument = (): Promise<DocumentResponse> =>
  api.post('/documents');

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
    onSuccess: (response, ...args) => {
      queryClient.setQueryData(
        getDocumentQueryOptions(response.data.id).queryKey,
        response,
      );
      void queryClient.invalidateQueries({
        queryKey: getDocumentsQueryOptions().queryKey,
      });

      onSuccess?.(response, ...args);
    },
  });
};
