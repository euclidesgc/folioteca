import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import path from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import {
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { DocumentsController } from '../documents.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

const openapiPath = path.resolve(
  import.meta.dirname,
  '../../../../../packages/api-contract/openapi.yaml',
);

type ContractDocument = {
  paths?: Record<
    string,
    Partial<
      Record<
        'get' | 'post' | 'put' | 'patch' | 'delete',
        { responses?: Record<string, { content?: unknown }> }
      >
    >
  >;
};

/**
 * O helper de contrato valida corpo contra schema; o 204 não tem corpo nem
 * schema, então a conferência aqui é a do contrato: o status está documentado
 * e sem conteúdo.
 */
async function expectDocumentedEmptyResponse(
  requestPath: string,
  method: 'put' | 'delete' | 'post',
  status: number,
): Promise<void> {
  const document = (await SwaggerParser.dereference(
    openapiPath,
  )) as ContractDocument;
  const response = document.paths?.[requestPath]?.[method]?.responses?.[
    String(status)
  ];

  expect(response).toBeDefined();
  expect(response?.content).toBeUndefined();
}

/** `isFavorite` do documento no corpo da resposta. */
function isFavoriteOf(response: Response): unknown {
  return (response.body as { data: { isFavorite: unknown } }).data.isFavorite;
}

/** `trashedAt` do documento no corpo da resposta. */
function trashedAtOf(response: Response): unknown {
  return (response.body as { data: { trashedAt: unknown } }).data.trashedAt;
}

/** `trashedAt` de cada resumo na resposta de lista. */
function summaryTrashedAt(response: Response): unknown[] {
  return (response.body as { data: { trashedAt: unknown }[] }).data.map(
    (summary) => summary.trashedAt,
  );
}

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

test('PUT favorite answers 204 as documented', async () => {
  const documentId = await createDocumentId();

  const response = await httpRequest(app)
    .put(`/api/documents/${documentId}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  await expectDocumentedEmptyResponse(
    '/documents/{documentId}/favorite',
    'put',
    204,
  );
});

test('DELETE favorite answers 204 as documented', async () => {
  const documentId = await createDocumentId();
  await httpRequest(app)
    .put(`/api/documents/${documentId}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  const response = await httpRequest(app)
    .delete(`/api/documents/${documentId}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  await expectDocumentedEmptyResponse(
    '/documents/{documentId}/favorite',
    'delete',
    204,
  );
});

test('favorite on an unknown document answers the documented 404', async () => {
  const response = await httpRequest(app)
    .put(`/api/documents/${randomUUID()}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: '/documents/{documentId}/favorite',
    method: 'put',
    status: 404,
    body: response.body,
  });
});

test('GET documents with scope favorites matches DocumentsResponse', async () => {
  const documentId = await createDocumentId();
  await httpRequest(app)
    .put(`/api/documents/${documentId}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  const response = await httpRequest(app)
    .get('/api/documents?scope=favorites')
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/documents',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('POST, GET and PATCH bodies carry isFavorite', async () => {
  const created = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
  const documentId = (created.body as { data: { id: string } }).data.id;

  const read = await httpRequest(app)
    .get(`/api/documents/${documentId}`)
    .set('Cookie', cookie);
  const renamed = await httpRequest(app)
    .patch(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send({ title: 'Plano de obras' });

  expect(isFavoriteOf(created)).toBe(false);
  expect(isFavoriteOf(read)).toBe(false);
  expect(isFavoriteOf(renamed)).toBe(false);
});

function trashDocument(documentId: string): Promise<Response> {
  return httpRequest(app)
    .post(`/api/documents/${documentId}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function restoreDocument(documentId: string): Promise<Response> {
  return httpRequest(app)
    .post(`/api/documents/${documentId}/restore`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function deleteDocument(documentId: string): Promise<Response> {
  return httpRequest(app)
    .delete(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

test('POST trash answers the documented 200', async () => {
  const documentId = await createDocumentId();

  const response = await trashDocument(documentId);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/documents/{documentId}/trash',
    method: 'post',
    status: 200,
    body: response.body,
  });
});

test('POST restore answers the documented 200', async () => {
  const documentId = await createDocumentId();
  await trashDocument(documentId);

  const response = await restoreDocument(documentId);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/documents/{documentId}/restore',
    method: 'post',
    status: 200,
    body: response.body,
  });
});

test('DELETE answers 204 in the trash and the documented 409 outside it', async () => {
  const outside = await createDocumentId();
  const inTrash = await createDocumentId();
  await trashDocument(inTrash);

  const conflict = await deleteDocument(outside);
  const removed = await deleteDocument(inTrash);

  expect(conflict.status).toBe(409);
  await expectMatchesContract({
    path: '/documents/{documentId}',
    method: 'delete',
    status: 409,
    body: conflict.body,
  });
  expect(removed.status).toBe(204);
  expect(removed.body).toEqual({});
  await expectDocumentedEmptyResponse('/documents/{documentId}', 'delete', 204);
});

test('PATCH in the trash answers the documented 409', async () => {
  const documentId = await createDocumentId();
  await trashDocument(documentId);

  const response = await httpRequest(app)
    .patch(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send({ title: 'Plano de obras' });

  expect(response.status).toBe(409);
  await expectMatchesContract({
    path: '/documents/{documentId}',
    method: 'patch',
    status: 409,
    body: response.body,
  });
});

test('GET documents with scope trash matches DocumentsResponse', async () => {
  const documentId = await createDocumentId();
  await trashDocument(documentId);

  const response = await httpRequest(app)
    .get('/api/documents?scope=trash')
    .set('Cookie', cookie);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/documents',
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('every document and summary body carries trashedAt', async () => {
  const created = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
  const documentId = (created.body as { data: { id: string } }).data.id;

  const read = await httpRequest(app)
    .get(`/api/documents/${documentId}`)
    .set('Cookie', cookie);
  const mine = await httpRequest(app)
    .get('/api/documents?scope=mine')
    .set('Cookie', cookie);
  const trashed = await trashDocument(documentId);
  const trashList = await httpRequest(app)
    .get('/api/documents?scope=trash')
    .set('Cookie', cookie);

  expect(trashedAtOf(created)).toBeNull();
  expect(trashedAtOf(read)).toBeNull();
  expect(summaryTrashedAt(mine)).toEqual([null]);
  expect(trashedAtOf(trashed)).toEqual(expect.any(String));
  expect(summaryTrashedAt(trashList)).toEqual([expect.any(String)]);
});

const SHARE_CONTRACT_PATH = '/documents/{documentId}/shares/{personId}';

function putShare(
  documentId: string,
  personId: string,
  shareCookie: string,
): Promise<Response> {
  return httpRequest(app)
    .put(`/api/documents/${documentId}/shares/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', shareCookie)
    .send({ level: 'view' });
}

async function expectShareContract(
  response: Response,
  status: number,
): Promise<void> {
  expect(response.status).toBe(status);
  await expectMatchesContract({
    path: SHARE_CONTRACT_PATH,
    method: 'put',
    status,
    body: response.body,
  });
}

test('PUT documents shares answers the documented 200', async () => {
  const documentId = await createDocumentId();
  const { person } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  await expectShareContract(await putShare(documentId, person.id, cookie), 200);
});

test('PUT documents shares answers the documented 400', async () => {
  const documentId = await createDocumentId();

  await expectShareContract(
    await putShare(documentId, randomUUID(), cookie),
    400,
  );
});

test('PUT documents shares answers the documented 403', async () => {
  const documentId = await createDocumentId();
  const viewer = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  const { person: third } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });
  await putShare(documentId, viewer.person.id, cookie);

  await expectShareContract(
    await putShare(documentId, third.id, viewer.cookie),
    403,
  );
});

test('PUT documents shares answers the documented 404', async () => {
  const { person } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  await expectShareContract(
    await putShare(randomUUID(), person.id, cookie),
    404,
  );
});

test('PUT documents shares answers the documented 409', async () => {
  const documentId = await createDocumentId();
  const { person } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await trashDocument(documentId);

  await expectShareContract(await putShare(documentId, person.id, cookie), 409);
});

const SHARES_LIST_CONTRACT_PATH = '/documents/{documentId}/shares';

function getShares(documentId: string, listCookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .get(`/api/documents/${documentId}/shares`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return listCookie === undefined
    ? request
    : request.set('Cookie', listCookie);
}

async function expectSharesListContract(
  response: Response,
  status: number,
): Promise<void> {
  expect(response.status).toBe(status);
  await expectMatchesContract({
    path: SHARES_LIST_CONTRACT_PATH,
    method: 'get',
    status,
    body: response.body,
  });
}

test('GET documents shares answers the documented 200', async () => {
  const documentId = await createDocumentId();
  const { person } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await putShare(documentId, person.id, cookie);

  await expectSharesListContract(await getShares(documentId, cookie), 200);
});

test('GET documents shares answers the documented 401', async () => {
  const documentId = await createDocumentId();

  await expectSharesListContract(await getShares(documentId), 401);
});

test('GET documents shares answers the documented 403', async () => {
  const documentId = await createDocumentId();
  const viewer = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await putShare(documentId, viewer.person.id, cookie);

  await expectSharesListContract(
    await getShares(documentId, viewer.cookie),
    403,
  );
});

test('GET documents shares answers the documented 404', async () => {
  await expectSharesListContract(await getShares(randomUUID(), cookie), 404);
});

/** `POST /api/documents` com o corpo informado, na sessão da instalação. */
function postDocumentWith(body: object): Promise<Response> {
  return httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send(body);
}

/** Unidade sob a raiz com o espaço `UNIT` dela e a pessoa da sessão lotada. */
async function createAssignedUnitSpaceId(): Promise<string> {
  const person = await prisma.person.findFirstOrThrow({
    where: { email: EMAIL },
  });
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { parentId: null },
  });
  const unit = await prisma.orgUnit.create({
    data: {
      organizationId: person.organizationId,
      parentId: root.id,
      name: 'Protocolo',
    },
  });
  const space = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: unit.id },
  });
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId: unit.id, personId: person.id },
  });

  return space.id;
}

test('POST documents with spaceId answers the documented 201', async () => {
  const spaceId = await createAssignedUnitSpaceId();

  const response = await postDocumentWith({ spaceId });

  expect(response.status).toBe(201);
  expect((response.body as { data: { spaceId: string } }).data.spaceId).toBe(
    spaceId,
  );
  await expectMatchesContract({
    path: '/documents',
    method: 'post',
    status: 201,
    body: response.body,
  });
});

/**
 * Mãe "Secretaria" com a pessoa da sessão lotada e a filha "Protocolo", cujo
 * espaço herda dela: devolve o espaço da filha, alcançado só pela herança.
 */
async function createInheritedUnitSpaceId(): Promise<string> {
  const person = await prisma.person.findFirstOrThrow({
    where: { email: EMAIL },
  });
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { parentId: null },
  });
  const parent = await prisma.orgUnit.create({
    data: {
      organizationId: person.organizationId,
      parentId: root.id,
      name: 'Secretaria',
    },
  });
  await prisma.space.create({ data: { type: 'UNIT', orgUnitId: parent.id } });
  const child = await prisma.orgUnit.create({
    data: {
      organizationId: person.organizationId,
      parentId: parent.id,
      name: 'Protocolo',
    },
  });
  const childSpace = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: child.id, inheritsParent: true },
  });
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId: parent.id, personId: person.id },
  });

  return childSpace.id;
}

test('POST /documents with an inherited unit space matches the 201 contract', async () => {
  const spaceId = await createInheritedUnitSpaceId();

  const response = await postDocumentWith({ spaceId });

  expect(response.status).toBe(201);
  expect(response.body).toEqual({
    data: expect.objectContaining({ spaceId, accessLevel: 'owner' }) as unknown,
  });
  await expectMatchesContract({
    path: '/documents',
    method: 'post',
    status: 201,
    body: response.body,
  });
});

test('POST documents with spaceId answers the documented 400', async () => {
  const spaceId = await createAssignedUnitSpaceId();

  const response = await postDocumentWith({ spaceId, title: 'Regulamento' });

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: '/documents',
    method: 'post',
    status: 400,
    body: response.body,
  });
});

test('POST documents with spaceId answers the documented 404', async () => {
  const response = await postDocumentWith({ spaceId: randomUUID() });

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: '/documents',
    method: 'post',
    status: 404,
    body: response.body,
  });
});

/** Esquema do contrato sem resolver `$ref`, para conferir a declaração. */
type RawSchema = {
  type?: string;
  enum?: string[];
  required?: string[];
  properties?: Record<string, RawSchema>;
};

type RawParameter = { name?: string; in?: string };

type RawContract = {
  paths?: Record<
    string,
    Partial<
      Record<
        'get' | 'post' | 'put' | 'patch' | 'delete',
        {
          operationId?: string;
          parameters?: RawParameter[];
          requestBody?: unknown;
          responses?: Record<string, { description?: string }>;
        }
      >
    >
  >;
  components?: { schemas?: Record<string, RawSchema> };
};

function rawContract(): Promise<RawContract> {
  return SwaggerParser.parse(openapiPath) as Promise<RawContract>;
}

test('ShareDocumentInput level is an enum of view and edit without nullable', async () => {
  const schema = (await rawContract()).components?.schemas?.ShareDocumentInput;

  expect(schema?.required).toContain('level');
  expect(schema?.properties?.level?.type).toBe('string');
  expect([...(schema?.properties?.level?.enum ?? [])].sort()).toEqual([
    'edit',
    'view',
  ]);
  expect(JSON.stringify(schema)).not.toContain('nullable');
});

test('DocumentShare level is an enum of view and edit without nullable', async () => {
  const schema = (await rawContract()).components?.schemas?.DocumentShare;
  const documentId = await createDocumentId();
  const { person } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const response = await httpRequest(app)
    .put(`/api/documents/${documentId}/shares/${person.id}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send({ level: 'edit' });

  expect(schema?.required).toContain('level');
  expect(schema?.properties?.level?.type).toBe('string');
  expect([...(schema?.properties?.level?.enum ?? [])].sort()).toEqual([
    'edit',
    'view',
  ]);
  expect(JSON.stringify(schema)).not.toContain('nullable');
  expect((response.body as { data: { level: string } }).data.level).toBe(
    'edit',
  );
  await expectShareContract(response, 200);
});

test('shareDocument path method and personId param match the controller', async () => {
  const pathItem = (await rawContract()).paths?.[SHARE_CONTRACT_PATH];
  const controllerPath = Reflect.getMetadata(
    PATH_METADATA,
    DocumentsController,
  ) as unknown;
  const handler = Object.getOwnPropertyDescriptor(
    DocumentsController.prototype,
    'shareDocument',
  )?.value as object;
  const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as unknown;
  const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as unknown;
  const routeArgs = (Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    DocumentsController,
    'shareDocument',
  ) ?? {}) as Record<string, { data?: unknown }>;
  const paramNames = Object.entries(routeArgs)
    .filter(([key]) => key.startsWith(`${RouteParamtypes.PARAM}:`))
    .map(([, arg]) => arg.data)
    .sort();
  const contractPath = `/${String(controllerPath)}/${String(methodPath)}`.replace(
    /:(\w+)/g,
    '{$1}',
  );

  // DV3: a fatia 179 acrescentou o `delete` ao mesmo path.
  expect(Object.keys(pathItem ?? {}).sort()).toEqual(['delete', 'put']);
  expect(pathItem?.put?.operationId).toBe('shareDocument');
  expect(requestMethod).toBe(RequestMethod.PUT);
  expect(contractPath).toBe(SHARE_CONTRACT_PATH);
  expect(paramNames).toEqual(['documentId', 'personId']);
  expect(
    (pathItem?.put?.parameters ?? [])
      .filter((parameter) => parameter.in === 'path')
      .map((parameter) => parameter.name)
      .sort(),
  ).toEqual(['documentId', 'personId']);
});

/** Operação `delete` do path do compartilhamento, sem resolver `$ref`. */
async function rawRemoveOperation() {
  return (await rawContract()).paths?.[SHARE_CONTRACT_PATH]?.delete;
}

function deleteShare(
  documentId: string,
  personId: string,
  shareCookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .delete(`/api/documents/${documentId}/shares/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return (
    shareCookie === undefined ? request : request.set('Cookie', shareCookie)
  ).send();
}

async function expectRemoveShareContract(
  response: Response,
  status: number,
): Promise<void> {
  expect(response.status).toBe(status);
  await expectMatchesContract({
    path: SHARE_CONTRACT_PATH,
    method: 'delete',
    status,
    body: response.body,
  });
}

test('removeDocumentShare is a delete on the shares path with 204 401 403 404 409', async () => {
  const operation = await rawRemoveOperation();
  const documentId = await createDocumentId();
  const trashedId = await createDocumentId();
  const viewer = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await putShare(documentId, viewer.person.id, cookie);
  await putShare(trashedId, viewer.person.id, cookie);
  await trashDocument(trashedId);

  const forbidden = await deleteShare(
    documentId,
    viewer.person.id,
    viewer.cookie,
  );
  const unauthorized = await deleteShare(documentId, viewer.person.id);
  const missing = await deleteShare(randomUUID(), viewer.person.id, cookie);
  const trashed = await deleteShare(trashedId, viewer.person.id, cookie);
  const removed = await deleteShare(documentId, viewer.person.id, cookie);

  expect(operation?.operationId).toBe('removeDocumentShare');
  expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
    '204',
    '401',
    '403',
    '404',
    '409',
  ]);
  expect(operation?.responses?.['403']?.description).toContain(
    'Só o proprietário pode remover o acesso a este documento.',
  );
  await expectRemoveShareContract(forbidden, 403);
  await expectRemoveShareContract(unauthorized, 401);
  await expectRemoveShareContract(missing, 404);
  await expectRemoveShareContract(trashed, 409);
  expect(removed.status).toBe(204);
  await expectDocumentedEmptyResponse(SHARE_CONTRACT_PATH, 'delete', 204);
});

test('removeDocumentShare path method and params match the controller', async () => {
  const operation = await rawRemoveOperation();
  const controllerPath = Reflect.getMetadata(
    PATH_METADATA,
    DocumentsController,
  ) as unknown;
  const handler = Object.getOwnPropertyDescriptor(
    DocumentsController.prototype,
    'removeDocumentShare',
  )?.value as object;
  const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as unknown;
  const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as unknown;
  const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as unknown;
  const routeArgs = (Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    DocumentsController,
    'removeDocumentShare',
  ) ?? {}) as Record<string, { data?: unknown }>;
  const paramNames = Object.entries(routeArgs)
    .filter(([key]) => key.startsWith(`${RouteParamtypes.PARAM}:`))
    .map(([, arg]) => arg.data)
    .sort();
  const contractPath = `/${String(controllerPath)}/${String(methodPath)}`.replace(
    /:(\w+)/g,
    '{$1}',
  );

  expect(operation?.operationId).toBe('removeDocumentShare');
  expect(requestMethod).toBe(RequestMethod.DELETE);
  expect(httpCode).toBe(204);
  expect(contractPath).toBe(SHARE_CONTRACT_PATH);
  expect(paramNames).toEqual(['documentId', 'personId']);
  expect(
    (operation?.parameters ?? [])
      .filter((parameter) => parameter.in === 'path')
      .map((parameter) => parameter.name)
      .sort(),
  ).toEqual(['documentId', 'personId']);
});

test('removeDocumentShare has no request body and no nullable', async () => {
  const operation = await rawRemoveOperation();
  const pathItem = (await rawContract()).paths?.[SHARE_CONTRACT_PATH];

  expect(operation).toBeDefined();
  expect(operation?.requestBody).toBeUndefined();
  expect(JSON.stringify(pathItem)).not.toContain('nullable');
});

const INSTANCE_SHARE_CONTRACT_PATH = '/documents/{documentId}/instance-share';

function putInstanceShare(
  documentId: string,
  body: object,
  shareCookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .put(`/api/documents/${documentId}/instance-share`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return (
    shareCookie === undefined ? request : request.set('Cookie', shareCookie)
  ).send(body);
}

async function expectInstanceShareContract(
  response: Response,
  status: number,
): Promise<void> {
  expect(response.status).toBe(status);
  await expectMatchesContract({
    path: INSTANCE_SHARE_CONTRACT_PATH,
    method: 'put',
    status,
    body: response.body,
  });
}

test('PUT instance-share has the same path and parameter in the controller and the contract', async () => {
  const pathItem = (await rawContract()).paths?.[INSTANCE_SHARE_CONTRACT_PATH];
  const controllerPath = Reflect.getMetadata(
    PATH_METADATA,
    DocumentsController,
  ) as unknown;
  const handler = Object.getOwnPropertyDescriptor(
    DocumentsController.prototype,
    'shareDocumentWithInstance',
  )?.value as object;
  const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as unknown;
  const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as unknown;
  const routeArgs = (Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    DocumentsController,
    'shareDocumentWithInstance',
  ) ?? {}) as Record<string, { data?: unknown }>;
  const paramNames = Object.entries(routeArgs)
    .filter(([key]) => key.startsWith(`${RouteParamtypes.PARAM}:`))
    .map(([, arg]) => arg.data)
    .sort();
  const contractPath = `/${String(controllerPath)}/${String(methodPath)}`.replace(
    /:(\w+)/g,
    '{$1}',
  );

  expect(Object.keys(pathItem ?? {}).sort()).toEqual(['delete', 'put']);
  expect(pathItem?.put?.operationId).toBe('shareDocumentWithInstance');
  expect(Object.keys(pathItem?.put?.responses ?? {}).sort()).toEqual([
    '200',
    '400',
    '401',
    '403',
    '404',
    '409',
  ]);
  expect(requestMethod).toBe(RequestMethod.PUT);
  expect(contractPath).toBe(INSTANCE_SHARE_CONTRACT_PATH);
  expect(paramNames).toEqual(['documentId']);
  expect(
    (pathItem?.put?.parameters ?? [])
      .filter((parameter) => parameter.in === 'path')
      .map((parameter) => parameter.name),
  ).toEqual(['documentId']);
  expect(JSON.stringify(pathItem)).not.toContain('nullable');
});

test('PUT instance-share matches the 200 contract', async () => {
  const documentId = await createDocumentId();
  const trashedId = await createDocumentId();
  await trashDocument(trashedId);
  const viewer = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await putShare(documentId, viewer.person.id, cookie);

  const shared = await putInstanceShare(documentId, { level: 'edit' }, cookie);
  const invalid = await putInstanceShare(documentId, { level: 'owner' }, cookie);
  const unauthorized = await putInstanceShare(documentId, { level: 'view' });
  const forbidden = await putInstanceShare(
    documentId,
    { level: 'view' },
    viewer.cookie,
  );
  const missing = await putInstanceShare(randomUUID(), { level: 'view' }, cookie);
  const trashed = await putInstanceShare(trashedId, { level: 'view' }, cookie);

  expect(shared.body).toEqual({ data: { level: 'edit' } });
  await expectInstanceShareContract(shared, 200);
  await expectInstanceShareContract(invalid, 400);
  await expectInstanceShareContract(unauthorized, 401);
  await expectInstanceShareContract(forbidden, 403);
  await expectInstanceShareContract(missing, 404);
  await expectInstanceShareContract(trashed, 409);
});

function deleteInstanceShare(
  documentId: string,
  shareCookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .delete(`/api/documents/${documentId}/instance-share`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return shareCookie === undefined ? request : request.set('Cookie', shareCookie);
}

async function expectRemoveInstanceShareContract(
  response: Response,
  status: number,
): Promise<void> {
  expect(response.status).toBe(status);
  await expectMatchesContract({
    path: INSTANCE_SHARE_CONTRACT_PATH,
    method: 'delete',
    status,
    body: response.body,
  });
}

test('DELETE instance-share has the same path and parameter in the controller and the contract', async () => {
  const pathItem = (await rawContract()).paths?.[INSTANCE_SHARE_CONTRACT_PATH];
  const controllerPath = Reflect.getMetadata(
    PATH_METADATA,
    DocumentsController,
  ) as unknown;
  const handler = Object.getOwnPropertyDescriptor(
    DocumentsController.prototype,
    'removeDocumentInstanceShare',
  )?.value as object;
  const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as unknown;
  const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as unknown;
  const httpCode = Reflect.getMetadata(HTTP_CODE_METADATA, handler) as unknown;
  const routeArgs = (Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    DocumentsController,
    'removeDocumentInstanceShare',
  ) ?? {}) as Record<string, { data?: unknown }>;
  const paramNames = Object.entries(routeArgs)
    .filter(([key]) => key.startsWith(`${RouteParamtypes.PARAM}:`))
    .map(([, arg]) => arg.data)
    .sort();
  const contractPath = `/${String(controllerPath)}/${String(methodPath)}`.replace(
    /:(\w+)/g,
    '{$1}',
  );

  expect(pathItem?.delete?.operationId).toBe('removeDocumentInstanceShare');
  expect(pathItem?.put?.operationId).toBe('shareDocumentWithInstance');
  expect(requestMethod).toBe(RequestMethod.DELETE);
  expect(httpCode).toBe(204);
  expect(contractPath).toBe(INSTANCE_SHARE_CONTRACT_PATH);
  expect(paramNames).toEqual(['documentId']);
  expect(
    (pathItem?.delete?.parameters ?? [])
      .filter((parameter) => parameter.in === 'path')
      .map((parameter) => parameter.name),
  ).toEqual(['documentId']);
});

test('DELETE instance-share declares 204, 401, 403, 404 and 409 without a request body', async () => {
  const pathItem = (await rawContract()).paths?.[INSTANCE_SHARE_CONTRACT_PATH];
  const operation = pathItem?.delete;
  const documentId = await createDocumentId();
  const trashedId = await createDocumentId();
  const viewer = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await putShare(documentId, viewer.person.id, cookie);
  await putInstanceShare(documentId, { level: 'view' }, cookie);
  await putInstanceShare(trashedId, { level: 'view' }, cookie);
  await trashDocument(trashedId);

  const unauthorized = await deleteInstanceShare(documentId);
  const forbidden = await deleteInstanceShare(documentId, viewer.cookie);
  const missing = await deleteInstanceShare(randomUUID(), cookie);
  const trashed = await deleteInstanceShare(trashedId, cookie);
  const removed = await deleteInstanceShare(documentId, cookie);

  expect(operation).toBeDefined();
  expect(operation?.requestBody).toBeUndefined();
  expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
    '204',
    '401',
    '403',
    '404',
    '409',
  ]);
  expect(operation?.responses?.['403']?.description).toContain(
    'Só o proprietário pode remover o acesso a este documento.',
  );
  expect(JSON.stringify(pathItem)).not.toContain('nullable');
  await expectRemoveInstanceShareContract(unauthorized, 401);
  await expectRemoveInstanceShareContract(forbidden, 403);
  await expectRemoveInstanceShareContract(missing, 404);
  await expectRemoveInstanceShareContract(trashed, 409);
  expect(removed.status).toBe(204);
  await expectDocumentedEmptyResponse(
    INSTANCE_SHARE_CONTRACT_PATH,
    'delete',
    204,
  );
});

test('GET shares matches the contract with instance', async () => {
  const schema = (await rawContract()).components?.schemas
    ?.DocumentAccessListResponse;
  const instanceSchema = (await rawContract()).components?.schemas
    ?.DocumentInstanceAccess;
  const withoutInstance = await createDocumentId();
  const withInstance = await createDocumentId();
  await putInstanceShare(withInstance, { level: 'view' }, cookie);

  const none = await getShares(withoutInstance, cookie);
  const view = await getShares(withInstance, cookie);

  expect(schema?.required).toEqual(['data', 'instance']);
  expect(instanceSchema?.required).toContain('level');
  expect([...(instanceSchema?.properties?.level?.enum ?? [])].sort()).toEqual([
    'edit',
    'none',
    'view',
  ]);
  expect((none.body as { instance: unknown }).instance).toEqual({
    level: 'none',
  });
  expect((view.body as { instance: unknown }).instance).toEqual({
    level: 'view',
  });
  await expectSharesListContract(none, 200);
  await expectSharesListContract(view, 200);
  // A lista sem `instance` não cumpre mais o contrato.
  await expect(
    expectMatchesContract({
      path: SHARES_LIST_CONTRACT_PATH,
      method: 'get',
      status: 200,
      body: { data: (none.body as { data: unknown }).data },
    }),
  ).rejects.toThrow('instance');
});
