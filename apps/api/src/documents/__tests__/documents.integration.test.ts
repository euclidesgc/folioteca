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
      title: 'documento-sem-titulo-1',
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
  expect(stored.title).toBe('documento-sem-titulo-1');
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
  expect(stored.title).toBe('documento-sem-titulo-1');
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
  expect(stored.title).toBe('documento-sem-titulo-1');
});

test('POST trash on a shared document by a view person answers 403', async () => {
  const { document, viewerCookie } = await createSharedDocument();

  const response = await httpRequest(app)
    .post(`/api/documents/${document.id}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', viewerCookie)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message: 'Só o proprietário pode mover este documento para a lixeira.',
  });
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
      title: 'documento-sem-titulo-1',
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

type InheritedUnitScenario = {
  parent: UnitWithSpace;
  child: UnitWithSpace;
  colleague: Person;
  colleagueCookie: string;
};

/**
 * A lotada só na mãe "Secretaria"; a filha "Protocolo" herda dela e tem o
 * colega lotado diretamente.
 */
async function createInheritedUnit(): Promise<InheritedUnitScenario> {
  const parent = await createUnitSpace('Secretaria');
  const child = await createUnitSpace('Protocolo', {
    parentId: parent.orgUnitId,
    inheritsParent: true,
  });
  const { person: colleague, cookie: colleagueCookie } =
    await createPersonWithSession(app, {
      name: 'João Lima',
      email: 'joao@exemplo.org',
    });
  await assign(parent.orgUnitId, personA.id);
  await assign(child.orgUnitId, colleague.id);

  return { parent, child, colleague, colleagueCookie };
}

test('POST /documents in an inherited unit space returns 201 owned by the caller', async () => {
  const { child } = await createInheritedUnit();

  const response = await postDocumentWith(cookieA, { spaceId: child.spaceId });
  const created = (response.body as { data: DocumentBody }).data;
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(response.status).toBe(201);
  expect(created).toEqual(
    expect.objectContaining({
      spaceId: child.spaceId,
      authorId: personA.id,
      ownerId: personA.id,
      accessLevel: 'owner',
    }),
  );
  expect(stored.spaceId).toBe(child.spaceId);
  expect(stored.ownerId).toBe(personA.id);
});

test('a document created by inheritance appears in Meus documentos and in the space list', async () => {
  const { child } = await createInheritedUnit();
  const created = await postDocumentWith(cookieA, { spaceId: child.spaceId });
  const documentId = (created.body as { data: DocumentBody }).data.id;

  const mine = await getDocuments(cookieA);
  const spaceList = await httpRequest(app)
    .get(`/api/spaces/${child.spaceId}/documents`)
    .set('Cookie', cookieA)
    .send();

  expect(created.status).toBe(201);
  expect(
    (mine.body as { data: DocumentSummaryBody[] }).data.map((item) => item.id),
  ).toEqual([documentId]);
  expect(spaceList.status).toBe(200);
  expect(
    (spaceList.body as { data: DocumentSummaryBody[] }).data.map(
      (item) => item.id,
    ),
  ).toEqual([documentId]);
});

test('a directly assigned person opens with edit a document created by an heir', async () => {
  const { child, colleagueCookie } = await createInheritedUnit();
  const created = await postDocumentWith(cookieA, { spaceId: child.spaceId });
  const documentId = (created.body as { data: DocumentBody }).data.id;

  const response = await getDocument(colleagueCookie, documentId);

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      id: documentId,
      ownerId: personA.id,
      accessLevel: 'edit',
    }),
  );
});

test('POST /documents in a unit space with a broken chain returns 404', async () => {
  const grandparent = await createUnitSpace('Gabinete');
  const parent = await createUnitSpace('Secretaria', {
    parentId: grandparent.orgUnitId,
    inheritsParent: false,
  });
  const child = await createUnitSpace('Protocolo', {
    parentId: parent.orgUnitId,
    inheritsParent: true,
  });
  await assign(grandparent.orgUnitId, personA.id);

  const response = await postDocumentWith(cookieA, { spaceId: child.spaceId });

  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count({ where: { spaceId: child.spaceId } })).toBe(
    0,
  );
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * é provado no serviço real, contra o mesmo Postgres, com um
 * `organizationId` gerado por `randomUUID()`.
 */
test('POST /documents in a unit space of another organization returns 404', async () => {
  const { child } = await createInheritedUnit();
  const person = await prisma.person.findFirstOrThrow({
    where: { id: personA.id },
    include: { organization: true },
  });

  await expect(
    documents().create(
      { ...person, organizationId: randomUUID() },
      { spaceId: child.spaceId },
    ),
  ).rejects.toMatchObject({
    status: 404,
    message: 'Espaço não encontrado.',
  });
  expect(await prisma.document.count({ where: { spaceId: child.spaceId } })).toBe(
    0,
  );
});

test('an heir cannot trash a document of someone else', async () => {
  const { child, colleagueCookie } = await createInheritedUnit();
  const created = await postDocumentWith(colleagueCookie, {
    spaceId: child.spaceId,
  });
  const documentId = (created.body as { data: DocumentBody }).data.id;

  const opened = await getDocument(cookieA, documentId);
  const trash = await httpRequest(app)
    .post(`/api/documents/${documentId}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: documentId },
  });

  expect(created.status).toBe(201);
  expect((opened.body as { data: DocumentBody }).data.accessLevel).toBe('edit');
  expect(trash.status).toBe(403);
  expect(trash.body).toEqual({
    message: 'Só o proprietário pode mover este documento para a lixeira.',
  });
  expect(stored.trashedAt).toBeNull();
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

