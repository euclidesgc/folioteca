import { queryOptions, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { QueryConfig } from '@/lib/react-query';
import type { InstallationStatusResponse } from '@/types/api';

export const getInstallation = (): Promise<InstallationStatusResponse> =>
  api.get('/installation');

export const getInstallationQueryOptions = () =>
  queryOptions({
    queryKey: ['installation'],
    queryFn: getInstallation,
  });

type UseInstallationOptions = {
  queryConfig?: QueryConfig<typeof getInstallationQueryOptions>;
};

export const useInstallation = ({
  queryConfig,
}: UseInstallationOptions = {}) =>
  useQuery({
    ...getInstallationQueryOptions(),
    ...queryConfig,
  });
