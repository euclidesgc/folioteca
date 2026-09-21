import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

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

test('GET org-units answers the documented 200', async () => {
  const response = await httpRequest(app)
    .get('/api/org-units')
    .set('Cookie', adminCookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/org-units',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET org-units answers the documented 401', async () => {
  const response = await httpRequest(app).get('/api/org-units');

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: '/org-units',
    method: 'get',
    status: 401,
    body: response.body,
  });
});

test('GET org-units answers the documented 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await httpRequest(app)
    .get('/api/org-units')
    .set('Cookie', cookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: '/org-units',
    method: 'get',
    status: 403,
    body: response.body,
  });
});
