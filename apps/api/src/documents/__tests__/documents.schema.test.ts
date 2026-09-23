import {
  DEFAULT_DOCUMENT_TITLE,
  TITLE_MAX_LENGTH,
  listDocumentsQuerySchema,
  shareDocumentSchema,
  updateDocumentSchema,
} from '../documents.schema';

const TOO_LONG_MESSAGE = 'O título pode ter no máximo 200 caracteres.';

test('trims the title', () => {
  const result = updateDocumentSchema.safeParse({ title: '  Plano de obras  ' });

  expect(result.success).toBe(true);
  expect(result.data?.title).toBe('Plano de obras');
});

test('turns an empty title into Sem título', () => {
  const result = updateDocumentSchema.safeParse({ title: '' });

  expect(result.success).toBe(true);
  expect(result.data?.title).toBe(DEFAULT_DOCUMENT_TITLE);
  expect(DEFAULT_DOCUMENT_TITLE).toBe('Sem título');
});

test('turns a whitespace only title into Sem título', () => {
  const result = updateDocumentSchema.safeParse({ title: '     ' });

  expect(result.success).toBe(true);
  expect(result.data?.title).toBe('Sem título');
});

test('accepts a 200 character title', () => {
  const title = 'a'.repeat(TITLE_MAX_LENGTH);

  const result = updateDocumentSchema.safeParse({ title });

  expect(TITLE_MAX_LENGTH).toBe(200);
  expect(result.success).toBe(true);
  expect(result.data?.title).toBe(title);
});

test('rejects a 201 character title with the literal message', () => {
  const result = updateDocumentSchema.safeParse({ title: 'a'.repeat(201) });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(TOO_LONG_MESSAGE);
});

test('measures the length after trimming', () => {
  const result = updateDocumentSchema.safeParse({
    title: `   ${'a'.repeat(200)}   `,
  });

  expect(result.success).toBe(true);
  expect(result.data?.title).toHaveLength(200);
});

test('rejects a missing title with Informe o título.', () => {
  const result = updateDocumentSchema.safeParse({});

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Informe o título.');
});

test('accepts scope mine', () => {
  const result = listDocumentsQuerySchema.safeParse({ scope: 'mine' });

  expect(result.success).toBe(true);
  expect(result.data?.scope).toBe('mine');
});

test('accepts the favorites scope', () => {
  const result = listDocumentsQuerySchema.safeParse({ scope: 'favorites' });

  expect(result.success).toBe(true);
  expect(result.data?.scope).toBe('favorites');
});

test('accepts the trash scope', () => {
  const result = listDocumentsQuerySchema.safeParse({ scope: 'trash' });

  expect(result.success).toBe(true);
  expect(result.data?.scope).toBe('trash');
});

test('rejects a scope outside mine, favorites and trash', () => {
  const result = listDocumentsQuerySchema.safeParse({ scope: 'favoritos' });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Informe um escopo válido.');
});

test('rejects a missing or unknown scope with Informe um escopo válido.', () => {
  const missing = listDocumentsQuerySchema.safeParse({});
  const unknown = listDocumentsQuerySchema.safeParse({ scope: 'todos' });

  expect(missing.success).toBe(false);
  expect(missing.error?.issues[0]?.message).toBe('Informe um escopo válido.');
  expect(unknown.success).toBe(false);
  expect(unknown.error?.issues[0]?.message).toBe('Informe um escopo válido.');
});

test('shareDocumentSchema accepts level view', () => {
  const result = shareDocumentSchema.safeParse({ level: 'view' });

  expect(result.success).toBe(true);
  expect(result.data).toEqual({ level: 'view' });
});

test('shareDocumentSchema rejects a missing level with Escolha o nível de acesso.', () => {
  const result = shareDocumentSchema.safeParse({});

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Escolha o nível de acesso.');
});

test('shareDocumentSchema rejects level edit', () => {
  const result = shareDocumentSchema.safeParse({ level: 'edit' });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Escolha o nível de acesso.');
});

test('shareDocumentSchema rejects extra fields with Campo não permitido.', () => {
  const result = shareDocumentSchema.safeParse({
    level: 'view',
    personId: 'outra-pessoa',
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Campo não permitido.');
});
