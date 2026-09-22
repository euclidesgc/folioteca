import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { isAxiosError } from 'axios';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
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

import { deleteOrgUnit, useDeleteOrgUnit } from '../delete-org-unit';

// A leaf with no document in its space: the unit the API accepts deleting.
const LEAF_ID = 'org-unit-restauro';
const LEAF_NAME = 'Restauro e Conservação';

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

test('sends DELETE to the unit path', async () => {
  signedInAdmin();

  let url = '';
  server.use(
    http.delete(`${env.API_URL}/org-units/:orgUnitId`, ({ request }) => {
      url = new URL(request.url).pathname;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  await deleteOrgUnit({ orgUnitId: LEAF_ID });

  expect(url.endsWith(`/org-units/${LEAF_ID}`)).toBe(true);
});

test('invalidates the org-units query', async () => {
  signedInAdmin();

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  const { result } = renderHook(() => useDeleteOrgUnit(), {
    wrapper: makeWrapper(queryClient),
  });

  result.current.mutate({ orgUnitId: LEAF_ID });

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
      remove: useDeleteOrgUnit({
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

  result.current.remove.mutate({ orgUnitId: LEAF_ID });

  await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));

  expect(namesWhenCalled.length).toBeGreaterThan(0);
  expect(namesWhenCalled).not.toContain(LEAF_NAME);
});

test('rejects on 409 and the notifications store receives the server message', async () => {
  signedInAdmin();

  await expect(
    deleteOrgUnit({ orgUnitId: ROOT_ORG_UNIT_ID }),
  ).rejects.toBeInstanceOf(ConflictError);

  expect(useNotifications.getState().notifications).toContainEqual(
    expect.objectContaining({
      type: 'error',
      message: 'A unidade raiz não pode ser apagada.',
    }),
  );
});

test('rejects with 403 for a person who is not admin', async () => {
  seedInstalled({ signedIn: true, isAdmin: false });
  seedSampleOrgUnits();

  const error: unknown = await deleteOrgUnit({ orgUnitId: LEAF_ID }).catch(
    (reason: unknown) => reason,
  );

  expect(isAxiosError(error)).toBe(true);
  expect(isAxiosError(error) ? error.response?.status : null).toBe(403);
});
