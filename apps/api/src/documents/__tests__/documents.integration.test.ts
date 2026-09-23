import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../documents.service';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

const NOT_FOUND_MESSAGE = 'Documento não encontrado.';

const MALFORMED_ID = 'nao-e-uuid';

/** `expect.any(String)` tipado, para o corpo comparado por `toEqual`. */
const ANY_STRING = expect.any(String) as unknown as string;

type DocumentBody = {
  id: string;
  title: string;
  spaceId: string;
  authorId: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  trashedAt: string | null;
  accessLevel: string;
  isFavorite: boolean;
};

type DocumentSummaryBody = {
  id: string;
  title: string;
  updatedAt: string;
  trashedAt: string | null;
};

type ValidationErrorBody = {
  message: string;
  errors: Array<{ field: string; message: string }>;
};

let app: INestApplication;
let prisma: PrismaService;

/** Pessoa A: nasce na instalação e entra pelo login. */
let personA: Person;
let cookieA: string;

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
      organizationName: 'Prefeitura de Exemplo',
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

  cookieA = sessionCookie.split(';')[0] ?? '';
  personA = await prisma.person.findFirstOrThrow({ where: { email: EMAIL } });
});

function postDocument(cookie: string): Promise<Response> {
  return httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function getDocuments(cookie: string, query = '?scope=mine'): Promise<Response> {
  return httpRequest(app)
    .get(`/api/documents${query}`)
    .set('Cookie', cookie)
    .send();
}

function getDocument(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .get(`/api/documents/${documentId}`)
    .set('Cookie', cookie)
    .send();
}

function patchDocument(
  cookie: string,
  documentId: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return httpRequest(app)
    .patch(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send(body);
}

/** Cria um documento pela API e devolve o corpo dele. */
async function createDocument(cookie: string): Promise<DocumentBody> {
  const response = await postDocument(cookie);

  return (response.body as { data: DocumentBody }).data;
}

/** Grava a data direto no banco: nenhum teste espera o relógio. */
async function setUpdatedAt(documentId: string, date: Date): Promise<void> {
  await prisma.$executeRaw`UPDATE "Document" SET "updatedAt" = ${date} WHERE "id" = ${documentId}`;
}

test('POST /api/documents returns 201 with a Sem título document owned and authored by the caller', async () => {
  const response = await postDocument(cookieA);

  expect(response.status).toBe(201);
  expect(response.body).toEqual({
    data: {
      id: ANY_STRING,
      title: 'Sem título',
      spaceId: ANY_STRING,
      authorId: personA.id,
      ownerId: personA.id,
      createdAt: ANY_STRING,
      updatedAt: ANY_STRING,
      trashedAt: null,
      accessLevel: 'owner',
      isFavorite: false,
    },
  });
});

test('a new document is not a favorite', async () => {
  const created = await createDocument(cookieA);

  const response = await getDocument(cookieA, created.id);

  expect(created.isFavorite).toBe(false);
  expect((response.body as { data: DocumentBody }).data.isFavorite).toBe(false);
  expect(await prisma.favorite.count()).toBe(0);
});

test('a new document is not in the trash', async () => {
  const created = await createDocument(cookieA);

  const read = await getDocument(cookieA, created.id);
  const trash = await getDocuments(cookieA, '?scope=trash');
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(created.trashedAt).toBeNull();
  expect((read.body as { data: DocumentBody }).data.trashedAt).toBeNull();
  expect(trash.body).toEqual({ data: [] });
  expect(stored.trashedAt).toBeNull();
});

test('the created document lives in the personal space of the caller', async () => {
  const document = await createDocument(cookieA);

  const personalSpace = await prisma.space.findFirstOrThrow({
    where: { personId: personA.id, type: 'PERSONAL' },
  });

  expect(document.spaceId).toBe(personalSpace.id);
});

test('creates the personal space when the person has none', async () => {
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
    withPersonalSpace: false,
  });

  expect(await prisma.space.count({ where: { personId: person.id } })).toBe(0);

  const response = await postDocument(cookie);

  const personalSpace = await prisma.space.findFirstOrThrow({
    where: { personId: person.id },
  });

  expect(response.status).toBe(201);
  expect(personalSpace.type).toBe('PERSONAL');
  expect((response.body as { data: DocumentBody }).data.spaceId).toBe(
    personalSpace.id,
  );
});

