import type { IncomingHttpHeaders } from 'node:http';

import { parse as parseCookies } from 'cookie';

import { SESSION_COOKIE_NAME } from '../auth/session-cookie';

/** Resultado da porta do upgrade: passa com o token, ou recusa com um status. */
export type UpgradeDecision =
  | { ok: true; sessionToken: string }
  | { ok: false; status: 401 | 403 };

/** Caminho do WebSocket de colaboração, fora do prefixo `/api`. */
const COLLAB_PATH = '/collab';

function readOrigin(value: string | undefined): URL | null {
  if (value === undefined || value === '') {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Decides whether an upgrade request may become a WebSocket.
 *
 * Origin is checked first, and on its own: the session cookie is `SameSite=Lax`
 * and WebSocket handshakes are not protected by CORS, so the browser would
 * happily attach the cookie to a socket opened by another site. Without that
 * check any page could talk to `/collab` as the logged in person.
 */
export function checkUpgradeRequest(
  headers: IncomingHttpHeaders,
  allowedOrigins: string[],
): UpgradeDecision {
  const origin = readOrigin(headers.origin);

  if (origin === null) {
    return { ok: false, status: 403 };
  }

  if (allowedOrigins.length > 0) {
    if (!allowedOrigins.includes(origin.origin)) {
      return { ok: false, status: 403 };
    }
  } else if (headers.host === undefined || headers.host !== origin.host) {
    return { ok: false, status: 403 };
  }

  const cookies = parseCookies(headers.cookie ?? '');
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken === undefined || sessionToken === '') {
    return { ok: false, status: 401 };
  }

  return { ok: true, sessionToken };
}

/** Diz se o pedido é para o caminho do WebSocket de colaboração. */
export function isCollabPath(url: string | undefined): boolean {
  if (url === undefined) {
    return false;
  }

  const [path] = url.split('?');

  return path === COLLAB_PATH;
}
