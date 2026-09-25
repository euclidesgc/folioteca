import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { DocumentsResponse } from '@/types/api';

// `silentError`: every state of the request, the 403 of whoever only inherits
// the space included, shows up in the place of the list, never as a toast.
export const getSpaceDocuments = (
  spaceId: string,
): Promise<DocumentsResponse> =>
  api.get(`/spaces/${spaceId}/documents`, { silentError: true });

export const getSpaceDocumentsQueryOptions = (spaceId: string) =>
  queryOptions({
    queryKey: ['space-documents', spaceId],
    queryFn: () => getSpaceDocuments(spaceId),
  });

export const useSpaceDocuments = ({ spaceId }: { spaceId: string }) =>
  useQuery(getSpaceDocumentsQueryOptions(spaceId));
