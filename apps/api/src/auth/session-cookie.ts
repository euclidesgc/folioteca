import type { CookieOptions } from 'express';

import { env } from '../config/env';

export const SESSION_COOKIE_NAME = 'folioteca_session';

/** Validade da sessão: 30 dias. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Opções do cookie de sessão: inacessível ao JavaScript da página. */
export function getSessionCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env.NODE_ENV === 'production',
    expires: expiresAt,
  };
}
