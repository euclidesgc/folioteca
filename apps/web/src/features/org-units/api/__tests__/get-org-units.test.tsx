import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { isAxiosError } from 'axios';
import type React from 'react';
import { expect, test } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { getDb, seedInstalled, seedSampleOrgUnits } from '@/testing/mocks/db';

import {
  getOrgUnits,
  getOrgUnitsQueryOptions,
  useOrgUnits,
} from '../get-org-units';

const renderUseOrgUnits = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useOrgUnits(), { wrapper });
};

test('getOrgUnits returns the data envelope', async () => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();

  const response = await getOrgUnits();

  expect(response.data).toHaveLength(getDb().orgUnits.length);
  expect(response.data.map((unit) => unit.name)).toContain(
    'Biblioteca Municipal de Exemplo',
  );
});

test('uses the org-units query key', () => {
  expect(getOrgUnitsQueryOptions().queryKey).toEqual(['org-units']);
});

test('useOrgUnits resolves with the seeded units', async () => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();

  const { result } = renderUseOrgUnits();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.data.map((unit) => unit.name)).toContain(
    'Catalogação',
  );
});

test('rejects with 403 for a person who is not admin', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  const error: unknown = await getOrgUnits().catch((reason: unknown) => reason);

  expect(isAxiosError(error)).toBe(true);
  expect(isAxiosError(error) ? error.response?.status : null).toBe(403);
});
