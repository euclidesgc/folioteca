import { randomBytes } from 'node:crypto';

import { verifyInstallCode } from '../verify-install-code';

const expectedCode = randomBytes(24).toString('base64url');

test('returns true for the exact code', () => {
  expect(verifyInstallCode(expectedCode, expectedCode)).toBe(true);
});

test('returns false for a different code of the same length', () => {
  const other = randomBytes(24).toString('base64url');

  expect(other).toHaveLength(expectedCode.length);
  expect(verifyInstallCode(other, expectedCode)).toBe(false);
});

test('returns false for a code of a different length', () => {
  const shorter = expectedCode.slice(0, 10);

  expect(verifyInstallCode(shorter, expectedCode)).toBe(false);
});

test('returns false when the expected code is undefined', () => {
  expect(verifyInstallCode(expectedCode, undefined)).toBe(false);
});

test('returns false when the provided value is not a string', () => {
  expect(verifyInstallCode(42, expectedCode)).toBe(false);
  expect(verifyInstallCode(null, expectedCode)).toBe(false);
  expect(verifyInstallCode({ code: expectedCode }, expectedCode)).toBe(false);
});

test('returns false for an empty string', () => {
  expect(verifyInstallCode('', expectedCode)).toBe(false);
});
