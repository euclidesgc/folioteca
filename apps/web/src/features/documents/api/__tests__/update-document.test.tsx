import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, expect, test, vi } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import type { MockDocument } from '@/testing/mocks/db';
import { getDb, seedInstalled, seedSampleDocuments } from '@/testing/mocks/db';

import { getDocumentQueryOptions } from '../get-document';
import { getDocumentsQueryOptions } from '../get-documents';
import {
  updateDocumentInputSchema,
  useUpdateDocument,
} from '../update-document';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSampleDocuments();
});

const firstSeededDocument = (): MockDocument => {
  const [document] = getDb().documents;
  if (!document) throw new Error('o banco simulado está sem documentos');
  return document;
};

const renderMutation = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const view = renderHook(() => useUpdateDocument(), { wrapper });
  return { ...view, queryClient };
};

test('updateDocumentInputSchema trims the title', () => {
  const result = updateDocumentInputSchema.safeParse({
    title: '  Ata da reunião  ',
  });

  expect(result.success).toBe(true);
  expect(result.data?.title).toBe('Ata da reunião');
});

test('updateDocumentInputSchema keeps an empty title empty', () => {
  const result = updateDocumentInputSchema.safeParse({ title: '   ' });

  expect(result.success).toBe(true);
  expect(result.data?.title).toBe('');
});

test('updateDocumentInputSchema rejects 201 characters with the literal message', () => {
  const result = updateDocumentInputSchema.safeParse({
    title: 'a'.repeat(201),
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(
    'O título pode ter no máximo 200 caracteres.',
  );
});

test('patches the title and writes the response to the item cache', async () => {
  const seeded = firstSeededDocument();
  const { result, queryClient } = renderMutation();

  result.current.mutate({
    documentId: seeded.id,
    data: { title: 'Ata revisada' },
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(result.current.data?.data.title).toBe('Ata revisada');
  expect(
    queryClient.getQueryData(getDocumentQueryOptions(seeded.id).queryKey),
  ).toEqual(result.current.data);
});

test('invalidates the documents list', async () => {
  const seeded = firstSeededDocument();
  const { result, queryClient } = renderMutation();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  result.current.mutate({
    documentId: seeded.id,
    data: { title: 'Ata revisada' },
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getDocumentsQueryOptions().queryKey,
  });
});
