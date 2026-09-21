import { isUuid } from '../is-uuid';

const LOWERCASE_UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

test('accepts a lowercase uuid', () => {
  expect(isUuid(LOWERCASE_UUID)).toBe(true);
});

test('accepts an uppercase uuid', () => {
  expect(isUuid(LOWERCASE_UUID.toUpperCase())).toBe(true);
});

test('rejects an empty string', () => {
  expect(isUuid('')).toBe(false);
});

test('rejects a uuid with extra characters', () => {
  expect(isUuid(`${LOWERCASE_UUID}x`)).toBe(false);
});

test('rejects a plain word', () => {
  expect(isUuid('acervo')).toBe(false);
});
