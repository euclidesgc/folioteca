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
import {
  HAS_CHILDREN_MESSAGE,
  HAS_DOCUMENTS_MESSAGE,
  ROOT_MESSAGE,
} from '../org-units.service';

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

const NOT_FOUND_MESSAGE = 'Unidade não encontrada.';

const NAME_TAKEN_MESSAGE = 'Já existe uma unidade com esse nome neste nível.';

const INVALID_MESSAGE = 'Dados inválidos.';

/** Envia `POST /api/org-units` com o cabeçalho que o CSRF do projeto exige. */
function postOrgUnit(body: object, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .post('/api/org-units')
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body,
  );
}

/** Envia `PATCH /api/org-units/:id` com o cabeçalho do CSRF. */
function patchOrgUnit(
  orgUnitId: string,
  body: object,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .patch(`/api/org-units/${orgUnitId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body,
  );
}

/** Envia `DELETE /api/org-units/:id` com o cabeçalho do CSRF. */
function deleteOrgUnit(orgUnitId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .delete(`/api/org-units/${orgUnitId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** Id da unidade raiz criada pela instalação. */
async function getRootId(): Promise<string> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: adminPerson.organizationId, parentId: null },
  });

  return root.id;
}

function unitOf(response: Response): OrgUnitBody {
  return (response.body as { data: OrgUnitBody }).data;
}

function messageOf(response: Response): string {
  return (response.body as { message: string }).message;
}

