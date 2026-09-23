import { expect, test } from 'vitest';

import { spaceNameSchema } from '../space-name-schema';

test('accepts a trimmed name', () => {
  const result = spaceNameSchema.safeParse('  Comissão de Leitura  ');

  expect(result.success).toBe(true);
  expect(result.data).toBe('Comissão de Leitura');
});

test('rejects an empty name with Informe o nome.', () => {
  const result = spaceNameSchema.safeParse('');

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Informe o nome.');
});

test('rejects a name of only spaces', () => {
  const result = spaceNameSchema.safeParse('   ');

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Informe o nome.');
});

test('rejects a name longer than 120 characters', () => {
  const result = spaceNameSchema.safeParse('a'.repeat(121));

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(
    'O nome pode ter no máximo 120 caracteres.',
  );
});
