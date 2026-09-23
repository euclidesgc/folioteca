import { z } from 'zod';

// Same rules and same messages as the API schema (`spaces.schema.ts`):
// trimmed, normalized to NFC before measuring (so "Área" typed decomposed
// counts four characters), one to 120 characters. Written here and not
// imported from `org-units`: a feature does not import from another one.
export const SPACE_NAME_MAX_LENGTH = 120;

export const spaceNameSchema = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .normalize('NFC')
  .min(1, 'Informe o nome.')
  .max(SPACE_NAME_MAX_LENGTH, 'O nome pode ter no máximo 120 caracteres.');
