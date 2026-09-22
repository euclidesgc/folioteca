import { z } from 'zod';

/**
 * Campos aceitos ao convidar alguém: só o e-mail.
 *
 * O encadeamento (`trim` → `toLowerCase` → `z.email`) é o mesmo de
 * `installation.schema.ts`, de propósito: o e-mail do convite e o e-mail da
 * pessoa precisam normalizar igual, e é disso que depende o 409 de "esta
 * pessoa já faz parte da organização". Mudar a normalização só de um lado
 * quebra esse 409.
 */
export const createInvitationSchema = z.strictObject(
  {
    email: z
      .string({ error: 'Informe o e-mail.' })
      .trim()
      .toLowerCase()
      .min(1, 'Informe o e-mail.')
      .pipe(z.email('Informe um e-mail válido.')),
  },
  { error: 'Campo não permitido.' },
);

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
