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

/**
 * Campos aceitos ao aceitar um convite: nome e senha, nada mais.
 *
 * Não existe campo de e-mail: ele é o do convite. As regras e as mensagens são
 * as mesmas de `installation.schema.ts` — quem entra por convite escolhe a
 * senha sob as mesmas exigências de quem instalou a instância, sem regra nova
 * e sem regra afrouxada.
 */
export const acceptInvitationSchema = z.strictObject(
  {
    name: z
      .string({ error: 'Informe o seu nome.' })
      .trim()
      .min(1, 'Informe o seu nome.')
      .max(120, 'O nome pode ter no máximo 120 caracteres.'),
    password: z
      .string({ error: 'A senha precisa ter pelo menos 12 caracteres.' })
      .min(12, 'A senha precisa ter pelo menos 12 caracteres.')
      .max(128, 'A senha pode ter no máximo 128 caracteres.'),
  },
  { error: 'Campo não permitido.' },
);

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
