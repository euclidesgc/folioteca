import { createHash } from 'node:crypto';

/**
 * Só o hash de um segredo opaco vai para o banco — sessões e convites usam o
 * mesmo desenho. O valor em claro existe apenas no cookie (sessão) ou no link
 * (convite), e nunca é gravado nem registrado.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
