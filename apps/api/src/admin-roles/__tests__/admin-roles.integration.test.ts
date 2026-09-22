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

const PERSON_NOT_FOUND_BODY = { message: 'Pessoa não encontrada.' };

const MALFORMED_ID = 'nao-e-um-uuid';

type AdminBody = { data: AdminPerson };

/** `PUT /api/admins/:personId`, com o cabeçalho de CSRF. */
function promote(personId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .put(`/api/admins/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

test('an admin promotes a member and gets 200 with the person', async () => {
  const alvaroId = await createPerson('Álvaro', 'alvaro@exemplo.org', false);

  const response = await promote(alvaroId, adminCookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: { id: alvaroId, name: 'Álvaro', email: 'alvaro@exemplo.org' },
  });

  const stored = await prisma.person.findUniqueOrThrow({
    where: { id: alvaroId },
    select: { isAdmin: true },
  });
  expect(stored.isAdmin).toBe(true);

  const list = await getAdmins(adminCookie);
  expect(list.status).toBe(200);
  expect(bodyOf(list).data.map((person) => person.id)).toEqual([
    alvaroId,
    adminPerson.id,
  ]);
});

test('promoting twice answers 200 again and keeps a single admin entry', async () => {
  const joaoId = await createPerson('João Souza', 'joao@exemplo.org', false);

  const first = await promote(joaoId, adminCookie);
  const second = await promote(joaoId, adminCookie);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);

  const list = await getAdmins(adminCookie);
  expect(list.status).toBe(200);
  expect(
    bodyOf(list).data.filter((person) => person.id === joaoId),
  ).toHaveLength(1);
});

/**
 * A organização é única por instância — a `0002` a tranca com o check
 * `Organization_singleton_check` —, então uma segunda organização não pode
 * ser gravada e o caso não chega a existir por HTTP. O 404 é provado pelo
 * HTTP com um id que não é desta organização, e o escopo da escrita é provado
 * onde ele mora: o serviço, contra o mesmo Postgres, com outro
 * `organizationId`.
 */
test('a person of another organization answers 404 and stays a member', async () => {
  const joaoId = await createPerson('João Souza', 'joao@exemplo.org', false);

  const response = await promote(randomUUID(), adminCookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual(PERSON_NOT_FOUND_BODY);

  const error = await adminRoles.promote(randomUUID(), joaoId).then(
    () => undefined,
    (thrown: unknown) => thrown,
  );

  expect((error as Error).message).toBe(PERSON_NOT_FOUND_BODY.message);

  const stored = await prisma.person.findUniqueOrThrow({
    where: { id: joaoId },
    select: { isAdmin: true },
  });
  expect(stored.isAdmin).toBe(false);
});

test('an unknown id and a malformed id answer the very same 404', async () => {
  const unknown = await promote(randomUUID(), adminCookie);
  const malformed = await promote(MALFORMED_ID, adminCookie);

  expect(unknown.status).toBe(404);
  expect(malformed.status).toBe(unknown.status);
  expect(unknown.body).toEqual(PERSON_NOT_FOUND_BODY);
  expect(malformed.body).toEqual(unknown.body);
});

test('a non-admin answers 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });
  const targetId = await createPerson('Álvaro', 'alvaro@exemplo.org', false);

  const response = await promote(targetId, cookie);

  expect(response.status).toBe(403);
  expect((response.body as { message: string }).message).toBe(
    FORBIDDEN_MESSAGE,
  );
});

test('an anonymous request answers 401', async () => {
  const targetId = await createPerson('Álvaro', 'alvaro@exemplo.org', false);

  const response = await promote(targetId);

  expect(response.status).toBe(401);
  expect((response.body as { message: string }).message).toBe(
    'Sessão não encontrada.',
  );
});

test('a request without the CSRF header is refused before the 401', async () => {
  const targetId = await createPerson('Álvaro', 'alvaro@exemplo.org', false);

  const response = await httpRequest(app).put(`/api/admins/${targetId}`);

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Requisição recusada.' });
});

test('the 200 body has exactly the id, name and email keys', async () => {
  const alvaroId = await createPerson('Álvaro', 'alvaro@exemplo.org', false);

  const response = await promote(alvaroId, adminCookie);

  expect(response.status).toBe(200);
  expect(Object.keys((response.body as AdminBody).data).sort()).toEqual([
    'email',
    'id',
    'name',
  ]);

  const serialized = JSON.stringify(response.body);
  expect(serialized).not.toContain('passwordHash');
  expect(serialized).not.toContain('isAdmin');

  const stored = await prisma.person.findUniqueOrThrow({
    where: { id: alvaroId },
    select: { passwordHash: true },
  });
  expect(stored.passwordHash.length).toBeGreaterThan(0);
  expect(serialized).not.toContain(stored.passwordHash);
});

test('the promoted session gets 200 on the next request without logging in again', async () => {
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const before = await getAdmins(cookie);
  expect(before.status).toBe(403);

  const promotion = await promote(person.id, adminCookie);
  expect(promotion.status).toBe(200);

  const after = await getAdmins(cookie);
  expect(after.status).toBe(200);
  expect(bodyOf(after).data.map((admin) => admin.id)).toContain(person.id);
});
