import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

const CONTRACT_PATH = '/admins';

let app: INestApplication;
let prisma: PrismaService;
let adminCookie: string;

/** Instala a instância e devolve o cookie da sessão da administração. */
async function installAndGetCookie(): Promise<string> {
  const response = await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: 'Prefeitura de Exemplo',
      name: 'Maria Souza',
      email: EMAIL,
      password: randomUUID(),
    });

  const cookies = (response.headers['set-cookie'] ?? []) as string[];
  const sessionCookie = cookies.find((item) =>
    item.startsWith('folioteca_session='),
  );

  if (sessionCookie === undefined) {
    throw new Error('A resposta não trouxe o cookie de sessão.');
  }

  return sessionCookie.split(';')[0] ?? '';
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
  adminCookie = await installAndGetCookie();
});

function getAdmins(cookie?: string): Promise<Response> {
  const request = httpRequest(app).get('/api/admins');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

test('GET admins answers the documented 200', async () => {
  const response = await getAdmins(adminCookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET admins answers the documented 401', async () => {
  const response = await getAdmins();

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'get',
    status: 401,
    body: response.body,
  });
});

test('GET admins answers the documented 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await getAdmins(cookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'get',
    status: 403,
    body: response.body,
  });
});

const PROMOTE_CONTRACT_PATH = '/admins/{personId}';

/** `PUT /api/admins/:personId`, com o cabeçalho de CSRF. */
function promoteAdmin(personId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .put(`/api/admins/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

test('PUT admins personId answers the documented 200', async () => {
  const { person } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await promoteAdmin(person.id, adminCookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: PROMOTE_CONTRACT_PATH,
    method: 'put',
    status: 200,
    body: response.body,
  });
});

test('PUT admins personId answers the documented 401', async () => {
  const { person } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await promoteAdmin(person.id);

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: PROMOTE_CONTRACT_PATH,
    method: 'put',
    status: 401,
    body: response.body,
  });
});

test('PUT admins personId answers the documented 403', async () => {
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await promoteAdmin(person.id, cookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: PROMOTE_CONTRACT_PATH,
    method: 'put',
    status: 403,
    body: response.body,
  });
});

test('PUT admins personId answers the documented 404', async () => {
  const response = await promoteAdmin(randomUUID(), adminCookie);

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: PROMOTE_CONTRACT_PATH,
    method: 'put',
    status: 404,
    body: response.body,
  });
});
