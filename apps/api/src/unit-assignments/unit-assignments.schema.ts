import { z } from 'zod';

/**
 * Campos aceitos ao lotar alguém: só a pessoa. A unidade vem da rota, e o
 * objeto é estrito para que campo desconhecido vire 400, como no `PATCH` de
 * unidades.
 */
export const assignPersonSchema = z.strictObject(
  { personId: z.string({ error: 'Informe a pessoa.' }).min(1, 'Informe a pessoa.') },
  { error: 'Campo não permitido.' },
);

export type AssignPersonInput = z.infer<typeof assignPersonSchema>;
