import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

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

test('GET space documents answers 403 with the direct assignment message to an inherited member', async () => {
  const parent = await createUnit('Secretaria de Educação');
  const child = await createUnit('Protocolo', { parentId: parent.orgUnitId });
  const { person, cookie } = await createMember();
  await assign(parent.orgUnitId, person.id);
  await setSpaceAccess(child.orgUnitId, 'inherit');
  await createSpaceDocument(
    child.spaceId,
    adminPerson,
    'Ata do protocolo',
    new Date('2026-01-01T10:00:00.000Z'),
  );

  const listed = await spaceIdsOf(cookie);
  const response = await getSpaceDocuments(child.spaceId, cookie);

  expect(listed).toContain(child.spaceId);
  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message:
      'Os documentos deste espaço estão disponíveis para quem está lotado diretamente na unidade.',
  });
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

test('GET space documents answers 404 for a FREE space', async () => {
  const { cookie } = await createMember();
  const created = await postSpace({ name: 'Projeto Alfa' }, cookie);
  const freeSpaceId = (created.body as { data: SpaceItem }).data.id;
  const random = await randomIdResponse(cookie);

  const response = await getSpaceDocuments(freeSpaceId, cookie);

  expect(created.status).toBe(201);
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
    data: { id: unit.spaceId, type: 'unit', name: 'Protocolo', reach: 'direct' },
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
    data: { id: freeSpaceId, type: 'free', name: 'Projeto Alfa', reach: 'owner' },
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
      },
      {
        id: alvaro.person.id,
        name: 'Álvaro Dias',
        email: 'alvaro@exemplo.org',
        isCurrentPerson: false,
      },
      {
        id: zilda.person.id,
        name: 'Zilda Rocha',
        email: 'zilda@exemplo.org',
        isCurrentPerson: false,
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

test('GET space members answers 404 for the owner FREE space', async () => {
  const { cookie } = await createMember();
  const created = await postSpace({ name: 'Projeto Alfa' }, cookie);
  const freeSpaceId = (created.body as { data: SpaceItem }).data.id;
  const random = await randomMembersResponse(cookie);

  const response = await getSpaceMembers(freeSpaceId, cookie);

  expect(created.status).toBe(201);
  expect(response.status).toBe(random.status);
  expect(response.body).toEqual(random.body);
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
  const service = new SpacesService(prisma);

  const mine = await service.getDetail(
    adminPerson.organizationId,
    person.id,
    unit.spaceId,
  );
  const others = await service.getDetail(randomUUID(), person.id, unit.spaceId);

  expect(mine).toEqual({ id: unit.spaceId, type: 'unit', name: 'Protocolo', reach: 'direct' });
  expect(others).toBeNull();
});

test('listMembers with another organization id returns null', async () => {
  const unit = await createUnit('Protocolo');
  const { person } = await createMember();
  await assign(unit.orgUnitId, person.id);
  const service = new SpacesService(prisma);

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
