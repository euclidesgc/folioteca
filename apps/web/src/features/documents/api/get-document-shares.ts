import type { components } from '@folioteca/api-contract';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export type DocumentAccessEntry = components['schemas']['DocumentAccessEntry'];
export type DocumentAccessListResponse =
  components['schemas']['DocumentAccessListResponse'];

// Silent: a failure is shown by the section of the dialog itself, with its
// own "Tentar de novo". Both type arguments are given on purpose: the response
// comes in an envelope (`{ data }`).
export const getDocumentShares = (
  documentId: string,
): Promise<DocumentAccessListResponse> =>
  api.get<DocumentAccessListResponse, DocumentAccessListResponse>(
    `/documents/${documentId}/shares`,
    { silentError: true },
  );

export const getDocumentSharesQueryOptions = (documentId: string) =>
  queryOptions({
    queryKey: ['document-shares', documentId],
    queryFn: () => getDocumentShares(documentId),
  });

type UseDocumentSharesOptions = {
  documentId: string;
  // Only while the share dialog is open.
  enabled: boolean;
};

export const useDocumentShares = ({
  documentId,
  enabled,
}: UseDocumentSharesOptions) =>
  useQuery({
    ...getDocumentSharesQueryOptions(documentId),
    enabled,
  });
