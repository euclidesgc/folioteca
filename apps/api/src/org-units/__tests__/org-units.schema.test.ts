import {
  ORG_UNIT_NAME_MAX_LENGTH,
  createOrgUnitSchema,
  orgUnitNameSchema,
  updateOrgUnitSchema,
  updateOrgUnitSpaceSchema,
} from '../org-units.schema';

const REQUIRED_MESSAGE = 'Informe o nome.';

const TOO_LONG_MESSAGE = 'O nome pode ter no máximo 120 caracteres.';

const PARENT_REQUIRED_MESSAGE = 'Informe a unidade mãe.';

const UNKNOWN_KEY_MESSAGE = 'Campo não permitido.';

const PARENT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

/** Primeira mensagem de erro do resultado, para comparar com o critério. */
function firstMessage(result: { error?: { issues: { message: string }[] } }): string {
  return result.error?.issues[0]?.message ?? '';
}

test('trims the name', () => {
  const result = orgUnitNameSchema.safeParse('  Área Técnica  ');

  expect(result.success).toBe(true);
  expect(result.data).toBe('Área Técnica');
});

test('normalizes the name to NFC', () => {
  const decomposed = 'Área';

  const result = orgUnitNameSchema.safeParse(decomposed);

  expect(result.success).toBe(true);
  expect(result.data).toBe('Área');
  expect(result.data).toHaveLength(4);
});

test('rejects an empty name with the message', () => {
  const result = orgUnitNameSchema.safeParse('');

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(REQUIRED_MESSAGE);
});

test('rejects a name of only spaces with the message', () => {
  const result = orgUnitNameSchema.safeParse('     ');

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(REQUIRED_MESSAGE);
});

test('accepts a name of 120 characters', () => {
  const name = 'a'.repeat(ORG_UNIT_NAME_MAX_LENGTH);

  const result = orgUnitNameSchema.safeParse(name);

  expect(result.success).toBe(true);
  expect(result.data).toBe(name);
});

test('rejects a name of 121 characters with the message', () => {
  const result = orgUnitNameSchema.safeParse(
    'a'.repeat(ORG_UNIT_NAME_MAX_LENGTH + 1),
  );

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(TOO_LONG_MESSAGE);
});

test('rejects a missing name with the message', () => {
  const result = updateOrgUnitSchema.safeParse({});

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(REQUIRED_MESSAGE);
});

test('create rejects a missing parentId with the message', () => {
  const result = createOrgUnitSchema.safeParse({ name: 'Acervo' });

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(PARENT_REQUIRED_MESSAGE);
});

test('create rejects an unknown key', () => {
  const result = createOrgUnitSchema.safeParse({
    parentId: PARENT_ID,
    name: 'Acervo',
    tipo: 'setor',
  });

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(UNKNOWN_KEY_MESSAGE);
});

test('update rejects parentId as an unknown key', () => {
  const result = updateOrgUnitSchema.safeParse({
    name: 'Acervo',
    parentId: PARENT_ID,
  });

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(UNKNOWN_KEY_MESSAGE);
});

const ACCESS_REQUIRED_MESSAGE = 'Escolha o modo de acesso.';

test('updateOrgUnitSpaceSchema accepts own and inherit', () => {
  const own = updateOrgUnitSpaceSchema.safeParse({ access: 'own' });
  const inherit = updateOrgUnitSpaceSchema.safeParse({ access: 'inherit' });

  expect(own.success).toBe(true);
  expect(own.data).toEqual({ access: 'own' });
  expect(inherit.success).toBe(true);
  expect(inherit.data).toEqual({ access: 'inherit' });
});

test('updateOrgUnitSpaceSchema rejects a missing access with Escolha o modo de acesso.', () => {
  const result = updateOrgUnitSpaceSchema.safeParse({});

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(ACCESS_REQUIRED_MESSAGE);
});

test('updateOrgUnitSpaceSchema rejects an unknown value', () => {
  const result = updateOrgUnitSpaceSchema.safeParse({ access: 'public' });

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(ACCESS_REQUIRED_MESSAGE);
});

test('updateOrgUnitSpaceSchema rejects extra fields with Campo não permitido.', () => {
  const result = updateOrgUnitSpaceSchema.safeParse({
    access: 'own',
    parentId: PARENT_ID,
  });

  expect(result.success).toBe(false);
  expect(firstMessage(result)).toBe(UNKNOWN_KEY_MESSAGE);
});
