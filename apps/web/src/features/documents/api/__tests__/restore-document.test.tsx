import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import type { MockDocument } from '@/testing/mocks/db';
import {
  getDb,
  seedInstalled,
  seedSampleDocuments,
  seedSampleTrash,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import type { DocumentResponse } from '@/types/api';

import { getDocumentQueryOptions } from '../get-document';
import { getDocumentsQueryOptions } from '../get-documents';
import { restoreDocument, useRestoreDocument } from '../restore-document';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
  seedSampleTrash();
});

const firstTrashedDocument = (): MockDocument => {
  const document = getDb().documents.find((item) => item.trashedAt !== null);
  if (!document) throw new Error('o banco simulado está sem lixeira');
  return document;
};

const cachedDocument = (document: MockDocument): DocumentResponse => ({
  data: { ...document, isFavorite: false },
});

const renderMutation = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(() => useRestoreDocument(), { wrapper });
  return { ...view, queryClient };
};

test('sends POST to the restore endpoint and returns the document', async () => {
  const seeded = firstTrashedDocument();
  let method: string | null = null;
  let url: string | null = null;
  server.use(
    http.post(
      `${env.API_URL}/documents/:documentId/restore`,
      ({ request: received, params }) => {
        method = received.method;
        url = received.url;
        return HttpResponse.json({
          data: {
            ...seeded,
            id: String(params.documentId),
            trashedAt: null,
            isFavorite: false,
          },
        });
      },
    ),
  );

  const response = await restoreDocument({ documentId: seeded.id });

  expect(method).toBe('POST');
  expect(url).toContain(`/documents/${seeded.id}/restore`);
  expect(response.data.id).toBe(seeded.id);
  expect(response.data.trashedAt).toBeNull();
});

test('writes the returned document into the document cache', async () => {
  const seeded = firstTrashedDocument();

  const { result, queryClient } = renderMutation();
  const queryKey = getDocumentQueryOptions(seeded.id).queryKey;
  queryClient.setQueryData(queryKey, cachedDocument(seeded));

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(queryClient.getQueryData(queryKey)?.data.trashedAt).toBeNull();
});

test('invalidates the mine, favorites and trash lists', async () => {
  const seeded = firstTrashedDocument();

  const { result, queryClient } = renderMutation();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getDocumentsQueryOptions('mine').queryKey,
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getDocumentsQueryOptions('favorites').queryKey,
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getDocumentsQueryOptions('trash').queryKey,
  });
});

test('forwards onSuccess to the caller', async () => {
  const seeded = firstTrashedDocument();
  const onSuccess = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useRestoreDocument({ mutationConfig: { onSuccess } }),
    { wrapper },
  );

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test('rejects on a 500 and leaves the cache alone', async () => {
  const seeded = firstTrashedDocument();
  server.use(
    http.post(`${env.API_URL}/documents/:documentId/restore`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  const { result, queryClient } = renderMutation();
  const queryKey = getDocumentQueryOptions(seeded.id).queryKey;
  const previous = cachedDocument(seeded);
  queryClient.setQueryData(queryKey, previous);

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(queryClient.getQueryData(queryKey)).toEqual(previous);
});
