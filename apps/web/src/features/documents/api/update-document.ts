import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { invalidateDocumentLists } from '@/features/documents/api/get-documents';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { DocumentResponse } from '@/types/api';

// Trimmed and capped, like the API schema. Unlike the API, an empty title is
// kept empty here: turning it into "Sem título" is a server decision.
export const updateDocumentInputSchema = z.object({
  title: z
    .string()
    .trim()
    .max(200, 'O título pode ter no máximo 200 caracteres.'),
});

export type UpdateDocumentInput = z.infer<typeof updateDocumentInputSchema>;

export const updateDocument = ({
  documentId,
  data,
}: {
  documentId: string;
  data: UpdateDocumentInput;
}): Promise<DocumentResponse> => api.patch(`/documents/${documentId}`, data);

type UseUpdateDocumentOptions = {
  mutationConfig?: MutationConfig<typeof updateDocument>;
};

export const useUpdateDocument = ({
  mutationConfig,
}: UseUpdateDocumentOptions = {}) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: updateDocument,
    onSuccess: (response, variables, ...args) => {
      queryClient.setQueryData(
        getDocumentQueryOptions(response.data.id).queryKey,
        response,
      );
      invalidateDocumentLists(queryClient);

      onSuccess?.(response, variables, ...args);
    },
  });
};
