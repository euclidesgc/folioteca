import 'reflect-metadata';

import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const SESSION_COOKIE_PREFIX = 'folioteca_session=';

/** `expect.any(String)` tipado, para o corpo comparado por `toEqual`. */
const ANY_STRING = expect.any(String) as unknown as string;

let app: INestApplication;
let prisma: PrismaService;

/** Instala a instância e devolve o cookie de sessão da pessoa criada. */
async function install(): Promise<{ cookie: string; token: string }> {
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

  const pair = cookie.split(';')[0] ?? '';

  return {
    cookie: pair,
    token: decodeURIComponent(pair.slice(SESSION_COOKIE_PREFIX.length)),
  };
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

test('GET /api/auth/me returns the person and the organization with the session cookie', async () => {
  const { cookie } = await install();

  const response = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      person: {
        id: ANY_STRING,
        name: 'Maria Souza',
        email: 'maria@exemplo.org',
        isAdmin: true,
        documentPageWidth: 'medium',
      },
      organization: {
        id: ANY_STRING,
        name: 'Prefeitura de Exemplo',
      },
    },
  });
});

test('never returns passwordHash', async () => {
  const { cookie } = await install();

  const response = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', cookie);

  expect(response.text).not.toContain('passwordHash');
  expect(response.text).not.toContain('$argon2id$');
});

test('returns 401 Sessão não encontrada without a cookie', async () => {
  await install();

  const response = await httpRequest(app).get('/api/auth/me');

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});

test('returns 401 with an unknown token', async () => {
  await install();

  const unknownToken = randomBytes(32).toString('base64url');

  const response = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', `folioteca_session=${unknownToken}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});

test('returns 401 with an expired session', async () => {
  await install();

  const person = await prisma.person.findFirstOrThrow();
  const expiredToken = randomBytes(32).toString('base64url');

  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(expiredToken).digest('hex'),
      personId: person.id,
      expiresAt: new Date(Date.now() - 1000),
    },
  });

  const response = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', `folioteca_session=${expiredToken}`);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});
