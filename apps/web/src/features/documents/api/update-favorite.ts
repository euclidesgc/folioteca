import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getDocumentQueryOptions } from '@/features/documents/api/get-document';
import { getDocumentsQueryOptions } from '@/features/documents/api/get-documents';
import { api } from '@/lib/api-client';
import type { MutationConfig } from '@/lib/react-query';
import type { DocumentResponse } from '@/types/api';

type UpdateFavoriteInput = {
  documentId: string;
  isFavorite: boolean;
};

// One file for both verbs, against the "one file per operation" rule: marking
// and unmarking are the two directions of a single optimistic cycle, and
// splitting them would write that cycle twice.
export const updateFavorite = ({
  documentId,
  isFavorite,
}: UpdateFavoriteInput): Promise<void> =>
  isFavorite
    ? api.put(`/documents/${documentId}/favorite`)
    : api.delete(`/documents/${documentId}/favorite`);

// What `onMutate` hands over to `onError`: the cached document as it was
// before the optimistic write, or nothing when it was never loaded.
type UpdateFavoriteContext = { previous: DocumentResponse | undefined };

type UseUpdateFavoriteOptions = {
  mutationConfig?: MutationConfig<typeof updateFavorite>;
};

export const useUpdateFavorite = ({
  mutationConfig,
}: UseUpdateFavoriteOptions = {}) => {
  const queryClient = useQueryClient();
  const { onError, onSettled, ...restConfig } = mutationConfig ?? {};

  return useMutation<void, Error, UpdateFavoriteInput, UpdateFavoriteContext>({
    ...restConfig,
    mutationFn: updateFavorite,
    onMutate: async ({ documentId, isFavorite }) => {
      const queryKey = getDocumentQueryOptions(documentId).queryKey;

      // A request already in flight would land after this write and undo it.
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData(queryKey);

      // The star only moves where the document is already on screen; with
      // nothing in the cache there is no optimistic state to show.
      if (previous) {
        queryClient.setQueryData(queryKey, {
          ...previous,
          data: { ...previous.data, isFavorite },
        });
      }

      return { previous };
    },
    onError: (error, variables, context, ...args) => {
      if (context?.previous) {
        queryClient.setQueryData(
          getDocumentQueryOptions(variables.documentId).queryKey,
          context.previous,
        );
      }

      // No notification here: the api client interceptor already showed one.
      onError?.(error, variables, context, ...args);
    },
    onSettled: (data, error, variables, context, ...args) => {
      // Only the favorites list changes: the summary of "Meus documentos"
      // carries no `isFavorite`.
      void queryClient.invalidateQueries({
        queryKey: getDocumentsQueryOptions('favorites').queryKey,
      });
      void queryClient.invalidateQueries({
        queryKey: getDocumentQueryOptions(variables.documentId).queryKey,
      });

      onSettled?.(data, error, variables, context, ...args);
    },
  });
};
