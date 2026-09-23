import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import path from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';
import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

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

const ORG_UNIT_PATH = '/org-units/{orgUnitId}';

/** Envia `POST /api/org-units` com o cabeçalho que o CSRF do projeto exige. */
function postOrgUnit(body: object, cookie: string): Promise<Response> {
  return httpRequest(app)
    .post('/api/org-units')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send(body);
}

/** Envia `PATCH /api/org-units/:id` com o cabeçalho do CSRF. */
function patchOrgUnit(
  orgUnitId: string,
  body: object,
  cookie: string,
): Promise<Response> {
  return httpRequest(app)
    .patch(`/api/org-units/${orgUnitId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send(body);
}

/** Id da unidade raiz criada pela instalação. */
async function getRootId(): Promise<string> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { parentId: null },
  });

  return root.id;
}

function idOf(response: Response): string {
  return (response.body as { data: { id: string } }).data.id;
}

test('POST org-units answers the documented 201', async () => {
  const response = await postOrgUnit(
    { parentId: await getRootId(), name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(201);
  await expectMatchesContract({
    path: '/org-units',
    method: 'post',
    status: 201,
    body: response.body,
  });
});

test('POST org-units answers the documented 400', async () => {
  const response = await postOrgUnit(
    { parentId: await getRootId(), name: '' },
    adminCookie,
  );

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: '/org-units',
    method: 'post',
    status: 400,
    body: response.body,
  });
});

test('POST org-units answers the documented 403', async () => {
  const rootId = await getRootId();
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await postOrgUnit({ parentId: rootId, name: 'Acervo' }, cookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: '/org-units',
    method: 'post',
    status: 403,
    body: response.body,
  });
});

test('POST org-units answers the documented 404', async () => {
  const response = await postOrgUnit(
    { parentId: randomUUID(), name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: '/org-units',
    method: 'post',
    status: 404,
    body: response.body,
  });
});

test('POST org-units answers the documented 409', async () => {
  const rootId = await getRootId();
  await postOrgUnit({ parentId: rootId, name: 'Acervo' }, adminCookie);

  const response = await postOrgUnit(
    { parentId: rootId, name: 'acervo' },
    adminCookie,
  );

  expect(response.status).toBe(409);
  await expectMatchesContract({
    path: '/org-units',
    method: 'post',
    status: 409,
    body: response.body,
  });
});

test('PATCH org-units answers the documented 200', async () => {
  const created = await postOrgUnit(
    { parentId: await getRootId(), name: 'Acervo' },
    adminCookie,
  );

  const response = await patchOrgUnit(
    idOf(created),
    { name: 'Acervo Geral' },
    adminCookie,
  );

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'patch',
    status: 200,
    body: response.body,
  });
});

test('PATCH org-units answers the documented 400', async () => {
  const response = await patchOrgUnit(
    await getRootId(),
    { name: '' },
    adminCookie,
  );

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'patch',
    status: 400,
    body: response.body,
  });
});

test('PATCH org-units answers the documented 403', async () => {
  const rootId = await getRootId();
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await patchOrgUnit(rootId, { name: 'Outro' }, cookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'patch',
    status: 403,
    body: response.body,
  });
});

test('PATCH org-units answers the documented 404', async () => {
  const response = await patchOrgUnit(
    randomUUID(),
    { name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'patch',
    status: 404,
    body: response.body,
  });
});

test('PATCH org-units answers the documented 409', async () => {
  const rootId = await getRootId();
  await postOrgUnit({ parentId: rootId, name: 'Acervo' }, adminCookie);
  const other = await postOrgUnit(
    { parentId: rootId, name: 'Zeladoria' },
    adminCookie,
  );

  const response = await patchOrgUnit(
    idOf(other),
    { name: 'ACERVO' },
    adminCookie,
  );

  expect(response.status).toBe(409);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'patch',
    status: 409,
    body: response.body,
  });
});

const openapiPath = path.resolve(
  import.meta.dirname,
  '../../../../../packages/api-contract/openapi.yaml',
);

type ContractDocument = {
  paths?: Record<
    string,
    Partial<
      Record<'delete', { responses?: Record<string, { content?: unknown }> }>
    >
  >;
};

/**
 * O ajudante de contrato valida corpo contra schema; o 204 não tem corpo nem
 * schema, então a conferência aqui é a do contrato: o status está documentado
 * e sem conteúdo.
 */
async function expectDocumentedEmptyResponse(
  requestPath: string,
  status: number,
): Promise<void> {
  const document = (await SwaggerParser.dereference(
    openapiPath,
  )) as ContractDocument;
  const response =
    document.paths?.[requestPath]?.delete?.responses?.[String(status)];

  expect(response).toBeDefined();
  expect(response?.content).toBeUndefined();
}

/** Envia `DELETE /api/org-units/:id` com o cabeçalho do CSRF. */
function deleteOrgUnit(orgUnitId: string, cookie: string): Promise<Response> {
  return httpRequest(app)
    .delete(`/api/org-units/${orgUnitId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie);
}

test('DELETE org-units answers the documented 204', async () => {
  const created = await postOrgUnit(
    { parentId: await getRootId(), name: 'Restauro' },
    adminCookie,
  );

  const response = await deleteOrgUnit(idOf(created), adminCookie);

  expect(response.status).toBe(204);
  await expectDocumentedEmptyResponse(ORG_UNIT_PATH, 204);
});

test('DELETE org-units answers the documented 403', async () => {
  const created = await postOrgUnit(
    { parentId: await getRootId(), name: 'Restauro' },
    adminCookie,
  );
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await deleteOrgUnit(idOf(created), cookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'delete',
    status: 403,
    body: response.body,
  });
});

test('DELETE org-units answers the documented 404', async () => {
  const response = await deleteOrgUnit(randomUUID(), adminCookie);

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'delete',
    status: 404,
    body: response.body,
  });
});

test('DELETE org-units answers the documented 409', async () => {
  const response = await deleteOrgUnit(await getRootId(), adminCookie);

  expect(response.status).toBe(409);
  await expectMatchesContract({
    path: ORG_UNIT_PATH,
    method: 'delete',
    status: 409,
    body: response.body,
  });
});
