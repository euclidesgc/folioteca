import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

import { parseBody } from '../parse-body';

const schema = z.object({
  name: z.string().min(1, 'Informe o seu nome.'),
  email: z.email('Informe um e-mail válido.'),
});

const nestedSchema = z.object({
  person: z.object({
    name: z.string().min(1, 'Informe o seu nome.'),
  }),
});

test('returns the parsed value for a valid body', () => {
  const result = parseBody(schema, {
    name: 'Maria Souza',
    email: 'maria@exemplo.org',
  });

  expect(result).toEqual({ name: 'Maria Souza', email: 'maria@exemplo.org' });
});

test('throws BadRequestException with Dados inválidos and the field errors', () => {
  expect.assertions(2);

  try {
    parseBody(schema, { name: '', email: 'nao-e-email' });
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);

    const response = (error as BadRequestException).getResponse();

    expect(response).toMatchObject({
      message: 'Dados inválidos.',
      errors: [
        { field: 'name', message: 'Informe o seu nome.' },
        { field: 'email', message: 'Informe um e-mail válido.' },
      ],
    });
  }
});

test('joins nested paths with a dot', () => {
  expect.assertions(1);

  try {
    parseBody(nestedSchema, { person: { name: '' } });
  } catch (error) {
    const response = (error as BadRequestException).getResponse();

    expect(response).toMatchObject({
      errors: [{ field: 'person.name', message: 'Informe o seu nome.' }],
    });
  }
});

test('rejects a body that is not an object', () => {
  expect(() => parseBody(schema, 'texto')).toThrow(BadRequestException);
});
