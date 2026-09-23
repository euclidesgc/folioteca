import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { isAxiosError } from 'axios';
import { http, HttpResponse } from 'msw';
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
  removeSpaceMember,
  useRemoveSpaceMember,
} from '../remove-space-member';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';
const MEMBER_ID = 'person-sample-1';

let spaceId = '';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
  spaceId = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura').id;
  addSpaceMember(INSTALLED_PERSON_ID, spaceId, MEMBER_ID);
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

test('removeSpaceMember sends DELETE to the space member path', async () => {
  const requests: { method: string; path: string }[] = [];
  server.use(
    http.delete(
      `${env.API_URL}/spaces/:spaceId/members/:personId`,
      ({ request }) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
        });
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );

  await removeSpaceMember({ spaceId, personId: MEMBER_ID });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe('DELETE');
  expect(requests[0]?.path).toMatch(
    new RegExp(`/spaces/${spaceId}/members/${MEMBER_ID}$`),
  );
});

test('useRemoveSpaceMember invalidates the space members query', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const order: string[] = [];
  const invalidateQueries = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockImplementation(async () => {
      order.push('invalidate');
      await Promise.resolve();
    });

  const { result } = renderHook(
    () =>
      useRemoveSpaceMember({
        spaceId,
        mutationConfig: {
          onSuccess: () => {
            order.push('onSuccess');
          },
        },
      }),
    { wrapper: createWrapper(queryClient) },
  );

  result.current.mutate({ spaceId, personId: MEMBER_ID });

  await waitFor(
    () => expect(result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['space-members', spaceId],
  });
  expect(invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: ['spaces'],
  });
  expect(order).toEqual(['invalidate', 'onSuccess']);
  expect(getDb().spaceMembers).toEqual([]);
});

test('useRemoveSpaceMember exposes the server message on 400', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  const { result } = renderHook(() => useRemoveSpaceMember({ spaceId }), {
    wrapper: createWrapper(queryClient),
  });

  result.current.mutate({ spaceId, personId: INSTALLED_PERSON_ID });

  await waitFor(() => expect(result.current.isError).toBe(true), LAZY_TIMEOUT);
  expect(isAxiosError(result.current.error)).toBe(true);
  expect(result.current.error).toMatchObject({
    response: {
      status: 400,
      data: { message: 'O dono não pode ser removido.' },
    },
  });
  expect(getDb().spaceMembers).toEqual([
    { spaceId, personId: MEMBER_ID },
  ]);
});
