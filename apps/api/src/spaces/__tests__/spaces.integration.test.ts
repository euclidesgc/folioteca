import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { NotFoundException, type INestApplication } from '@nestjs/common';
import { Prisma, type Person } from '@prisma/client';
import type { Response } from 'supertest';

import { AccessService } from '../../access/access.service';
import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { compareMembers, SpacesService } from '../spaces.service';
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

test('POST spaces answers 409 to a second space with the same name from the same owner', async () => {
  const first = await postSpace({ name: 'Projeto Alfa' }, adminCookie);
  const second = await postSpace({ name: 'Projeto Alfa' }, adminCookie);

  expect(first.status).toBe(201);
  expect(second.status).toBe(409);
  expect(second.body).toEqual({
    message: 'Você já tem um espaço com esse nome.',
  });
  expect(
    await prisma.space.count({
      where: { type: 'FREE', ownerId: adminPerson.id, name: 'Projeto Alfa' },
    }),
  ).toBe(1);
});

test('POST spaces answers 409 when the name differs only in case and outer spaces', async () => {
  const first = await postSpace({ name: 'Projeto Alfa' }, adminCookie);
  const second = await postSpace({ name: ' PROJETO alfa ' }, adminCookie);

  expect(first.status).toBe(201);
  expect(second.status).toBe(409);
  expect(second.body).toEqual({
    message: 'Você já tem um espaço com esse nome.',
  });
  expect(await countFreeSpaces()).toBe(1);
});

test('POST spaces accepts a name that differs only by an accent', async () => {
  const first = await postSpace({ name: 'Projeto Alfa' }, adminCookie);
  const second = await postSpace({ name: 'Projeto Álfa' }, adminCookie);

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(await countFreeSpaces()).toBe(2);
});

test('POST spaces accepts a name that differs only by inner spaces', async () => {
  const first = await postSpace({ name: 'Projeto Alfa' }, adminCookie);
  const second = await postSpace({ name: 'Projeto  Alfa' }, adminCookie);

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(await countFreeSpaces()).toBe(2);
});

test('POST spaces accepts the same name from a different owner', async () => {
  const { person, cookie } = await createMember();

  const mine = await postSpace({ name: 'Projeto Alfa' }, adminCookie);
  const theirs = await postSpace({ name: 'Projeto Alfa' }, cookie);

  expect(mine.status).toBe(201);
  expect(theirs.status).toBe(201);
  expect(
    await prisma.space.count({
      where: { type: 'FREE', ownerId: adminPerson.id, name: 'Projeto Alfa' },
    }),
  ).toBe(1);
  expect(
    await prisma.space.count({
      where: { type: 'FREE', ownerId: person.id, name: 'Projeto Alfa' },
    }),
  ).toBe(1);
});

test('POST spaces accepts a free space with the name of an existing unit space of the owner', async () => {
  const unit = await createUnit('Projeto Alfa');
  await assign(unit.orgUnitId, adminPerson.id);

  const response = await postSpace({ name: 'Projeto Alfa' }, adminCookie);

  expect(response.status).toBe(201);
  expect(await countFreeSpaces()).toBe(1);
  expect(
    await prisma.space.count({ where: { id: unit.spaceId, type: 'UNIT' } }),
  ).toBe(1);
});

test('two parallel POST spaces with the same name give one 201 and one 409', async () => {
  const responses = await Promise.all([
    postSpace({ name: 'Projeto Alfa' }, adminCookie),
    postSpace({ name: 'Projeto Alfa' }, adminCookie),
  ]);

  expect(responses.map((response) => response.status).sort()).toEqual([
    201, 409,
  ]);
  expect(
    await prisma.space.count({
      where: { type: 'FREE', ownerId: adminPerson.id, name: 'Projeto Alfa' },
    }),
  ).toBe(1);
});

/** Espaço livre gravado direto pelo Prisma, sem passar pelo serviço. */
function insertFreeSpace(ownerId: string, name: string): Promise<unknown> {
  return prisma.space.create({
    data: {
      type: 'FREE',
      organizationId: adminPerson.organizationId,
      ownerId,
      name,
    },
  });
}

test('the database rejects a duplicate free space name through Space_free_owner_name_key', async () => {
  await insertFreeSpace(adminPerson.id, 'Projeto Alfa');

  const error: unknown = await insertFreeSpace(
    adminPerson.id,
    'PROJETO ALFA',
  ).catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  const known = error as Prisma.PrismaClientKnownRequestError;
  expect(known.code).toBe('P2002');
  // Prisma names the columns of the violated index, not the index itself;
  // `(ownerId, lower(name))` is exactly the key of Space_free_owner_name_key.
  expect(known.meta?.target).toEqual(['ownerId', 'lower(name)']);
  const indexes = await prisma.$queryRaw<{ indexdef: string }[]>`
    SELECT indexdef FROM pg_indexes
    WHERE tablename = 'Space' AND indexname = 'Space_free_owner_name_key'
  `;
  expect(indexes).toHaveLength(1);
  expect(indexes[0]?.indexdef).toContain('("ownerId", lower(name))');
  expect(await countFreeSpaces()).toBe(1);
});

test('the database accepts the same name for another owner', async () => {
  const { person } = await createMember();
  await insertFreeSpace(adminPerson.id, 'Projeto Alfa');

  await insertFreeSpace(person.id, 'Projeto Alfa');

  expect(await countFreeSpaces()).toBe(2);
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

/** Envia `PATCH /api/org-units/:id/space` como a administração. */
function setSpaceAccess(
  orgUnitId: string,
  access: 'own' | 'inherit',
): Promise<Response> {
  return httpRequest(app)
    .patch(`/api/org-units/${orgUnitId}/space`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', adminCookie)
    .send({ access });
}

/** Ids dos espaços que `GET /api/spaces` devolve à sessão, em ordem. */
async function spaceIdsOf(cookie: string): Promise<string[]> {
  const response = await getSpaces(cookie);

  expect(response.status).toBe(200);

  return (response.body as SpacesBody).data.map((item) => item.id);
}

type InheritTree = {
  grandparent: CreatedUnit;
  parent: CreatedUnit;
  child: CreatedUnit;
};

/** Avó "Anexo" → mãe "Biblioteca" → filha "Catálogo", sob a raiz. */
async function createTree(): Promise<InheritTree> {
  const grandparent = await createUnit('Anexo');
  const parent = await createUnit('Biblioteca', {
    parentId: grandparent.orgUnitId,
  });
  const child = await createUnit('Catálogo', { parentId: parent.orgUnitId });

  return { grandparent, parent, child };
}

test('a person assigned to the parent sees the inheriting child space', async () => {
  const { parent, child } = await createTree();
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);

  await setSpaceAccess(child.orgUnitId, 'inherit');

  expect(await spaceIdsOf(cookie)).toEqual([parent.spaceId, child.spaceId]);
});

test('a person assigned to the grandparent sees parent and child when both inherit', async () => {
  const { grandparent, parent, child } = await createTree();
  const { person, cookie } = await createMember();
  await assign(grandparent.orgUnitId, person.id);

  await setSpaceAccess(parent.orgUnitId, 'inherit');
  await setSpaceAccess(child.orgUnitId, 'inherit');

  expect(await spaceIdsOf(cookie)).toEqual([
    grandparent.spaceId,
    parent.spaceId,
    child.spaceId,
  ]);
});

test('switching the parent back to own hides parent and child from the grandparent person but keeps the child for the parent person', async () => {
  const { grandparent, parent, child } = await createTree();
  const { person: grandparentPerson, cookie: grandparentCookie } =
    await createMember();
  const { person: parentPerson, cookie: parentCookie } =
    await createPersonWithSession(app, {
      name: 'Ana Lima',
      email: 'ana@exemplo.org',
    });
  await assign(grandparent.orgUnitId, grandparentPerson.id);
  await assign(parent.orgUnitId, parentPerson.id);
  await setSpaceAccess(parent.orgUnitId, 'inherit');
  await setSpaceAccess(child.orgUnitId, 'inherit');

  const before = await spaceIdsOf(grandparentCookie);
  const response = await setSpaceAccess(parent.orgUnitId, 'own');

  expect(before).toEqual([grandparent.spaceId, parent.spaceId, child.spaceId]);
  expect(response.status).toBe(200);
  expect(await spaceIdsOf(grandparentCookie)).toEqual([grandparent.spaceId]);
  expect(await spaceIdsOf(parentCookie)).toEqual([
    parent.spaceId,
    child.spaceId,
  ]);
});

test('a person assigned to parent and child sees the child space once', async () => {
  const { parent, child } = await createTree();
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);
  await assign(child.orgUnitId, person.id);

  await setSpaceAccess(child.orgUnitId, 'inherit');

  expect(await spaceIdsOf(cookie)).toEqual([parent.spaceId, child.spaceId]);
});

test('removing the parent assignment removes the inherited space', async () => {
  const { parent, child } = await createTree();
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);
  await setSpaceAccess(child.orgUnitId, 'inherit');

  const before = await spaceIdsOf(cookie);
  await prisma.orgUnitAssignment.delete({
    where: {
      orgUnitId_personId: { orgUnitId: parent.orgUnitId, personId: person.id },
    },
  });

  expect(before).toEqual([parent.spaceId, child.spaceId]);
  expect(await spaceIdsOf(cookie)).toEqual([]);
});

