import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { SpacesService } from '../spaces.service';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

type SpaceItem = { id: string; type: string; name: string };

type SpacesBody = { data: SpaceItem[] };

let app: INestApplication;
let prisma: PrismaService;
let spaces: SpacesService;

let adminPerson: Person;
let adminCookie: string;

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
  spaces = app.get(SpacesService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);

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
    throw new Error('A instalação não trouxe o cookie de sessão.');
  }

  adminCookie = sessionCookie.split(';')[0] ?? '';
  adminPerson = await prisma.person.findFirstOrThrow({ where: { email: EMAIL } });
});

/** `GET /api/spaces`. */
function getSpaces(cookie?: string): Promise<Response> {
  const request = httpRequest(app).get('/api/spaces');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** Id da unidade raiz criada pela instalação. */
async function getRootId(): Promise<string> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: adminPerson.organizationId, parentId: null },
  });

  return root.id;
}

type CreatedUnit = { orgUnitId: string; spaceId: string };

/** Cria uma unidade (filha da raiz, por padrão) com o espaço `UNIT` dela. */
async function createUnit(
  name: string,
  options: { parentId?: string } = {},
): Promise<CreatedUnit> {
  const unit = await prisma.orgUnit.create({
    data: {
      organizationId: adminPerson.organizationId,
      parentId: options.parentId ?? (await getRootId()),
      name,
    },
  });

  const space = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: unit.id },
  });

  return { orgUnitId: unit.id, spaceId: space.id };
}

/** Lota a pessoa na unidade, direto pelo Prisma. */
async function assign(orgUnitId: string, personId: string): Promise<void> {
  await prisma.orgUnitAssignment.create({ data: { orgUnitId, personId } });
}

async function createMember(): Promise<{ person: Person; cookie: string }> {
  return createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });
}

test('a person without assignments gets an empty list', async () => {
  await createUnit('Protocolo');
  const { cookie } = await createMember();

  const response = await getSpaces(cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});

test('a person assigned to two units gets both in pt-BR order with the space id', async () => {
  const zilda = await createUnit('Zilda');
  const alvaro = await createUnit('Álvaro');
  const { person, cookie } = await createMember();
  await assign(zilda.orgUnitId, person.id);
  await assign(alvaro.orgUnitId, person.id);

  const zildaSpace = await prisma.space.findUniqueOrThrow({
    where: { orgUnitId: zilda.orgUnitId },
  });
  const alvaroSpace = await prisma.space.findUniqueOrThrow({
    where: { orgUnitId: alvaro.orgUnitId },
  });

  const response = await getSpaces(cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      { id: alvaroSpace.id, type: 'unit', name: 'Álvaro' },
      { id: zildaSpace.id, type: 'unit', name: 'Zilda' },
    ],
  });
});

test('a person assigned only to a child unit does not get the parent', async () => {
  const parent = await createUnit('Secretaria de Educação');
  const child = await createUnit('Protocolo', { parentId: parent.orgUnitId });
  const childUnit = await prisma.orgUnit.findUniqueOrThrow({
    where: { id: child.orgUnitId },
  });
  const { person, cookie } = await createMember();
  await assign(child.orgUnitId, person.id);

  const response = await getSpaces(cookie);

  expect(childUnit.parentId).toBe(parent.orgUnitId);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [{ id: child.spaceId, type: 'unit', name: 'Protocolo' }],
  });
});

test('an admin without assignments gets an empty list even with units in the organization', async () => {
  await createUnit('Protocolo');
  await createUnit('Almoxarifado');

  const response = await getSpaces(adminCookie);

  expect(adminPerson.isAdmin).toBe(true);
  expect(response.status).toBe(200);
  expect((response.body as SpacesBody).data).toEqual([]);
});

/**
 * A organização é única por instância — a `0002` a tranca com o check
 * `Organization_singleton_check` —, então uma segunda organização não pode
 * ser gravada e o caso não chega a existir por HTTP. O filtro é provado onde
 * ele mora: o serviço, contra o mesmo Postgres, com outro `organizationId`.
 */
test('a unit of another organization never appears', async () => {
  const unit = await createUnit('Protocolo');
  const { person } = await createMember();
  await assign(unit.orgUnitId, person.id);

  const mine = await spaces.list(adminPerson.organizationId, person.id);
  const others = await spaces.list(randomUUID(), person.id);

  expect(mine.data.map((item) => item.id)).toEqual([unit.spaceId]);
  expect(others.data.map((item) => item.id)).not.toContain(unit.spaceId);
  expect(others).toEqual({ data: [] });
});

test('after the assignment is removed the next request no longer returns the unit', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);

  const before = await getSpaces(cookie);

  await prisma.orgUnitAssignment.delete({
    where: {
      orgUnitId_personId: { orgUnitId: unit.orgUnitId, personId: person.id },
    },
  });

  const after = await getSpaces(cookie);

  expect((before.body as SpacesBody).data.map((item) => item.id)).toEqual([
    unit.spaceId,
  ]);
  expect(after.status).toBe(200);
  expect((after.body as SpacesBody).data).toEqual([]);
});

test('an anonymous request answers 401', async () => {
  const response = await getSpaces();

  expect(response.status).toBe(401);
});

test('each item has exactly the id, type and name keys', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);

  const response = await getSpaces(cookie);
  const [item] = (response.body as SpacesBody).data;

  expect(item).toBeDefined();
  expect(Object.keys(item ?? {}).sort()).toEqual(['id', 'name', 'type']);
});
