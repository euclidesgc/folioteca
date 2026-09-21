import { http, HttpResponse } from 'msw';
import { afterEach, expect, test, vi } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { env } from '@/config/env';
import { hardRedirect } from '@/lib/hard-redirect';
import { server } from '@/testing/mocks/server';

import { api } from '../api-client';
import {
  isNotFoundError,
  isUnauthenticatedError,
  NotFoundError,
  UnauthenticatedError,
} from '../errors';

// jsdom does not navigate: the end of a session is checked by this one call.
vi.mock('@/lib/hard-redirect', () => ({ hardRedirect: vi.fn() }));

afterEach(() => {
  vi.mocked(hardRedirect).mockClear();
  window.history.replaceState({}, '', '/');
});

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

test('rejects with UnauthenticatedError on 401', async () => {
  server.use(
    http.get(`${env.API_URL}/secure`, () =>
      HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 }),
    ),
  );

  await expect(api.get('/secure')).rejects.toBeInstanceOf(
    UnauthenticatedError,
  );
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

test('a 401 outside /auth redirects to /login with the current path in redirectTo', async () => {
  window.history.replaceState({}, '', '/favorites?x=1');
  server.use(
    http.get(`${env.API_URL}/secure`, () =>
      HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 }),
    ),
  );

  await expect(api.get('/secure')).rejects.toBeInstanceOf(
    UnauthenticatedError,
  );

  expect(hardRedirect).toHaveBeenCalledWith(
    `/login?redirectTo=${encodeURIComponent('/favorites?x=1')}`,
  );
});

test('a 401 from /auth/me does not redirect', async () => {
  window.history.replaceState({}, '', '/favorites');
  server.use(
    http.get(`${env.API_URL}/auth/me`, () =>
      HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 }),
    ),
  );

  await expect(api.get('/auth/me')).rejects.toBeInstanceOf(
    UnauthenticatedError,
  );

  expect(hardRedirect).not.toHaveBeenCalled();
});

test('a 401 while on /login does not redirect', async () => {
  window.history.replaceState({}, '', '/login');
  server.use(
    http.get(`${env.API_URL}/secure`, () =>
      HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 }),
    ),
  );

  await expect(api.get('/secure')).rejects.toBeInstanceOf(
    UnauthenticatedError,
  );

  expect(hardRedirect).not.toHaveBeenCalled();
});

test('a 404 rejects with NotFoundError and notifies', async () => {
  server.use(
    http.get(`${env.API_URL}/missing`, () =>
      HttpResponse.json(
        { message: 'Documento não encontrado.' },
        { status: 404 },
      ),
    ),
  );

  await expect(api.get('/missing')).rejects.toBeInstanceOf(NotFoundError);

  expect(notifications()).toHaveLength(1);
  expect(notifications()[0]).toMatchObject({
    type: 'error',
    title: 'Algo deu errado',
    message: 'Documento não encontrado.',
  });
});

test('a 404 with silentError rejects with NotFoundError and notifies nothing', async () => {
  server.use(
    http.get(`${env.API_URL}/missing`, () =>
      HttpResponse.json(
        { message: 'Documento não encontrado.' },
        { status: 404 },
      ),
    ),
  );

  await expect(
    api.get('/missing', { silentError: true }),
  ).rejects.toBeInstanceOf(NotFoundError);

  expect(notifications()).toHaveLength(0);
});

test('isNotFoundError is true only for NotFoundError', () => {
  expect(isNotFoundError(new NotFoundError())).toBe(true);
  expect(isNotFoundError(new UnauthenticatedError())).toBe(false);
  expect(isNotFoundError(new Error('outro erro'))).toBe(false);
});

test('no 401 case adds a notification', async () => {
  window.history.replaceState({}, '', '/favorites');
  server.use(
    http.get(`${env.API_URL}/secure`, () =>
      HttpResponse.json({ message: 'Não autenticado.' }, { status: 401 }),
    ),
    http.get(`${env.API_URL}/auth/me`, () =>
      HttpResponse.json({ message: 'Sessão não encontrada.' }, { status: 401 }),
    ),
  );

  await expect(api.get('/secure')).rejects.toBeDefined();
  await expect(api.get('/auth/me')).rejects.toBeDefined();

  expect(notifications()).toHaveLength(0);
});
