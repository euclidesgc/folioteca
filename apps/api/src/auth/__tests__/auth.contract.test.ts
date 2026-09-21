import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

let app: INestApplication;
let prisma: PrismaService;

async function installAndGetCookie(): Promise<string> {
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

  const cookies = (response.headers['set-cookie'] ?? []) as string[];
  const cookie = cookies.find((item) =>
    item.startsWith('folioteca_session='),
  );

  if (cookie === undefined) {
    throw new Error('A resposta não trouxe o cookie de sessão.');
  }

  return cookie.split(';')[0] ?? '';
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

test('GET 200 matches CurrentUserResponse', async () => {
  const cookie = await installAndGetCookie();

  const response = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/auth/me',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET 401 matches Error', async () => {
  const response = await httpRequest(app).get('/api/auth/me');

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: '/auth/me',
    method: 'get',
    status: 401,
    body: response.body,
  });
});
