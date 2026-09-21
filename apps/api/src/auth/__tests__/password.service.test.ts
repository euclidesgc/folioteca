import { randomUUID } from 'node:crypto';

import { PasswordService } from '../password.service';

test('verify returns true for the right password', async () => {
  const passwords = new PasswordService();
  const password = randomUUID();

  const hash = await passwords.hash(password);

  expect(await passwords.verify(hash, password)).toBe(true);
});

test('verify returns false for a wrong password', async () => {
  const passwords = new PasswordService();

  const hash = await passwords.hash(randomUUID());

  expect(await passwords.verify(hash, randomUUID())).toBe(false);
});

test('verify returns false for a malformed hash instead of throwing', async () => {
  const passwords = new PasswordService();

  await expect(
    passwords.verify('nao-e-um-hash', randomUUID()),
  ).resolves.toBe(false);
});

test('getDummyHash returns an argon2id hash', async () => {
  const passwords = new PasswordService();

  const dummyHash = await passwords.getDummyHash();

  expect(dummyHash.startsWith('$argon2id$')).toBe(true);
});

test('getDummyHash returns the same value on every call', async () => {
  const passwords = new PasswordService();

  const first = await passwords.getDummyHash();
  const second = await passwords.getDummyHash();

  expect(second).toBe(first);
});

test('getDummyHash hashes only once under concurrent calls', async () => {
  const passwords = new PasswordService();

  const [first, second, third] = await Promise.all([
    passwords.getDummyHash(),
    passwords.getDummyHash(),
    passwords.getDummyHash(),
  ]);

  expect(second).toBe(first);
  expect(third).toBe(first);
});
