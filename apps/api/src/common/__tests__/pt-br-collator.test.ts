import { ptBrCollator } from '../pt-br-collator';

test('ptBrCollator treats accents and case as equal', () => {
  expect(ptBrCollator.compare('Álvaro', 'alvaro')).toBe(0);
});

test('ptBrCollator orders Álvaro before Zilda', () => {
  expect(ptBrCollator.compare('Álvaro', 'Zilda')).toBeLessThan(0);
  expect(['Zilda', 'Álvaro'].sort((a, b) => ptBrCollator.compare(a, b))).toEqual([
    'Álvaro',
    'Zilda',
  ]);
});
