import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled, seedSampleOrgUnits } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import {
  updateOrgUnitSpace,
  useUpdateOrgUnitSpace,
} from '../update-org-unit-space';

const CHILD_ID = 'org-unit-catalogacao';

const signedInAdmin = (): void => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
};

const makeWrapper = (
  queryClient: QueryClient,
): (({ children }: { children: React.ReactNode }) => React.JSX.Element) => {
  const Wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

test('updateOrgUnitSpace sends PATCH to the unit space with the access body', async () => {
  signedInAdmin();

  let method = '';
  let url = '';
  let body: unknown = null;
  server.use(
    http.patch(
      `${env.API_URL}/org-units/:orgUnitId/space`,
      async ({ request }) => {
        method = request.method;
        url = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({
          data: {
            id: CHILD_ID,
            parentId: 'org-unit-acervo',
            name: 'Catalogação',
            spaceAccess: 'inherit',
          },
        });
      },
    ),
  );

  const response = await updateOrgUnitSpace({
    orgUnitId: CHILD_ID,
    access: 'inherit',
  });

  expect(method).toBe('PATCH');
  expect(url.endsWith(`/org-units/${CHILD_ID}/space`)).toBe(true);
  expect(body).toEqual({ access: 'inherit' });
  expect(response.data.spaceAccess).toBe('inherit');
});

test('useUpdateOrgUnitSpace invalidates org-units and spaces before onSuccess', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const events: string[] = [];
  const invalidateQueries = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
    async (filters, options) => {
      await invalidateQueries(filters, options);
      events.push(`invalidated ${JSON.stringify(filters?.queryKey)}`);
    },
  );

  const { result } = renderHook(
    () =>
      useUpdateOrgUnitSpace({
        mutationConfig: {
          onSuccess: () => {
            events.push('onSuccess');
          },
        },
      }),
    { wrapper: makeWrapper(queryClient) },
  );

  result.current.mutate({ orgUnitId: CHILD_ID, access: 'inherit' });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(events).toEqual([
    'invalidated ["org-units"]',
    'invalidated ["spaces"]',
    'onSuccess',
  ]);
});
