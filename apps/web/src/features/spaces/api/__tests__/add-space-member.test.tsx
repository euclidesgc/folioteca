import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { isAxiosError } from 'axios';
import { http, HttpResponse } from 'msw';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { env } from '@/config/env';
import { queryConfig } from '@/lib/react-query';
import type { MockPerson } from '@/testing/mocks/db';
import {
  addFreeSpace,
  getDb,
  seedInstalled,
  seedSamplePeople,
} from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';

import { addSpaceMember, useAddSpaceMember } from '../add-space-member';

// Every wait of this file gets an explicit budget instead of the implicit
// default.
const LAZY_TIMEOUT = { timeout: 5000 };

const INSTALLED_PERSON_ID = 'person-1';

beforeEach(() => {
  seedInstalled({ signedIn: true });
  seedSamplePeople();
});

const firstSamplePerson = (): MockPerson => {
  const [person] = getDb().people;
  if (!person) throw new Error('o banco simulado está sem pessoas');
  return person;
};

const createWrapper = (queryClient: QueryClient) =>
  function Wrapper({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

test('addSpaceMember sends PUT to the space member path', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  const person = firstSamplePerson();
  const requests: { method: string; path: string }[] = [];
  server.use(
    http.put(
      `${env.API_URL}/spaces/:spaceId/members/:personId`,
      ({ request }) => {
        requests.push({
          method: request.method,
          path: new URL(request.url).pathname,
        });
        return HttpResponse.json({
          data: { id: person.id, name: person.name, email: person.email },
        });
      },
    ),
  );

  const response = await addSpaceMember({
    spaceId: space.id,
    personId: person.id,
  });

  expect(requests).toHaveLength(1);
  expect(requests[0]?.method).toBe('PUT');
  expect(requests[0]?.path).toMatch(
    new RegExp(`/spaces/${space.id}/members/${person.id}$`),
  );
  expect(response).toEqual({
    data: { id: person.id, name: person.name, email: person.email },
  });
});

test('useAddSpaceMember returns the person summary', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  const person = firstSamplePerson();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  const { result } = renderHook(() => useAddSpaceMember(), {
    wrapper: createWrapper(queryClient),
  });

  result.current.mutate({ spaceId: space.id, personId: person.id });

  await waitFor(
    () => expect(result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
  expect(result.current.data).toEqual({
    data: { id: person.id, name: person.name, email: person.email },
  });
  expect(getDb().spaceMembers).toEqual([
    { spaceId: space.id, personId: person.id },
  ]);
});

test('useAddSpaceMember exposes the server message on 400', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  const queryClient = new QueryClient({ defaultOptions: queryConfig });

  const { result } = renderHook(() => useAddSpaceMember(), {
    wrapper: createWrapper(queryClient),
  });

  result.current.mutate({ spaceId: space.id, personId: 'person-inexistente' });

  await waitFor(() => expect(result.current.isError).toBe(true), LAZY_TIMEOUT);
  expect(isAxiosError(result.current.error)).toBe(true);
  expect(result.current.error).toMatchObject({
    response: {
      status: 400,
      data: { message: 'Pessoa não encontrada nesta instância.' },
    },
  });
  expect(getDb().spaceMembers).toEqual([]);
});

test('useAddSpaceMember does not invalidate the spaces query', async () => {
  const space = addFreeSpace(INSTALLED_PERSON_ID, 'Comissão de Leitura');
  const person = firstSamplePerson();
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  queryClient.setQueryData(['spaces'], {
    data: [{ id: space.id, type: 'free', name: 'Comissão de Leitura' }],
  });

  const { result } = renderHook(() => useAddSpaceMember(), {
    wrapper: createWrapper(queryClient),
  });

  result.current.mutate({ spaceId: space.id, personId: person.id });

  await waitFor(
    () => expect(result.current.isSuccess).toBe(true),
    LAZY_TIMEOUT,
  );
  expect(queryClient.getQueryState(['spaces'])?.isInvalidated).toBe(false);
});
