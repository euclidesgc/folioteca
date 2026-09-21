import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { expect, test, vi } from 'vitest';

import { queryConfig } from '@/lib/react-query';
import { seedInstalled } from '@/testing/mocks/db';
import { MOCK_INSTALL_CODE } from '@/testing/mocks/utils';

import {
  type CreateInstallationInput,
  createInstallationInputSchema,
  useCreateInstallation,
} from '../create-installation';

const validInput = (): CreateInstallationInput => ({
  code: MOCK_INSTALL_CODE,
  organizationName: 'Biblioteca Municipal de Exemplo',
  name: 'Ana Souza',
  email: 'ana.souza@exemplo.com.br',
  // Generated at run time: never a literal that looks like a real credential.
  password: crypto.randomUUID(),
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

  const view = renderHook(() => useCreateInstallation(), { wrapper });
  return { ...view, queryClient };
};

test('schema accepts a valid input', () => {
  const result = createInstallationInputSchema.safeParse(validInput());

  expect(result.success).toBe(true);
});

test('schema rejects an 11 character password with the literal message', () => {
  const result = createInstallationInputSchema.safeParse({
    ...validInput(),
    password: 'x'.repeat(11),
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(
    'A senha precisa ter pelo menos 12 caracteres.',
  );
});

test('schema rejects a 129 character password', () => {
  const result = createInstallationInputSchema.safeParse({
    ...validInput(),
    password: 'x'.repeat(129),
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(
    'A senha pode ter no máximo 128 caracteres.',
  );
});

test('schema rejects an invalid email and empty required fields', () => {
  const result = createInstallationInputSchema.safeParse({
    code: '',
    organizationName: '',
    name: '',
    email: 'nao-e-um-email',
    password: crypto.randomUUID(),
  });

  expect(result.success).toBe(false);

  const messages = (result.error?.issues ?? []).map((issue) => issue.message);
  expect(messages).toContain('Informe o código de instalação.');
  expect(messages).toContain('Informe o nome da organização.');
  expect(messages).toContain('Informe o seu nome.');
  expect(messages).toContain('Informe um e-mail válido.');
});

test('on success writes the user and installed true to the cache', async () => {
  const { result, queryClient } = renderMutation();

  result.current.mutate({ data: validInput() });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  expect(queryClient.getQueryData(['authenticated-user'])).toMatchObject({
    organization: { name: 'Biblioteca Municipal de Exemplo' },
    person: { name: 'Ana Souza' },
  });
  expect(queryClient.getQueryData(['installation'])).toEqual({
    data: { installed: true },
  });
});

test('on error invalidates the installation query', async () => {
  seedInstalled({ signedIn: false });
  const { result, queryClient } = renderMutation();
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  result.current.mutate({ data: validInput() });

  await waitFor(() => expect(result.current.isError).toBe(true));

  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: ['installation'],
  });
});
