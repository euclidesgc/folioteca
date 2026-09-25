import { nextDefaultTitle } from '../default-title';

test('nextDefaultTitle returns documento-sem-titulo-1 for an empty list', () => {
  expect(nextDefaultTitle([])).toBe('documento-sem-titulo-1');
});

test('nextDefaultTitle returns the next number after a sequence', () => {
  expect(
    nextDefaultTitle([
      'documento-sem-titulo-1',
      'documento-sem-titulo-2',
      'documento-sem-titulo-3',
    ]),
  ).toBe('documento-sem-titulo-4');
});

test('nextDefaultTitle fills the smallest gap', () => {
  expect(
    nextDefaultTitle([
      'documento-sem-titulo-1',
      'documento-sem-titulo-3',
      'documento-sem-titulo-5',
    ]),
  ).toBe('documento-sem-titulo-2');
});

test('nextDefaultTitle ignores titles with leading zeros', () => {
  expect(nextDefaultTitle(['documento-sem-titulo-01'])).toBe(
    'documento-sem-titulo-1',
  );
});

test('nextDefaultTitle ignores documento-sem-titulo-0', () => {
  expect(nextDefaultTitle(['documento-sem-titulo-0'])).toBe(
    'documento-sem-titulo-1',
  );
});

test('nextDefaultTitle ignores titles with a suffix', () => {
  expect(nextDefaultTitle(['documento-sem-titulo-1 cópia'])).toBe(
    'documento-sem-titulo-1',
  );
});

test('nextDefaultTitle ignores Sem título', () => {
  expect(nextDefaultTitle(['Sem título'])).toBe('documento-sem-titulo-1');
});