test('an admin without assignment sees no unit space after changing the access mode', async () => {
  const { parent, child } = await createTree();

  const first = await setSpaceAccess(parent.orgUnitId, 'inherit');
  const second = await setSpaceAccess(child.orgUnitId, 'inherit');

  expect(adminPerson.isAdmin).toBe(true);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(await spaceIdsOf(adminCookie)).toEqual([]);
});

test('deleting an inheriting child removes it from the list of who inherited it', async () => {
  const { parent, child } = await createTree();
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);
  await setSpaceAccess(child.orgUnitId, 'inherit');

  const before = await spaceIdsOf(cookie);
  const deleted = await httpRequest(app)
    .delete(`/api/org-units/${child.orgUnitId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', adminCookie);

  expect(before).toEqual([parent.spaceId, child.spaceId]);
  expect(deleted.status).toBe(204);
  expect(await spaceIdsOf(cookie)).toEqual([parent.spaceId]);
});

/**
 * Organização única por instância: o escopo é provado no serviço real, contra
 * o mesmo Postgres, com um `organizationId` que não é o da instalação.
 */
test('list with another organization id returns nothing', async () => {
  const { parent, child } = await createTree();
  const { person } = await createMember();
  await assign(parent.orgUnitId, person.id);
  await setSpaceAccess(child.orgUnitId, 'inherit');

  const mine = await spaces.list(adminPerson.organizationId, person.id);
  const others = await spaces.list(randomUUID(), person.id);

  expect(mine.data.map((item) => item.id)).toEqual([
    parent.spaceId,
    child.spaceId,
  ]);
  expect(others).toEqual({ data: [] });
});

type SpaceDocumentsBody = {
  data: { id: string; title: string; updatedAt: string; trashedAt: null }[];
};

/** `GET /api/spaces/:spaceId/documents`. */
function getSpaceDocuments(spaceId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/spaces/${spaceId}/documents`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** Documento da pessoa no espaço, com `updatedAt` gravado direto no banco. */
async function createSpaceDocument(
  spaceId: string,
  owner: Person,
  title: string,
  updatedAt: Date,
): Promise<string> {
  const document = await prisma.document.create({
    data: { title, spaceId, authorId: owner.id, ownerId: owner.id },
  });

  await prisma.$executeRaw`UPDATE "Document" SET "updatedAt" = ${updatedAt} WHERE "id" = ${document.id}`;

  return document.id;
}

/** Resposta do id aleatório: o 404 opaco com que todos os outros se comparam. */
async function randomIdResponse(cookie: string): Promise<Response> {
  const response = await getSpaceDocuments(randomUUID(), cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });

  return response;
}

test('GET space documents answers 200 to a direct member ordered by updatedAt desc', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);
  await assign(unit.orgUnitId, adminPerson.id);
  const older = await createSpaceDocument(
    unit.spaceId,
    adminPerson,
    'Ata antiga',
    new Date('2026-01-01T10:00:00.000Z'),
  );
  const newer = await createSpaceDocument(
    unit.spaceId,
    person,
    'Ata nova',
    new Date('2026-02-01T10:00:00.000Z'),
  );
  const middle = await createSpaceDocument(
    unit.spaceId,
    adminPerson,
    'Ata do meio',
    new Date('2026-01-15T10:00:00.000Z'),
  );

  const response = await getSpaceDocuments(unit.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      {
        id: newer,
        title: 'Ata nova',
        updatedAt: '2026-02-01T10:00:00.000Z',
        trashedAt: null,
      },
      {
        id: middle,
        title: 'Ata do meio',
        updatedAt: '2026-01-15T10:00:00.000Z',
        trashedAt: null,
      },
      {
        id: older,
        title: 'Ata antiga',
        updatedAt: '2026-01-01T10:00:00.000Z',
        trashedAt: null,
      },
    ],
  });
});

test('GET space documents omits trashed documents', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);
  const kept = await createSpaceDocument(
    unit.spaceId,
    adminPerson,
    'Ata vigente',
    new Date('2026-01-01T10:00:00.000Z'),
  );
  const trashed = await createSpaceDocument(
    unit.spaceId,
    adminPerson,
    'Ata descartada',
    new Date('2026-02-01T10:00:00.000Z'),
  );
  await prisma.document.update({
    where: { id: trashed },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });

  const response = await getSpaceDocuments(unit.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(
    (response.body as SpaceDocumentsBody).data.map((item) => item.id),
  ).toEqual([kept]);
});

/**
 * Mãe "Secretaria de Educação" com a filha "Protocolo" herdando dela, a
 * herdeira lotada só na mãe e uma ata da administração no espaço da filha.
 */
async function createInheritedReach(): Promise<{
  parent: CreatedUnit;
  child: CreatedUnit;
  person: Person;
  cookie: string;
  documentId: string;
}> {
  const parent = await createUnit('Secretaria de Educação');
  const child = await createUnit('Protocolo', { parentId: parent.orgUnitId });
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);
  const inherited = await setSpaceAccess(child.orgUnitId, 'inherit');
  const documentId = await createSpaceDocument(
    child.spaceId,
    adminPerson,
    'Ata do protocolo',
    new Date('2026-01-01T10:00:00.000Z'),
  );

  expect(inherited.status).toBe(200);

  return { parent, child, person, cookie, documentId };
}

test('GET /spaces/{id}/documents returns 200 to an inherited reach', async () => {
  const { child, cookie, documentId } = await createInheritedReach();

  const response = await getSpaceDocuments(child.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      {
        id: documentId,
        title: 'Ata do protocolo',
        updatedAt: '2026-01-01T10:00:00.000Z',
        trashedAt: null,
      },
    ],
  });
});

test('GET /spaces/{id} returns canCreateDocuments true to an inherited reach', async () => {
  const { child, cookie } = await createInheritedReach();

  const response = await getSpace(child.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: child.spaceId,
      type: 'unit',
      name: 'Protocolo',
      reach: 'inherited',
      membersCanInvite: false,
      canCreateDocuments: true,
      canAddPeople: false,
    },
  });
});

