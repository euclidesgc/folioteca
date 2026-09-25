import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { isAxiosError } from 'axios';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import {
  getOrgUnitsQueryOptions,
  useOrgUnits,
} from '@/features/org-units/api/get-org-units';
import { ConflictError } from '@/lib/errors';
import { queryConfig } from '@/lib/react-query';
import {
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { updateOrgUnit, useUpdateOrgUnit } from '../update-org-unit';

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

test('patches the name to the unit path', async () => {
  signedInAdmin();

  let url = '';
  let body: unknown = null;
  server.use(
    http.patch(
      `${env.API_URL}/org-units/:orgUnitId`,
      async ({ request }) => {
        url = new URL(request.url).pathname;
        body = await request.json();
        return HttpResponse.json({
          data: {
            id: CHILD_ID,
            parentId: 'org-unit-acervo',
            name: 'Catalogação e Indexação',
            spaceAccess: 'own',
          },
        });
      },
    ),
  );

  await updateOrgUnit({
    orgUnitId: CHILD_ID,
    data: { name: 'Catalogação e Indexação' },
  });

  expect(url.endsWith(`/org-units/${CHILD_ID}`)).toBe(true);
  expect(body).toEqual({ name: 'Catalogação e Indexação' });
});

test('invalidates the org-units query', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useUpdateOrgUnit(), {
    wrapper: makeWrapper(queryClient),
  });

  result.current.mutate({
    orgUnitId: CHILD_ID,
    data: { name: 'Catalogação e Indexação' },
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['org-units'] });
});

test('calls the caller onSuccess only after the list was refetched', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  let namesWhenCalled: string[] = [];

  const { result } = renderHook(
    () => ({
      list: useOrgUnits(),
      update: useUpdateOrgUnit({
        mutationConfig: {
          onSuccess: () => {
            namesWhenCalled =
              queryClient
                .getQueryData(getOrgUnitsQueryOptions().queryKey)
                ?.data.map((unit) => unit.name) ?? [];
          },
        },
      }),
    }),
    { wrapper: makeWrapper(queryClient) },
  );

  await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

  result.current.update.mutate({
    orgUnitId: CHILD_ID,
    data: { name: 'Catalogação e Indexação' },
  });

  await waitFor(() => expect(result.current.update.isSuccess).toBe(true));

  expect(namesWhenCalled).toContain('Catalogação e Indexação');
});

test('renaming the root invalidates the authenticated user', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useUpdateOrgUnit(), {
    wrapper: makeWrapper(queryClient),
  });

  result.current.mutate({
    orgUnitId: ROOT_ORG_UNIT_ID,
    data: { name: 'Biblioteca Municipal Renovada' },
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['authenticated-user'],
  });
});

test('renaming a child does not invalidate the authenticated user', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useUpdateOrgUnit(), {
    wrapper: makeWrapper(queryClient),
  });

  result.current.mutate({
    orgUnitId: CHILD_ID,
    data: { name: 'Catalogação e Indexação' },
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: ['authenticated-user'],
  });
});

test('rejects with ConflictError on a sibling name', async () => {
  signedInAdmin();

  await expect(
    updateOrgUnit({
      orgUnitId: CHILD_ID,
      data: { name: 'restauro e conservação' },
    }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('rejects with 403 for a person who is not admin', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  const error: unknown = await updateOrgUnit({
    orgUnitId: ROOT_ORG_UNIT_ID,
    data: { name: 'Outro nome' },
  }).catch((reason: unknown) => reason);

  expect(isAxiosError(error)).toBe(true);
  expect(isAxiosError(error) ? error.response?.status : null).toBe(403);
});
