import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import type { DocumentResponse } from '@/types/api';

import { getDocumentQueryOptions } from '../get-document';
import { getDocumentsQueryOptions } from '../get-documents';
import { createDocument, useCreateDocument } from '../create-document';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const renderMutation = (onSuccess?: () => void) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(
    () => useCreateDocument(onSuccess ? { mutationConfig: { onSuccess } } : {}),
    { wrapper },
  );

  return { ...view, queryClient };
};

test('posts without a body and returns the created document', async () => {
  let body: string | null = null;
  server.use(
    http.post(`${env.API_URL}/documents`, async ({ request }) => {
      body = await request.text();
      return HttpResponse.json(
        {
          data: {
            id: 'document-novo',
            title: 'Sem título',
            spaceId: 'space-person-1',
            authorId: 'person-1',
            ownerId: 'person-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            trashedAt: null,
            accessLevel: 'owner',
            isFavorite: false,
          },
        } satisfies DocumentResponse,
        { status: 201 },
      );
    }),
  );

  const { result } = renderMutation();

  result.current.mutate(undefined);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(body).toBe('');
  expect(result.current.data?.data).toMatchObject({
    title: 'Sem título',
    accessLevel: 'owner',
  });
});

test('writes the created document to the item cache', async () => {
  const { result, queryClient } = renderMutation();

  result.current.mutate(undefined);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  const created = result.current.data;
  expect(
    queryClient.getQueryData(getDocumentQueryOptions(created?.data.id ?? '').queryKey),
  ).toEqual(created);
});

test('invalidates the documents list', async () => {
  const { result, queryClient } = renderMutation();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  result.current.mutate(undefined);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getDocumentsQueryOptions().queryKey,
  });
});

test('calls onSuccess with the response', async () => {
  const onSuccess = vi.fn();
  const { result } = renderMutation(onSuccess);

  result.current.mutate(undefined);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(onSuccess.mock.calls[0]?.[0]).toEqual(result.current.data);
});

// Answers the creation with a fixed document and hands the raw body to the
// test, so the body sent is read as it went over the wire.
const captureCreationBody = (): { read: () => string | null } => {
  let body: string | null = null;
  server.use(
    http.post(`${env.API_URL}/documents`, async ({ request }) => {
      body = await request.text();
      return HttpResponse.json(
        {
          data: {
            id: 'document-no-espaco',
            title: 'Sem título',
            spaceId: 'space-org-unit-catalogacao',
            authorId: 'person-1',
            ownerId: 'person-1',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            trashedAt: null,
            accessLevel: 'owner',
            isFavorite: false,
          },
        } satisfies DocumentResponse,
        { status: 201 },
      );
    }),
  );
  return { read: () => body };
};

test('createDocument sends spaceId in the body', async () => {
  const body = captureCreationBody();

  await createDocument({ spaceId: 'space-org-unit-catalogacao' });

  expect(JSON.parse(body.read() ?? '')).toEqual({
    spaceId: 'space-org-unit-catalogacao',
  });
});

test('createDocument without input sends no body', async () => {
  const body = captureCreationBody();

  await createDocument();

  expect(body.read()).toBe('');
});

test('useCreateDocument invalidates the space documents list', async () => {
  const { result, queryClient } = renderMutation();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  result.current.mutate(undefined);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['space-documents'],
  });
});

test('useCreateDocument returns documento-sem-titulo-1 for the first document', async () => {
  const { result } = renderMutation();

  result.current.mutate(undefined);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.data.title).toBe('documento-sem-titulo-1');
});

test('useCreateDocument awaits list invalidation before the caller onSuccess', async () => {
  const onSuccess = vi.fn();
  const invalidated = vi.fn();
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { result, queryClient } = renderMutation(onSuccess);
  const invalidateQueries = vi
    .spyOn(queryClient, 'invalidateQueries')
    .mockImplementation(async () => {
      await gate;
      invalidated();
    });

  result.current.mutate(undefined);

  await waitFor(() => expect(invalidateQueries).toHaveBeenCalledTimes(4));
  expect(onSuccess).not.toHaveBeenCalled();

  release();

  await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  expect(invalidated).toHaveBeenCalledTimes(4);
  expect(Math.max(...invalidated.mock.invocationCallOrder)).toBeLessThan(
    onSuccess.mock.invocationCallOrder[0] ?? 0,
  );
});