test('a space that stops inheriting returns 404 on the next GET /spaces/{id}/documents', async () => {
  const { child, cookie } = await createInheritedReach();

  const before = await getSpaceDocuments(child.spaceId, cookie);
  const switched = await setSpaceAccess(child.orgUnitId, 'own');
  const after = await getSpaceDocuments(child.spaceId, cookie);

  expect(before.status).toBe(200);
  expect(switched.status).toBe(200);
  expect(after.status).toBe(404);
  expect(after.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('a person removed from the parent unit gets 404 on the next GET /spaces/{id}/documents', async () => {
  const { parent, child, person, cookie } = await createInheritedReach();

  const before = await getSpaceDocuments(child.spaceId, cookie);
  await prisma.orgUnitAssignment.delete({
    where: {
      orgUnitId_personId: { orgUnitId: parent.orgUnitId, personId: person.id },
    },
  });
  const after = await getSpaceDocuments(child.spaceId, cookie);

  expect(before.status).toBe(200);
  expect(after.status).toBe(404);
  expect(after.body).toEqual({ message: 'Espaço não encontrado.' });
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * é provado no serviço real, contra o mesmo Postgres, com um
 * `organizationId` gerado por `randomUUID()`; a rota responde 404 a todo
 * alcance `'none'`, e a um espaço que não é da organização da sessão.
 */
test('a space of another organization returns 404', async () => {
  const { child, person, cookie } = await createInheritedReach();

  const mine = await spaces.reachOf(
    adminPerson.organizationId,
    person.id,
    child.spaceId,
  );
  const others = await spaces.reachOf(randomUUID(), person.id, child.spaceId);
  const detail = await spaces.getDetail(randomUUID(), person.id, child.spaceId);
  const response = await getSpaceDocuments(randomUUID(), cookie);

  expect(mine).toBe('inherited');
  expect(others).toBe('none');
  expect(detail).toBeNull();
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('GET /spaces keeps listing inherited unit spaces', async () => {
  const { parent, child, cookie } = await createInheritedReach();

  // Ordem pt-BR pelo nome: "Protocolo" antes de "Secretaria de Educação".
  expect(await spaceIdsOf(cookie)).toEqual([child.spaceId, parent.spaceId]);
});

test('listMembers keeps only direct assignments', async () => {
  const { child, person, cookie } = await createInheritedReach();
  const direct = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  await assign(child.orgUnitId, direct.person.id);

  const response = await getSpaceMembers(child.spaceId, cookie);
  const body = response.body as SpaceMembersBody;

  expect(response.status).toBe(200);
  expect(body.data.map((item) => item.id)).toEqual([direct.person.id]);
  expect(body.data.some((item) => item.id === person.id)).toBe(false);
});

test('GET space documents answers 404 without assignment', async () => {
  const unit = await createUnit('Protocolo');
  const { cookie } = await createMember();
  const random = await randomIdResponse(cookie);

  const response = await getSpaceDocuments(unit.spaceId, cookie);

  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space documents answers 404 to an unassigned admin', async () => {
  const unit = await createUnit('Protocolo');
  const random = await randomIdResponse(adminCookie);

  const response = await getSpaceDocuments(unit.spaceId, adminCookie);

  expect(adminPerson.isAdmin).toBe(true);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space documents answers 404 for a random id', async () => {
  const { cookie } = await createMember();

  const response = await getSpaceDocuments(randomUUID(), cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('GET space documents answers 404 for a malformed id', async () => {
  const { cookie } = await createMember();
  const random = await randomIdResponse(cookie);

  const response = await getSpaceDocuments('nao-e-uuid', cookie);

  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space documents answers 401 without session', async () => {
  const unit = await createUnit('Protocolo');
  await assign(unit.orgUnitId, adminPerson.id);

  const response = await getSpaceDocuments(unit.spaceId);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * é provado no serviço real, contra o mesmo Postgres, com um
 * `organizationId` que não é o da instalação.
 */
test('reachOf with another organization id returns none', async () => {
  const unit = await createUnit('Protocolo');
  const { person } = await createMember();
  await assign(unit.orgUnitId, person.id);

  const mine = await spaces.reachOf(
    adminPerson.organizationId,
    person.id,
    unit.spaceId,
  );
  const others = await spaces.reachOf(randomUUID(), person.id, unit.spaceId);

  expect(mine).toBe('direct');
  expect(others).toBe('none');
});


type SpaceMemberItem = {
  id: string;
  name: string;
  email: string;
  isCurrentPerson: boolean;
  role: 'owner' | 'member' | 'assigned';
  level: 'view' | 'edit' | null;
};

type SpaceMembersBody = { data: SpaceMemberItem[] };

/** `GET /api/spaces/:spaceId`. */
function getSpace(spaceId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/spaces/${spaceId}`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** `GET /api/spaces/:spaceId/members`. */
function getSpaceMembers(spaceId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/spaces/${spaceId}/members`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** 404 opaco de `GET /api/spaces/:id` para um id aleatório. */
async function randomDetailResponse(cookie: string): Promise<Response> {
  const response = await getSpace(randomUUID(), cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });

  return response;
}

/** 404 opaco de `GET /api/spaces/:id/members` para um id aleatório. */
async function randomMembersResponse(cookie: string): Promise<Response> {
  const response = await getSpaceMembers(randomUUID(), cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });

  return response;
}

/** Mãe "Secretaria de Educação" com a filha "Protocolo" herdando dela. */
async function createInheritingChild(): Promise<{
  parent: CreatedUnit;
  child: CreatedUnit;
}> {
  const parent = await createUnit('Secretaria de Educação');
  const child = await createUnit('Protocolo', { parentId: parent.orgUnitId });
  const response = await setSpaceAccess(child.orgUnitId, 'inherit');

  expect(response.status).toBe(200);

  return { parent, child };
}

test('GET space answers 200 with reach direct and the unit name to a direct member', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);

  const response = await getSpace(unit.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: unit.spaceId,
      type: 'unit',
      name: 'Protocolo',
      reach: 'direct',
      membersCanInvite: false,
      canCreateDocuments: true,
      canAddPeople: false,
    },
  });
});

test('GET space answers reach inherited to an inherited member', async () => {
  const { parent, child } = await createInheritingChild();
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);

  const response = await getSpace(child.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: child.spaceId,
      type: 'unit',
      name: 'Protocolo',
      reach: 'inherited',
      membersCanInvite: false,
      canCreateDocuments: true,
      canAddPeople: false,
    },
  });
});

test('GET space answers reach owner with the space name to the owner of a FREE space', async () => {
  const { cookie } = await createMember();
  const created = await postSpace({ name: 'Projeto Alfa' }, cookie);
  const freeSpaceId = (created.body as { data: SpaceItem }).data.id;

  const response = await getSpace(freeSpaceId, cookie);

  expect(created.status).toBe(201);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: freeSpaceId,
      type: 'free',
      name: 'Projeto Alfa',
      reach: 'owner',
      membersCanInvite: false,
      canCreateDocuments: true,
      canAddPeople: true,
    },
  });
});

test('GET space answers 404 for a FREE space of another person', async () => {
  const { cookie: ownerCookie } = await createMember();
  const other = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  const created = await postSpace({ name: 'Projeto Alfa' }, ownerCookie);
  const freeSpaceId = (created.body as { data: SpaceItem }).data.id;
  const random = await randomDetailResponse(other.cookie);

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(created.status).toBe(201);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space answers 404 to an unassigned admin', async () => {
  const unit = await createUnit('Protocolo');
  const random = await randomDetailResponse(adminCookie);

  const response = await getSpace(unit.spaceId, adminCookie);

  expect(adminPerson.isAdmin).toBe(true);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space answers 404 without assignment', async () => {
  const unit = await createUnit('Protocolo');
  const { cookie } = await createMember();
  const random = await randomDetailResponse(cookie);

  const response = await getSpace(unit.spaceId, cookie);

  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space answers 404 for a random id', async () => {
  const { cookie } = await createMember();

  const response = await getSpace(randomUUID(), cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('GET space answers 404 for a malformed id', async () => {
  const { cookie } = await createMember();
  const random = await randomDetailResponse(cookie);

  const response = await getSpace('nao-e-uuid', cookie);

  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space answers 401 without session', async () => {
  const unit = await createUnit('Protocolo');
  await assign(unit.orgUnitId, adminPerson.id);

  const response = await getSpace(unit.spaceId);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});

test('GET space members lists the caller first with isCurrentPerson then Álvaro before Zilda', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  const zilda = await createPersonWithSession(app, {
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
  });
  const alvaro = await createPersonWithSession(app, {
    name: 'Álvaro Dias',
    email: 'alvaro@exemplo.org',
  });
  await assign(unit.orgUnitId, zilda.person.id);
  await assign(unit.orgUnitId, person.id);
  await assign(unit.orgUnitId, alvaro.person.id);

  const response = await getSpaceMembers(unit.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      {
        id: person.id,
        name: 'João Souza',
        email: 'joao@exemplo.org',
        isCurrentPerson: true,
        role: 'assigned',
        level: null,
      },
      {
        id: alvaro.person.id,
        name: 'Álvaro Dias',
        email: 'alvaro@exemplo.org',
        isCurrentPerson: false,
        role: 'assigned',
        level: null,
      },
      {
        id: zilda.person.id,
        name: 'Zilda Rocha',
        email: 'zilda@exemplo.org',
        isCurrentPerson: false,
        role: 'assigned',
        level: null,
      },
    ],
  });
});

test('GET space members breaks name ties by email', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  const second = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'b.ana@exemplo.org',
  });
  const first = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'a.ana@exemplo.org',
  });
  await assign(unit.orgUnitId, second.person.id);
  await assign(unit.orgUnitId, first.person.id);
  await assign(unit.orgUnitId, person.id);

  const response = await getSpaceMembers(unit.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(
    (response.body as SpaceMembersBody).data.map((item) => item.email),
  ).toEqual(['joao@exemplo.org', 'a.ana@exemplo.org', 'b.ana@exemplo.org']);
});

