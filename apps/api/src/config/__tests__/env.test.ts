import { parseEnv } from '../env';

test('parses a valid environment and defaults PORT to 3000', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
  });

  expect(result).toEqual({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
    PORT: 3000,
    NODE_ENV: 'development',
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
