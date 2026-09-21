import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória.'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.string().min(1).default('development'),
  /**
   * Código de instalação. Ausente ou vazio vira `undefined`: sem ele a
   * instalação fica bloqueada, mas a API continua de pé.
   */
  INSTALL_CODE: z
    .string()
    .transform((value) => (value === '' ? undefined : value))
    .refine(
      (value) => value === undefined || value.length >= 16,
      'INSTALL_CODE precisa ter pelo menos 16 caracteres.',
    )
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (source: NodeJS.ProcessEnv): Env => {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    throw new Error(`Variáveis de ambiente inválidas — ${details}`);
  }

  return result.data;
};

export const env = parseEnv(process.env);
