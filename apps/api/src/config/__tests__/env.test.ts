import { parseEnv } from '../env';

test('parses a valid environment and defaults PORT to 3000', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
  });

  expect(result).toEqual({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
    PORT: 3000,
    NODE_ENV: 'development',
    COLLAB_ALLOWED_ORIGINS: [],
    COLLAB_STORE_DEBOUNCE_MS: 2000,
  });
});

test('throws naming DATABASE_URL when it is missing', () => {
  expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
});

test('accepts a missing INSTALL_CODE', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
  });

  expect(result.INSTALL_CODE).toBeUndefined();
});

test('treats an empty INSTALL_CODE as missing', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
    INSTALL_CODE: '',
  });

  expect(result.INSTALL_CODE).toBeUndefined();
});

test('throws naming INSTALL_CODE when it has fewer than 16 characters', () => {
  expect(() =>
    parseEnv({
      DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
      INSTALL_CODE: 'x'.repeat(15),
    }),
  ).toThrow(/INSTALL_CODE/);
});

test('defaults NODE_ENV to development', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
  });

  expect(result.NODE_ENV).toBe('development');
});

test('COLLAB_ALLOWED_ORIGINS defaults to an empty list', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
  });

  expect(result.COLLAB_ALLOWED_ORIGINS).toEqual([]);
});

test('COLLAB_ALLOWED_ORIGINS is split by comma and trimmed', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
    COLLAB_ALLOWED_ORIGINS:
      ' http://app.exemplo.org , https://seguro.exemplo.org ,, ',
  });

  expect(result.COLLAB_ALLOWED_ORIGINS).toEqual([
    'http://app.exemplo.org',
    'https://seguro.exemplo.org',
  ]);
});

test('COLLAB_STORE_DEBOUNCE_MS defaults to 2000', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
  });

  expect(result.COLLAB_STORE_DEBOUNCE_MS).toBe(2000);
});

test('COLLAB_STORE_DEBOUNCE_MS rejects a non positive value', () => {
  expect(() =>
    parseEnv({
      DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
      COLLAB_STORE_DEBOUNCE_MS: '0',
    }),
  ).toThrow(/COLLAB_STORE_DEBOUNCE_MS/);
});
