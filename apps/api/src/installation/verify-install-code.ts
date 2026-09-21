import { createHash, timingSafeEqual } from 'node:crypto';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Compara o código recebido com o esperado em tempo constante, sobre o
 * `sha256` dos dois (os buffers têm sempre o mesmo tamanho).
 */
export function verifyInstallCode(
  provided: unknown,
  expected: string | undefined,
): boolean {
  if (expected === undefined || expected === '') {
    return false;
  }

  if (typeof provided !== 'string' || provided === '') {
    return false;
  }

  return timingSafeEqual(sha256(provided), sha256(expected));
}
