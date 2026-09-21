import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import type { DocumentResponse } from '@/types/api';

import { getDocumentQueryOptions } from '../get-document';
import { getDocumentsQueryOptions } from '../get-documents';
import { useUpdateFavorite } from '../update-favorite';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

const cachedDocument = (
  document: MockDocument,
  isFavorite: boolean,
): DocumentResponse => ({ data: { ...document, isFavorite } });

const renderMutation = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(() => useUpdateFavorite(), { wrapper });
  return { ...view, queryClient };
};

test('sends PUT when isFavorite is true and DELETE when it is false', async () => {
  const seeded = firstSeededDocument();
  const methods: string[] = [];
  server.use(
    http.put(
      `${env.API_URL}/documents/:documentId/favorite`,
      ({ request }) => {
        methods.push(request.method);
        return new HttpResponse(null, { status: 204 });
      },
    ),
    http.delete(
      `${env.API_URL}/documents/:documentId/favorite`,
      ({ request }) => {
        methods.push(request.method);
        return new HttpResponse(null, { status: 204 });
      },
    ),
  );

  const marking = renderMutation();
  marking.result.current.mutate({
    documentId: seeded.id,
    isFavorite: true,
  });
  await waitFor(() => expect(marking.result.current.isSuccess).toBe(true));

  const unmarking = renderMutation();
  unmarking.result.current.mutate({
    documentId: seeded.id,
    isFavorite: false,
  });
  await waitFor(() => expect(unmarking.result.current.isSuccess).toBe(true));

  expect(methods).toEqual(['PUT', 'DELETE']);
});

test('flips isFavorite in the document cache before the server answers', async () => {
  const seeded = firstSeededDocument();
  server.use(
    http.put(`${env.API_URL}/documents/:documentId/favorite`, async () => {
      await delay('infinite');
      return new HttpResponse(null, { status: 204 });
    }),
  );

  const { result, queryClient } = renderMutation();
  const queryKey = getDocumentQueryOptions(seeded.id).queryKey;
  queryClient.setQueryData(queryKey, cachedDocument(seeded, false));

  result.current.mutate({ documentId: seeded.id, isFavorite: true });

  await waitFor(() =>
    expect(queryClient.getQueryData(queryKey)?.data.isFavorite).toBe(true),
  );
  expect(result.current.isPending).toBe(true);
});

test('rolls the cache back on a 500', async () => {
  const seeded = firstSeededDocument();
  server.use(
    http.put(`${env.API_URL}/documents/:documentId/favorite`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  const { result, queryClient } = renderMutation();
  const queryKey = getDocumentQueryOptions(seeded.id).queryKey;
  const previous = cachedDocument(seeded, false);
  queryClient.setQueryData(queryKey, previous);

  result.current.mutate({ documentId: seeded.id, isFavorite: true });

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(queryClient.getQueryData(queryKey)).toEqual(previous);
});

test('leaves the cache alone when the document was never loaded', async () => {
  const seeded = firstSeededDocument();

  const { result, queryClient } = renderMutation();
  const queryKey = getDocumentQueryOptions(seeded.id).queryKey;

  result.current.mutate({ documentId: seeded.id, isFavorite: true });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(queryClient.getQueryData(queryKey)).toBeUndefined();
});

test('invalidates the favorites list and the document when settled, not the mine list', async () => {
  const seeded = firstSeededDocument();
  const { result, queryClient } = renderMutation();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  result.current.mutate({ documentId: seeded.id, isFavorite: true });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getDocumentsQueryOptions('favorites').queryKey,
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getDocumentQueryOptions(seeded.id).queryKey,
  });
  expect(invalidateQueries).not.toHaveBeenCalledWith({
    queryKey: getDocumentsQueryOptions('mine').queryKey,
  });
});

test('forwards onError and onSettled to the caller', async () => {
  const seeded = firstSeededDocument();
  const onError = vi.fn();
  const onSettled = vi.fn();
  server.use(
    http.put(`${env.API_URL}/documents/:documentId/favorite`, () =>
      HttpResponse.json(
        { message: 'Erro interno do servidor.' },
        { status: 500 },
      ),
    ),
  );

  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(
    () => useUpdateFavorite({ mutationConfig: { onError, onSettled } }),
    { wrapper },
  );

  result.current.mutate({ documentId: seeded.id, isFavorite: true });

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(onError).toHaveBeenCalledTimes(1);
  expect(onSettled).toHaveBeenCalledTimes(1);
});
