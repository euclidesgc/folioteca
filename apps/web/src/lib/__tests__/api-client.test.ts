import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { server } from '@/testing/mocks/server';

import { api } from '../api-client';
import { isUnauthenticatedError, UnauthenticatedError } from '../errors';

const GENERIC_MESSAGE =
  'Não foi possível concluir a operação. Tente novamente em instantes.';

const notifications = () => useNotifications.getState().notifications;

test('returns the response body instead of the axios response', async () => {
  server.use(
    http.get(`${env.API_URL}/ping`, () => HttpResponse.json({ ok: true })),
  );

  const result = await api.get('/ping');

  expect(result).toEqual({ ok: true });
});

test('rejects with UnauthenticatedError on 401 without redirecting', async () => {
  server.use(
    http.get(`${env.API_URL}/secure`, () =>
      HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 }),
    ),
  );
  const hrefBefore = window.location.href;

  await expect(api.get('/secure')).rejects.toBeInstanceOf(
    UnauthenticatedError,
  );
  expect(window.location.href).toBe(hrefBefore);
});

test('rejects with the original error on 500', async () => {
  server.use(
    http.get(`${env.API_URL}/broken`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  await expect(api.get('/broken')).rejects.toMatchObject({
    response: { status: 500 },
  });
  await expect(api.get('/broken')).rejects.not.toBeInstanceOf(
    UnauthenticatedError,
  );
});

test('isUnauthenticatedError narrows only UnauthenticatedError', () => {
  expect(isUnauthenticatedError(new UnauthenticatedError())).toBe(true);
  expect(isUnauthenticatedError(new Error('outro erro'))).toBe(false);
});

test('sends X-Requested-With on every request', async () => {
  let header: string | null = null;
  server.use(
    http.get(`${env.API_URL}/ping`, ({ request }) => {
      header = request.headers.get('X-Requested-With');
      return HttpResponse.json({ ok: true });
    }),
  );

  await api.get('/ping');

  expect(header).toBe('XMLHttpRequest');
});

test('notifies with the server message on 4xx', async () => {
  server.use(
    http.get(`${env.API_URL}/invalid`, () =>
      HttpResponse.json({ message: 'Dados inválidos.' }, { status: 400 }),
    ),
  );

  await expect(api.get('/invalid')).rejects.toBeDefined();

  expect(notifications()).toHaveLength(1);
  expect(notifications()[0]).toMatchObject({
    type: 'error',
    title: 'Algo deu errado',
    message: 'Dados inválidos.',
  });
});

test('notifies with the generic message on 500', async () => {
  server.use(
    http.get(`${env.API_URL}/broken`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  await expect(api.get('/broken')).rejects.toBeDefined();

  expect(notifications()[0]).toMatchObject({
    title: 'Algo deu errado',
    message: GENERIC_MESSAGE,
  });
});

test('notifies with the generic message on a network error', async () => {
  server.use(http.get(`${env.API_URL}/offline`, () => HttpResponse.error()));

  await expect(api.get('/offline')).rejects.toBeDefined();

  expect(notifications()[0]).toMatchObject({
    title: 'Algo deu errado',
    message: GENERIC_MESSAGE,
  });
});

test('does not notify when silentError is true', async () => {
  server.use(
    http.get(`${env.API_URL}/broken`, () =>
      HttpResponse.json({ message: 'Erro interno.' }, { status: 500 }),
    ),
  );

  await expect(
    api.get('/broken', { silentError: true }),
  ).rejects.toBeDefined();

  expect(notifications()).toHaveLength(0);
});

test('does not notify on 401', async () => {
  server.use(
    http.get(`${env.API_URL}/secure`, () =>
      HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 }),
    ),
  );

  await expect(api.get('/secure')).rejects.toBeInstanceOf(
    UnauthenticatedError,
  );

  expect(notifications()).toHaveLength(0);
});
