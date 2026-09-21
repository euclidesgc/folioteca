import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Valida o corpo com o schema informado. Em falha, lança um 400 no formato
 * único de erro da API, com um item por problema encontrado.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new BadRequestException({
      message: 'Dados inválidos.',
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return result.data;
}
