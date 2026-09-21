import { parseEnv } from '../env';

test('parses a valid environment and defaults PORT to 3000', () => {
  const result = parseEnv({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
  });

  expect(result).toEqual({
    DATABASE_URL: 'postgresql://folioteca@localhost:5433/folioteca',
    PORT: 3000,
  });
});

test('throws naming DATABASE_URL when it is missing', () => {
  expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
});