test('returns accessLevel owner to the owner', async () => {
  const created = await createDocument(cookieA);

  const response = await getDocument(cookieA, created.id);

  expect(created.accessLevel).toBe('owner');
  expect((response.body as { data: DocumentBody }).data.accessLevel).toBe(
    'owner',
  );
});

test('GET /api/documents?scope=mine lists by updatedAt desc with id, title and updatedAt only', async () => {
  const oldest = await createDocument(cookieA);
  const middle = await createDocument(cookieA);
  const newest = await createDocument(cookieA);

  await setUpdatedAt(oldest.id, new Date('2026-01-01T10:00:00.000Z'));
  await setUpdatedAt(middle.id, new Date('2026-02-01T10:00:00.000Z'));
  await setUpdatedAt(newest.id, new Date('2026-03-01T10:00:00.000Z'));

  const response = await getDocuments(cookieA);
  const data = (response.body as { data: DocumentSummaryBody[] }).data;

  expect(response.status).toBe(200);
  expect(data.map((item) => item.id)).toEqual([newest.id, middle.id, oldest.id]);
  expect(Object.keys(data[0] ?? {}).sort()).toEqual([
    'id',
    'title',
    'trashedAt',
    'updatedAt',
  ]);
});

test('lists at most 100 documents', async () => {
  const space = await prisma.space.findFirstOrThrow({
    where: { personId: personA.id },
  });

  await prisma.document.createMany({
    data: Array.from({ length: 105 }, (_unused, index) => ({
      title: `Documento ${index}`,
      spaceId: space.id,
      authorId: personA.id,
      ownerId: personA.id,
    })),
  });

  const response = await getDocuments(cookieA);

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentSummaryBody[] }).data).toHaveLength(
    100,
  );
});

test('returns an empty list for a person without documents', async () => {
  await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const response = await getDocuments(cookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});

test('returns 400 for a missing or unknown scope', async () => {
  const missing = await getDocuments(cookieA, '');
  const unknown = await getDocuments(cookieA, '?scope=todos');

  expect(missing.status).toBe(400);
  expect(unknown.status).toBe(400);
  expect(missing.body as ValidationErrorBody).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: 'scope', message: 'Informe um escopo válido.' }],
  });
  expect(unknown.body).toEqual(missing.body);
});

test('GET /api/documents/:id returns the document to the owner', async () => {
  const created = await createDocument(cookieA);

  const response = await getDocument(cookieA, created.id);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: created });
});

test('PATCH renames the document, trims the title and bumps updatedAt', async () => {
  const created = await createDocument(cookieA);
  await setUpdatedAt(created.id, new Date('2026-01-01T10:00:00.000Z'));

  const response = await patchDocument(cookieA, created.id, {
    title: '  Plano de obras  ',
  });
  const data = (response.body as { data: DocumentBody }).data;

  expect(response.status).toBe(200);
  expect(data.title).toBe('Plano de obras');
  expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(
    new Date('2026-01-01T10:00:00.000Z').getTime(),
  );
});

test('PATCH with an empty title stores Sem título', async () => {
  const created = await createDocument(cookieA);
  await patchDocument(cookieA, created.id, { title: 'Plano de obras' });

  const response = await patchDocument(cookieA, created.id, { title: '   ' });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'Sem título',
  );
  expect(stored.title).toBe('Sem título');
});

test('PATCH with a 201 character title returns 400 with the literal message', async () => {
  const created = await createDocument(cookieA);

  const response = await patchDocument(cookieA, created.id, {
    title: 'a'.repeat(201),
  });

  expect(response.status).toBe(400);
  expect(response.body as ValidationErrorBody).toEqual({
    message: 'Dados inválidos.',
    errors: [
      {
        field: 'title',
        message: 'O título pode ter no máximo 200 caracteres.',
      },
    ],
  });
});

