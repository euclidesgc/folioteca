import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import {
  addFreeSpace,
  addSpaceMember,
  getDb,
  seedInstalled,
  seedSamplePeople,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import {
  updateSpaceMemberLevel,
  useUpdateSpaceMemberLevel,
} from '../update-space-member-level';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const MEMBER_ID = 'person-sample-3';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

const seedOwnedSpaceWithMember = (): string => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  addSpaceMember(INSTALLED_PERSON_ID, space.id, MEMBER_ID);
  return space.id;
};

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

test('updateSpaceMemberLevel sends PATCH to the member path with the level body', async () => {
  const spaceId = seedOwnedSpaceWithMember();
  const requests: { method: string; path: string; body: unknown }[] = [];
  server.use(
    http.patch(
      `${env.API_URL}/spaces/:spaceId/members/:personId`,
      async ({ request }) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: await request.clone().json(),
        });
        return undefined;
      },
    ),
  );

  const response = await updateSpaceMemberLevel({
    spaceId,
    personId: MEMBER_ID,
    level: 'view',
  });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe('PATCH');
  expect(requests[0]?.path).toMatch(
    new RegExp(`/spaces/${spaceId}/members/${MEMBER_ID}$`),
  );
  expect(requests[0]?.body).toEqual({ level: 'view' });
  expect(response.data).toMatchObject({ id: MEMBER_ID, level: 'view' });
  expect(
    getDb().spaceMembers.find(
      (item) => item.spaceId === spaceId && item.personId === MEMBER_ID,
    ),
  ).toMatchObject({ level: 'view' });
});

test('useUpdateSpaceMemberLevel invalidates the space members query before onSuccess', async () => {
  const spaceId = seedOwnedSpaceWithMember();
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
      useUpdateSpaceMemberLevel({
        spaceId,
        mutationConfig: {
          onSuccess: () => {
            order.push('onSuccess');
          },
        },
      }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ spaceId, personId: MEMBER_ID, level: 'view' });

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
    queryKey: ['space-members', spaceId],
  });
  expect(order).toEqual(['invalidate:start', 'invalidate:end', 'onSuccess']);
});
