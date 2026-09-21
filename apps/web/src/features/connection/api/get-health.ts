import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { HealthResponse } from '@/types/api';

export const getHealth = (): Promise<HealthResponse> => api.get('/health');

export const getHealthQueryOptions = () =>
  queryOptions({
    queryKey: ['health'],
    queryFn: getHealth,
    // Backs off less aggressively while healthy, and checks more often while
    // broken, without ever polling forever in a paused/offline state.
    refetchInterval: (query) =>
      query.state.status === 'error' ? 3_000 : 10_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    // Offline fails immediately instead of leaving the query paused.
    networkMode: 'always',
    retry: false,
  });

type UseHealthOptions = {
  queryConfig?: QueryConfig<typeof getHealthQueryOptions>;
};

export const useHealth = ({ queryConfig }: UseHealthOptions = {}) =>
  useQuery({
    ...getHealthQueryOptions(),
    ...queryConfig,
  });