test('a colleague gets 403 on trash, restore and delete of the unit space document', async () => {
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

  expect(trash.status).toBe(403);
  expect(trash.body).toEqual({
    message: 'Só o proprietário pode mover este documento para a lixeira.',
  });
  expect(restore.status).toBe(403);
  expect(restore.body).toEqual({
    message: 'Só o proprietário pode restaurar este documento.',
  });
  expect(remove.status).toBe(403);
  expect(remove.body).toEqual({
    message: 'Só o proprietário pode excluir este documento.',
  });
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

/** Espaço livre "Projeto Alfa" da pessoa, gravado direto pelo Prisma. */
async function createFreeSpace(owner: Person): Promise<string> {
  const space = await prisma.space.create({
    data: {
      type: 'FREE',
      organizationId: owner.organizationId,
      name: 'Projeto Alfa',
      ownerId: owner.id,
    },
  });

  return space.id;
}

/** Torna a pessoa membro do espaço livre, pelo Prisma. */
async function addFreeMember(spaceId: string, personId: string): Promise<void> {
  await prisma.spaceMember.create({ data: { spaceId, personId } });
}

type FreeDocumentScenario = {
  spaceId: string;
  document: DocumentBody;
  member: Person;
  memberCookie: string;
};

/** A é dona do espaço livre, João é membro e cria um documento nele. */
async function createFreeDocument(): Promise<FreeDocumentScenario> {
  const spaceId = await createFreeSpace(personA);
  const { person: member, cookie: memberCookie } =
    await createPersonWithSession(app, {
      name: 'João Lima',
      email: 'joao@exemplo.org',
    });
  await addFreeMember(spaceId, member.id);

  const response = await postDocumentWith(memberCookie, { spaceId });

  expect(response.status).toBe(201);

  return {
    spaceId,
    document: (response.body as { data: DocumentBody }).data,
    member,
    memberCookie,
  };
}

test('POST documents with a free spaceId answers 201 to a member in that space owned by the caller', async () => {
  const { spaceId, document, member } = await createFreeDocument();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(document).toEqual(
    expect.objectContaining({
      title: 'documento-sem-titulo-1',
      spaceId,
      authorId: member.id,
      ownerId: member.id,
      accessLevel: 'owner',
    }),
  );
  expect(stored.spaceId).toBe(spaceId);
  expect(stored.ownerId).toBe(member.id);
});

test('a document created by a member in the free space appears in my documents of the member and not of the space owner', async () => {
  const { document, memberCookie } = await createFreeDocument();

  const memberList = await getDocuments(memberCookie);
  const ownerList = await getDocuments(cookieA);

  expect(memberList.status).toBe(200);
  expect(
    (memberList.body as { data: DocumentSummaryBody[] }).data.map(
      (item) => item.id,
    ),
  ).toEqual([document.id]);
  expect(ownerList.status).toBe(200);
  expect(ownerList.body).toEqual({ data: [] });
});

test('the free space owner GETs the member document with accessLevel edit', async () => {
  const { document, member } = await createFreeDocument();

  const response = await getDocument(cookieA, document.id);

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      id: document.id,
      ownerId: member.id,
      accessLevel: 'edit',
    }),
  );
});

