import { z } from 'zod';

/** Tamanho máximo do nome, contado depois de aparar os espaços. */
export const ORG_UNIT_NAME_MAX_LENGTH = 120;

/**
 * Nome da unidade: aparado e normalizado para NFC antes de medir, para que
 * "Área" digitado de forma decomposta conte como quatro caracteres e case com
 * o mesmo nome digitado de forma composta.
 */
export const orgUnitNameSchema = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .normalize('NFC')
  .min(1, 'Informe o nome.')
  .max(ORG_UNIT_NAME_MAX_LENGTH, 'O nome pode ter no máximo 120 caracteres.');

/** Campos aceitos ao criar uma unidade filha. */
export const createOrgUnitSchema = z.strictObject(
  {
    parentId: z.string({ error: 'Informe a unidade mãe.' }),
    name: orgUnitNameSchema,
  },
  { error: 'Campo não permitido.' },
);

export type CreateOrgUnitInput = z.infer<typeof createOrgUnitSchema>;

/** Campos aceitos ao renomear: só o nome; a unidade mãe é imutável. */
export const updateOrgUnitSchema = z.strictObject(
  { name: orgUnitNameSchema },
  { error: 'Campo não permitido.' },
);

export type UpdateOrgUnitInput = z.infer<typeof updateOrgUnitSchema>;