test('GET space members answers an inherited member without including them', async () => {
  const { parent, child } = await createInheritingChild();
  const childSpace = await prisma.space.findUniqueOrThrow({
    where: { id: child.spaceId },
  });
  const { person, cookie } = await createMember();
  const other = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  await assign(parent.orgUnitId, person.id);
  await assign(child.orgUnitId, other.person.id);

  const response = await getSpaceMembers(child.spaceId, cookie);
  const body = response.body as SpaceMembersBody;

  expect(childSpace.inheritsParent).toBe(true);
  expect(response.status).toBe(200);
  expect(body.data.map((item) => item.id)).toEqual([other.person.id]);
  expect(body.data.some((item) => item.id === person.id)).toBe(false);
  expect(body.data.some((item) => item.isCurrentPerson)).toBe(false);
});

test('GET space members answers an empty list for an inherited unit without assignments', async () => {
  const { parent, child } = await createInheritingChild();
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);

  const response = await getSpaceMembers(child.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});

test('GET space members answers 404 after the caller assignment is removed', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);
  const random = await randomMembersResponse(cookie);

  const before = await getSpaceMembers(unit.spaceId, cookie);
  await prisma.orgUnitAssignment.delete({
    where: {
      orgUnitId_personId: { orgUnitId: unit.orgUnitId, personId: person.id },
    },
  });
  const after = await getSpaceMembers(unit.spaceId, cookie);

  expect(before.status).toBe(200);
  expect(
    (before.body as SpaceMembersBody).data.map((item) => item.id),
  ).toEqual([person.id]);
  expect(after.status).toBe(random.status);
  expect(after.body).toEqual(random.body);
});

test('GET space members lists a FREE space to its owner with the owner first', async () => {
  const { person, cookie } = await createMember();
  const created = await postSpace({ name: 'Projeto Alfa' }, cookie);
  const freeSpaceId = (created.body as { data: SpaceItem }).data.id;
  const alvaro = await createPersonWithSession(app, {
    name: 'Álvaro Dias',
    email: 'alvaro@exemplo.org',
  });
  await prisma.spaceMember.create({
    data: { spaceId: freeSpaceId, personId: alvaro.person.id },
  });
  await prisma.spaceMember.create({
    data: { spaceId: freeSpaceId, personId: adminPerson.id },
  });

  const response = await getSpaceMembers(freeSpaceId, cookie);

  expect(created.status).toBe(201);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      {
        id: person.id,
        name: 'João Souza',
        email: 'joao@exemplo.org',
        isCurrentPerson: true,
        role: 'owner',
        level: null,
      },
      {
        id: alvaro.person.id,
        name: 'Álvaro Dias',
        email: 'alvaro@exemplo.org',
        isCurrentPerson: false,
        role: 'member',
        level: 'edit',
      },
      {
        id: adminPerson.id,
        name: 'Maria Souza',
        email: EMAIL,
        isCurrentPerson: false,
        role: 'member',
        level: 'edit',
      },
    ],
  });
});

