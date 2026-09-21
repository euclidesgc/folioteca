import type { IncomingHttpHeaders } from 'node:http';

import { SESSION_COOKIE_NAME } from '../../auth/session-cookie';
import { checkUpgradeRequest, isCollabPath } from '../upgrade-gate';

const HOST = '127.0.0.1:3000';
const SAME_ORIGIN = `http://${HOST}`;
const TOKEN = 'token-de-sessao';

function headers(values: IncomingHttpHeaders): IncomingHttpHeaders {
  return values;
}

function sessionCookie(value: string): string {
  return `${SESSION_COOKIE_NAME}=${value}`;
}

test('refuses with 403 when Origin is missing', () => {
  const decision = checkUpgradeRequest(
    headers({ host: HOST, cookie: sessionCookie(TOKEN) }),
    [],
  );

  expect(decision).toEqual({ ok: false, status: 403 });
});

test('refuses with 403 when Origin is not a valid URL', () => {
  const decision = checkUpgradeRequest(
    headers({
      host: HOST,
      origin: 'nao-e-uma-url',
      cookie: sessionCookie(TOKEN),
    }),
    [],
  );

  expect(decision).toEqual({ ok: false, status: 403 });
});

test('accepts an Origin whose host equals the Host header', () => {
  const decision = checkUpgradeRequest(
    headers({
      host: HOST,
      origin: SAME_ORIGIN,
      cookie: sessionCookie(TOKEN),
    }),
    [],
  );

  expect(decision).toEqual({ ok: true, sessionToken: TOKEN });
});

test('refuses with 403 when the Origin host differs from the Host header', () => {
  const decision = checkUpgradeRequest(
    headers({
      host: HOST,
      origin: 'http://outro.exemplo.org',
      cookie: sessionCookie(TOKEN),
    }),
    [],
  );

  expect(decision).toEqual({ ok: false, status: 403 });
});

test('refuses with 403 when the Host header is missing', () => {
  const decision = checkUpgradeRequest(
    headers({ origin: SAME_ORIGIN, cookie: sessionCookie(TOKEN) }),
    [],
  );

  expect(decision).toEqual({ ok: false, status: 403 });
});

test.each([
  { origin: 'http://app.exemplo.org', expected: { ok: true } },
  { origin: 'https://outro.exemplo.org', expected: { ok: false } },
])('with an allow list accepts only listed origins ($origin)', ({
  origin,
  expected,
}) => {
  const decision = checkUpgradeRequest(
    headers({ host: HOST, origin, cookie: sessionCookie(TOKEN) }),
    ['http://app.exemplo.org', 'https://seguro.exemplo.org'],
  );

  expect(decision.ok).toBe(expected.ok);
});

test('with an allow list ignores the Host comparison', () => {
  const listed = checkUpgradeRequest(
    headers({
      host: HOST,
      origin: 'http://app.exemplo.org',
      cookie: sessionCookie(TOKEN),
    }),
    ['http://app.exemplo.org'],
  );

  const sameHostOutsideTheList = checkUpgradeRequest(
    headers({
      host: HOST,
      origin: SAME_ORIGIN,
      cookie: sessionCookie(TOKEN),
    }),
    ['http://app.exemplo.org'],
  );

  expect(listed).toEqual({ ok: true, sessionToken: TOKEN });
  expect(sameHostOutsideTheList).toEqual({ ok: false, status: 403 });
});

test('refuses with 401 when the session cookie is missing', () => {
  const decision = checkUpgradeRequest(
    headers({ host: HOST, origin: SAME_ORIGIN }),
    [],
  );

  expect(decision).toEqual({ ok: false, status: 401 });
});

test('refuses with 401 when the session cookie is empty', () => {
  const decision = checkUpgradeRequest(
    headers({
      host: HOST,
      origin: SAME_ORIGIN,
      cookie: sessionCookie(''),
    }),
    [],
  );

  expect(decision).toEqual({ ok: false, status: 401 });
});

test('returns the session token among other cookies', () => {
  const decision = checkUpgradeRequest(
    headers({
      host: HOST,
      origin: SAME_ORIGIN,
      cookie: `tema=escuro; ${sessionCookie(TOKEN)}; idioma=pt-BR`,
    }),
    [],
  );

  expect(decision).toEqual({ ok: true, sessionToken: TOKEN });
});

test.each(['/collab', '/collab?documento=abc'])(
  'isCollabPath accepts /collab with or without a query string (%s)',
  (url) => {
    expect(isCollabPath(url)).toBe(true);
  },
);

test.each(['/collabs', '/api/collab', '/collab/abc', '/', undefined])(
  'isCollabPath refuses other paths, prefixes and undefined (%s)',
  (url) => {
    expect(isCollabPath(url)).toBe(false);
  },
);
