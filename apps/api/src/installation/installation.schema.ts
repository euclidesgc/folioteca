import { z } from 'zod';

/** Campos da instalação. O código de instalação é conferido à parte. */
export const createInstallationSchema = z.object({
  organizationName: z
    .string({ error: 'Informe o nome da organização.' })
    .trim()
    .min(1, 'Informe o nome da organização.')
    .max(120, 'O nome da organização pode ter no máximo 120 caracteres.'),
  name: z
    .string({ error: 'Informe o seu nome.' })
    .trim()
    .min(1, 'Informe o seu nome.')
    .max(120, 'O nome pode ter no máximo 120 caracteres.'),
  email: z
    .string({ error: 'Informe o e-mail.' })
    .trim()
    .toLowerCase()
    .min(1, 'Informe o e-mail.')
    .pipe(z.email('Informe um e-mail válido.')),
  password: z
    .string({ error: 'A senha precisa ter pelo menos 12 caracteres.' })
    .min(12, 'A senha precisa ter pelo menos 12 caracteres.')
    .max(128, 'A senha pode ter no máximo 128 caracteres.'),
});

export type CreateInstallationInput = z.infer<typeof createInstallationSchema>;