test('GET space members answers 404 to an unassigned admin', async () => {
  const unit = await createUnit('Protocolo');
  const { person } = await createMember();
  await assign(unit.orgUnitId, person.id);
  const random = await randomMembersResponse(adminCookie);

  const response = await getSpaceMembers(unit.spaceId, adminCookie);

  expect(adminPerson.isAdmin).toBe(true);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space members answers 404 for a random id', async () => {
  const { cookie } = await createMember();

  const response = await getSpaceMembers(randomUUID(), cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('GET space members answers 404 for a malformed id', async () => {
  const { cookie } = await createMember();
  const random = await randomMembersResponse(cookie);

  const response = await getSpaceMembers('nao-e-uuid', cookie);

  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space members answers 401 without session', async () => {
  const unit = await createUnit('Protocolo');
  await assign(unit.orgUnitId, adminPerson.id);

  const response = await getSpaceMembers(unit.spaceId);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * é provado no serviço real, ligado ao Prisma de teste, com um
 * `organizationId` que não é o da instalação.
 */
test('getDetail with another organization id returns null', async () => {
  const unit = await createUnit('Protocolo');
  const { person } = await createMember();
  await assign(unit.orgUnitId, person.id);
  const service = new SpacesService(prisma, new AccessService(prisma));

  const mine = await service.getDetail(
    adminPerson.organizationId,
    person.id,
    unit.spaceId,
  );
  const others = await service.getDetail(randomUUID(), person.id, unit.spaceId);

  expect(mine).toEqual({
    id: unit.spaceId,
    type: 'unit',
    name: 'Protocolo',
    reach: 'direct',
    membersCanInvite: false,
    canCreateDocuments: true,
    canAddPeople: false,
  });
  expect(others).toBeNull();
});

test('listMembers with another organization id returns null', async () => {
  const unit = await createUnit('Protocolo');
  const { person } = await createMember();
  await assign(unit.orgUnitId, person.id);
  const service = new SpacesService(prisma, new AccessService(prisma));

  const mine = await service.listMembers(
    adminPerson.organizationId,
    person.id,
    unit.spaceId,
  );
  const others = await service.listMembers(
    randomUUID(),
    person.id,
    unit.spaceId,
  );

  expect(mine?.data.map((item) => item.id)).toEqual([person.id]);
  expect(others).toBeNull();
});

function member(
  overrides: Partial<SpaceMemberItem> & Pick<SpaceMemberItem, 'id'>,
): SpaceMemberItem {
  return {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
    isCurrentPerson: false,
    role: 'assigned',
    level: null,
    ...overrides,
  };
}

test('compareMembers puts the current person first', () => {
  const alvaro = member({ id: 'b', name: 'Álvaro Dias', email: 'alvaro@exemplo.org' });
  const zilda = member({
    id: 'a',
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
    isCurrentPerson: true,
  });

  expect(compareMembers(zilda, alvaro)).toBeLessThan(0);
  expect(compareMembers(alvaro, zilda)).toBeGreaterThan(0);
  expect([alvaro, zilda].sort(compareMembers).map((item) => item.id)).toEqual([
    'a',
    'b',
  ]);
});

test('compareMembers breaks name ties by email then id', () => {
  const byEmailLast = member({ id: 'a', email: 'b.ana@exemplo.org' });
  const byIdLast = member({ id: 'c', name: 'ana lima', email: 'A.ana@exemplo.org' });
  const byIdFirst = member({ id: 'b', email: 'a.ana@exemplo.org' });

  expect(compareMembers(byIdFirst, byEmailLast)).toBeLessThan(0);
  expect(compareMembers(byIdFirst, byIdLast)).toBeLessThan(0);
  expect(
    [byEmailLast, byIdLast, byIdFirst].sort(compareMembers).map((item) => item.id),
  ).toEqual(['b', 'c', 'a']);
});

type SpaceMemberBody = { data: { id: string; name: string; email: string } };

/** `PUT /api/spaces/:spaceId/members/:personId` com o cabeçalho de CSRF. */
function putSpaceMember(
  spaceId: string,
  personId: string,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .put(`/api/spaces/${spaceId}/members/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** Quantas linhas existem em `SpaceMember`. */
function countSpaceMembers(): Promise<number> {
  return prisma.spaceMember.count();
}

/** Cria, pela API, um espaço livre "Projeto Alfa" de quem tem o cookie. */
async function createFreeSpace(cookie: string): Promise<string> {
  const created = await postSpace({ name: 'Projeto Alfa' }, cookie);

  expect(created.status).toBe(201);

  return (created.body as { data: SpaceItem }).data.id;
}

/** João (dono de um espaço livre) e Ana, outra pessoa da organização. */
async function createOwnerAndOther(): Promise<{
  owner: { person: Person; cookie: string };
  other: { person: Person; cookie: string };
  freeSpaceId: string;
}> {
  const owner = await createMember();
  const other = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  const freeSpaceId = await createFreeSpace(owner.cookie);

  return { owner, other, freeSpaceId };
}

test('PUT space member answers 200 with the person summary to the owner', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();

  const response = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: { id: other.person.id, name: 'Ana Lima', email: 'ana@exemplo.org' },
  });
  expect(
    await prisma.spaceMember.count({
      where: { spaceId: freeSpaceId, personId: other.person.id },
    }),
  ).toBe(1);
});

test('PUT space member repeated answers the same 200 without a second row', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();

  const first = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);
  const second = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);
  expect((second.body as SpaceMemberBody).data.id).toBe(other.person.id);
  expect(await countSpaceMembers()).toBe(1);
});

test('PUT space member answers 404 for a malformed space id', async () => {
  const { owner, other } = await createOwnerAndOther();

  const response = await putSpaceMember('nao-e-uuid', other.person.id, owner.cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(0);
});

test('PUT space member answers 404 for a random space id', async () => {
  const { owner, other } = await createOwnerAndOther();

  const response = await putSpaceMember(randomUUID(), other.person.id, owner.cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(0);
});

test('PUT space member answers 404 for a FREE space of another person', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();

  const response = await putSpaceMember(freeSpaceId, adminPerson.id, other.cookie);

  expect(owner.person.id).not.toBe(other.person.id);
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(0);
});

test('PUT space member answers 404 for a UNIT space', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  const other = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  await assign(unit.orgUnitId, person.id);
  const detail = await getSpace(unit.spaceId, cookie);

  const response = await putSpaceMember(unit.spaceId, other.person.id, cookie);

  expect((detail.body as { data: { reach: string } }).data.reach).toBe('direct');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(0);
});

test('PUT space member answers 403 to a member of a closed space', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();
  const added = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);

  const response = await putSpaceMember(freeSpaceId, adminPerson.id, other.cookie);

  expect(added.status).toBe(200);
  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message: 'Só o dono do espaço pode adicionar pessoas.',
  });
  expect(await countSpaceMembers()).toBe(1);
});

test('PUT space member answers 400 when adding the owner', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await putSpaceMember(freeSpaceId, owner.person.id, owner.cookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'Você já é o dono deste espaço.' });
  expect(await countSpaceMembers()).toBe(0);
});

test('PUT space member answers 400 for a random person id', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await putSpaceMember(freeSpaceId, randomUUID(), owner.cookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Pessoa não encontrada nesta instância.',
  });
  expect(await countSpaceMembers()).toBe(0);
});

test('PUT space member answers 400 for a malformed person id', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await putSpaceMember(freeSpaceId, 'nao-e-uuid', owner.cookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Pessoa não encontrada nesta instância.',
  });
  expect(await countSpaceMembers()).toBe(0);
});

test('PUT space member answers 401 without session', async () => {
  const { other, freeSpaceId } = await createOwnerAndOther();

  const response = await putSpaceMember(freeSpaceId, other.person.id);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(await countSpaceMembers()).toBe(0);
});

test('GET spaces lists a FREE space to its member', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();
  const added = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);

  const response = await getSpaces(other.cookie);

  expect(added.status).toBe(200);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [{ id: freeSpaceId, type: 'free', name: 'Projeto Alfa' }],
  });
});

test('GET spaces does not list a FREE space to a person who is not a member', async () => {
  const { other } = await createOwnerAndOther();

  const response = await getSpaces(other.cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});

test('GET space answers reach member to a member of a FREE space', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();
  const added = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(added.status).toBe(200);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: freeSpaceId,
      type: 'free',
      name: 'Projeto Alfa',
      reach: 'member',
      membersCanInvite: false,
      canCreateDocuments: true,
      canAddPeople: false,
    },
  });
});

test('GET space answers 404 for a FREE space to a person who is not a member', async () => {
  const { other, freeSpaceId } = await createOwnerAndOther();
  const random = await randomDetailResponse(other.cookie);

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space members lists a FREE space to its member', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();
  const zilda = await createPersonWithSession(app, {
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
  });
  const bruno = await createPersonWithSession(app, {
    name: 'Bruno Alves',
    email: 'bruno@exemplo.org',
  });
  const added = await Promise.all(
    [zilda.person.id, other.person.id, bruno.person.id].map((id) =>
      putSpaceMember(freeSpaceId, id, owner.cookie),
    ),
  );

  const response = await getSpaceMembers(freeSpaceId, zilda.cookie);

  expect(added.map((item) => item.status)).toEqual([200, 200, 200]);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      {
        id: owner.person.id,
        name: 'João Souza',
        email: 'joao@exemplo.org',
        isCurrentPerson: false,
        role: 'owner',
        level: null,
      },
      {
        id: zilda.person.id,
        name: 'Zilda Rocha',
        email: 'zilda@exemplo.org',
        isCurrentPerson: true,
        role: 'member',
        level: 'edit',
      },
      {
        id: other.person.id,
        name: 'Ana Lima',
        email: 'ana@exemplo.org',
        isCurrentPerson: false,
        role: 'member',
        level: 'edit',
      },
      {
        id: bruno.person.id,
        name: 'Bruno Alves',
        email: 'bruno@exemplo.org',
        isCurrentPerson: false,
        role: 'member',
        level: 'edit',
      },
    ],
  });
});

/** `DELETE /api/spaces/:spaceId/members/:personId` com o cabeçalho de CSRF. */
function deleteSpaceMember(
  spaceId: string,
  personId: string,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .delete(`/api/spaces/${spaceId}/members/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** Dono, Ana já adicionada como membro e o espaço livre. */
async function createOwnerWithMember(): Promise<{
  owner: { person: Person; cookie: string };
  other: { person: Person; cookie: string };
  freeSpaceId: string;
}> {
  const created = await createOwnerAndOther();
  const added = await putSpaceMember(
    created.freeSpaceId,
    created.other.person.id,
    created.owner.cookie,
  );

  expect(added.status).toBe(200);

  return created;
}

test('GET space members answers 404 for a FREE space to a person who is not a member', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();
  const added = await putSpaceMember(freeSpaceId, adminPerson.id, owner.cookie);
  const outsider = await createPersonWithSession(app, {
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
  });
  const random = await randomMembersResponse(outsider.cookie);

  const response = await getSpaceMembers(freeSpaceId, outsider.cookie);

  expect(added.status).toBe(200);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space members answers 404 to a removed member', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();
  const added = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);
  const before = await getSpaceMembers(freeSpaceId, other.cookie);
  const removed = await deleteSpaceMember(
    freeSpaceId,
    other.person.id,
    owner.cookie,
  );

  const response = await getSpaceMembers(freeSpaceId, other.cookie);

  expect(added.status).toBe(200);
  expect(before.status).toBe(200);
  expect(removed.status).toBe(204);
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('GET space answers 404 to a removed member', async () => {
  const { owner, other, freeSpaceId } = await createOwnerAndOther();
  const added = await putSpaceMember(freeSpaceId, other.person.id, owner.cookie);
  const before = await getSpace(freeSpaceId, other.cookie);
  const removed = await deleteSpaceMember(
    freeSpaceId,
    other.person.id,
    owner.cookie,
  );

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(added.status).toBe(200);
  expect(before.status).toBe(200);
  expect(removed.status).toBe(204);
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('GET space members of a UNIT space answers role assigned', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);
  await assign(unit.orgUnitId, adminPerson.id);

  const response = await getSpaceMembers(unit.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(
    (response.body as SpaceMembersBody).data.map((item) => item.role),
  ).toEqual(['assigned', 'assigned']);
});

test('DELETE space member answers 204 and removes the row', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();
  const before = await countSpaceMembers();

  const response = await deleteSpaceMember(
    freeSpaceId,
    other.person.id,
    owner.cookie,
  );

  expect(before).toBe(1);
  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(
    await prisma.spaceMember.count({
      where: { spaceId: freeSpaceId, personId: other.person.id },
    }),
  ).toBe(0);
});

test('DELETE space member repeated answers 204', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();

  const first = await deleteSpaceMember(freeSpaceId, other.person.id, owner.cookie);
  const second = await deleteSpaceMember(freeSpaceId, other.person.id, owner.cookie);

  expect(first.status).toBe(204);
  expect(second.status).toBe(204);
  expect(await countSpaceMembers()).toBe(0);
});

test('DELETE space member answers 204 for a person who is not a member', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();

  const response = await deleteSpaceMember(freeSpaceId, adminPerson.id, owner.cookie);

  expect(response.status).toBe(204);
  expect(await countSpaceMembers()).toBe(1);
});

test('DELETE space member answers 204 for a malformed person id', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();

  const response = await deleteSpaceMember(freeSpaceId, 'nao-e-uuid', owner.cookie);

  expect(response.status).toBe(204);
  expect(await countSpaceMembers()).toBe(1);
});

test('DELETE space member answers 400 when removing the owner', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();

  const response = await deleteSpaceMember(
    freeSpaceId,
    owner.person.id,
    owner.cookie,
  );

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'O dono não pode ser removido.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('DELETE space member answers 400 when the owner removes himself', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await deleteSpaceMember(
    freeSpaceId,
    owner.person.id,
    owner.cookie,
  );
  const detail = await getSpace(freeSpaceId, owner.cookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'O dono não pode ser removido.' });
  expect((detail.body as { data: { reach: string } }).data.reach).toBe('owner');
});

test('DELETE space member answers 403 to a member', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();
  const second = await putSpaceMember(freeSpaceId, adminPerson.id, owner.cookie);

  const response = await deleteSpaceMember(freeSpaceId, adminPerson.id, other.cookie);

  expect(second.status).toBe(200);
  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message: 'Só o dono do espaço pode remover pessoas.',
  });
  expect(await countSpaceMembers()).toBe(2);
});