test('the free space owner renames the member document with 200', async () => {
  const { document, member } = await createFreeDocument();

  const response = await patchDocument(cookieA, document.id, {
    title: 'Plano do projeto',
  });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'Plano do projeto',
  );
  expect(stored.title).toBe('Plano do projeto');
  expect(stored.ownerId).toBe(member.id);
});

test('the free space owner gets 403 on trash, restore and delete of the member document', async () => {
  const { document } = await createFreeDocument();

  const trash = await httpRequest(app)
    .post(`/api/documents/${document.id}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();
  const restore = await httpRequest(app)
    .post(`/api/documents/${document.id}/restore`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();
  const remove = await httpRequest(app)
    .delete(`/api/documents/${document.id}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(trash.status).toBe(403);
  expect(trash.body).toEqual({
    message: 'Só o proprietário pode mover este documento para a lixeira.',
  });
  expect(restore.status).toBe(403);
  expect(restore.body).toEqual({
    message: 'Só o proprietário pode restaurar este documento.',
  });
  expect(remove.status).toBe(403);
  expect(remove.body).toEqual({
    message: 'Só o proprietário pode excluir este documento.',
  });
  expect(stored.trashedAt).toBeNull();
});

test('POST documents with a free spaceId answers 404 to a third person', async () => {
  const spaceId = await createFreeSpace(personA);
  const { cookie: thirdCookie } = await createPersonWithSession(app, {
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
  });

  const response = await postDocumentWith(thirdCookie, { spaceId });

  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count({ where: { spaceId } })).toBe(0);
});

test('POST documents with a free spaceId answers 404 to an admin who is not a member', async () => {
  const { person: spaceOwner } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  const spaceId = await createFreeSpace(spaceOwner);

  const response = await postDocumentWith(cookieA, { spaceId });

  expect(personA.isAdmin).toBe(true);
  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count({ where: { spaceId } })).toBe(0);
});

test('POST documents with a free spaceId answers 404 to a removed member', async () => {
  const { spaceId, member, memberCookie } = await createFreeDocument();

  await prisma.spaceMember.delete({
    where: { spaceId_personId: { spaceId, personId: member.id } },
  });
  const response = await postDocumentWith(memberCookie, { spaceId });

  expect(response.status).toBe(404);
  expect(response.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count({ where: { spaceId } })).toBe(1);
});