test('renaming never changes authorId', async () => {
  const created = await createDocument(cookieA);

  const response = await patchDocument(cookieA, created.id, {
    title: 'Plano de obras',
  });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect((response.body as { data: DocumentBody }).data.authorId).toBe(
    created.authorId,
  );
  expect(stored.authorId).toBe(personA.id);
});

test('another person cannot read, list or rename the document', async () => {
  const created = await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const read = await getDocument(cookie, created.id);
  const list = await getDocuments(cookie);
  const rename = await patchDocument(cookie, created.id, { title: 'Meu' });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(read.status).toBe(404);
  expect(list.body).toEqual({ data: [] });
  expect(rename.status).toBe(404);
  expect(stored.title).toBe('Sem título');
});

test('an administrator who is not the owner cannot read, list or rename the document', async () => {
  const created = await createDocument(cookieA);
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
    isAdmin: true,
  });

  const read = await getDocument(cookie, created.id);
  const list = await getDocuments(cookie);
  const rename = await patchDocument(cookie, created.id, { title: 'Meu' });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(person.isAdmin).toBe(true);
  expect(read.status).toBe(404);
  expect(list.body).toEqual({ data: [] });
  expect(rename.status).toBe(404);
  expect(stored.title).toBe('Sem título');
});

test('GET returns the same 404 status and body for unknown, foreign and malformed ids', async () => {
  const foreign = await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const unknownId = await getDocument(cookie, randomUUID());
  const foreignId = await getDocument(cookie, foreign.id);
  const malformedId = await getDocument(cookie, MALFORMED_ID);

  expect(unknownId.status).toBe(404);
  expect(foreignId.status).toEqual(unknownId.status);
  expect(malformedId.status).toEqual(unknownId.status);
  expect(unknownId.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(foreignId.body).toEqual(unknownId.body);
  expect(malformedId.body).toEqual(unknownId.body);
});

test('PATCH returns the same 404 status and body for unknown, foreign and malformed ids', async () => {
  const foreign = await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  const body = { title: 'Plano de obras' };

  const unknownId = await patchDocument(cookie, randomUUID(), body);
  const foreignId = await patchDocument(cookie, foreign.id, body);
  const malformedId = await patchDocument(cookie, MALFORMED_ID, body);

  expect(unknownId.status).toBe(404);
  expect(foreignId.status).toEqual(unknownId.status);
  expect(malformedId.status).toEqual(unknownId.status);
  expect(unknownId.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(foreignId.body).toEqual(unknownId.body);
  expect(malformedId.body).toEqual(unknownId.body);
});

test('PATCH with an invalid body on a foreign document returns 404, not 400', async () => {
  const foreign = await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const response = await patchDocument(cookie, foreign.id, {
    title: 'a'.repeat(201),
  });

  expect(response.status).toBe(404);
  expect(response.body).not.toHaveProperty('errors');
});

test.each([
  {
    name: 'POST /api/documents',
    run: (): Promise<Response> =>
      httpRequest(app)
        .post('/api/documents')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send(),
  },
  {
    name: 'GET /api/documents',
    run: (): Promise<Response> =>
      httpRequest(app).get('/api/documents?scope=mine').send(),
  },
  {
    name: 'GET /api/documents/:id',
    run: (): Promise<Response> =>
      httpRequest(app).get(`/api/documents/${randomUUID()}`).send(),
  },
  {
    name: 'PATCH /api/documents/:id',
    run: (): Promise<Response> =>
      httpRequest(app)
        .patch(`/api/documents/${randomUUID()}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ title: 'Plano de obras' }),
  },
])('every route returns 401 without a session ($name)', async ({ run }) => {
  const response = await run();

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ message: 'Sessão não encontrada.' });
});

test('POST and PATCH return 403 without the X-Requested-With header', async () => {
  const created = await createDocument(cookieA);

  const post = await httpRequest(app)
    .post('/api/documents')
    .set('Cookie', cookieA)
    .send();
  const patch = await httpRequest(app)
    .patch(`/api/documents/${created.id}`)
    .set('Cookie', cookieA)
    .send({ title: 'Plano de obras' });

  expect(post.status).toBe(403);
  expect(post.body).toEqual({ message: 'Requisição recusada.' });
  expect(patch.status).toBe(403);
  expect(patch.body).toEqual({ message: 'Requisição recusada.' });
  expect(await prisma.document.count()).toBe(1);
});

/** Estado Yjs de mentira: as duas operações só movem bytes. */
const STATE = new Uint8Array([1, 2, 3, 4]);
const OTHER_STATE = new Uint8Array([9, 8, 7]);

function documents(): DocumentsService {
  return app.get(DocumentsService);
}

test('saveContent stores the state and bumps the document updatedAt', async () => {
  const created = await createDocument(cookieA);
  await setUpdatedAt(created.id, new Date('2026-01-01T10:00:00.000Z'));

  await documents().saveContent(created.id, STATE);

  const content = await prisma.documentContent.findFirstOrThrow({
    where: { documentId: created.id },
  });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(new Uint8Array(content.state)).toEqual(STATE);
  expect(stored.updatedAt.getTime()).toBeGreaterThan(
    new Date('2026-01-01T10:00:00.000Z').getTime(),
  );
});

test('saveContent twice keeps a single content row with the latest state', async () => {
  const created = await createDocument(cookieA);

  await documents().saveContent(created.id, STATE);
  await documents().saveContent(created.id, OTHER_STATE);

  const content = await prisma.documentContent.findFirstOrThrow({
    where: { documentId: created.id },
  });

  expect(await prisma.documentContent.count()).toBe(1);
  expect(new Uint8Array(content.state)).toEqual(OTHER_STATE);
});

test('loadContent returns the stored bytes', async () => {
  const created = await createDocument(cookieA);
  await documents().saveContent(created.id, STATE);

  const loaded = await documents().loadContent(created.id);

  expect(loaded).not.toBeNull();
  expect(new Uint8Array(loaded ?? new Uint8Array())).toEqual(STATE);
});

test('the documents list and the document read carry no content bytes', async () => {
  const created = await createDocument(cookieA);
  await documents().saveContent(created.id, STATE);

  const list = await getDocuments(cookieA);
  const read = await getDocument(cookieA, created.id);
  const body = JSON.stringify({
    list: list.body as unknown,
    read: read.body as unknown,
  });

  expect(Object.keys((read.body as { data: DocumentBody }).data)).not.toContain(
    'content',
  );
  expect(body).not.toContain('"content"');
  expect(body).not.toContain('"state"');
});

test('deleting a document deletes its content', async () => {
  const created = await createDocument(cookieA);
  await documents().saveContent(created.id, STATE);

  await prisma.document.delete({ where: { id: created.id } });

  expect(
    await prisma.documentContent.count({ where: { documentId: created.id } }),
  ).toBe(0);
});

/** A dona dá leitura do documento à pessoa, pela API. */
async function shareWith(documentId: string, personId: string): Promise<void> {
  const response = await httpRequest(app)
    .put(`/api/documents/${documentId}/shares/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level: 'view' });

  expect(response.status).toBe(200);
}

/** Pessoa com sessão que recebe leitura do documento criado pela dona. */
async function createSharedDocument(): Promise<{
  document: DocumentBody;
  viewerCookie: string;
}> {
  const document = await createDocument(cookieA);
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await shareWith(document.id, person.id);

  return { document, viewerCookie: cookie };
}

test('GET a shared document answers 200 with accessLevel view', async () => {
  const { document, viewerCookie } = await createSharedDocument();

  const response = await getDocument(viewerCookie, document.id);

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      id: document.id,
      ownerId: personA.id,
      accessLevel: 'view',
    }),
  );
});

