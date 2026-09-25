import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import path from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import {
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
        { operationId?: string; parameters?: RawParameter[] }
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

  expect(Object.keys(pathItem ?? {})).toEqual(['put']);
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
