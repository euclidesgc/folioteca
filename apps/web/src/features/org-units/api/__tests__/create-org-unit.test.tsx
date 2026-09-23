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
import { ConflictError, NotFoundError } from '@/lib/errors';
import { queryConfig } from '@/lib/react-query';
import {
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { createOrgUnit, useCreateOrgUnit } from '../create-org-unit';

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

test('posts parentId and name to org-units', async () => {
  signedInAdmin();

  let body: unknown = null;
  server.use(
    http.post(`${env.API_URL}/org-units`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(
        {
          data: {
            id: 'org-unit-nova',
            parentId: ROOT_ORG_UNIT_ID,
            name: 'Nova unidade',
            spaceAccess: 'own',
          },
        },
        { status: 201 },
      );
    }),
  );

  await createOrgUnit({
    parentId: ROOT_ORG_UNIT_ID,
    data: { name: 'Nova unidade' },
  });

  expect(body).toEqual({
    parentId: ROOT_ORG_UNIT_ID,
    name: 'Nova unidade',
  });
});

test('returns the created unit envelope', async () => {
  signedInAdmin();

  const response = await createOrgUnit({
    parentId: ROOT_ORG_UNIT_ID,
    data: { name: 'Núcleo de Memória' },
  });

  expect(response.data).toMatchObject({
    parentId: ROOT_ORG_UNIT_ID,
    name: 'Núcleo de Memória',
  });
  expect(response.data.id).toEqual(expect.any(String));
});

test('invalidates the org-units query', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useCreateOrgUnit(), {
    wrapper: makeWrapper(queryClient),
  });

  result.current.mutate({
    parentId: ROOT_ORG_UNIT_ID,
    data: { name: 'Núcleo de Memória' },
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['org-units'],
  });
});

test('calls the caller onSuccess only after the list was refetched', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  let namesWhenCalled: string[] = [];

  const { result } = renderHook(
    () => ({
      list: useOrgUnits(),
      create: useCreateOrgUnit({
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

  result.current.create.mutate({
    parentId: ROOT_ORG_UNIT_ID,
    data: { name: 'Núcleo de Memória' },
  });

  await waitFor(() => expect(result.current.create.isSuccess).toBe(true));

  expect(namesWhenCalled).toContain('Núcleo de Memória');
});

test('rejects with ConflictError on a sibling name', async () => {
  signedInAdmin();

  await expect(
    createOrgUnit({
      parentId: ROOT_ORG_UNIT_ID,
      data: { name: 'acervo e processamento técnico' },
    }),
  ).rejects.toBeInstanceOf(ConflictError);
});

test('rejects with 403 for a person who is not admin', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });

  const error: unknown = await createOrgUnit({
    parentId: ROOT_ORG_UNIT_ID,
    data: { name: 'Núcleo de Memória' },
  }).catch((reason: unknown) => reason);

  expect(isAxiosError(error)).toBe(true);
  expect(isAxiosError(error) ? error.response?.status : null).toBe(403);
});

test('rejects with NotFoundError for an unknown parent', async () => {
  signedInAdmin();

  await expect(
    createOrgUnit({
      parentId: 'org-unit-inexistente',
      data: { name: 'Núcleo de Memória' },
    }),
  ).rejects.toBeInstanceOf(NotFoundError);
});
