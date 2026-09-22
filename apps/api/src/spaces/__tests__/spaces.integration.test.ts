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

/** `POST /api/spaces` com o cabeçalho de CSRF. */
function postSpace(body: unknown, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .post('/api/spaces')
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined
    ? request.send(body as object)
    : request.set('Cookie', cookie).send(body as object);
}

/** Quantos espaços livres existem no banco. */
function countFreeSpaces(): Promise<number> {
  return prisma.space.count({ where: { type: 'FREE' } });
}

test('POST spaces creates a free space owned by the session person', async () => {
  const { person, cookie } = await createMember();

  const response = await postSpace({ name: '  Projeto Alfa  ' }, cookie);

  expect(response.status).toBe(201);
  const created = (response.body as { data: SpaceItem }).data;
  expect(created).toEqual({
    id: expect.any(String) as string,
    type: 'free',
    name: 'Projeto Alfa',
  });

  const row = await prisma.space.findUniqueOrThrow({ where: { id: created.id } });
  expect(row.type).toBe('FREE');
  expect(row.name).toBe('Projeto Alfa');
  expect(row.ownerId).toBe(person.id);
  expect(row.organizationId).toBe(person.organizationId);
});

test('POST spaces rejects an empty name with 400', async () => {
  const response = await postSpace({ name: '' }, adminCookie);

  expect(response.status).toBe(400);
  expect(await countFreeSpaces()).toBe(0);
});

test('POST spaces rejects a name made only of spaces with 400', async () => {
  const response = await postSpace({ name: '    ' }, adminCookie);

  expect(response.status).toBe(400);
  expect(await countFreeSpaces()).toBe(0);
});

test('POST spaces rejects a name longer than 120 characters with 400', async () => {
  const response = await postSpace({ name: 'a'.repeat(121) }, adminCookie);

  expect(response.status).toBe(400);
  expect(await countFreeSpaces()).toBe(0);
});

test('POST spaces rejects extra fields with 400', async () => {
  const { person, cookie } = await createMember();

  const response = await postSpace(
    {
      name: 'Projeto Alfa',
      organizationId: randomUUID(),
      ownerId: adminPerson.id,
    },
    cookie,
  );

  expect(response.status).toBe(400);
  expect(await countFreeSpaces()).toBe(0);
  expect(
    await prisma.space.count({ where: { ownerId: { in: [person.id, adminPerson.id] } } }),
  ).toBe(0);
});

test('POST spaces accepts two spaces with the same name from the same owner', async () => {
  const first = await postSpace({ name: 'Projeto Alfa' }, adminCookie);
  const second = await postSpace({ name: 'Projeto Alfa' }, adminCookie);

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect((first.body as { data: SpaceItem }).data.id).not.toBe(
    (second.body as { data: SpaceItem }).data.id,
  );
  expect(
    await prisma.space.count({
      where: { type: 'FREE', ownerId: adminPerson.id, name: 'Projeto Alfa' },
    }),
  ).toBe(2);
});

test('POST spaces answers 401 to an anonymous request', async () => {
  const response = await postSpace({ name: 'Projeto Alfa' });

  expect(response.status).toBe(401);
  expect(await countFreeSpaces()).toBe(0);
});

test('POST spaces without the CSRF token is refused', async () => {
  const response = await httpRequest(app)
    .post('/api/spaces')
    .set('Cookie', adminCookie)
    .send({ name: 'Projeto Alfa' });

  expect(response.status).toBe(403);
  expect(response.body).toEqual({ message: 'Requisição recusada.' });
  expect(await countFreeSpaces()).toBe(0);
});

test('GET spaces returns free and unit spaces mixed in pt-BR order', async () => {
  const zilda = await createUnit('Zilda');
  const beatriz = await createUnit('Beatriz');
  const { person, cookie } = await createMember();
  await assign(zilda.orgUnitId, person.id);
  await assign(beatriz.orgUnitId, person.id);
  const alvaro = await postSpace({ name: 'Álvaro' }, cookie);
  const erico = await postSpace({ name: 'érico' }, cookie);

  const response = await getSpaces(cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      { id: (alvaro.body as { data: SpaceItem }).data.id, type: 'free', name: 'Álvaro' },
      { id: beatriz.spaceId, type: 'unit', name: 'Beatriz' },
      { id: (erico.body as { data: SpaceItem }).data.id, type: 'free', name: 'érico' },
      { id: zilda.spaceId, type: 'unit', name: 'Zilda' },
    ],
  });
});

test('a free space is not listed for another person of the same organization', async () => {
  const { cookie: ownerCookie } = await createMember();
  const other = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  const created = await postSpace({ name: 'Projeto Alfa' }, ownerCookie);
  const spaceId = (created.body as { data: SpaceItem }).data.id;

  const response = await getSpaces(other.cookie);

  expect(other.person.organizationId).toBe(adminPerson.organizationId);
  expect(response.status).toBe(200);
  expect((response.body as SpacesBody).data.map((item) => item.id)).not.toContain(
    spaceId,
  );
});

test('a free space is not listed for an admin who is not the owner', async () => {
  const { person, cookie } = await createMember();
  const created = await postSpace({ name: 'Projeto Alfa' }, cookie);
  const spaceId = (created.body as { data: SpaceItem }).data.id;

  const response = await getSpaces(adminCookie);

  expect(adminPerson.isAdmin).toBe(true);
  expect(adminPerson.organizationId).toBe(person.organizationId);
  expect(response.status).toBe(200);
  expect((response.body as SpacesBody).data.map((item) => item.id)).not.toContain(
    spaceId,
  );
});

/**
 * Como em `a unit of another organization never appears`: a organização é
 * única por instância (`Organization_singleton_check`), então o filtro é
 * provado no serviço real, com outro `organizationId`.
 */
test('a free space of another organization never appears', async () => {
  const space = await prisma.space.create({
    data: {
      type: 'FREE',
      organizationId: adminPerson.organizationId,
      ownerId: adminPerson.id,
      name: 'Projeto Alfa',
    },
  });

  const mine = await spaces.list(adminPerson.organizationId, adminPerson.id);
  const others = await spaces.list(randomUUID(), adminPerson.id);

  expect(mine.data.map((item) => item.id)).toEqual([space.id]);
  expect(others).toEqual({ data: [] });
});

test('the database rejects a FREE space without name', async () => {
  await expect(
    prisma.space.create({
      data: {
        type: 'FREE',
        organizationId: adminPerson.organizationId,
        ownerId: adminPerson.id,
      },
    }),
  ).rejects.toThrow(/Space_type_owner_check/);
});

test('the database rejects a FREE space without owner', async () => {
  await expect(
    prisma.space.create({
      data: {
        type: 'FREE',
        organizationId: adminPerson.organizationId,
        name: 'Projeto Alfa',
      },
    }),
  ).rejects.toThrow(/Space_type_owner_check/);
});

test('the database rejects a PERSONAL space with a name', async () => {
  const { person } = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
    withPersonalSpace: false,
  });

  await expect(
    prisma.space.create({
      data: { type: 'PERSONAL', personId: person.id, name: 'Projeto Alfa' },
    }),
  ).rejects.toThrow(/Space_type_owner_check/);
});
