import 'reflect-metadata';

import { randomBytes, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

const GUEST_EMAIL = 'convidado@exemplo.org';

const INVITATIONS_PATH = '/invitations';

const INVITATION_PATH = '/invitations/{token}';

const ACCEPT_PATH = '/invitations/{token}/accept';

const GUEST_NAME = 'Convidado Souza';

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

/** Envia `POST /api/invitations` com o cabeçalho que o CSRF do projeto exige. */
function postInvitation(body: object, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .post('/api/invitations')
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body,
  );
}

/** Cria um convite pela API e devolve o token em claro dele. */
async function inviteToken(email: string): Promise<string> {
  const response = await postInvitation({ email }, adminCookie);

  return (response.body as { data: { token: string } }).data.token;
}

function getInvitation(token: string): Promise<Response> {
  return httpRequest(app).get(`/api/invitations/${token}`);
}

/** Envia o aceite com o cabeçalho que o CSRF do projeto exige. */
function postAccept(token: string, body: object): Promise<Response> {
  return httpRequest(app)
    .post(`/api/invitations/${token}/accept`)
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
  adminCookie = await installAndGetCookie();
});

test('POST invitations answers the documented 201', async () => {
  const response = await postInvitation({ email: GUEST_EMAIL }, adminCookie);

  expect(response.status).toBe(201);
  await expectMatchesContract({
    path: INVITATIONS_PATH,
    method: 'post',
    status: 201,
    body: response.body,
  });
});

test('POST invitations answers the documented 400', async () => {
  const response = await postInvitation({ email: 'nao-e-email' }, adminCookie);

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: INVITATIONS_PATH,
    method: 'post',
    status: 400,
    body: response.body,
  });
});

test('POST invitations answers the documented 401', async () => {
  const response = await postInvitation({ email: GUEST_EMAIL });

  expect(response.status).toBe(401);
  await expectMatchesContract({
    path: INVITATIONS_PATH,
    method: 'post',
    status: 401,
    body: response.body,
  });
});

test('POST invitations answers the documented 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await postInvitation({ email: GUEST_EMAIL }, cookie);

  expect(response.status).toBe(403);
  await expectMatchesContract({
    path: INVITATIONS_PATH,
    method: 'post',
    status: 403,
    body: response.body,
  });
});

test('POST invitations answers the documented 409', async () => {
  const response = await postInvitation({ email: EMAIL }, adminCookie);

  expect(response.status).toBe(409);
  await expectMatchesContract({
    path: INVITATIONS_PATH,
    method: 'post',
    status: 409,
    body: response.body,
  });
});

test('GET invitation answers the documented 200', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await getInvitation(token);

  expect(response.status).toBe(200);
  await expectMatchesContract({
    path: INVITATION_PATH,
    method: 'get',
    status: 200,
    body: response.body,
  });
});

test('GET invitation answers the documented 404', async () => {
  const response = await getInvitation(randomBytes(32).toString('base64url'));

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: INVITATION_PATH,
    method: 'get',
    status: 404,
    body: response.body,
  });
});

test('POST accept answers the documented 201', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await postAccept(token, {
    name: GUEST_NAME,
    password: randomUUID(),
  });

  expect(response.status).toBe(201);
  await expectMatchesContract({
    path: ACCEPT_PATH,
    method: 'post',
    status: 201,
    body: response.body,
  });
});

test('POST accept answers the documented 400', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await postAccept(token, {
    name: '',
    password: randomUUID(),
  });

  expect(response.status).toBe(400);
  await expectMatchesContract({
    path: ACCEPT_PATH,
    method: 'post',
    status: 400,
    body: response.body,
  });
});

test('POST accept answers the documented 404', async () => {
  const response = await postAccept(randomBytes(32).toString('base64url'), {
    name: GUEST_NAME,
    password: randomUUID(),
  });

  expect(response.status).toBe(404);
  await expectMatchesContract({
    path: ACCEPT_PATH,
    method: 'post',
    status: 404,
    body: response.body,
  });
});

test('POST accept answers the documented 409', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  await createPersonWithSession(app, {
    name: 'João Souza',
    email: GUEST_EMAIL,
  });

  const response = await postAccept(token, {
    name: GUEST_NAME,
    password: randomUUID(),
  });

  expect(response.status).toBe(409);
  await expectMatchesContract({
    path: ACCEPT_PATH,
    method: 'post',
    status: 409,
    body: response.body,
  });
});
