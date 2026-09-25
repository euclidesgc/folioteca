import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const SESSION_COOKIE_PREFIX = 'folioteca_session=';
const INVALID_WIDTH_MESSAGE = 'Escolha uma largura de página válida.';

/** `expect.any(String)` tipado, para o corpo comparado por `toEqual`. */
const ANY_STRING = expect.any(String) as unknown as string;

let app: INestApplication;
let prisma: PrismaService;

/** Instala a instância e devolve o cookie de sessão da pessoa criada. */
async function install(): Promise<string> {
  const response = await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: 'Prefeitura de Exemplo',
      name: 'Maria Souza',
      email: 'maria@exemplo.org',
      password: randomUUID(),
    });

  expect(response.status).toBe(201);

  const cookies = (response.headers['set-cookie'] ?? []) as string[];
  const cookie = cookies.find((item) => item.startsWith(SESSION_COOKIE_PREFIX));

  if (cookie === undefined) {
    throw new Error('A resposta não trouxe o cookie de sessão.');
  }

  return cookie.split(';')[0] ?? '';
}

function patchPreferences(cookie: string | null, body: unknown) {
  const request = httpRequest(app)
    .patch('/api/auth/me/preferences')
    .set('X-Requested-With', 'XMLHttpRequest');

  if (cookie !== null) {
    request.set('Cookie', cookie);
  }

  return request.send(body as object);
}

function getMe(cookie: string) {
  return httpRequest(app).get('/api/auth/me').set('Cookie', cookie);
}

/** `person.documentPageWidth` no corpo de `CurrentUserResponse`. */
function widthOf(body: unknown): unknown {
  return (body as { data: { person: { documentPageWidth: unknown } } }).data
    .person.documentPageWidth;
}

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

test('GET auth me returns medium for a new person', async () => {
  const cookie = await install();

  const response = await getMe(cookie);

  expect(response.status).toBe(200);
  expect(widthOf(response.body)).toBe('medium');
});

test('PATCH auth me preferences saves large and returns the current user', async () => {
  const cookie = await install();

  const response = await patchPreferences(cookie, {
    documentPageWidth: 'large',
  });

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      person: {
        id: ANY_STRING,
        name: 'Maria Souza',
        email: 'maria@exemplo.org',
        isAdmin: true,
        documentPageWidth: 'large',
      },
      organization: {
        id: ANY_STRING,
        name: 'Prefeitura de Exemplo',
      },
    },
  });

  const person = await prisma.person.findFirstOrThrow({
    where: { email: 'maria@exemplo.org' },
  });

  expect(person.documentPageWidth).toBe('LARGE');
});

test('PATCH auth me preferences is returned by the next GET auth me', async () => {
  const cookie = await install();

  const patch = await patchPreferences(cookie, { documentPageWidth: 'full' });

  expect(patch.status).toBe(200);

  const me = await getMe(cookie);

  expect(me.status).toBe(200);
  expect(widthOf(me.body)).toBe('full');
});

test('PATCH auth me preferences accepts each of small medium large full', async () => {
  const cookie = await install();

  const small = await patchPreferences(cookie, { documentPageWidth: 'small' });
  const medium = await patchPreferences(cookie, {
    documentPageWidth: 'medium',
  });
  const large = await patchPreferences(cookie, { documentPageWidth: 'large' });
  const full = await patchPreferences(cookie, { documentPageWidth: 'full' });

  expect([small.status, medium.status, large.status, full.status]).toEqual([
    200, 200, 200, 200,
  ]);
  expect([
    widthOf(small.body),
    widthOf(medium.body),
    widthOf(large.body),
    widthOf(full.body),
  ]).toEqual(['small', 'medium', 'large', 'full']);
});

test('PATCH auth me preferences rejects an unknown width with 400', async () => {
  const cookie = await install();

  const response = await patchPreferences(cookie, {
    documentPageWidth: 'huge',
  });

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: INVALID_WIDTH_MESSAGE });
  expect(widthOf((await getMe(cookie)).body)).toBe('medium');
});

test('PATCH auth me preferences rejects a missing width with 400', async () => {
  const cookie = await install();

  const response = await patchPreferences(cookie, {});

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: INVALID_WIDTH_MESSAGE });
  expect(widthOf((await getMe(cookie)).body)).toBe('medium');
});

test('PATCH auth me preferences without a session answers 401', async () => {
  await install();

  const response = await patchPreferences(null, { documentPageWidth: 'large' });

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });

  const person = await prisma.person.findFirstOrThrow();

  expect(person.documentPageWidth).toBe('MEDIUM');
});

test('PATCH auth me preferences changes only the current person', async () => {
  const ownerCookie = await install();
  const other = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const response = await patchPreferences(ownerCookie, {
    documentPageWidth: 'small',
  });

  expect(response.status).toBe(200);
  expect(widthOf((await getMe(ownerCookie)).body)).toBe('small');
  expect(widthOf((await getMe(other.cookie)).body)).toBe('medium');
});