test('DELETE space member answers 404 for a malformed space id', async () => {
  const { owner, other } = await createOwnerWithMember();

  const response = await deleteSpaceMember('nao-e-uuid', other.person.id, owner.cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('DELETE space member answers 404 for a random space id', async () => {
  const { owner, other } = await createOwnerWithMember();

  const response = await deleteSpaceMember(randomUUID(), other.person.id, owner.cookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('DELETE space member answers 404 for a FREE space of another person', async () => {
  const { other, freeSpaceId } = await createOwnerWithMember();

  const response = await deleteSpaceMember(freeSpaceId, other.person.id, adminCookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('DELETE space member answers 404 for a UNIT space', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  const other = await createPersonWithSession(app, {
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
  await assign(unit.orgUnitId, person.id);
  await assign(unit.orgUnitId, other.person.id);
  const detail = await getSpace(unit.spaceId, cookie);

  const response = await deleteSpaceMember(unit.spaceId, other.person.id, cookie);

  expect((detail.body as { data: { reach: string } }).data.reach).toBe('direct');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(
    await prisma.orgUnitAssignment.count({ where: { orgUnitId: unit.orgUnitId } }),
  ).toBe(2);
});

test('DELETE space member answers 401 without session', async () => {
  const { other, freeSpaceId } = await createOwnerWithMember();

  const response = await deleteSpaceMember(freeSpaceId, other.person.id);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('GET space documents answers 200 to the owner of a FREE space ordered by updatedAt desc', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();
  const older = await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Ata antiga',
    new Date('2026-01-01T10:00:00.000Z'),
  );
  const newer = await createSpaceDocument(
    freeSpaceId,
    other.person,
    'Ata nova',
    new Date('2026-02-01T10:00:00.000Z'),
  );
  const middle = await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Ata do meio',
    new Date('2026-01-15T10:00:00.000Z'),
  );

  const response = await getSpaceDocuments(freeSpaceId, owner.cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      {
        id: newer,
        title: 'Ata nova',
        updatedAt: '2026-02-01T10:00:00.000Z',
        trashedAt: null,
      },
      {
        id: middle,
        title: 'Ata do meio',
        updatedAt: '2026-01-15T10:00:00.000Z',
        trashedAt: null,
      },
      {
        id: older,
        title: 'Ata antiga',
        updatedAt: '2026-01-01T10:00:00.000Z',
        trashedAt: null,
      },
    ],
  });
});

test('GET space documents answers 200 to a member of a FREE space', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();
  const ownerDocument = await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Plano do projeto',
    new Date('2026-01-01T10:00:00.000Z'),
  );

  const response = await getSpaceDocuments(freeSpaceId, other.cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: [
      {
        id: ownerDocument,
        title: 'Plano do projeto',
        updatedAt: '2026-01-01T10:00:00.000Z',
        trashedAt: null,
      },
    ],
  });
});

test('GET space documents of a FREE space omits trashed documents', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();
  const kept = await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Ata vigente',
    new Date('2026-01-01T10:00:00.000Z'),
  );
  const trashed = await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Ata descartada',
    new Date('2026-02-01T10:00:00.000Z'),
  );
  await prisma.document.update({
    where: { id: trashed },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });

  const ownerResponse = await getSpaceDocuments(freeSpaceId, owner.cookie);
  const memberResponse = await getSpaceDocuments(freeSpaceId, other.cookie);

  expect(ownerResponse.status).toBe(200);
  expect(
    (ownerResponse.body as SpaceDocumentsBody).data.map((item) => item.id),
  ).toEqual([kept]);
  expect(memberResponse.status).toBe(200);
  expect(
    (memberResponse.body as SpaceDocumentsBody).data.map((item) => item.id),
  ).toEqual([kept]);
});

test('GET space documents answers 404 for a FREE space to a removed member', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();
  await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Plano do projeto',
    new Date('2026-01-01T10:00:00.000Z'),
  );
  const before = await getSpaceDocuments(freeSpaceId, other.cookie);
  const removed = await deleteSpaceMember(
    freeSpaceId,
    other.person.id,
    owner.cookie,
  );
  const random = await randomIdResponse(other.cookie);

  const response = await getSpaceDocuments(freeSpaceId, other.cookie);

  expect(before.status).toBe(200);
  expect(removed.status).toBe(204);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space documents answers 404 for a FREE space to a third person', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();
  await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Plano do projeto',
    new Date('2026-01-01T10:00:00.000Z'),
  );
  const outsider = await createPersonWithSession(app, {
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
  });
  const random = await randomIdResponse(outsider.cookie);

  const response = await getSpaceDocuments(freeSpaceId, outsider.cookie);

  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

test('GET space documents answers 404 for a FREE space to an admin who is not a member', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();
  await createSpaceDocument(
    freeSpaceId,
    owner.person,
    'Plano do projeto',
    new Date('2026-01-01T10:00:00.000Z'),
  );
  const random = await randomIdResponse(adminCookie);

  const response = await getSpaceDocuments(freeSpaceId, adminCookie);

  expect(adminPerson.isAdmin).toBe(true);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * do espaço livre é provado no serviço real, contra o mesmo Postgres, com um
 * `organizationId` que não é o da instalação, sobre um espaço de que a pessoa
 * é dona.
 */
test('reachOf a FREE space with another organization id returns none', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const mine = await spaces.reachOf(
    adminPerson.organizationId,
    owner.person.id,
    freeSpaceId,
  );
  const others = await spaces.reachOf(randomUUID(), owner.person.id, freeSpaceId);

  expect(mine).toBe('direct');
  expect(others).toBe('none');
});

