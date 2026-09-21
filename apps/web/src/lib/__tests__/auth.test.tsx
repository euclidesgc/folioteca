import { http, HttpResponse } from 'msw';
import type React from 'react';
import { expect, test } from 'vitest';

import { env } from '@/config/env';
import { seedInstalled } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { renderApp, screen } from '@/testing/test-utils';

import { AuthLoader, getUser } from '../auth';

const renderAuthLoader = (): ReturnType<typeof renderApp> =>
  renderApp(
    <AuthLoader
      renderLoading={(): React.JSX.Element => <p>Carregando sessão…</p>}
      renderError={(): React.JSX.Element => (
        <p role="alert">Não foi possível abrir a sessão.</p>
      )}
    >
      <p>Conteúdo protegido</p>
    </AuthLoader>,
  );

test('getUser returns the current user from the data envelope', async () => {
  seedInstalled({ signedIn: true });

  const user = await getUser();

  expect(user?.organization.name).toBe('Biblioteca Municipal de Exemplo');
  expect(user?.person.name).toBe('Ana Souza');
});

test('getUser returns null on 401', async () => {
  await expect(getUser()).resolves.toBeNull();
});

test('getUser rethrows on 500', async () => {
  server.use(
    http.get(`${env.API_URL}/auth/me`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  await expect(getUser()).rejects.toMatchObject({
    response: { status: 500 },
  });
});

test('AuthLoader renders renderLoading while pending', () => {
  server.use(
    http.get(`${env.API_URL}/auth/me`, async () => {
      await new Promise(() => {});
    }),
  );

  renderAuthLoader();

  expect(screen.getByText('Carregando sessão…')).toBeInTheDocument();
});

test('AuthLoader renders children when the user resolves to null', async () => {
  renderAuthLoader();

  expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
});

test('AuthLoader renders renderError on failure', async () => {
  server.use(
    http.get(`${env.API_URL}/auth/me`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  renderAuthLoader();

  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
