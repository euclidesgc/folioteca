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
  accessLevel: string;
};

type DocumentSummaryBody = {
  id: string;
  title: string;
  updatedAt: string;
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
      accessLevel: 'owner',
    },
  });
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
