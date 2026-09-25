import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';

// Silent: the dialog answers a failure with its own notification. No body:
// the document is in the path, and removing a share that no longer exists
// answers the same 204.
export const removeDocumentInstanceShare = ({
  documentId,
}: {
  documentId: string;
}): Promise<void> =>
  api.delete(`/documents/${documentId}/instance-share`, {
    silentError: true,
  });

type UseRemoveDocumentInstanceShareOptions = {
  documentId: string;
  mutationConfig?: MutationConfig<typeof removeDocumentInstanceShare>;
};

export const useRemoveDocumentInstanceShare = ({
  documentId,
  mutationConfig,
}: UseRemoveDocumentInstanceShareOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess, ...restConfig } = mutationConfig ?? {};

  return useMutation({
    ...restConfig,
    mutationFn: removeDocumentInstanceShare,
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
