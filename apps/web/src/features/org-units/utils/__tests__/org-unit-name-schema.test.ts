import { expect, test } from 'vitest';

import {
  ORG_UNIT_NAME_MAX_LENGTH,
  orgUnitNameSchema,
} from '../org-unit-name-schema';

const firstMessage = (value: string): string | undefined => {
  const result = orgUnitNameSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
};

test('trims the name', () => {
  const result = orgUnitNameSchema.safeParse('  Catalogação  ');

  expect(result.success).toBe(true);
  expect(result.success ? result.data : null).toBe('Catalogação');
});

test('normalizes the name to NFC', () => {
  // "Área" typed with a combining accent: five code units before, four after.
  const decomposed = 'Área Administrativa';

  const result = orgUnitNameSchema.safeParse(decomposed);

  expect(result.success).toBe(true);
  expect(result.success ? result.data : null).toBe('Área Administrativa');
});

test('rejects an empty name with the message', () => {
  expect(orgUnitNameSchema.safeParse('').success).toBe(false);
  expect(firstMessage('')).toBe('Informe o nome.');
});

test('rejects only spaces with the message', () => {
  expect(orgUnitNameSchema.safeParse('   ').success).toBe(false);
  expect(firstMessage('   ')).toBe('Informe o nome.');
});

test('accepts 120 characters', () => {
  const name = 'a'.repeat(ORG_UNIT_NAME_MAX_LENGTH);

  expect(ORG_UNIT_NAME_MAX_LENGTH).toBe(120);
  expect(orgUnitNameSchema.safeParse(name).success).toBe(true);
});

test('rejects 121 characters with the message', () => {
  const name = 'a'.repeat(ORG_UNIT_NAME_MAX_LENGTH + 1);

  expect(orgUnitNameSchema.safeParse(name).success).toBe(false);
  expect(firstMessage(name)).toBe(
    'O nome pode ter no máximo 120 caracteres.',
  );
});