test('PATCH a shared document by a view person answers 403', async () => {
  const { document, viewerCookie } = await createSharedDocument();

  const response = await patchDocument(viewerCookie, document.id, {
    title: 'Título da visitante',
  });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(response.status).toBe(403);
  expect(stored.title).toBe('Sem título');
});

test('POST trash on a shared document by a view person answers 404', async () => {
  const { document, viewerCookie } = await createSharedDocument();

  const response = await httpRequest(app)
    .post(`/api/documents/${document.id}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', viewerCookie)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(stored.trashedAt).toBeNull();
});

test('GET a shared document by a third person answers the same 404 as a missing one', async () => {
  const { document } = await createSharedDocument();
  const { cookie: thirdCookie } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });

  const shared = await getDocument(thirdCookie, document.id);
  const missing = await getDocument(thirdCookie, randomUUID());

  expect(missing.status).toBe(404);
  expect(shared.status).toBe(missing.status);
  expect(shared.body).toEqual(missing.body);
});

test('my documents of the view person does not list the shared document', async () => {
  const { viewerCookie } = await createSharedDocument();

  const response = await getDocuments(viewerCookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});

const SPACE_NOT_FOUND_BODY = { message: 'Espaço não encontrado.' };

/** `POST /api/documents` com o corpo informado. */
function postDocumentWith(cookie: string, body: unknown): Promise<Response> {
  return httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send(body as object);
}

type UnitWithSpace = { orgUnitId: string; spaceId: string };

/** Unidade sob a raiz (ou sob `parentId`) com o espaço `UNIT` dela. */
async function createUnitSpace(
  name: string,
  options: { parentId?: string; inheritsParent?: boolean } = {},
): Promise<UnitWithSpace> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: personA.organizationId, parentId: null },
  });
  const unit = await prisma.orgUnit.create({
    data: {
      organizationId: personA.organizationId,
      parentId: options.parentId ?? root.id,
      name,
    },
  });
  const space = await prisma.space.create({
    data: {
      type: 'UNIT',
      orgUnitId: unit.id,
      inheritsParent: options.inheritsParent ?? false,
    },
  });

  return { orgUnitId: unit.id, spaceId: space.id };
}

/** Lota a pessoa diretamente na unidade, pelo Prisma. */
async function assign(orgUnitId: string, personId: string): Promise<void> {
  await prisma.orgUnitAssignment.create({ data: { orgUnitId, personId } });
}

type UnitDocumentScenario = {
  unit: UnitWithSpace;
  document: DocumentBody;
  colleague: Person;
  colleagueCookie: string;
};

/** A e o colega lotados na mesma unidade; A cria um documento no espaço dela. */
async function createUnitDocument(): Promise<UnitDocumentScenario> {
  const unit = await createUnitSpace('Protocolo');
  const { person: colleague, cookie: colleagueCookie } =
    await createPersonWithSession(app, {
      name: 'João Lima',
      email: 'joao@exemplo.org',
    });
  await assign(unit.orgUnitId, personA.id);
  await assign(unit.orgUnitId, colleague.id);

  const response = await postDocumentWith(cookieA, { spaceId: unit.spaceId });

  expect(response.status).toBe(201);

  return {
    unit,
    document: (response.body as { data: DocumentBody }).data,
    colleague,
    colleagueCookie,
  };
}

test('POST documents without body still creates in the personal space', async () => {
  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA);
  const personalSpace = await prisma.space.findFirstOrThrow({
    where: { personId: personA.id, type: 'PERSONAL' },
  });

  expect(response.status).toBe(201);
  expect((response.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      spaceId: personalSpace.id,
      ownerId: personA.id,
      accessLevel: 'owner',
    }),
  );
});

test('POST documents with a direct unit spaceId answers 201 in that space owned by the caller', async () => {
  const unit = await createUnitSpace('Protocolo');
  await assign(unit.orgUnitId, personA.id);

  const response = await postDocumentWith(cookieA, { spaceId: unit.spaceId });
  const created = (response.body as { data: DocumentBody }).data;
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(response.status).toBe(201);
  expect(created).toEqual(
    expect.objectContaining({
      title: 'Sem título',
      spaceId: unit.spaceId,
      authorId: personA.id,
      ownerId: personA.id,
      accessLevel: 'owner',
    }),
  );
  expect(stored.spaceId).toBe(unit.spaceId);
  expect(stored.ownerId).toBe(personA.id);
});

test('a document created in the unit space appears in my documents of the creator and not of the colleague', async () => {
  const { document, colleagueCookie } = await createUnitDocument();

  const creatorList = await getDocuments(cookieA);
  const colleagueList = await getDocuments(colleagueCookie);

  expect(
    (creatorList.body as { data: DocumentSummaryBody[] }).data.map(
      (item) => item.id,
    ),
  ).toEqual([document.id]);
  expect(colleagueList.status).toBe(200);
  expect(colleagueList.body).toEqual({ data: [] });
});

test('POST documents with an inherited unit spaceId answers 404 with Espaço não encontrado.', async () => {
  const parent = await createUnitSpace('Secretaria');
  const child = await createUnitSpace('Protocolo', {
    parentId: parent.orgUnitId,
    inheritsParent: true,
  });
  await assign(parent.orgUnitId, personA.id);

  const response = await postDocumentWith(cookieA, { spaceId: child.spaceId });

  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count({ where: { spaceId: child.spaceId } })).toBe(
    0,
  );
});

test('POST documents with a unit spaceId without assignment answers 404', async () => {
  const unit = await createUnitSpace('Protocolo');

  const response = await postDocumentWith(cookieA, { spaceId: unit.spaceId });

  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count()).toBe(0);
});

test('POST documents with a random spaceId answers 404', async () => {
  const response = await postDocumentWith(cookieA, { spaceId: randomUUID() });

  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count()).toBe(0);
});

test('POST documents with a malformed spaceId answers 404', async () => {
  const response = await postDocumentWith(cookieA, { spaceId: MALFORMED_ID });

  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count()).toBe(0);
});

test('POST documents with an extra field answers 400', async () => {
  const unit = await createUnitSpace('Protocolo');
  await assign(unit.orgUnitId, personA.id);

  const response = await postDocumentWith(cookieA, {
    spaceId: unit.spaceId,
    ownerId: randomUUID(),
  });

  expect(response.status).toBe(400);
  expect((response.body as ValidationErrorBody).errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ message: 'Campo não permitido.' }),
    ]),
  );
  expect(await prisma.document.count()).toBe(0);
});

test('a colleague GETs the unit space document with accessLevel edit', async () => {
  const { document, colleagueCookie } = await createUnitDocument();

  const response = await getDocument(colleagueCookie, document.id);

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      id: document.id,
      ownerId: personA.id,
      accessLevel: 'edit',
    }),
  );
});

test('a colleague renames the unit space document with 200', async () => {
  const { document, colleagueCookie } = await createUnitDocument();

  const response = await patchDocument(colleagueCookie, document.id, {
    title: 'Regulamento do protocolo',
  });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'Regulamento do protocolo',
  );
  expect(stored.title).toBe('Regulamento do protocolo');
  expect(stored.ownerId).toBe(personA.id);
});

test('a colleague gets 404 on trash, restore and delete of the unit space document', async () => {
  const { document, colleagueCookie } = await createUnitDocument();

  const trash = await httpRequest(app)
    .post(`/api/documents/${document.id}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', colleagueCookie)
    .send();
  const restore = await httpRequest(app)
    .post(`/api/documents/${document.id}/restore`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', colleagueCookie)
    .send();
  const remove = await httpRequest(app)
    .delete(`/api/documents/${document.id}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', colleagueCookie)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(trash.status).toBe(404);
  expect(trash.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(restore.status).toBe(404);
  expect(restore.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(remove.status).toBe(404);
  expect(remove.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(stored.trashedAt).toBeNull();
});

/**
 * A organização é única por instância (`Organization_singleton_check`): o
 * escopo por organização é provado no serviço real, contra o mesmo Postgres,
 * com um `organizationId` que não é o da instalação.
 */
test('create with another organization id answers 404', async () => {
  const unit = await createUnitSpace('Protocolo');
  await assign(unit.orgUnitId, personA.id);
  const person = await prisma.person.findFirstOrThrow({
    where: { id: personA.id },
    include: { organization: true },
  });

  const created = await documents().create(person, { spaceId: unit.spaceId });

  await expect(
    documents().create(
      { ...person, organizationId: randomUUID() },
      { spaceId: unit.spaceId },
    ),
  ).rejects.toMatchObject({
    status: 404,
    message: 'Espaço não encontrado.',
  });
  expect(created.spaceId).toBe(unit.spaceId);
  expect(await prisma.document.count({ where: { spaceId: unit.spaceId } })).toBe(
    1,
  );
});
