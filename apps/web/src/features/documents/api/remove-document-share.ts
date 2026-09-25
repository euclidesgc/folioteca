import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// Silent: the dialog answers a failure with its own notification, which names
// the person. No body: the document and the person are both in the path, and
// removing someone who no longer has a share answers the same 204.
export const removeDocumentShare = ({
  documentId,
  personId,
}: {
  documentId: string;
  personId: string;
}): Promise<void> =>
  api.delete(`/documents/${documentId}/shares/${personId}`, {
    silentError: true,
  });

type UseRemoveDocumentShareOptions = {
  documentId: string;
  mutationConfig?: MutationConfig<typeof removeDocumentShare>;
};

export const useRemoveDocumentShare = ({
  documentId,
  mutationConfig,
}: UseRemoveDocumentShareOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: removeDocumentShare,
    // Awaited on purpose: the mutation stays pending until the list of who
    // has access arrived again, so the focus moves once the row is already
    // gone. No optimistic update: the row leaves when the server says so.
    onSuccess: async (data, ...args) => {
      await queryClient.invalidateQueries({
        queryKey: ['document-shares', documentId],
      });

      onSuccess?.(data, ...args);
    },
  });
};
