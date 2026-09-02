import { z } from 'zod';

export const signUpSchema = z
  .object({
    email: z.string().email('Informe um e-mail válido.'),
    password: z.string().min(12, 'A senha precisa de pelo menos 12 caracteres.'),
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'As senhas não coincidem.',
  });

export type SignUpValues = z.infer<typeof signUpSchema>;
