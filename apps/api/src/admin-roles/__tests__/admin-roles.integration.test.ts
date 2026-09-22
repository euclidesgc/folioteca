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
import { AdminRolesService } from '../admin-roles.service';

const EMAIL = 'maria@exemplo.org';

const FORBIDDEN_MESSAGE = 'Apenas a administração pode fazer isso.';

type AdminPerson = { id: string; name: string; email: string };

type AdminsBody = { data: AdminPerson[] };

let app: INestApplication;
let prisma: PrismaService;
let adminRoles: AdminRolesService;

let adminPerson: Person;
let adminCookie: string;
let installedPassword: string;

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
  adminRoles = app.get(AdminRolesService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);

  installedPassword = randomUUID();

  await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: 'Prefeitura de Exemplo',
      name: 'Maria Souza',
      email: EMAIL,
      password: installedPassword,
    });

  const login = await httpRequest(app)
    .post('/api/auth/login')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email: EMAIL, password: installedPassword });

  const cookies = (login.headers['set-cookie'] ?? []) as string[];
  const sessionCookie = cookies.find((item) =>
    item.startsWith('folioteca_session='),
  );

  if (sessionCookie === undefined) {
    throw new Error('O login não trouxe o cookie de sessão.');
  }

  adminCookie = sessionCookie.split(';')[0] ?? '';
  adminPerson = await prisma.person.findFirstOrThrow({
    where: { email: EMAIL },
  });
});

/** `GET /api/admins`. */
function getAdmins(cookie?: string): Promise<Response> {
  const request = httpRequest(app).get('/api/admins');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

function bodyOf(response: Response): AdminsBody {
  return response.body as AdminsBody;
}

async function createPerson(
  name: string,
  email: string,
  isAdmin: boolean,
): Promise<string> {
  const person = await prisma.person.create({
    data: {
      organizationId: adminPerson.organizationId,
      name,
      email,
      passwordHash: randomUUID(),
      isAdmin,
    },
  });

  return person.id;
}

test('a fresh installation answers 200 with the single installed admin', async () => {
  const response = await getAdmins(adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response)).toEqual({
    data: [
      { id: adminPerson.id, name: adminPerson.name, email: adminPerson.email },
    ],
  });
});

test('only the admins of the organization come back, sorted with the pt-BR collator', async () => {
  const alvaroId = await createPerson('Álvaro', 'alvaro@exemplo.org', true);
  const beatrizId = await createPerson('Beatriz', 'beatriz@exemplo.org', true);
  const zildaId = await createPerson('Zilda', 'zilda@exemplo.org', true);
  await createPerson('João Souza', 'joao@exemplo.org', false);

  const response = await getAdmins(adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response).data.map((person) => person.id)).toEqual([
    alvaroId,
    beatrizId,
    adminPerson.id,
    zildaId,
  ]);
  expect(bodyOf(response).data[0]?.name).toBe('Álvaro');
});

test('each item has exactly the id, name and email keys', async () => {
  const response = await getAdmins(adminCookie);

  expect(response.status).toBe(200);

  for (const item of bodyOf(response).data) {
    expect(Object.keys(item).sort()).toEqual(['email', 'id', 'name']);
  }

  const serialized = JSON.stringify(response.body);
  expect(serialized).not.toContain('passwordHash');
  expect(serialized).not.toContain('isAdmin');
  expect(serialized).not.toContain('createdAt');
  expect(serialized).not.toContain(installedPassword);

  // The name of the column never leaving the body is the weak half of the
  // proof: what must never leave is the value. Read the hash that is really
  // stored and look for it.
  const stored = await prisma.person.findUniqueOrThrow({
    where: { id: adminPerson.id },
    select: { passwordHash: true },
  });
  expect(stored.passwordHash.length).toBeGreaterThan(0);
  expect(serialized).not.toContain(stored.passwordHash);
});

/**
 * A organização é única por instância — a `0002` a tranca com o check
 * `Organization_singleton_check` —, então uma segunda organização não pode
 * ser gravada e o caso não chega a existir por HTTP. O filtro é provado onde
 * ele mora: o serviço, contra o mesmo Postgres, com outro `organizationId`.
 */
test('an admin of another organization never shows up', async () => {
  await createPerson('Zilda', 'zilda@exemplo.org', true);

  const mine = await adminRoles.list(adminPerson.organizationId);
  const others = await adminRoles.list(randomUUID());

  expect(mine.data.length).toBeGreaterThan(0);
  expect(others).toEqual({ data: [] });
});

test('a non-admin answers 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await getAdmins(cookie);

  expect(response.status).toBe(403);
  expect((response.body as { message: string }).message).toBe(
    FORBIDDEN_MESSAGE,
  );
});

test('an anonymous request answers 401', async () => {
  const response = await getAdmins();

  expect(response.status).toBe(401);
  expect((response.body as { message: string }).message).toBe(
    'Sessão não encontrada.',
  );
});

test('the role is re-read on every request', async () => {
  const first = await getAdmins(adminCookie);
  expect(first.status).toBe(200);

  await prisma.person.update({
    where: { id: adminPerson.id },
    data: { isAdmin: false },
  });

  const second = await getAdmins(adminCookie);
  expect(second.status).toBe(403);
  expect((second.body as { message: string }).message).toBe(
    FORBIDDEN_MESSAGE,
  );
});
