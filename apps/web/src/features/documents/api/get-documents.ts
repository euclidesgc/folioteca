import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { DocumentsResponse } from '@/types/api';

export const getDocuments = (): Promise<DocumentsResponse> =>
  api.get('/documents', { params: { scope: 'mine' } });

export const getDocumentsQueryOptions = () =>
  queryOptions({
    queryKey: ['documents', { scope: 'mine' }],
    queryFn: getDocuments,
  });

type UseDocumentsOptions = {
  queryConfig?: QueryConfig<typeof getDocumentsQueryOptions>;
};

export const useDocuments = ({ queryConfig }: UseDocumentsOptions = {}) =>
  useQuery({
    ...getDocumentsQueryOptions(),
    ...queryConfig,
  });
