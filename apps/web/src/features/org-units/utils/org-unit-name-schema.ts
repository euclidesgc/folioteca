import { z } from 'zod';

// Same rules and same messages as the API schema: trimmed, normalized to NFC
// before measuring (so "Área" typed decomposed counts four characters), one
// to 120 characters.
export const ORG_UNIT_NAME_MAX_LENGTH = 120;

export const orgUnitNameSchema = z
  .string({ error: 'Informe o nome.' })
  .trim()
  .normalize('NFC')
  .min(1, 'Informe o nome.')
  .max(ORG_UNIT_NAME_MAX_LENGTH, 'O nome pode ter no máximo 120 caracteres.');
