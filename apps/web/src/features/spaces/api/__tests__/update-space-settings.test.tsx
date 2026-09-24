import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { addFreeSpace, getDb, seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import {
  updateSpaceSettings,
  useUpdateSpaceSettings,
} from '../update-space-settings';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

test('updateSpaceSettings sends PATCH to the space with the membersCanInvite body', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  const requests: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.patch(`${env.API_URL}/spaces/:spaceId`, async ({ request }) => {
      requests.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: await request.clone().json(),
      });
      return undefined;
    }),
  );

  const response = await updateSpaceSettings({
    spaceId: space.id,
    membersCanInvite: true,
  });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe('PATCH');
  expect(requests[0]?.path).toMatch(new RegExp(`/spaces/${space.id}$`));
  expect(requests[0]?.body).toEqual({ membersCanInvite: true });
  expect(response.data).toMatchObject({
    id: space.id,
    type: 'free',
    membersCanInvite: true,
  });
  expect(getDb().spaces.find((item) => item.id === space.id)).toMatchObject({
    membersCanInvite: true,
  });
});

test('useUpdateSpaceSettings invalidates the space query before onSuccess', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const order: string[] = [];
  let releaseInvalidation: () => void = () => undefined;
  const invalidateQueries = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockImplementation(async () => {
      order.push('invalidate:start');
      await new Promise<void>((resolve) => {
        releaseInvalidation = resolve;
      });
      order.push('invalidate:end');
    });

  const { result } = renderHook(
    () =>
      useUpdateSpaceSettings({
        mutationConfig: {
          onSuccess: () => {
            order.push('onSuccess');
          },
        },
      }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ spaceId: space.id, membersCanInvite: true });

  await waitFor(
    () => expect(order).toEqual(['invalidate:start']),
    LAZY_TIMEOUT,
  );
  expect(result.current.isPending).toBe(true);

  releaseInvalidation();

  await waitFor(
    () => expect(result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['space', space.id],
  });
  expect(order).toEqual(['invalidate:start', 'invalidate:end', 'onSuccess']);
});
