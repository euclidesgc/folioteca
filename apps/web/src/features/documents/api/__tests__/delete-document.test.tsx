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

import { deleteDocument, useDeleteDocument } from '../delete-document';
import { getDocumentQueryOptions } from '../get-document';
import { getDocumentsQueryOptions } from '../get-documents';

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

const firstDocumentOutsideTrash = (): MockDocument => {
  const document = getDb().documents.find((item) => item.trashedAt === null);
  if (!document) throw new Error('o banco simulado está sem documentos');
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

  const view = renderHook(() => useDeleteDocument(), { wrapper });
  return { ...view, queryClient };
};

test('sends DELETE to the document endpoint', async () => {
  const seeded = firstTrashedDocument();
  let method: string | null = null;
  let url: string | null = null;
  server.use(
    http.delete(
      `${env.API_URL}/documents/:documentId`,
      ({ request: received }) => {
        method = received.method;
        url = received.url;
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );

  await deleteDocument({ documentId: seeded.id });

  expect(method).toBe('DELETE');
  expect(url).toContain(`/documents/${seeded.id}`);
});

test('removes the document query from the cache', async () => {
  const seeded = firstTrashedDocument();

  const { result, queryClient } = renderMutation();
  const queryKey = getDocumentQueryOptions(seeded.id).queryKey;
  queryClient.setQueryData(queryKey, cachedDocument(seeded));

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(queryClient.getQueryData(queryKey)).toBeUndefined();
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
    () => useDeleteDocument({ mutationConfig: { onSuccess } }),
    { wrapper },
  );

  result.current.mutate({ documentId: seeded.id });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(onSuccess).toHaveBeenCalledTimes(1);
});

test('rejects on a 409 and keeps the document query', async () => {
  const outsideTrash = firstDocumentOutsideTrash();

  const { result, queryClient } = renderMutation();
  const queryKey = getDocumentQueryOptions(outsideTrash.id).queryKey;
  const previous = cachedDocument(outsideTrash);
  queryClient.setQueryData(queryKey, previous);

  result.current.mutate({ documentId: outsideTrash.id });

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(queryClient.getQueryData(queryKey)).toEqual(previous);
});
