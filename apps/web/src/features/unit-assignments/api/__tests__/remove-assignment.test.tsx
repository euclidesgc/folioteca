import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import {
  removeAssignment,
  useRemoveAssignment,
} from '@/features/unit-assignments/api/remove-assignment';
import { NotFoundError } from '@/lib/errors';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  ROOT_ORG_UNIT_ID,
  seedInstalled,
  seedSamplePeople,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { waitFor } from '@/testing/test-utils';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const ASSIGNED_PERSON_ID = 'person-sample-1';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
  addAssignment(ROOT_ORG_UNIT_ID, ASSIGNED_PERSON_ID);
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

test('sends DELETE to /org-units/:orgUnitId/people/:personId', async () => {
  const sent: { method: string; path: string }[] = [];
  server.use(
    http.delete(
      `${env.API_URL}/org-units/:orgUnitId/people/:personId`,
      ({ request }) => {
        sent.push({
          method: request.method,
          path: new URL(request.url).pathname,
        });
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );

  await removeAssignment({
    orgUnitId: ROOT_ORG_UNIT_ID,
    personId: ASSIGNED_PERSON_ID,
  });

  await waitFor(
    () =>
      expect(sent).toEqual([
        {
          method: 'DELETE',
          path: `${env.API_URL}/org-units/${ROOT_ORG_UNIT_ID}/people/${ASSIGNED_PERSON_ID}`,
        },
      ]),
    LAZY_TIMEOUT,
  );
});

test('a successful remove invalidates the unit people query key', async () => {
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
      useRemoveAssignment({
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
    personId: ASSIGNED_PERSON_ID,
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true), LAZY_TIMEOUT);
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['org-units', ROOT_ORG_UNIT_ID, 'people'],
  });
  // The invalidation runs first and is awaited: whoever closes the dialog
  // already finds the list without the row.
  expect(order).toEqual(['invalidate', 'onSuccess']);
});

test('a 404 rejects without a global notification', async () => {
  // The pair is not there any more: the single 404 of the route, which on this
  // screen must never become an error notification.
  const error: unknown = await removeAssignment({
    orgUnitId: ROOT_ORG_UNIT_ID,
    personId: 'person-que-nao-existe',
  }).catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(NotFoundError);
  await waitFor(
    () => expect(useNotifications.getState().notifications).toEqual([]),
    LAZY_TIMEOUT,
  );
});
