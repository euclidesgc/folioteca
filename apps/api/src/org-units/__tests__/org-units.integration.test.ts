import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

const ORGANIZATION_NAME = 'Prefeitura de Exemplo';

const FORBIDDEN_MESSAGE = 'Apenas a administração pode fazer isso.';

/** `expect.any(String)` tipado, para o corpo comparado por `toEqual`. */
const ANY_STRING = expect.any(String) as unknown as string;

type OrgUnitBody = { id: string; parentId: string | null; name: string };

let app: INestApplication;
let prisma: PrismaService;

let adminPerson: Person;
let adminCookie: string;

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);

  const password = randomUUID();

  await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: ORGANIZATION_NAME,
      name: 'Maria Souza',
      email: EMAIL,
      password,
    });

  const login = await httpRequest(app)
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email: EMAIL, password });

  const cookies = (login.headers['set-cookie'] ?? []) as string[];
  const sessionCookie = cookies.find((item) =>
    item.startsWith('folioteca_session='),
  );

  if (sessionCookie === undefined) {
    throw new Error('O login não trouxe o cookie de sessão.');
  }

  adminCookie = sessionCookie.split(';')[0] ?? '';
  adminPerson = await prisma.person.findFirstOrThrow({ where: { email: EMAIL } });
});

function getOrgUnits(cookie?: string): Promise<Response> {
  const request = httpRequest(app).get('/api/org-units');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

test('an admin right after installation gets 200 with the single root unit', async () => {
  const response = await getOrgUnits(adminCookie);

  expect(response.status).toBe(200);
  const body = response.body as { data: OrgUnitBody[] };
  expect(body.data).toHaveLength(1);
  expect(body.data[0]).toEqual({
    id: ANY_STRING,
    parentId: null,
    name: ORGANIZATION_NAME,
  });
});

test('returns every unit flat with its parentId in pt-BR collator order', async () => {
  const rootUnit = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: adminPerson.organizationId },
  });

  const zeladoria = await prisma.orgUnit.create({
    data: {
      organizationId: adminPerson.organizationId,
      parentId: rootUnit.id,
      name: 'Zeladoria',
    },
  });
  const areaTecnica = await prisma.orgUnit.create({
    data: {
      organizationId: adminPerson.organizationId,
      parentId: rootUnit.id,
      name: 'Área Técnica',
    },
  });
  const acervo = await prisma.orgUnit.create({
    data: {
      organizationId: adminPerson.organizationId,
      parentId: areaTecnica.id,
      name: 'acervo',
    },
  });

  const response = await getOrgUnits(adminCookie);

  expect(response.status).toBe(200);
  const body = response.body as { data: OrgUnitBody[] };
  expect(body.data).toHaveLength(4);
  expect(body.data.map((unit) => unit.name)).toEqual([
    'acervo',
    'Área Técnica',
    ORGANIZATION_NAME,
    'Zeladoria',
  ]);

  const byId = new Map(body.data.map((unit) => [unit.id, unit]));
  expect(byId.get(rootUnit.id)?.parentId).toBeNull();
  expect(byId.get(zeladoria.id)?.parentId).toBe(rootUnit.id);
  expect(byId.get(areaTecnica.id)?.parentId).toBe(rootUnit.id);
  expect(byId.get(acervo.id)?.parentId).toBe(areaTecnica.id);
});

test('a person who is not admin gets 403 with the message', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await getOrgUnits(cookie);

  expect(response.status).toBe(403);
  expect((response.body as { message: string }).message).toBe(FORBIDDEN_MESSAGE);
});

test('answers 401 without a session cookie', async () => {
  const response = await getOrgUnits();

  expect(response.status).toBe(401);
});

test('an admin demoted in the database gets 403 on the next request with the same session', async () => {
  const first = await getOrgUnits(adminCookie);
  expect(first.status).toBe(200);

  await prisma.person.update({
    where: { id: adminPerson.id },
    data: { isAdmin: false },
  });

  const second = await getOrgUnits(adminCookie);
  expect(second.status).toBe(403);
  expect((second.body as { message: string }).message).toBe(FORBIDDEN_MESSAGE);
});
