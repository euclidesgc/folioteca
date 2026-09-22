import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { expectMatchesContract } from '../../../test/contract';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

const CONTRACT_PATH = '/org-units/{orgUnitId}/people';

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

/** Id da unidade raiz criada pela instalação. */
async function getRootId(): Promise<string> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { parentId: null },
  });

  return root.id;
}

/** Cria uma pessoa da organização, sem sessão. */
async function createPersonId(email: string): Promise<string> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { parentId: null },
  });

  const person = await prisma.person.create({
    data: {
      organizationId: root.organizationId,
      name: 'Ana Lima',
      email,
      passwordHash: randomUUID(),
    },
  });

  return person.id;
}

function getUnitPeople(orgUnitId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/org-units/${orgUnitId}/people`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

function assignPerson(
  orgUnitId: string,
  body: object,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .post(`/api/org-units/${orgUnitId}/people`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body,
  );
}

test('GET org unit people answers the documented 200/401/403/404', async () => {
  const rootId = await getRootId();
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const documented: [number, Response][] = [
    [200, await getUnitPeople(rootId, adminCookie)],
    [401, await getUnitPeople(rootId)],
    [403, await getUnitPeople(rootId, cookie)],
    [404, await getUnitPeople(randomUUID(), adminCookie)],
  ];

  for (const [status, response] of documented) {
    expect(response.status).toBe(status);
    await expectMatchesContract({
      path: CONTRACT_PATH,
      method: 'get',
      status,
      body: response.body,
    });
  }
});

test('POST assign answers the documented 201/400/401/403/404/409', async () => {
  const rootId = await getRootId();
  const personId = await createPersonId('ana@exemplo.org');
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const documented: [number, Response][] = [
    [201, await assignPerson(rootId, { personId }, adminCookie)],
    [409, await assignPerson(rootId, { personId }, adminCookie)],
    [400, await assignPerson(rootId, {}, adminCookie)],
    [401, await assignPerson(rootId, { personId })],
    [403, await assignPerson(rootId, { personId }, cookie)],
    [404, await assignPerson(rootId, { personId: randomUUID() }, adminCookie)],
  ];

  for (const [status, response] of documented) {
    expect(response.status).toBe(status);
    await expectMatchesContract({
      path: CONTRACT_PATH,
      method: 'post',
      status,
      body: response.body,
    });
  }
});
