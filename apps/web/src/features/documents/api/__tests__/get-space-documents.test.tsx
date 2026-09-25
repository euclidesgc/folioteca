import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import {
  addAssignment,
  seedInstalled,
  seedSampleOrgUnits,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { getSpaceDocuments, useSpaceDocuments } from '../get-space-documents';

const CATALOGACAO_SPACE_ID = 'space-org-unit-catalogacao';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleOrgUnits();
  addAssignment('org-unit-catalogacao', 'person-1');
});

test('getSpaceDocuments requests the space documents path', async () => {
  let pathname: string | null = null;
  server.use(
    http.get(`${env.API_URL}/spaces/:spaceId/documents`, ({ request }) => {
      pathname = new URL(request.url).pathname;
      return HttpResponse.json({ data: [] });
    }),
  );

  const response = await getSpaceDocuments(CATALOGACAO_SPACE_ID);

  expect(pathname).toMatch(
    new RegExp(`/spaces/${CATALOGACAO_SPACE_ID}/documents$`),
  );
  expect(response).toEqual({ data: [] });
});

test('useSpaceDocuments uses the space-documents query key', async () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useSpaceDocuments({ spaceId: CATALOGACAO_SPACE_ID }),
    { wrapper },
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(
    queryClient.getQueryData(['space-documents', CATALOGACAO_SPACE_ID]),
  ).toEqual(result.current.data);
});
