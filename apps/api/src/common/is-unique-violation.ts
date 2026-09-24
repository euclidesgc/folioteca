import { Prisma } from '@prisma/client';

export const UNIQUE_VIOLATION = 'P2002';

/**
 * Tells whether the error is Prisma's report of a unique constraint or unique
 * index violation. Pure: it only looks at the error it receives.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  );
}
