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

const TRASHED_DOCUMENT_MESSAGE =
  'Este documento está na lixeira. Restaure-o para editar.';

const DELETE_OUTSIDE_TRASH_MESSAGE =
  'Mova o documento para a lixeira antes de apagá-lo definitivamente.';

const MALFORMED_ID = 'nao-e-uuid';

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

/** Cria um documento pela API e devolve o corpo dele. */
async function createDocument(cookie: string): Promise<DocumentBody> {
  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  return (response.body as { data: DocumentBody }).data;
}

function trashDocument(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .post(`/api/documents/${documentId}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function restoreDocument(
  cookie: string,
  documentId: string,
): Promise<Response> {
  return httpRequest(app)
    .post(`/api/documents/${documentId}/restore`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function deleteDocument(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .delete(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
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

function putFavorite(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .put(`/api/documents/${documentId}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function getDocument(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .get(`/api/documents/${documentId}`)
    .set('Cookie', cookie)
    .send();
}

function getDocuments(cookie: string, scope: string): Promise<Response> {
  return httpRequest(app)
    .get(`/api/documents?scope=${scope}`)
    .set('Cookie', cookie)
    .send();
}

function summaryIds(response: Response): string[] {
  return (response.body as { data: DocumentSummaryBody[] }).data.map(
    (item) => item.id,
  );
}

function documentOf(response: Response): DocumentBody {
  return (response.body as { data: DocumentBody }).data;
}

/** Grava a data da lixeira direto no banco: nenhum teste espera o relógio. */
async function setTrashedAt(documentId: string, date: Date): Promise<void> {
  await prisma.$executeRaw`UPDATE "Document" SET "trashedAt" = ${date} WHERE "id" = ${documentId}`;
}

async function createPersonB(): Promise<{ person: Person; cookie: string }> {
  return createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
}

test('POST trash answers 200 with trashedAt, hides the document from mine and favorites, lists it in trash and keeps it readable by the owner', async () => {
  const created = await createDocument(cookieA);
  await putFavorite(cookieA, created.id);

  const response = await trashDocument(cookieA, created.id);
  const mine = await getDocuments(cookieA, 'mine');
  const favorites = await getDocuments(cookieA, 'favorites');
  const trash = await getDocuments(cookieA, 'trash');
  const read = await getDocument(cookieA, created.id);

  expect(response.status).toBe(200);
  expect(documentOf(response).trashedAt).toEqual(expect.any(String));
  expect(summaryIds(mine)).toEqual([]);
  expect(summaryIds(favorites)).toEqual([]);
  expect(summaryIds(trash)).toEqual([created.id]);
  expect(read.status).toBe(200);
  expect(documentOf(read).trashedAt).toBe(documentOf(response).trashedAt);
});

test('a second POST trash answers 200 with the same trashedAt', async () => {
  const created = await createDocument(cookieA);

  const first = await trashDocument(cookieA, created.id);
  const second = await trashDocument(cookieA, created.id);

  expect(second.status).toBe(200);
  expect(documentOf(second).trashedAt).toBe(documentOf(first).trashedAt);
});

test('POST restore answers 200 with trashedAt null and brings the document back to mine and favorites with the same favorite row', async () => {
  const created = await createDocument(cookieA);
  await putFavorite(cookieA, created.id);
  const favoriteBefore = await prisma.favorite.findFirstOrThrow({
    where: { personId: personA.id, documentId: created.id },
  });
  await trashDocument(cookieA, created.id);

  const response = await restoreDocument(cookieA, created.id);
  const mine = await getDocuments(cookieA, 'mine');
  const favorites = await getDocuments(cookieA, 'favorites');
  const trash = await getDocuments(cookieA, 'trash');
  const favoriteAfter = await prisma.favorite.findFirstOrThrow({
    where: { personId: personA.id, documentId: created.id },
  });

  expect(response.status).toBe(200);
  expect(documentOf(response).trashedAt).toBeNull();
  expect(documentOf(response).isFavorite).toBe(true);
  expect(summaryIds(mine)).toEqual([created.id]);
  expect(summaryIds(favorites)).toEqual([created.id]);
  expect(summaryIds(trash)).toEqual([]);
  expect(favoriteAfter.createdAt.toISOString()).toBe(
    favoriteBefore.createdAt.toISOString(),
  );
});

test('restore keeps the stored Yjs state byte for byte', async () => {
  const created = await createDocument(cookieA);
  const state = new Uint8Array([1, 2, 3, 4, 5]);
  await prisma.documentContent.create({
    data: { documentId: created.id, state },
  });

  await trashDocument(cookieA, created.id);
  await restoreDocument(cookieA, created.id);

  const content = await prisma.documentContent.findFirstOrThrow({
    where: { documentId: created.id },
  });

  expect(new Uint8Array(content.state)).toEqual(state);
});

test('a second POST restore still answers 200', async () => {
  const created = await createDocument(cookieA);
  await trashDocument(cookieA, created.id);
  await restoreDocument(cookieA, created.id);

  const second = await restoreDocument(cookieA, created.id);

  expect(second.status).toBe(200);
  expect(documentOf(second).trashedAt).toBeNull();
});

test('lists the trash from the most recently trashed to the oldest', async () => {
  const oldest = await createDocument(cookieA);
  const middle = await createDocument(cookieA);
  const newest = await createDocument(cookieA);

  await trashDocument(cookieA, oldest.id);
  await trashDocument(cookieA, middle.id);
  await trashDocument(cookieA, newest.id);

  await setTrashedAt(oldest.id, new Date('2026-01-01T10:00:00.000Z'));
  await setTrashedAt(middle.id, new Date('2026-02-01T10:00:00.000Z'));
  await setTrashedAt(newest.id, new Date('2026-03-01T10:00:00.000Z'));

  const trash = await getDocuments(cookieA, 'trash');

  expect(trash.status).toBe(200);
  expect(summaryIds(trash)).toEqual([newest.id, middle.id, oldest.id]);
});

test('another person gets 404 on trash, restore and DELETE, identical to unknown and malformed ids, and no row changes', async () => {
  const outside = await createDocument(cookieA);
  const inTrash = await createDocument(cookieA);
  await trashDocument(cookieA, inTrash.id);
  const { cookie } = await createPersonB();

  const before = await prisma.document.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, trashedAt: true },
  });
  const countBefore = await prisma.document.count();

  const trashOutside = await trashDocument(cookie, outside.id);
  const trashInTrash = await trashDocument(cookie, inTrash.id);
  const restoreOutside = await restoreDocument(cookie, outside.id);
  const restoreInTrash = await restoreDocument(cookie, inTrash.id);
  const deleteOutside = await deleteDocument(cookie, outside.id);
  const deleteInTrash = await deleteDocument(cookie, inTrash.id);
  const unknownTrash = await trashDocument(cookie, randomUUID());
  const malformedTrash = await trashDocument(cookie, MALFORMED_ID);
  const unknownDelete = await deleteDocument(cookie, randomUUID());
  const malformedDelete = await deleteDocument(cookie, MALFORMED_ID);

  const responses = [
    trashOutside,
    trashInTrash,
    restoreOutside,
    restoreInTrash,
    deleteOutside,
    deleteInTrash,
    unknownTrash,
    malformedTrash,
    unknownDelete,
    malformedDelete,
  ];

  expect(responses.map((response) => response.status)).toEqual(
    responses.map(() => 404),
  );
  expect(trashOutside.body).toEqual({ message: NOT_FOUND_MESSAGE });

  for (const response of responses) {
    expect(response.body).toEqual(trashOutside.body);
  }

  const after = await prisma.document.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, trashedAt: true },
  });

  expect(after).toEqual(before);
  expect(await prisma.document.count()).toBe(countBefore);
});