/** `PATCH /api/spaces/:spaceId` com o cabeçalho de CSRF. */
function patchSpace(
  spaceId: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .patch(`/api/spaces/${spaceId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined
    ? request.send(body as object)
    : request.set('Cookie', cookie).send(body as object);
}

/** Valor de `membersCanInvite` gravado no banco para o espaço. */
async function membersCanInviteOf(spaceId: string): Promise<boolean> {
  const space = await prisma.space.findUniqueOrThrow({ where: { id: spaceId } });

  return space.membersCanInvite;
}

/** Zilda Rocha, pessoa da organização fora do espaço. */
function createOutsider(): Promise<{ person: Person; cookie: string }> {
  return createPersonWithSession(app, {
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
  });
}

/** Espaço livre de João com Ana como membro, aberto pelo dono via `PATCH`. */
async function createOpenSpaceWithMember(): Promise<{
  owner: { person: Person; cookie: string };
  other: { person: Person; cookie: string };
  freeSpaceId: string;
}> {
  const created = await createOwnerWithMember();
  const opened = await patchSpace(
    created.freeSpaceId,
    { membersCanInvite: true },
    created.owner.cookie,
  );

  expect(opened.status).toBe(200);

  return created;
}

test('PUT space member answers 200 to a member of an open space and the person sees the space in GET spaces', async () => {
  const { other, freeSpaceId } = await createOpenSpaceWithMember();
  const outsider = await createOutsider();

  const response = await putSpaceMember(
    freeSpaceId,
    outsider.person.id,
    other.cookie,
  );
  const listed = await getSpaces(outsider.cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: outsider.person.id,
      name: 'Zilda Rocha',
      email: 'zilda@exemplo.org',
    },
  });
  expect(listed.status).toBe(200);
  expect((listed.body as SpacesBody).data).toContainEqual({
    id: freeSpaceId,
    type: 'free',
    name: 'Projeto Alfa',
  });
  expect(await countSpaceMembers()).toBe(2);
});

test('PUT space member answers 200 to the owner of an open space', async () => {
  const { owner, freeSpaceId } = await createOpenSpaceWithMember();

  const response = await putSpaceMember(freeSpaceId, adminPerson.id, owner.cookie);

  expect(response.status).toBe(200);
  expect((response.body as SpaceMemberBody).data.id).toBe(adminPerson.id);
  expect(await countSpaceMembers()).toBe(2);
});

test('PUT space member answers 404 to a stranger of an open space', async () => {
  const { freeSpaceId } = await createOpenSpaceWithMember();
  const outsider = await createOutsider();

  const response = await putSpaceMember(
    freeSpaceId,
    adminPerson.id,
    outsider.cookie,
  );

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('PUT space member answers 400 when a member adds himself with Você já é membro deste espaço.', async () => {
  const { other, freeSpaceId } = await createOpenSpaceWithMember();

  const response = await putSpaceMember(freeSpaceId, other.person.id, other.cookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'Você já é membro deste espaço.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('PUT space member answers 400 when a member adds the owner with Esta pessoa é a dona deste espaço.', async () => {
  const { owner, other, freeSpaceId } = await createOpenSpaceWithMember();

  const response = await putSpaceMember(freeSpaceId, owner.person.id, other.cookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Esta pessoa é a dona deste espaço.',
  });
  expect(await countSpaceMembers()).toBe(1);
});

test('PATCH space answers 200 to the owner and GET space reflects membersCanInvite', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await patchSpace(
    freeSpaceId,
    { membersCanInvite: true },
    owner.cookie,
  );
  const detail = await getSpace(freeSpaceId, owner.cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: freeSpaceId,
      type: 'free',
      name: 'Projeto Alfa',
      reach: 'owner',
      membersCanInvite: true,
      canCreateDocuments: true,
      canAddPeople: true,
    },
  });
  expect(detail.status).toBe(200);
  expect(detail.body).toEqual(response.body);
  expect(await membersCanInviteOf(freeSpaceId)).toBe(true);
});

test('PATCH space is idempotent', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const first = await patchSpace(freeSpaceId, { membersCanInvite: true }, owner.cookie);
  const second = await patchSpace(freeSpaceId, { membersCanInvite: true }, owner.cookie);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);
  expect(await membersCanInviteOf(freeSpaceId)).toBe(true);
});

test('PATCH space answers 403 to a member with Só o dono do espaço pode mudar quem adiciona pessoas.', async () => {
  const { other, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpace(
    freeSpaceId,
    { membersCanInvite: true },
    other.cookie,
  );

  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message: 'Só o dono do espaço pode mudar quem adiciona pessoas.',
  });
  expect(await membersCanInviteOf(freeSpaceId)).toBe(false);
});

test('PATCH space answers 404 to a stranger', async () => {
  const { freeSpaceId } = await createOwnerWithMember();
  const outsider = await createOutsider();

  const response = await patchSpace(
    freeSpaceId,
    { membersCanInvite: true },
    outsider.cookie,
  );

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await membersCanInviteOf(freeSpaceId)).toBe(false);
});

test('PATCH space answers 404 for a malformed id', async () => {
  const { owner } = await createOwnerAndOther();

  const response = await patchSpace(
    'nao-e-uuid',
    { membersCanInvite: true },
    owner.cookie,
  );

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('PATCH space answers 404 for a UNIT space', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);
  const detail = await getSpace(unit.spaceId, cookie);

  const response = await patchSpace(
    unit.spaceId,
    { membersCanInvite: true },
    cookie,
  );

  expect((detail.body as { data: { reach: string } }).data.reach).toBe('direct');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await membersCanInviteOf(unit.spaceId)).toBe(false);
});

test('PATCH space rejects an empty body with 400', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await patchSpace(freeSpaceId, {}, owner.cookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Dados inválidos.',
    errors: [
      { field: 'membersCanInvite', message: 'Escolha quem adiciona pessoas.' },
    ],
  });
  expect(await membersCanInviteOf(freeSpaceId)).toBe(false);
});

test('PATCH space rejects a non boolean value with 400', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await patchSpace(
    freeSpaceId,
    { membersCanInvite: 'sim' },
    owner.cookie,
  );

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Dados inválidos.',
    errors: [
      { field: 'membersCanInvite', message: 'Escolha quem adiciona pessoas.' },
    ],
  });
  expect(await membersCanInviteOf(freeSpaceId)).toBe(false);
});

test('PATCH space rejects extra fields with 400', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const response = await patchSpace(
    freeSpaceId,
    { membersCanInvite: true, ownerId: adminPerson.id },
    owner.cookie,
  );

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: '', message: 'Campo não permitido.' }],
  });
  expect(await membersCanInviteOf(freeSpaceId)).toBe(false);
  expect(
    (await prisma.space.findUniqueOrThrow({ where: { id: freeSpaceId } })).ownerId,
  ).toBe(
    (await prisma.person.findFirstOrThrow({ where: { email: 'joao@exemplo.org' } })).id,
  );
});

test('PATCH space answers 401 without session', async () => {
  const { freeSpaceId } = await createOwnerAndOther();

  const response = await patchSpace(freeSpaceId, { membersCanInvite: true });

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(await membersCanInviteOf(freeSpaceId)).toBe(false);
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * de `updateSettings` é provado no serviço real, contra o mesmo Postgres, com
 * um `organizationId` que não é o da instalação, sobre um espaço de que a
 * pessoa é dona.
 */
test('updateSettings with another organization id answers 404', async () => {
  const { owner, freeSpaceId } = await createOwnerAndOther();

  const attempt = spaces.updateSettings(
    { organizationId: randomUUID(), id: owner.person.id },
    freeSpaceId,
    { membersCanInvite: true },
  );

  await expect(attempt).rejects.toThrow(NotFoundException);
  await expect(attempt).rejects.toThrow('Espaço não encontrado.');
  expect(await membersCanInviteOf(freeSpaceId)).toBe(false);
});

test('closing the space keeps the members who joined', async () => {
  const { owner, other, freeSpaceId } = await createOpenSpaceWithMember();
  const outsider = await createOutsider();
  const added = await putSpaceMember(
    freeSpaceId,
    outsider.person.id,
    other.cookie,
  );

  const closed = await patchSpace(
    freeSpaceId,
    { membersCanInvite: false },
    owner.cookie,
  );
  const refused = await putSpaceMember(freeSpaceId, adminPerson.id, other.cookie);

  expect(added.status).toBe(200);
  expect(closed.status).toBe(200);
  expect((closed.body as { data: { membersCanInvite: boolean } }).data.membersCanInvite).toBe(
    false,
  );
  expect(await prisma.spaceMember.count({ where: { spaceId: freeSpaceId } })).toBe(2);
  expect(refused.status).toBe(403);
  expect(refused.body).toEqual({
    message: 'Só o dono do espaço pode adicionar pessoas.',
  });
});

test('the database rejects membersCanInvite on a UNIT space', async () => {
  const unit = await createUnit('Protocolo');

  await expect(
    prisma.space.update({
      where: { id: unit.spaceId },
      data: { membersCanInvite: true },
    }),
  ).rejects.toThrow(/Space_members_can_invite_free_check/);
  expect(await membersCanInviteOf(unit.spaceId)).toBe(false);
});

/** `PATCH /api/spaces/:spaceId/members/:personId` com o cabeçalho de CSRF. */
function patchSpaceMember(
  spaceId: string,
  personId: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .patch(`/api/spaces/${spaceId}/members/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined
    ? request.send(body as object)
    : request.set('Cookie', cookie).send(body as object);
}

/** Nível gravado no banco para o membro do espaço livre. */
async function memberLevelOf(
  spaceId: string,
  personId: string,
): Promise<'VIEW' | 'EDIT'> {
  const row = await prisma.spaceMember.findUniqueOrThrow({
    where: { spaceId_personId: { spaceId, personId } },
  });

  return row.level;
}

/** Grava o nível de leitura para o membro, direto pelo Prisma. */
async function setViewLevel(spaceId: string, personId: string): Promise<void> {
  await prisma.spaceMember.update({
    where: { spaceId_personId: { spaceId, personId } },
    data: { level: 'VIEW' },
  });
}

test('PATCH space member answers 200 to the owner and GET space members reflects the level', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpaceMember(
    freeSpaceId,
    other.person.id,
    { level: 'view' },
    owner.cookie,
  );
  const members = await getSpaceMembers(freeSpaceId, owner.cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      id: other.person.id,
      name: 'Ana Lima',
      email: 'ana@exemplo.org',
      isCurrentPerson: false,
      role: 'member',
      level: 'view',
    },
  });
  expect(members.status).toBe(200);
  expect(
    (members.body as SpaceMembersBody).data.find(
      (item) => item.id === other.person.id,
    ),
  ).toEqual({
    id: other.person.id,
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
    isCurrentPerson: false,
    role: 'member',
    level: 'view',
  });
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('VIEW');
});

