import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import type React from 'react';
import { beforeEach, expect, test } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import type { MockPerson } from '@/testing/mocks/db';
import { getDb, seedInstalled } from '@/testing/mocks/db';

import { usePageWidth, usePageWidthStore } from '../page-width-store';

beforeEach(() => {
  usePageWidthStore.setState(usePageWidthStore.getInitialState());
  seedInstalled({ signedIn: true });
});

const signedInPerson = (): MockPerson => {
  const person = getDb().installation?.person;
  if (!person) throw new Error('o banco simulado está sem instalação');
  return person;
};

const renderPageWidth = () => {
  const queryClient = new QueryClient({ defaultOptions: queryConfig });
  const wrapper = ({
    children,
  }: {
    children: React.ReactNode;
  }): React.JSX.Element =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return renderHook(() => usePageWidth(), { wrapper });
};

test('usePageWidth returns the server value when there is no session choice', async () => {
  signedInPerson().documentPageWidth = 'large';

  const { result } = renderPageWidth();

  await waitFor(() => expect(result.current).toBe('large'));
});

test('usePageWidth returns the session choice for the same person', async () => {
  const person = signedInPerson();
  person.documentPageWidth = 'large';

  const { result } = renderPageWidth();
  await waitFor(() => expect(result.current).toBe('large'));

  act(() => {
    usePageWidthStore
      .getState()
      .setSessionChoice({ personId: person.id, width: 'full' });
  });

  expect(result.current).toBe('full');
});

test('usePageWidth ignores a session choice from another person', async () => {
  const person = signedInPerson();
  person.documentPageWidth = 'large';

  const { result } = renderPageWidth();
  await waitFor(() => expect(result.current).toBe('large'));

  act(() => {
    usePageWidthStore
      .getState()
      .setSessionChoice({ personId: `${person.id}-outra`, width: 'full' });
  });

  expect(result.current).toBe('large');
});
