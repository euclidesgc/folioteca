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
  /**
   * Origens autorizadas a abrir o WebSocket de `/collab`, separadas por
   * vírgula. Ausente ou vazia vira lista vazia: sem lista, a porta do upgrade
   * compara a origem com o `Host` do pedido (mesma origem).
   */
  COLLAB_ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ''),
    ),
  /** Espera antes de gravar o conteúdo do documento, em milissegundos. */
  COLLAB_STORE_DEBOUNCE_MS: z.coerce
    .number()
    .int('COLLAB_STORE_DEBOUNCE_MS precisa ser um número inteiro.')
    .positive('COLLAB_STORE_DEBOUNCE_MS precisa ser maior que zero.')
    .default(2000),
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
