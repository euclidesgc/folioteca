import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

let app: INestApplication;
let prisma: PrismaService;
let cookie: string;

/** Instala a instância e devolve o cookie da sessão criada com ela. */
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

async function createDocumentId(): Promise<string> {
  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  return (response.body as { data: { id: string } }).data.id;
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
  cookie = await installAndGetCookie();
});

test('POST documents 201 matches DocumentResponse', async () => {
  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  expect(response.status).toBe(201);
  await expectMatchesContract({
    path: '/documents',
    method: 'post',
    status: 201,
    body: response.body,
  });
});

test('GET documents 200 matches DocumentsResponse', async () => {
  await createDocumentId();

  const response = await httpRequest(app)
    .get('/api/documents?scope=mine')
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/documents',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET documents 400 matches ValidationError', async () => {
  const response = await httpRequest(app)
    .get('/api/documents')
    .set('Cookie', cookie);

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: '/documents',
    method: 'get',
    status: 400,
    body: response.body,
  });
});

test('GET documents 401 matches Error', async () => {
  const response = await httpRequest(app).get('/api/documents?scope=mine');

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: '/documents',
    method: 'get',
    status: 401,
    body: response.body,
  });
});

test('GET document 200 matches DocumentResponse', async () => {
  const documentId = await createDocumentId();

  const response = await httpRequest(app)
    .get(`/api/documents/${documentId}`)
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/documents/{documentId}',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET document 404 matches Error', async () => {
  const response = await httpRequest(app)
    .get(`/api/documents/${randomUUID()}`)
    .set('Cookie', cookie);

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: '/documents/{documentId}',
    method: 'get',
    status: 404,
    body: response.body,
  });
});

test('PATCH document 200 matches DocumentResponse', async () => {
  const documentId = await createDocumentId();

  const response = await httpRequest(app)
    .patch(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send({ title: 'Plano de obras' });

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/documents/{documentId}',
    method: 'patch',
    status: 200,
    body: response.body,
  });
});

test('PATCH document 400 matches ValidationError', async () => {
  const documentId = await createDocumentId();

  const response = await httpRequest(app)
    .patch(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send({ title: 'a'.repeat(201) });

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: '/documents/{documentId}',
    method: 'patch',
    status: 400,
    body: response.body,
  });
});
