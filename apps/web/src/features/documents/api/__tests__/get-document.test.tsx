import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { NotFoundError } from '@/lib/errors';
import { queryConfig } from '@/lib/react-query';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import {
  getDocument,
  getDocumentQueryOptions,
  useDocument,
} from '../get-document';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

const renderUseDocument = (documentId: string) => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return renderHook(() => useDocument({ documentId }), { wrapper });
};

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

test('getDocumentQueryOptions uses the key documents id', () => {
  expect(getDocumentQueryOptions('document-1').queryKey).toEqual([
    'documents',
    'document-1',
  ]);
});

test('useDocument returns the document', async () => {
  seedSampleDocuments();
  const seeded = firstSeededDocument();

  const { result } = renderUseDocument(seeded.id);

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.data).toMatchObject({
    id: seeded.id,
    title: seeded.title,
  });
});

test('rejects with NotFoundError on 404 without retrying', async () => {
  let requests = 0;
  server.use(
    http.get(`${env.API_URL}/documents/:documentId`, () => {
      requests += 1;
      return HttpResponse.json(
        { message: 'Documento não encontrado.' },
        { status: 404 },
      );
    }),
  );

  const { result } = renderUseDocument('id-desconhecido');

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(result.current.error).toBeInstanceOf(NotFoundError);
  expect(requests).toBe(1);
  await expect(
    getDocument({ documentId: 'id-desconhecido' }),
  ).rejects.toBeInstanceOf(NotFoundError);
});

test('a failed read adds no notification', async () => {
  const { result } = renderUseDocument('id-desconhecido');

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(useNotifications.getState().notifications).toHaveLength(0);
});
