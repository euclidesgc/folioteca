import { randomUUID } from 'node:crypto';

import { loginSchema } from '../login.schema';

test('accepts a valid body', () => {
  const password = randomUUID();

  const result = loginSchema.safeParse({
    email: 'maria@exemplo.org',
    password,
  });

  expect(result.success).toBe(true);
  expect(result.data).toEqual({ email: 'maria@exemplo.org', password });
});

test('lowercases and trims the email', () => {
  const result = loginSchema.safeParse({
    email: '  MARIA@Exemplo.ORG  ',
    password: randomUUID(),
  });

  expect(result.success).toBe(true);
  expect(result.data?.email).toBe('maria@exemplo.org');
});

test('does not trim the password', () => {
  const password = `  ${randomUUID()}  `;

  const result = loginSchema.safeParse({
    email: 'maria@exemplo.org',
    password,
  });

  expect(result.success).toBe(true);
  expect(result.data?.password).toBe(password);
});

test('accepts a password shorter than 12 characters', () => {
  const password = 'x'.repeat(4);

  const result = loginSchema.safeParse({
    email: 'maria@exemplo.org',
    password,
  });

  expect(result.success).toBe(true);
  expect(result.data?.password).toBe(password);
});

test('rejects an empty email with Informe o e-mail.', () => {
  const result = loginSchema.safeParse({
    email: '',
    password: randomUUID(),
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Informe o e-mail.');
});

test('rejects a malformed email with Informe um e-mail válido.', () => {
  const result = loginSchema.safeParse({
    email: 'nao-e-email',
    password: randomUUID(),
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Informe um e-mail válido.');
});

test('rejects an empty password with Informe a senha.', () => {
  const result = loginSchema.safeParse({
    email: 'maria@exemplo.org',
    password: '',
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Informe a senha.');
});

test('rejects a 129 character password with the literal message', () => {
  const result = loginSchema.safeParse({
    email: 'maria@exemplo.org',
    password: 'x'.repeat(129),
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe(
    'A senha pode ter no máximo 128 caracteres.',
  );
});