test('POST documents with a random spaceId answers 404 for a free space caller', async () => {
  const { memberCookie } = await createFreeDocument();

  const ownerResponse = await postDocumentWith(cookieA, {
    spaceId: randomUUID(),
  });
  const memberResponse = await postDocumentWith(memberCookie, {
    spaceId: randomUUID(),
  });

  expect(ownerResponse.status).toBe(404);
  expect(ownerResponse.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(memberResponse.status).toBe(404);
  expect(memberResponse.body).toEqual(SPACE_NOT_FOUND_BODY);
  expect(await prisma.document.count()).toBe(1);
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * do espaço livre é provado no serviço real, contra o mesmo Postgres, com um
 * `organizationId` que não é o da instalação, sobre um espaço de que a pessoa
 * é dona.
 */
test('create in a free space with another organization id answers 404', async () => {
  const spaceId = await createFreeSpace(personA);
  const person = await prisma.person.findFirstOrThrow({
    where: { id: personA.id },
    include: { organization: true },
  });

  const created = await documents().create(person, { spaceId });

  await expect(
    documents().create({ ...person, organizationId: randomUUID() }, { spaceId }),
  ).rejects.toMatchObject({
    status: 404,
    message: 'Espaço não encontrado.',
  });
  expect(created.spaceId).toBe(spaceId);
  expect(await prisma.document.count({ where: { spaceId } })).toBe(1);
});

/** Grava o nível do membro do espaço livre, direto pelo Prisma. */
async function setFreeMemberLevel(
  spaceId: string,
  personId: string,
  level: 'VIEW' | 'EDIT',
): Promise<void> {
  await prisma.spaceMember.update({
    where: { spaceId_personId: { spaceId, personId } },
    data: { level },
  });
}

test('POST documents with a free spaceId answers 403 to a viewer member with Só quem pode editar cria documentos neste espaço.', async () => {
  const { spaceId, member, memberCookie } = await createFreeDocument();
  await setFreeMemberLevel(spaceId, member.id, 'VIEW');
  const before = await prisma.document.count();

  const response = await postDocumentWith(memberCookie, { spaceId });

  expect(response.status).toBe(403);
  expect(response.body).toEqual({
    message: 'Só quem pode editar cria documentos neste espaço.',
  });
  expect(await prisma.document.count()).toBe(before);
});

test('POST documents with a free spaceId answers 201 again after the viewer is promoted to edit', async () => {
  const { spaceId, member, memberCookie } = await createFreeDocument();
  await setFreeMemberLevel(spaceId, member.id, 'VIEW');
  const refused = await postDocumentWith(memberCookie, { spaceId });

  await setFreeMemberLevel(spaceId, member.id, 'EDIT');
  const response = await postDocumentWith(memberCookie, { spaceId });

  expect(refused.status).toBe(403);
  expect(response.status).toBe(201);
  expect((response.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({ spaceId, ownerId: member.id }),
  );
  expect(await prisma.document.count({ where: { spaceId } })).toBe(2);
});

/** Documento da dona do espaço livre (A) no espaço, com João já leitor. */
async function createColleagueDocumentForViewer(): Promise<{
  spaceId: string;
  document: DocumentBody;
  memberCookie: string;
}> {
  const { spaceId, member, memberCookie } = await createFreeDocument();
  const created = await postDocumentWith(cookieA, { spaceId });
  await setFreeMemberLevel(spaceId, member.id, 'VIEW');

  expect(created.status).toBe(201);

  return {
    spaceId,
    document: (created.body as { data: DocumentBody }).data,
    memberCookie,
  };
}

test('a viewer member GETs a colleague document of the free space with accessLevel view', async () => {
  const { document, memberCookie } = await createColleagueDocumentForViewer();

  const response = await getDocument(memberCookie, document.id);

  expect(response.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      id: document.id,
      ownerId: personA.id,
      accessLevel: 'view',
    }),
  );
});

test('a viewer member PATCH on a colleague document of the free space is refused and keeps the title', async () => {
  const { document, memberCookie } = await createColleagueDocumentForViewer();

  const response = await patchDocument(memberCookie, document.id, {
    title: 'Título do leitor',
  });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(response.status).toBe(403);
  expect(stored.title).toBe('documento-sem-titulo-1');
});

test('a viewer member renames and trashes their own document in the free space', async () => {
  const { spaceId, document, member, memberCookie } =
    await createFreeDocument();
  await setFreeMemberLevel(spaceId, member.id, 'VIEW');

  const renamed = await patchDocument(memberCookie, document.id, {
    title: 'Rascunho do João',
  });
  const trashed = await httpRequest(app)
    .post(`/api/documents/${document.id}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', memberCookie)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(renamed.status).toBe(200);
  expect(trashed.status).toBe(200);
  expect(stored.title).toBe('Rascunho do João');
  expect(stored.trashedAt).not.toBeNull();
});

/** Manda o documento para a lixeira pela API. */
function trashDocument(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .post(`/api/documents/${documentId}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

test('POST documents names the first document documento-sem-titulo-1', async () => {
  const response = await postDocument(cookieA);

  expect(response.status).toBe(201);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'documento-sem-titulo-1',
  );
});

test('POST documents names the second document documento-sem-titulo-2', async () => {
  await createDocument(cookieA);

  const response = await postDocument(cookieA);

  expect(response.status).toBe(201);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'documento-sem-titulo-2',
  );
});

test('POST documents counts trashed documents when picking the number', async () => {
  const first = await createDocument(cookieA);
  const trashed = await trashDocument(cookieA, first.id);

  const response = await postDocument(cookieA);

  expect(first.title).toBe('documento-sem-titulo-1');
  expect(trashed.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'documento-sem-titulo-2',
  );
});

test('POST documents reuses the smallest free number after a rename', async () => {
  await createDocument(cookieA);
  const second = await createDocument(cookieA);
  await createDocument(cookieA);
  const renamed = await patchDocument(cookieA, second.id, {
    title: 'Plano de obras',
  });

  const response = await postDocument(cookieA);

  expect(second.title).toBe('documento-sem-titulo-2');
  expect(renamed.status).toBe(200);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'documento-sem-titulo-2',
  );
});

test('POST documents numbering of another owner does not interfere', async () => {
  await createDocument(cookieA);
  await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const response = await postDocument(cookie);
  const next = await postDocument(cookieA);

  expect(response.status).toBe(201);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'documento-sem-titulo-1',
  );
  expect((next.body as { data: DocumentBody }).data.title).toBe(
    'documento-sem-titulo-3',
  );
});

test('POST documents keeps existing Sem título documents untouched', async () => {
  const personalSpace = await prisma.space.findFirstOrThrow({
    where: { personId: personA.id, type: 'PERSONAL' },
  });
  const existing = await prisma.document.create({
    data: {
      title: 'Sem título',
      spaceId: personalSpace.id,
      authorId: personA.id,
      ownerId: personA.id,
    },
  });

  const response = await postDocument(cookieA);
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: existing.id },
  });

  expect(response.status).toBe(201);
  expect((response.body as { data: DocumentBody }).data.title).toBe(
    'documento-sem-titulo-1',
  );
  expect(stored.title).toBe('Sem título');
});

