import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import {
  assignPerson,
  isAssignmentRefusedError,
  useAssignPerson,
} from '@/features/unit-assignments/api/assign-person';
import { queryConfig } from '@/lib/react-query';
import {
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSamplePeople,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
  useNotifications.setState({ notifications: [] });
});

const wrapperFor = (
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

test('sends POST to /org-units/:orgUnitId/people with the personId', async () => {
  const sent: { path: string; body: unknown }[] = [];
  server.use(
    http.post(
      `${env.API_URL}/org-units/:orgUnitId/people`,
      async ({ request }) => {
        sent.push({
          path: new URL(request.url).pathname,
          body: await request.json(),
        });
        return HttpResponse.json(
          {
            data: {
              id: 'person-sample-1',
              name: 'Álvaro Pinheiro',
              email: 'alvaro.pinheiro@exemplo.com.br',
            },
          },
          { status: 201 },
        );
      },
    ),
  );

  await assignPerson({
    orgUnitId: ROOT_ORG_UNIT_ID,
    personId: 'person-sample-1',
  });

  await waitFor(
    () =>
      expect(sent).toEqual([
        {
          path: `${env.API_URL}/org-units/${ROOT_ORG_UNIT_ID}/people`,
          body: { personId: 'person-sample-1' },
        },
      ]),
    LAZY_TIMEOUT,
  );
});

test('a successful assignment awaits the invalidation of the unit people key', async () => {
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
      useAssignPerson({
        orgUnitId: ROOT_ORG_UNIT_ID,
        mutationConfig: {
          onSuccess: () => {
            order.push('onSuccess');
          },
        },
      }),
    { wrapper: wrapperFor(queryClient) },
  );

  result.current.mutate({
    orgUnitId: ROOT_ORG_UNIT_ID,
    personId: 'person-sample-1',
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true), LAZY_TIMEOUT);
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['org-units', ROOT_ORG_UNIT_ID, 'people'],
  });
  // The invalidation runs first and is awaited: whoever listens to the
  // success already finds the new list.
  expect(order).toEqual(['invalidate', 'onSuccess']);
});

test('errors are silent for the global notifier', async () => {
  server.use(
    http.post(`${env.API_URL}/org-units/:orgUnitId/people`, () =>
      HttpResponse.json(
        { message: 'Esta pessoa já está lotada nesta unidade.' },
        { status: 409 },
      ),
    ),
  );

  const error: unknown = await assignPerson({
    orgUnitId: ROOT_ORG_UNIT_ID,
    personId: 'person-sample-1',
  }).catch((reason: unknown) => reason);

  expect(isAssignmentRefusedError(error)).toBe(true);
  if (isAssignmentRefusedError(error)) {
    expect(error.kind).toBe('already-assigned');
    // The message is the server's, read before the shared client turned the
    // answer into a domain error.
    expect(error.message).toBe('Esta pessoa já está lotada nesta unidade.');
  }
  await waitFor(
    () => expect(useNotifications.getState().notifications).toEqual([]),
    LAZY_TIMEOUT,
  );
});