test('PATCH space member is idempotent', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();

  const first = await patchSpaceMember(
    freeSpaceId,
    other.person.id,
    { level: 'view' },
    owner.cookie,
  );
  const second = await patchSpaceMember(
    freeSpaceId,
    other.person.id,
    { level: 'view' },
    owner.cookie,
  );

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('VIEW');
  expect(await countSpaceMembers()).toBe(1);
});

test('PATCH space member answers 403 to a member with Só o dono do espaço pode mudar o nível de um membro.', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();
  const added = await putSpaceMember(freeSpaceId, adminPerson.id, owner.cookie);

  const response = await patchSpaceMember(
    freeSpaceId,
    adminPerson.id,
    { level: 'view' },
    other.cookie,
  );

  expect(added.status).toBe(200);
  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message: 'Só o dono do espaço pode mudar o nível de um membro.',
  });
  expect(await memberLevelOf(freeSpaceId, adminPerson.id)).toBe('EDIT');
});

test('PATCH space member answers 400 when the owner targets himself with O dono do espaço não tem nível.', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpaceMember(
    freeSpaceId,
    owner.person.id,
    { level: 'view' },
    owner.cookie,
  );

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ message: 'O dono do espaço não tem nível.' });
  expect(await countSpaceMembers()).toBe(1);
});

test('PATCH space member answers 404 for a person who is not a member with Esta pessoa não é membro deste espaço.', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpaceMember(
    freeSpaceId,
    adminPerson.id,
    { level: 'view' },
    owner.cookie,
  );

  expect(response.status).toBe(404);
  expect(response.body).toEqual({
    message: 'Esta pessoa não é membro deste espaço.',
  });
  expect(await countSpaceMembers()).toBe(1);
});

test('PATCH space member answers 404 to a stranger', async () => {
  const { other, freeSpaceId } = await createOwnerWithMember();
  const outsider = await createOutsider();

  const response = await patchSpaceMember(
    freeSpaceId,
    other.person.id,
    { level: 'view' },
    outsider.cookie,
  );

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('EDIT');
});

test('PATCH space member answers 404 for a malformed space id', async () => {
  const { owner, other } = await createOwnerWithMember();

  const response = await patchSpaceMember(
    'nao-e-uuid',
    other.person.id,
    { level: 'view' },
    owner.cookie,
  );

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
});

test('PATCH space member answers 404 for a UNIT space', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);
  await assign(unit.orgUnitId, adminPerson.id);
  const detail = await getSpace(unit.spaceId, cookie);

  const response = await patchSpaceMember(
    unit.spaceId,
    adminPerson.id,
    { level: 'view' },
    cookie,
  );

  expect((detail.body as { data: { reach: string } }).data.reach).toBe('direct');
  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Espaço não encontrado.' });
  expect(await countSpaceMembers()).toBe(0);
});

test('PATCH space member rejects an empty body with 400', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpaceMember(
    freeSpaceId,
    other.person.id,
    {},
    owner.cookie,
  );

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: 'level', message: 'Escolha o nível do membro.' }],
  });
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('EDIT');
});

test('PATCH space member rejects an invalid level with 400', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpaceMember(
    freeSpaceId,
    other.person.id,
    { level: 'owner' },
    owner.cookie,
  );

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: 'level', message: 'Escolha o nível do membro.' }],
  });
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('EDIT');
});

test('PATCH space member rejects extra fields with 400', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpaceMember(
    freeSpaceId,
    other.person.id,
    { level: 'view', role: 'owner' },
    owner.cookie,
  );

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: '', message: 'Campo não permitido.' }],
  });
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('EDIT');
});

test('PATCH space member answers 401 without session', async () => {
  const { other, freeSpaceId } = await createOwnerWithMember();

  const response = await patchSpaceMember(freeSpaceId, other.person.id, {
    level: 'view',
  });

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('EDIT');
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * de `updateMemberLevel` é provado no serviço real, contra o mesmo Postgres,
 * com um `organizationId` que não é o da instalação, sobre um espaço de que a
 * pessoa é dona e um membro existente.
 */
test('updateMemberLevel with another organization id answers 404', async () => {
  const { owner, other, freeSpaceId } = await createOwnerWithMember();

  const attempt = spaces.updateMemberLevel(
    { organizationId: randomUUID(), id: owner.person.id },
    freeSpaceId,
    other.person.id,
    { level: 'view' },
  );

  await expect(attempt).rejects.toThrow(NotFoundException);
  await expect(attempt).rejects.toThrow('Espaço não encontrado.');
  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('EDIT');
});

test('PUT space member answers 403 to a viewer of an open space with Só quem pode editar adiciona pessoas a este espaço.', async () => {
  const { other, freeSpaceId } = await createOpenSpaceWithMember();
  await setViewLevel(freeSpaceId, other.person.id);
  const outsider = await createOutsider();

  const response = await putSpaceMember(
    freeSpaceId,
    outsider.person.id,
    other.cookie,
  );

  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message: 'Só quem pode editar adiciona pessoas a este espaço.',
  });
  expect(await countSpaceMembers()).toBe(1);
});

test('PUT space member answers 200 to an editor of an open space', async () => {
  const { other, freeSpaceId } = await createOpenSpaceWithMember();
  const outsider = await createOutsider();

  const response = await putSpaceMember(
    freeSpaceId,
    outsider.person.id,
    other.cookie,
  );

  expect(await memberLevelOf(freeSpaceId, other.person.id)).toBe('EDIT');
  expect(response.status).toBe(200);
  expect((response.body as SpaceMemberBody).data.id).toBe(outsider.person.id);
  expect(await countSpaceMembers()).toBe(2);
});

type SpacePermissions = {
  data: { canCreateDocuments: boolean; canAddPeople: boolean };
};

/** Os dois flags de permissão de `GET /api/spaces/:spaceId`. */
function permissionsOf(response: Response): {
  canCreateDocuments: boolean;
  canAddPeople: boolean;
} {
  const { canCreateDocuments, canAddPeople } = (
    response.body as SpacePermissions
  ).data;

  return { canCreateDocuments, canAddPeople };
}

test('GET space answers canCreateDocuments and canAddPeople true to the owner', async () => {
  const { owner, freeSpaceId } = await createOwnerWithMember();

  const response = await getSpace(freeSpaceId, owner.cookie);

  expect(response.status).toBe(200);
  expect(permissionsOf(response)).toEqual({
    canCreateDocuments: true,
    canAddPeople: true,
  });
});

test('GET space answers canCreateDocuments true and canAddPeople false to an editor of a closed space', async () => {
  const { other, freeSpaceId } = await createOwnerWithMember();

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(response.status).toBe(200);
  expect(permissionsOf(response)).toEqual({
    canCreateDocuments: true,
    canAddPeople: false,
  });
});

test('GET space answers canCreateDocuments and canAddPeople true to an editor of an open space', async () => {
  const { other, freeSpaceId } = await createOpenSpaceWithMember();

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(response.status).toBe(200);
  expect(permissionsOf(response)).toEqual({
    canCreateDocuments: true,
    canAddPeople: true,
  });
});

test('GET space answers canCreateDocuments and canAddPeople false to a viewer of an open space', async () => {
  const { other, freeSpaceId } = await createOpenSpaceWithMember();
  await setViewLevel(freeSpaceId, other.person.id);

  const response = await getSpace(freeSpaceId, other.cookie);

  expect(response.status).toBe(200);
  expect((response.body as { data: { membersCanInvite: boolean } }).data.membersCanInvite).toBe(
    true,
  );
  expect(permissionsOf(response)).toEqual({
    canCreateDocuments: false,
    canAddPeople: false,
  });
});

test('GET space answers canCreateDocuments true and canAddPeople false to a direct unit member', async () => {
  const unit = await createUnit('Protocolo');
  const { person, cookie } = await createMember();
  await assign(unit.orgUnitId, person.id);

  const response = await getSpace(unit.spaceId, cookie);

  expect(response.status).toBe(200);
  expect(permissionsOf(response)).toEqual({
    canCreateDocuments: true,
    canAddPeople: false,
  });
});
