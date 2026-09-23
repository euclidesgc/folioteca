import { z } from 'zod';

/** Tamanho máximo do nome, contado depois de aparar os espaços. */
export const SPACE_NAME_MAX_LENGTH = 120;

/**
 * Nome do espaço livre: aparado e normalizado para NFC antes de medir, com as
 * mesmas regras e mensagens do nome de unidade. As regras são copiadas, e não
 * importadas de `org-units`, para os dois módulos poderem divergir sem se
 * arrastar.
 */
export const spaceNameSchema = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .normalize('NFC')
  .min(1, 'Informe o nome.')
  .max(SPACE_NAME_MAX_LENGTH, 'O nome pode ter no máximo 120 caracteres.');

/**
 * Campos aceitos ao criar um espaço livre: só o nome. Organização e dona vêm
 * da sessão; mandá-las no corpo é campo extra e recusado.
 */
export const createSpaceSchema = z.strictObject(
  { name: spaceNameSchema },
  { error: 'Campo não permitido.' },
);

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
