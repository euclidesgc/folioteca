import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import path from 'node:path';

import SwaggerParser from '@apidevtools/swagger-parser';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { createApp } from '../../create-app';
import { AuthController } from '../auth.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

let app: INestApplication;
let prisma: PrismaService;

const EMAIL = 'maria@exemplo.org';

const openapiPath = path.resolve(
  import.meta.dirname,
  '../../../../../packages/api-contract/openapi.yaml',
);

/** Esquema do contrato sem resolver `$ref`, para conferir a declaração. */
type RawSchema = {
  type?: string;
  enum?: string[];
  required?: string[];
  properties?: Record<string, RawSchema>;
  $ref?: string;
};

type RawContract = {
  paths?: Record<
    string,
    Partial<
      Record<
        'get' | 'post' | 'put' | 'patch' | 'delete',
        { operationId?: string; responses?: Record<string, unknown> }
      >
    >
  >;
  components?: { schemas?: Record<string, RawSchema> };
};

/** Senha da pessoa criada pela última instalação do teste. */
let installedPassword = '';

async function installAndGetCookie(): Promise<string> {
  installedPassword = randomUUID();

  const response = await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: 'Prefeitura de Exemplo',
      name: 'Maria Souza',
      email: EMAIL,
      password: installedPassword,
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

test('POST login 200 matches CurrentUserResponse', async () => {
  await installAndGetCookie();

  const response = await httpRequest(app)
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email: EMAIL, password: installedPassword });

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: '/auth/login',
    method: 'post',
    status: 200,
    body: response.body,
  });
});

test('POST login 400 matches ValidationError', async () => {
  await installAndGetCookie();

  const response = await httpRequest(app)
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email: 'nao-e-email', password: installedPassword });

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: '/auth/login',
    method: 'post',
    status: 400,
    body: response.body,
  });
});

test('POST login 401 matches Error', async () => {
  await installAndGetCookie();

  const response = await httpRequest(app)
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email: EMAIL, password: randomUUID() });

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: '/auth/login',
    method: 'post',
    status: 401,
    body: response.body,
  });
});

test('POST logout 204 has no body', async () => {
  const cookie = await installAndGetCookie();

  const response = await httpRequest(app)
    .post('/api/auth/logout')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie);

  // O contrato declara 204 sem `content`, então não há schema a comparar:
  // o que se confere é que a resposta também não traz corpo.
  expect(response.status).toBe(204);
  expect(response.text).toBe('');
  expect(response.body).toEqual({});
});

test('updateCurrentUserPreferences path and method match the controller', async () => {
  const document = (await SwaggerParser.parse(openapiPath)) as RawContract;
  const controllerPath = Reflect.getMetadata(
    PATH_METADATA,
    AuthController,
  ) as unknown;
  const handler = Object.getOwnPropertyDescriptor(
    AuthController.prototype,
    'updatePreferences',
  )?.value as object;
  const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as unknown;
  const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as unknown;

  const operation = document.paths?.['/auth/me/preferences']?.patch;

  expect(operation?.operationId).toBe('updateCurrentUserPreferences');
  expect(controllerPath).toBe('auth');
  expect(methodPath).toBe('me/preferences');
  expect(`/${String(controllerPath)}/${String(methodPath)}`).toBe(
    '/auth/me/preferences',
  );
  expect(requestMethod).toBe(RequestMethod.PATCH);
  expect(Object.keys(operation?.responses ?? {}).sort()).toEqual([
    '200',
    '400',
    '401',
  ]);
});

test('CurrentUser requires documentPageWidth as an enum without nullable', async () => {
  const document = (await SwaggerParser.parse(openapiPath)) as RawContract;
  const schemas = document.components?.schemas ?? {};
  const person = schemas.CurrentUser?.properties?.person;
  const pageWidth = schemas.DocumentPageWidth;

  expect(person?.required).toContain('documentPageWidth');
  expect(person?.properties?.documentPageWidth).toEqual({
    $ref: '#/components/schemas/DocumentPageWidth',
  });
  expect(pageWidth?.type).toBe('string');
  expect(pageWidth?.enum).toEqual(['small', 'medium', 'large', 'full']);
  expect(pageWidth).not.toHaveProperty('nullable');
  expect(person?.properties?.documentPageWidth).not.toHaveProperty('nullable');
});
