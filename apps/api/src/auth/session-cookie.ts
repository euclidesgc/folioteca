import type { CookieOptions } from 'express';

import { env } from '../config/env';

export const SESSION_COOKIE_NAME = 'folioteca_session';

/** Validade da sessão: 30 dias. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Atributos do cookie de sessão: inacessível ao JavaScript da página. São os
 * mesmos na gravação e na limpeza — o navegador só apaga o cookie quando os
 * atributos batem.
 */
export function getSessionCookieBaseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: env.NODE_ENV === 'production',
  };
}

/** Opções do cookie de sessão com o vencimento desta sessão. */
export function getSessionCookieOptions(expiresAt: Date): CookieOptions {
  return { ...getSessionCookieBaseOptions(), expires: expiresAt };
}
