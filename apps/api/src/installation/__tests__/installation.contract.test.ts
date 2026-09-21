import 'reflect-metadata';

import { randomBytes, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

let app: INestApplication;
let prisma: PrismaService;

function validBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    code: process.env.INSTALL_CODE ?? '',
    organizationName: 'Prefeitura de Exemplo',
    name: 'Maria Souza',
    email: 'maria@exemplo.org',
    password: randomUUID(),
    ...overrides,
  };
}

function postInstallation(
  body: Record<string, unknown>,
): ReturnType<ReturnType<typeof httpRequest>['post']> {
  return httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(body);
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

test('GET 200 matches InstallationStatusResponse', async () => {
  const response = await httpRequest(app).get('/api/installation');

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/installation',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('POST 201 matches CurrentUserResponse', async () => {
  const response = await postInstallation(validBody());

  expect(response.status).toBe(201);
  await expectMatchesContract({
    path: '/installation',
    method: 'post',
    status: 201,
    body: response.body,
  });
});

test('POST 400 matches ValidationError', async () => {
  const response = await postInstallation(validBody({ email: 'nao-e-email' }));

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: '/installation',
    method: 'post',
    status: 400,
    body: response.body,
  });
});

test('POST 403 matches Error', async () => {
  const response = await postInstallation(
    validBody({ code: randomBytes(24).toString('base64url') }),
  );

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: '/installation',
    method: 'post',
    status: 403,
    body: response.body,
  });
});

test('POST 409 matches Error', async () => {
  await postInstallation(validBody());

  const response = await postInstallation(
    validBody({ email: 'joao@exemplo.org' }),
  );

  expect(response.status).toBe(409);
  await expectMatchesContract({
    path: '/installation',
    method: 'post',
    status: 409,
    body: response.body,
  });
});
