import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import {
  getDocuments,
  getDocumentsQueryOptions,
  invalidateDocumentLists,
  useDocuments,
} from '../get-documents';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const renderUseDocuments = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useDocuments(), { wrapper });
};

test('getDocumentsQueryOptions uses the key documents scope mine', () => {
  expect(getDocumentsQueryOptions().queryKey).toEqual([
    'documents',
    { scope: 'mine' },
  ]);
});

test('requests scope=mine', async () => {
  let scope: string | null = null;
  server.use(
    http.get(`${env.API_URL}/documents`, ({ request }) => {
      scope = new URL(request.url).searchParams.get('scope');
      return HttpResponse.json({ data: [] });
    }),
  );

  await getDocuments('mine');

  expect(scope).toBe('mine');
});

test('uses one key per scope and defaults to mine', () => {
  expect(getDocumentsQueryOptions('mine').queryKey).toEqual([
    'documents',
    { scope: 'mine' },
  ]);
  expect(getDocumentsQueryOptions('favorites').queryKey).toEqual([
    'documents',
    { scope: 'favorites' },
  ]);
  expect(getDocumentsQueryOptions().queryKey).toEqual(
    getDocumentsQueryOptions('mine').queryKey,
  );
});

test('requests the given scope', async () => {
  let scope: string | null = null;
  server.use(
    http.get(`${env.API_URL}/documents`, ({ request }) => {
      scope = new URL(request.url).searchParams.get('scope');
      return HttpResponse.json({ data: [] });
    }),
  );

  await getDocuments('favorites');

  expect(scope).toBe('favorites');
});

test('uses its own key for the trash scope', () => {
  expect(getDocumentsQueryOptions('trash').queryKey).toEqual([
    'documents',
    { scope: 'trash' },
  ]);
  expect(getDocumentsQueryOptions('trash').queryKey).not.toEqual(
    getDocumentsQueryOptions('mine').queryKey,
  );
});

test('invalidateDocumentLists invalidates the three lists and leaves the open document alone', () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  invalidateDocumentLists(queryClient);

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'mine' }],
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'favorites' }],
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['documents', { scope: 'trash' }],
  });
  expect(invalidateQueries).toHaveBeenCalledTimes(3);
  expect(invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: ['documents'],
  });
  expect(invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: ['documents', 'document-1'],
  });
});

test('useDocuments returns the list in the order the API sent', async () => {
  seedSampleDocuments();
  const expectedOrder = [...getDb().documents]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((document) => document.title);

  const { result } = renderUseDocuments();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.data.map((document) => document.title)).toEqual(
    expectedOrder,
  );
});

test('useDocuments exposes the error on 500', async () => {
  server.use(
    http.get(`${env.API_URL}/documents`, () =>
      HttpResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 }),
    ),
  );

  const { result } = renderUseDocuments();

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(result.current.error).toBeDefined();
});