test('the trash list of another person is empty and GET of a trashed document of someone else answers 404', async () => {
  const created = await createDocument(cookieA);
  await trashDocument(cookieA, created.id);
  const { cookie } = await createPersonB();

  const trash = await getDocuments(cookie, 'trash');
  const read = await getDocument(cookie, created.id);

  expect(trash.status).toBe(200);
  expect(trash.body).toEqual({ data: [] });
  expect(read.status).toBe(404);
  expect(read.body).toEqual({ message: NOT_FOUND_MESSAGE });
});

test('DELETE outside the trash answers 409 with the message and deletes nothing', async () => {
  const created = await createDocument(cookieA);

  const response = await deleteDocument(cookieA, created.id);

  expect(response.status).toBe(409);
  expect(response.body).toEqual({ message: DELETE_OUTSIDE_TRASH_MESSAGE });
  expect(await prisma.document.count({ where: { id: created.id } })).toBe(1);
});

test('DELETE in the trash answers 204 and removes the document, its content and every favorite', async () => {
  const created = await createDocument(cookieA);
  await putFavorite(cookieA, created.id);
  const { person: personB } = await createPersonB();
  // B não enxerga o documento de A: a linha de favorito entra direto no banco.
  await prisma.favorite.create({
    data: { personId: personB.id, documentId: created.id },
  });
  await prisma.documentContent.create({
    data: { documentId: created.id, state: new Uint8Array([1, 2, 3]) },
  });
  await trashDocument(cookieA, created.id);

  const response = await deleteDocument(cookieA, created.id);

  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(await prisma.document.count({ where: { id: created.id } })).toBe(0);
  expect(
    await prisma.documentContent.count({ where: { documentId: created.id } }),
  ).toBe(0);
  expect(await prisma.favorite.count({ where: { documentId: created.id } })).toBe(
    0,
  );
});

