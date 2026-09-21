import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { env } from '@/config/env';
import { server } from '@/testing/mocks/server';

import { api } from '../api-client';
import { isUnauthenticatedError, UnauthenticatedError } from '../errors';

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
