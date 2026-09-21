import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { DocumentResponse } from '@/types/api';

export const getDocument = ({
  documentId,
}: {
  documentId: string;
}): Promise<DocumentResponse> =>
  // The page already shows the error and the not-found state in the content
  // area; the floating notification would say the same thing twice.
  api.get(`/documents/${documentId}`, { silentError: true });

export const getDocumentQueryOptions = (documentId: string) =>
  queryOptions({
    queryKey: ['documents', documentId],
    queryFn: () => getDocument({ documentId }),
  });

type UseDocumentOptions = {
  documentId: string;
  queryConfig?: QueryConfig<typeof getDocumentQueryOptions>;
};

export const useDocument = ({ documentId, queryConfig }: UseDocumentOptions) =>
  useQuery({
    ...getDocumentQueryOptions(documentId),
    ...queryConfig,
  });
