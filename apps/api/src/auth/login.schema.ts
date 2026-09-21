import { z } from 'zod';

/**
 * Campos do login. A senha não repete a política de tamanho mínimo da
 * instalação: quem já tem conta informa a senha que existe, seja qual for.
 */
export const loginSchema = z.object({
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail.')
    .pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string({ error: 'Informe a senha.' })
    .min(1, 'Informe a senha.')
    .max(128, 'A senha pode ter no máximo 128 caracteres.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
