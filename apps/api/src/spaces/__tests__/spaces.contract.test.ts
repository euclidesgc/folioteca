import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const CONTRACT_PATH = '/spaces';

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
      email: 'maria@exemplo.org',
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

function getSpaces(cookie?: string): Promise<Response> {
  const request = httpRequest(app).get('/api/spaces');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

test('GET spaces answers the documented 200', async () => {
  const admin = await prisma.person.findFirstOrThrow({ select: { id: true, organizationId: true } });
  const root = await prisma.orgUnit.findFirstOrThrow({ where: { parentId: null } });
  const unit = await prisma.orgUnit.create({
    data: { organizationId: admin.organizationId, parentId: root.id, name: 'Protocolo' },
  });
  await prisma.space.create({ data: { type: 'UNIT', orgUnitId: unit.id } });
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId: unit.id, personId: admin.id },
  });

  const response = await getSpaces(adminCookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET spaces answers the documented 401', async () => {
  const response = await getSpaces();

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'get',
    status: 401,
    body: response.body,
  });
});

function postSpace(body: object, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .post('/api/spaces')
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined
    ? request.send(body)
    : request.set('Cookie', cookie).send(body);
}

test('POST spaces answers the documented 201', async () => {
  const response = await postSpace({ name: 'Projeto Alfa' }, adminCookie);

  expect(response.status).toBe(201);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'post',
    status: 201,
    body: response.body,
  });
});

test('POST spaces answers the documented 400', async () => {
  const response = await postSpace({ name: '' }, adminCookie);

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'post',
    status: 400,
    body: response.body,
  });
});

test('POST spaces answers the documented 401', async () => {
  const response = await postSpace({ name: 'Projeto Alfa' });

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'post',
    status: 401,
    body: response.body,
  });
});

test('GET spaces with an inherited unit space matches the documented 200', async () => {
  const admin = await prisma.person.findFirstOrThrow({ select: { id: true, organizationId: true } });
  const root = await prisma.orgUnit.findFirstOrThrow({ where: { parentId: null } });
  const parent = await prisma.orgUnit.create({
    data: { organizationId: admin.organizationId, parentId: root.id, name: 'Secretaria' },
  });
  await prisma.space.create({ data: { type: 'UNIT', orgUnitId: parent.id } });
  const child = await prisma.orgUnit.create({
    data: { organizationId: admin.organizationId, parentId: parent.id, name: 'Protocolo' },
  });
  const childSpace = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: child.id, inheritsParent: true },
  });
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId: parent.id, personId: admin.id },
  });

  const response = await getSpaces(adminCookie);

  expect(response.status).toBe(200);
  expect(
    (response.body as { data: { id: string }[] }).data.map((item) => item.id),
  ).toContain(childSpace.id);
  await expectMatchesContract({
    path: CONTRACT_PATH,
    method: 'get',
    status: 200,
    body: response.body,
  });
});
