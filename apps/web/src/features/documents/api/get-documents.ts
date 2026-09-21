import {
  queryOptions,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { DocumentsResponse } from '@/types/api';

export type DocumentsScope = 'mine' | 'favorites';

const DOCUMENTS_SCOPES: DocumentsScope[] = ['mine', 'favorites'];

export const getDocuments = (
  scope: DocumentsScope,
): Promise<DocumentsResponse> => api.get('/documents', { params: { scope } });

export const getDocumentsQueryOptions = (scope: DocumentsScope = 'mine') =>
  queryOptions({
    queryKey: ['documents', { scope }],
    queryFn: () => getDocuments(scope),
  });

type UseDocumentsOptions = {
  scope?: DocumentsScope;
  queryConfig?: QueryConfig<typeof getDocumentsQueryOptions>;
};

export const useDocuments = ({
  scope,
  queryConfig,
}: UseDocumentsOptions = {}) =>
  useQuery({
    ...getDocumentsQueryOptions(scope),
    ...queryConfig,
  });

// Invalidates the list of every scope, one key at a time. Invalidating the
// `['documents']` prefix would also hit `['documents', <id>]`, and whoever
// writes a document has just put the fresh one in that key with
// `setQueryData`: the open document would be fetched again for nothing.
export function invalidateDocumentLists(queryClient: QueryClient): void {
  for (const scope of DOCUMENTS_SCOPES) {
    void queryClient.invalidateQueries({
      queryKey: getDocumentsQueryOptions(scope).queryKey,
    });
  }
}