test('creates a child under the root, lists it and creates its UNIT space', async () => {
  const rootId = await getRootId();

  const response = await postOrgUnit(
    { parentId: rootId, name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(201);
  expect(unitOf(response)).toEqual({
    id: ANY_STRING,
    parentId: rootId,
    name: 'Acervo',
  });

  const list = await getOrgUnits(adminCookie);
  const names = (list.body as { data: OrgUnitBody[] }).data.map(
    (unit) => unit.name,
  );
  expect(names).toContain('Acervo');

  const space = await prisma.space.findFirst({
    where: { orgUnitId: unitOf(response).id },
  });
  expect(space?.type).toBe('UNIT');
});

test('stores the name trimmed', async () => {
  const rootId = await getRootId();

  const response = await postOrgUnit(
    { parentId: rootId, name: '   Área Técnica   ' },
    adminCookie,
  );

  expect(response.status).toBe(201);
  expect(unitOf(response).name).toBe('Área Técnica');

  const stored = await prisma.orgUnit.findUniqueOrThrow({
    where: { id: unitOf(response).id },
  });
  expect(stored.name).toBe('Área Técnica');
});

test('answers 400 for an empty name and for a name of only spaces', async () => {
  const rootId = await getRootId();

  const empty = await postOrgUnit({ parentId: rootId, name: '' }, adminCookie);
  const spaces = await postOrgUnit(
    { parentId: rootId, name: '    ' },
    adminCookie,
  );

  expect(empty.status).toBe(400);
  expect(messageOf(empty)).toBe(INVALID_MESSAGE);
  expect(spaces.status).toBe(400);
  expect(messageOf(spaces)).toBe(INVALID_MESSAGE);
});

test('answers 400 for 121 characters and 201 for 120', async () => {
  const rootId = await getRootId();

  const tooLong = await postOrgUnit(
    { parentId: rootId, name: 'a'.repeat(121) },
    adminCookie,
  );
  const limit = await postOrgUnit(
    { parentId: rootId, name: 'b'.repeat(120) },
    adminCookie,
  );

  expect(tooLong.status).toBe(400);
  expect(limit.status).toBe(201);
  expect(unitOf(limit).name).toHaveLength(120);
});

test('answers 400 without parentId', async () => {
  const response = await postOrgUnit({ name: 'Acervo' }, adminCookie);

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe(INVALID_MESSAGE);
});

test('answers 404 with the message for an unknown parentId', async () => {
  const response = await postOrgUnit(
    { parentId: randomUUID(), name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(404);
  expect(messageOf(response)).toBe(NOT_FOUND_MESSAGE);
});

test('answers 404 with the message for a malformed parentId', async () => {
  const response = await postOrgUnit(
    { parentId: 'nao-e-uuid', name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(404);
  expect(messageOf(response)).toBe(NOT_FOUND_MESSAGE);
});

test('answers 409 with the message for siblings differing only by case', async () => {
  const rootId = await getRootId();

  const first = await postOrgUnit(
    { parentId: rootId, name: 'Acervo' },
    adminCookie,
  );
  const second = await postOrgUnit(
    { parentId: rootId, name: 'acervo' },
    adminCookie,
  );

  expect(first.status).toBe(201);
  expect(second.status).toBe(409);
  expect(messageOf(second)).toBe(NAME_TAKEN_MESSAGE);
});

test('answers 409 for accented siblings differing only by case', async () => {
  const rootId = await getRootId();

  const first = await postOrgUnit(
    { parentId: rootId, name: 'ÁREA' },
    adminCookie,
  );
  const second = await postOrgUnit(
    { parentId: rootId, name: 'área' },
    adminCookie,
  );

  expect(first.status).toBe(201);
  expect(second.status).toBe(409);
  expect(messageOf(second)).toBe(NAME_TAKEN_MESSAGE);
});

test('accepts siblings differing only by accent', async () => {
  const rootId = await getRootId();

  const accented = await postOrgUnit(
    { parentId: rootId, name: 'Área' },
    adminCookie,
  );
  const plain = await postOrgUnit(
    { parentId: rootId, name: 'Area' },
    adminCookie,
  );

  expect(accented.status).toBe(201);
  expect(plain.status).toBe(201);
});

test('accepts the same name under different parents', async () => {
  const rootId = await getRootId();

  const branch = await postOrgUnit(
    { parentId: rootId, name: 'Área Técnica' },
    adminCookie,
  );

  const underRoot = await postOrgUnit(
    { parentId: rootId, name: 'Acervo' },
    adminCookie,
  );
  const underBranch = await postOrgUnit(
    { parentId: unitOf(branch).id, name: 'Acervo' },
    adminCookie,
  );

  expect(underRoot.status).toBe(201);
  expect(underBranch.status).toBe(201);
});

test('two identical concurrent creates end as one 201 and one 409 with a single row', async () => {
  const rootId = await getRootId();
  const body = { parentId: rootId, name: 'Acervo' };

  const responses = await Promise.all([
    postOrgUnit(body, adminCookie),
    postOrgUnit(body, adminCookie),
  ]);

  expect(responses.map((response) => response.status).sort()).toEqual([
    201, 409,
  ]);

  const count = await prisma.orgUnit.count({
    where: { parentId: rootId, name: 'Acervo' },
  });
  expect(count).toBe(1);
});

test('renames a child and the list reflects it', async () => {
  const rootId = await getRootId();
  const created = await postOrgUnit(
    { parentId: rootId, name: 'Acervo' },
    adminCookie,
  );

  const response = await patchOrgUnit(
    unitOf(created).id,
    { name: 'Acervo Geral' },
    adminCookie,
  );

  expect(response.status).toBe(200);
  expect(unitOf(response)).toEqual({
    id: unitOf(created).id,
    parentId: rootId,
    name: 'Acervo Geral',
  });

  const list = await getOrgUnits(adminCookie);
  const names = (list.body as { data: OrgUnitBody[] }).data.map(
    (unit) => unit.name,
  );
  expect(names).toContain('Acervo Geral');
  expect(names).not.toContain('Acervo');
});

test('answers 409 when renaming to a sibling name with different case', async () => {
  const rootId = await getRootId();
  await postOrgUnit({ parentId: rootId, name: 'Acervo' }, adminCookie);
  const other = await postOrgUnit(
    { parentId: rootId, name: 'Zeladoria' },
    adminCookie,
  );

  const response = await patchOrgUnit(
    unitOf(other).id,
    { name: 'ACERVO' },
    adminCookie,
  );

  expect(response.status).toBe(409);
  expect(messageOf(response)).toBe(NAME_TAKEN_MESSAGE);
});

test('renames only the case of its own name', async () => {
  const rootId = await getRootId();
  const created = await postOrgUnit(
    { parentId: rootId, name: 'Acervo' },
    adminCookie,
  );

  const response = await patchOrgUnit(
    unitOf(created).id,
    { name: 'ACERVO' },
    adminCookie,
  );

  expect(response.status).toBe(200);
  expect(unitOf(response).name).toBe('ACERVO');
});

test('renaming the root renames the organization and auth me returns the new name', async () => {
  const rootId = await getRootId();

  const response = await patchOrgUnit(
    rootId,
    { name: 'Prefeitura Nova' },
    adminCookie,
  );

  expect(response.status).toBe(200);
  expect(unitOf(response).name).toBe('Prefeitura Nova');

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: adminPerson.organizationId },
  });
  expect(organization.name).toBe('Prefeitura Nova');

  const me = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', adminCookie);

  expect(me.status).toBe(200);
  const body = me.body as { data: { organization: { name: string } } };
  expect(body.data.organization.name).toBe('Prefeitura Nova');
});

test('PATCH answers 400 when the body carries parentId', async () => {
  const rootId = await getRootId();
  const created = await postOrgUnit(
    { parentId: rootId, name: 'Acervo' },
    adminCookie,
  );

  const response = await patchOrgUnit(
    unitOf(created).id,
    { name: 'Acervo Geral', parentId: rootId },
    adminCookie,
  );

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe(INVALID_MESSAGE);
  const body = response.body as { errors: { message: string }[] };
  expect(body.errors[0]?.message).toBe('Campo não permitido.');
});

test('PATCH answers 404 for an unknown id', async () => {
  const response = await patchOrgUnit(
    randomUUID(),
    { name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(404);
  expect(messageOf(response)).toBe(NOT_FOUND_MESSAGE);
});

test('PATCH answers 404 for a malformed id', async () => {
  const response = await patchOrgUnit(
    'nao-e-uuid',
    { name: 'Acervo' },
    adminCookie,
  );

  expect(response.status).toBe(404);
  expect(messageOf(response)).toBe(NOT_FOUND_MESSAGE);
});

test('a person who is not admin gets 403 on POST and on PATCH', async () => {
  const rootId = await getRootId();
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const created = await postOrgUnit(
    { parentId: rootId, name: 'Acervo' },
    cookie,
  );
  const renamed = await patchOrgUnit(rootId, { name: 'Outro' }, cookie);

  expect(created.status).toBe(403);
  expect(messageOf(created)).toBe(FORBIDDEN_MESSAGE);
  expect(renamed.status).toBe(403);
  expect(messageOf(renamed)).toBe(FORBIDDEN_MESSAGE);
});

test('answers 401 without a session cookie on POST and on PATCH', async () => {
  const rootId = await getRootId();

  const created = await postOrgUnit({ parentId: rootId, name: 'Acervo' });
  const renamed = await patchOrgUnit(rootId, { name: 'Outro' });

  expect(created.status).toBe(401);
  expect(renamed.status).toBe(401);
});

test('the database refuses a second root', async () => {
  await expect(
    prisma.orgUnit.create({
      data: {
        organizationId: adminPerson.organizationId,
        parentId: null,
        name: 'Segunda Raiz',
      },
    }),
  ).rejects.toMatchObject({ code: 'P2002' });
});

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

/** Cria uma unidade pela API e devolve o id dela. */
async function createUnit(name: string, parentId?: string): Promise<string> {
  const response = await postOrgUnit(
    { parentId: parentId ?? (await getRootId()), name },
    adminCookie,
  );

  expect(response.status).toBe(201);

  return unitOf(response).id;
}

/** Id do espaço `UNIT` da unidade. */
async function getSpaceId(orgUnitId: string): Promise<string> {
  const space = await prisma.space.findFirstOrThrow({ where: { orgUnitId } });

  return space.id;
}

/**
 * Põe um documento no espaço da unidade. O acesso direto à tabela `Document`
 * vale aqui: `__tests__` fica fora da varredura do teste de fronteira.
 */
async function createDocumentIn(
  orgUnitId: string,
  trashedAt: Date | null = null,
): Promise<void> {
  await prisma.document.create({
    data: {
      title: 'Regulamento',
      spaceId: await getSpaceId(orgUnitId),
      authorId: adminPerson.id,
      ownerId: adminPerson.id,
      trashedAt,
    },
  });
}

test('deletes a leaf, answers 204 without a body and removes it from the list', async () => {
  const unitId = await createUnit('Restauro');

  const response = await deleteOrgUnit(unitId, adminCookie);

  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(response.text).toBe('');

  const list = await getOrgUnits(adminCookie);
  const names = (list.body as { data: OrgUnitBody[] }).data.map(
    (unit) => unit.name,
  );
  expect(names).not.toContain('Restauro');
});

test('deleting a leaf also deletes its UNIT space', async () => {
  const unitId = await createUnit('Restauro');

  const response = await deleteOrgUnit(unitId, adminCookie);

  expect(response.status).toBe(204);
  expect(await prisma.orgUnit.findUnique({ where: { id: unitId } })).toBeNull();
  expect(
    await prisma.space.findFirst({ where: { orgUnitId: unitId } }),
  ).toBeNull();
});

test('answers 409 with the message for the root', async () => {
  const rootId = await getRootId();

  const response = await deleteOrgUnit(rootId, adminCookie);

  expect(response.status).toBe(409);
  expect(messageOf(response)).toBe(ROOT_MESSAGE);
  expect(
    await prisma.orgUnit.findUnique({ where: { id: rootId } }),
  ).not.toBeNull();
});

test('answers 409 with the message for a unit with children and keeps it', async () => {
  const parentId = await createUnit('Acervo');
  await createUnit('Processamento Técnico', parentId);

  const response = await deleteOrgUnit(parentId, adminCookie);

  expect(response.status).toBe(409);
  expect(messageOf(response)).toBe(HAS_CHILDREN_MESSAGE);
  expect(
    await prisma.orgUnit.findUnique({ where: { id: parentId } }),
  ).not.toBeNull();
});

test('answers 409 with the message when the space has a document', async () => {
  const unitId = await createUnit('Sala Infantil');
  await createDocumentIn(unitId);

  const response = await deleteOrgUnit(unitId, adminCookie);

  expect(response.status).toBe(409);
  expect(messageOf(response)).toBe(HAS_DOCUMENTS_MESSAGE);
  expect(
    await prisma.orgUnit.findUnique({ where: { id: unitId } }),
  ).not.toBeNull();
});

test('answers 409 when the only document of the space is in the trash', async () => {
  const unitId = await createUnit('Sala Infantil');
  await createDocumentIn(unitId, new Date());

  const response = await deleteOrgUnit(unitId, adminCookie);

  expect(response.status).toBe(409);
  expect(messageOf(response)).toBe(HAS_DOCUMENTS_MESSAGE);
});

test('a person who is not admin gets 403 on DELETE', async () => {
  const unitId = await createUnit('Restauro');
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await deleteOrgUnit(unitId, cookie);

  expect(response.status).toBe(403);
  expect(messageOf(response)).toBe(FORBIDDEN_MESSAGE);
});

test('answers 401 without a session cookie on DELETE', async () => {
  const unitId = await createUnit('Restauro');

  const response = await deleteOrgUnit(unitId);

  expect(response.status).toBe(401);
});

test('answers 404 with the message for an unknown id', async () => {
  const response = await deleteOrgUnit(randomUUID(), adminCookie);

  expect(response.status).toBe(404);
  expect(messageOf(response)).toBe(NOT_FOUND_MESSAGE);
});

test('answers 404 with the message for a malformed id', async () => {
  const response = await deleteOrgUnit('nao-e-uuid', adminCookie);

  expect(response.status).toBe(404);
  expect(messageOf(response)).toBe(NOT_FOUND_MESSAGE);
});

test('the database refuses to delete a parent with children', async () => {
  const parentId = await createUnit('Acervo');
  await createUnit('Processamento Técnico', parentId);

  // O espaço da mãe sai antes para que só a filha possa segurar a exclusão.
  await prisma.space.delete({ where: { id: await getSpaceId(parentId) } });

  await expect(
    prisma.orgUnit.delete({ where: { id: parentId } }),
  ).rejects.toMatchObject({ code: 'P2003' });
});

test('the database refuses to delete a unit that still has its space', async () => {
  const unitId = await createUnit('Restauro');

  await expect(
    prisma.orgUnit.delete({ where: { id: unitId } }),
  ).rejects.toMatchObject({ code: 'P2003' });
});

test('the database refuses to delete a space that still has a document', async () => {
  const unitId = await createUnit('Sala Infantil');
  await createDocumentIn(unitId);

  await expect(
    prisma.space.delete({ where: { id: await getSpaceId(unitId) } }),
  ).rejects.toMatchObject({ code: 'P2003' });
});
