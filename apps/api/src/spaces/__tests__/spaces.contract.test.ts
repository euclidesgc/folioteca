import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { expectMatchesContract } from '../../../test/contract';
import { createPersonWithSession } from '../../../test/create-person';
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

const DOCUMENTS_CONTRACT_PATH = '/spaces/{spaceId}/documents';

type ContractUnits = { parentSpaceId: string; childSpaceId: string };

/**
 * Unidade-mãe com a administração lotada e unidade filha que herda dela: a mãe
 * é alcance direto, a filha só por herança.
 */
async function createUnitsWithAssignedParent(): Promise<ContractUnits> {
  const admin = await prisma.person.findFirstOrThrow({
    select: { id: true, organizationId: true },
  });
  const root = await prisma.orgUnit.findFirstOrThrow({ where: { parentId: null } });
  const parent = await prisma.orgUnit.create({
    data: { organizationId: admin.organizationId, parentId: root.id, name: 'Secretaria' },
  });
  const parentSpace = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: parent.id },
  });
  const child = await prisma.orgUnit.create({
    data: { organizationId: admin.organizationId, parentId: parent.id, name: 'Protocolo' },
  });
  const childSpace = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: child.id, inheritsParent: true },
  });
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId: parent.id, personId: admin.id },
  });
  await prisma.document.create({
    data: {
      title: 'Regulamento',
      spaceId: parentSpace.id,
      authorId: admin.id,
      ownerId: admin.id,
    },
  });

  return { parentSpaceId: parentSpace.id, childSpaceId: childSpace.id };
}

function getSpaceDocuments(spaceId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/spaces/${spaceId}/documents`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

test('GET space documents answers the documented 200', async () => {
  const { parentSpaceId } = await createUnitsWithAssignedParent();

  const response = await getSpaceDocuments(parentSpaceId, adminCookie);

  expect(response.status).toBe(200);
  expect((response.body as { data: unknown[] }).data).toHaveLength(1);
  await expectMatchesContract({
    path: DOCUMENTS_CONTRACT_PATH,
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET space documents answers the documented 401', async () => {
  const { parentSpaceId } = await createUnitsWithAssignedParent();

  const response = await getSpaceDocuments(parentSpaceId);

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: DOCUMENTS_CONTRACT_PATH,
    method: 'get',
    status: 401,
    body: response.body,
  });
});

test('GET space documents answers the documented 403', async () => {
  const { childSpaceId } = await createUnitsWithAssignedParent();

  const response = await getSpaceDocuments(childSpaceId, adminCookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: DOCUMENTS_CONTRACT_PATH,
    method: 'get',
    status: 403,
    body: response.body,
  });
});

test('GET space documents answers the documented 404', async () => {
  const response = await getSpaceDocuments(randomUUID(), adminCookie);

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: DOCUMENTS_CONTRACT_PATH,
    method: 'get',
    status: 404,
    body: response.body,
  });
});

function getSpace(spaceId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/spaces/${spaceId}`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

function getSpaceMembers(spaceId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/spaces/${spaceId}/members`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

test('GET space answers the documented 200', async () => {
  const { childSpaceId } = await createUnitsWithAssignedParent();

  const response = await getSpace(childSpaceId, adminCookie);

  expect(response.status).toBe(200);
  expect((response.body as { data: { reach: string } }).data.reach).toBe(
    'inherited',
  );
  await expectMatchesContract({
    path: '/spaces/{spaceId}',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET space answers the documented 401', async () => {
  const { parentSpaceId } = await createUnitsWithAssignedParent();

  const response = await getSpace(parentSpaceId);

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: '/spaces/{spaceId}',
    method: 'get',
    status: 401,
    body: response.body,
  });
});

test('GET space answers the documented 404', async () => {
  const response = await getSpace(randomUUID(), adminCookie);

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: '/spaces/{spaceId}',
    method: 'get',
    status: 404,
    body: response.body,
  });
});

test('GET space members answers the documented 200', async () => {
  const { parentSpaceId } = await createUnitsWithAssignedParent();

  const response = await getSpaceMembers(parentSpaceId, adminCookie);

  expect(response.status).toBe(200);
  expect((response.body as { data: unknown[] }).data).toHaveLength(1);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET space members answers the documented 401', async () => {
  const { parentSpaceId } = await createUnitsWithAssignedParent();

  const response = await getSpaceMembers(parentSpaceId);

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members',
    method: 'get',
    status: 401,
    body: response.body,
  });
});

test('GET space members answers the documented 404', async () => {
  const response = await getSpaceMembers(randomUUID(), adminCookie);

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members',
    method: 'get',
    status: 404,
    body: response.body,
  });
});

/** `PUT /api/spaces/:spaceId/members/:personId` com o cabeçalho de CSRF. */
function putSpaceMember(
  spaceId: string,
  personId: string,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .put(`/api/spaces/${spaceId}/members/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** Espaço livre da administração e Ana, outra pessoa da organização. */
async function createFreeSpaceAndOther(): Promise<{
  freeSpaceId: string;
  adminId: string;
  other: { id: string; cookie: string };
}> {
  const created = await postSpace({ name: 'Projeto Alfa' }, adminCookie);
  const admin = await prisma.person.findFirstOrThrow({
    where: { email: 'maria@exemplo.org' },
    select: { id: true },
  });
  const other = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });

  expect(created.status).toBe(201);

  return {
    freeSpaceId: (created.body as { data: { id: string } }).data.id,
    adminId: admin.id,
    other: { id: other.person.id, cookie: other.cookie },
  };
}

test('PUT space member answers the documented 200', async () => {
  const { freeSpaceId, other } = await createFreeSpaceAndOther();

  const response = await putSpaceMember(freeSpaceId, other.id, adminCookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members/{personId}',
    method: 'put',
    status: 200,
    body: response.body,
  });
});

test('PUT space member answers the documented 400', async () => {
  const { freeSpaceId, adminId } = await createFreeSpaceAndOther();

  const response = await putSpaceMember(freeSpaceId, adminId, adminCookie);

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members/{personId}',
    method: 'put',
    status: 400,
    body: response.body,
  });
});

test('PUT space member answers the documented 401', async () => {
  const { freeSpaceId, other } = await createFreeSpaceAndOther();

  const response = await putSpaceMember(freeSpaceId, other.id);

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members/{personId}',
    method: 'put',
    status: 401,
    body: response.body,
  });
});

test('PUT space member answers the documented 403', async () => {
  const { freeSpaceId, adminId, other } = await createFreeSpaceAndOther();
  const added = await putSpaceMember(freeSpaceId, other.id, adminCookie);

  const response = await putSpaceMember(freeSpaceId, adminId, other.cookie);

  expect(added.status).toBe(200);
  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members/{personId}',
    method: 'put',
    status: 403,
    body: response.body,
  });
});

test('PUT space member answers the documented 404', async () => {
  const { other } = await createFreeSpaceAndOther();

  const response = await putSpaceMember(randomUUID(), other.id, adminCookie);

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: '/spaces/{spaceId}/members/{personId}',
    method: 'put',
    status: 404,
    body: response.body,
  });
});

test('GET space answers the documented 200 with reach member', async () => {
  const { freeSpaceId, other } = await createFreeSpaceAndOther();
  const added = await putSpaceMember(freeSpaceId, other.id, adminCookie);

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(added.status).toBe(200);
  expect(response.status).toBe(200);
  expect((response.body as { data: { reach: string } }).data.reach).toBe(
    'member',
  );
  await expectMatchesContract({
    path: '/spaces/{spaceId}',
    method: 'get',
    status: 200,
    body: response.body,
  });
});