test('a second DELETE answers 404', async () => {
  const created = await createDocument(cookieA);
  await trashDocument(cookieA, created.id);
  await deleteDocument(cookieA, created.id);

  const second = await deleteDocument(cookieA, created.id);

  expect(second.status).toBe(404);
  expect(second.body).toEqual({ message: NOT_FOUND_MESSAGE });
});

test('PATCH in the trash answers 409 with the message and keeps the title', async () => {
  const created = await createDocument(cookieA);
  await patchDocument(cookieA, created.id, { title: 'Plano de obras' });
  await trashDocument(cookieA, created.id);

  const response = await patchDocument(cookieA, created.id, {
    title: 'Outro título',
  });
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(response.status).toBe(409);
  expect(response.body).toEqual({ message: TRASHED_DOCUMENT_MESSAGE });
  expect(stored.title).toBe('Plano de obras');
});

test('PATCH with an invalid body in the trash answers 409, not 400', async () => {
  const created = await createDocument(cookieA);
  await trashDocument(cookieA, created.id);

  const response = await patchDocument(cookieA, created.id, {
    title: 'a'.repeat(201),
  });

  expect(response.status).toBe(409);
  expect(response.body).toEqual({ message: TRASHED_DOCUMENT_MESSAGE });
  expect(response.body).not.toHaveProperty('errors');
});

test('PATCH after restore answers 200', async () => {
  const created = await createDocument(cookieA);
  await trashDocument(cookieA, created.id);
  await restoreDocument(cookieA, created.id);

  const response = await patchDocument(cookieA, created.id, {
    title: 'Plano de obras',
  });

  expect(response.status).toBe(200);
  expect(documentOf(response).title).toBe('Plano de obras');
  expect(documentOf(response).trashedAt).toBeNull();
});

test('answers 403 without the X-Requested-With header', async () => {
  const created = await createDocument(cookieA);

  const trash = await httpRequest(app)
    .post(`/api/documents/${created.id}/trash`)
    .set('Cookie', cookieA)
    .send();
  const restore = await httpRequest(app)
    .post(`/api/documents/${created.id}/restore`)
    .set('Cookie', cookieA)
    .send();
  const removal = await httpRequest(app)
    .delete(`/api/documents/${created.id}`)
    .set('Cookie', cookieA)
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(trash.status).toBe(403);
  expect(trash.body).toEqual({ message: 'Requisição recusada.' });
  expect(restore.status).toBe(403);
  expect(restore.body).toEqual({ message: 'Requisição recusada.' });
  expect(removal.status).toBe(403);
  expect(removal.body).toEqual({ message: 'Requisição recusada.' });
  expect(stored.trashedAt).toBeNull();
});

test('answers 401 without a session cookie', async () => {
  const created = await createDocument(cookieA);

  const trash = await httpRequest(app)
    .post(`/api/documents/${created.id}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send();
  const restore = await httpRequest(app)
    .post(`/api/documents/${created.id}/restore`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send();
  const removal = await httpRequest(app)
    .delete(`/api/documents/${created.id}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send();
  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(trash.status).toBe(401);
  expect(trash.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(restore.status).toBe(401);
  expect(restore.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(removal.status).toBe(401);
  expect(removal.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(stored.trashedAt).toBeNull();
});

test('answers 400 with the scope error for an unknown scope', async () => {
  const response = await getDocuments(cookieA, 'lixeira');

  expect(response.status).toBe(400);
  expect(response.body as ValidationErrorBody).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: 'scope', message: 'Informe um escopo válido.' }],
  });
});