test('create twice at the same time for the same owner gives distinct numbers', async () => {
  const person = await prisma.person.findFirstOrThrow({
    where: { id: personA.id },
    include: { organization: true },
  });

  const created = await Promise.all([
    documents().create(person, undefined),
    documents().create(person, undefined),
  ]);

  expect(new Set(created.map((document) => document.title))).toEqual(
    new Set(['documento-sem-titulo-1', 'documento-sem-titulo-2']),
  );
});

test('POST documents twice in parallel answers 201 with distinct numbers', async () => {
  const responses = await Promise.all([
    postDocument(cookieA),
    postDocument(cookieA),
  ]);

  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  expect(
    new Set(
      responses.map(
        (response) => (response.body as { data: DocumentBody }).data.title,
      ),
    ),
  ).toEqual(new Set(['documento-sem-titulo-1', 'documento-sem-titulo-2']));
});

/** A dona compartilha o documento com todos da organização, pela API. */
async function shareWithInstance(
  documentId: string,
  level: 'view' | 'edit',
): Promise<void> {
  const response = await httpRequest(app)
    .put(`/api/documents/${documentId}/instance-share`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level });

  expect(response.status).toBe(200);
}

/** Colega da organização, sem compartilhamento pessoal nem espaço em comum. */
async function createColleague(): Promise<{ person: Person; cookie: string }> {
  return createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
}

test('a colleague opens a document shared with the instance with the right accessLevel', async () => {
  const viewDocument = await createDocument(cookieA);
  const editDocument = await createDocument(cookieA);
  await shareWithInstance(viewDocument.id, 'view');
  await shareWithInstance(editDocument.id, 'edit');
  const { cookie } = await createColleague();

  const opensView = await getDocument(cookie, viewDocument.id);
  const opensEdit = await getDocument(cookie, editDocument.id);
  const renameView = await patchDocument(cookie, viewDocument.id, {
    title: 'Título do colega',
  });
  const renameEdit = await patchDocument(cookie, editDocument.id, {
    title: 'Título do colega',
  });

  expect(opensView.status).toBe(200);
  expect((opensView.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      id: viewDocument.id,
      ownerId: personA.id,
      accessLevel: 'view',
    }),
  );
  expect(opensEdit.status).toBe(200);
  expect((opensEdit.body as { data: DocumentBody }).data).toEqual(
    expect.objectContaining({
      id: editDocument.id,
      ownerId: personA.id,
      accessLevel: 'edit',
    }),
  );
  expect(renameView.status).toBe(403);
  expect(renameEdit.status).toBe(200);
});

test('a document shared with the instance appears in the colleague lists', async () => {
  const document = await createDocument(cookieA);
  await shareWithInstance(document.id, 'view');
  const { cookie } = await createColleague();

  const favorite = await httpRequest(app)
    .put(`/api/documents/${document.id}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
  const favorites = await getDocuments(cookie, '?scope=favorites');
  const mine = await getDocuments(cookie);

  expect(favorite.status).toBe(204);
  expect(favorites.status).toBe(200);
  expect(
    (favorites.body as { data: DocumentSummaryBody[] }).data.map(
      (item) => item.id,
    ),
  ).toEqual([document.id]);
  // "Meus documentos" continua só com o que é da pessoa.
  expect(mine.body).toEqual({ data: [] });
});

test('a colleague through the instance gets 403 on trash and delete', async () => {
  const document = await createDocument(cookieA);
  await shareWithInstance(document.id, 'edit');
  const { cookie } = await createColleague();

  const trash = await httpRequest(app)
    .post(`/api/documents/${document.id}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
  const remove = await httpRequest(app)
    .delete(`/api/documents/${document.id}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: document.id },
  });

  expect(trash.status).toBe(403);
  expect(trash.body).toEqual({
    message: 'Só o proprietário pode mover este documento para a lixeira.',
  });
  expect(remove.status).toBe(403);
  expect(remove.body).toEqual({
    message: 'Só o proprietário pode excluir este documento.',
  });
  expect(stored.trashedAt).toBeNull();
});

test('a colleague reached only through the instance gets 404 after the instance share is removed', async () => {
  const document = await createDocument(cookieA);
  await shareWithInstance(document.id, 'edit');
  const { cookie } = await createColleague();

  const before = await getDocument(cookie, document.id);
  const removed = await httpRequest(app)
    .delete(`/api/documents/${document.id}/instance-share`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();
  const after = await getDocument(cookie, document.id);
  const rename = await patchDocument(cookie, document.id, {
    title: 'Título do colega',
  });
  const byOwner = await getDocument(cookieA, document.id);

  expect(before.status).toBe(200);
  expect(removed.status).toBe(204);
  expect(after.status).toBe(404);
  expect(after.body).toEqual({ message: 'Documento não encontrado.' });
  expect(rename.status).toBe(404);
  expect(byOwner.status).toBe(200);
});
