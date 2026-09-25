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

function putFavorite(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .put(`/api/documents/${documentId}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function deleteFavorite(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .delete(`/api/documents/${documentId}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function getFavorites(cookie: string): Promise<Response> {
  return httpRequest(app)
    .get('/api/documents?scope=favorites')
    .set('Cookie', cookie)
    .send();
}

function getDocument(cookie: string, documentId: string): Promise<Response> {
  return httpRequest(app)
    .get(`/api/documents/${documentId}`)
    .set('Cookie', cookie)
    .send();
}

/** Grava a data do favorito direto no banco: nenhum teste espera o relógio. */
async function setFavoritedAt(
  personId: string,
  documentId: string,
  date: Date,
): Promise<void> {
  await prisma.favorite.update({
    where: { personId_documentId: { personId, documentId } },
    data: { createdAt: date },
  });
}

function summaryIds(response: Response): string[] {
  return (response.body as { data: DocumentSummaryBody[] }).data.map(
    (item) => item.id,
  );
}

async function createPersonB(): Promise<{ person: Person; cookie: string }> {
  return createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
}

test('PUT marks the document as favorite, lists it and reports isFavorite true', async () => {
  const created = await createDocument(cookieA);

  const put = await putFavorite(cookieA, created.id);
  const list = await getFavorites(cookieA);
  const read = await getDocument(cookieA, created.id);

  expect(put.status).toBe(204);
  expect(put.body).toEqual({});
  expect(list.status).toBe(200);
  expect(list.body).toEqual({
    data: [
      {
        id: created.id,
        title: created.title,
        updatedAt: ANY_STRING,
        trashedAt: null,
      },
    ],
  });
  expect((read.body as { data: DocumentBody }).data.isFavorite).toBe(true);
});

test('a second PUT keeps a single row and the same createdAt', async () => {
  const created = await createDocument(cookieA);

  await putFavorite(cookieA, created.id);
  const first = await prisma.favorite.findFirstOrThrow({
    where: { personId: personA.id, documentId: created.id },
  });

  const second = await putFavorite(cookieA, created.id);
  const stored = await prisma.favorite.findFirstOrThrow({
    where: { personId: personA.id, documentId: created.id },
  });

  expect(second.status).toBe(204);
  expect(await prisma.favorite.count()).toBe(1);
  expect(stored.createdAt.toISOString()).toBe(first.createdAt.toISOString());
});

test('DELETE removes the favorite, empties the list and reports isFavorite false', async () => {
  const created = await createDocument(cookieA);
  await putFavorite(cookieA, created.id);

  const removed = await deleteFavorite(cookieA, created.id);
  const list = await getFavorites(cookieA);
  const read = await getDocument(cookieA, created.id);

  expect(removed.status).toBe(204);
  expect(removed.body).toEqual({});
  expect(list.body).toEqual({ data: [] });
  expect((read.body as { data: DocumentBody }).data.isFavorite).toBe(false);
  expect(await prisma.favorite.count()).toBe(0);
});

test('a second DELETE still answers 204', async () => {
  const created = await createDocument(cookieA);
  await putFavorite(cookieA, created.id);
  await deleteFavorite(cookieA, created.id);

  const second = await deleteFavorite(cookieA, created.id);

  expect(second.status).toBe(204);
  expect(await prisma.favorite.count()).toBe(0);
});

test('lists favorites from the most recently favorited to the oldest', async () => {
  const oldest = await createDocument(cookieA);
  const middle = await createDocument(cookieA);
  const newest = await createDocument(cookieA);

  await putFavorite(cookieA, oldest.id);
  await putFavorite(cookieA, middle.id);
  await putFavorite(cookieA, newest.id);

  await setFavoritedAt(
    personA.id,
    oldest.id,
    new Date('2026-01-01T10:00:00.000Z'),
  );
  await setFavoritedAt(
    personA.id,
    middle.id,
    new Date('2026-02-01T10:00:00.000Z'),
  );
  await setFavoritedAt(
    personA.id,
    newest.id,
    new Date('2026-03-01T10:00:00.000Z'),
  );

  const list = await getFavorites(cookieA);

  expect(list.status).toBe(200);
  expect(summaryIds(list)).toEqual([newest.id, middle.id, oldest.id]);
});

test('another person gets 404 on PUT and DELETE, identical to unknown and malformed ids, and no row changes', async () => {
  const foreign = await createDocument(cookieA);
  await putFavorite(cookieA, foreign.id);
  const { cookie } = await createPersonB();

  const before = await prisma.favorite.count();

  const putForeign = await putFavorite(cookie, foreign.id);
  const putUnknown = await putFavorite(cookie, randomUUID());
  const putMalformed = await putFavorite(cookie, MALFORMED_ID);
  const deleteForeign = await deleteFavorite(cookie, foreign.id);
  const deleteUnknown = await deleteFavorite(cookie, randomUUID());
  const deleteMalformed = await deleteFavorite(cookie, MALFORMED_ID);

  expect(putForeign.status).toBe(404);
  expect(putUnknown.status).toBe(404);
  expect(putMalformed.status).toBe(404);
  expect(deleteForeign.status).toBe(404);
  expect(deleteUnknown.status).toBe(404);
  expect(deleteMalformed.status).toBe(404);
  expect(putForeign.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(putUnknown.body).toEqual(putForeign.body);
  expect(putMalformed.body).toEqual(putForeign.body);
  expect(deleteForeign.body).toEqual(putForeign.body);
  expect(deleteUnknown.body).toEqual(putForeign.body);
  expect(deleteMalformed.body).toEqual(putForeign.body);
  expect(await prisma.favorite.count()).toBe(before);
});

test('the favorites list of another person is empty and their own favorite is independent', async () => {
  const documentA = await createDocument(cookieA);
  await putFavorite(cookieA, documentA.id);
  const { cookie } = await createPersonB();
  const documentB = await createDocument(cookie);

  const emptyList = await getFavorites(cookie);

  await putFavorite(cookie, documentB.id);
  await deleteFavorite(cookieA, documentA.id);

  const listB = await getFavorites(cookie);
  const readB = await getDocument(cookie, documentB.id);
  const listA = await getFavorites(cookieA);

  expect(emptyList.body).toEqual({ data: [] });
  expect(summaryIds(listB)).toEqual([documentB.id]);
  expect((readB.body as { data: DocumentBody }).data.isFavorite).toBe(true);
  expect(listA.body).toEqual({ data: [] });
});

test('losing read access hides the favorite, DELETE answers 404, the row stays and it reappears when access returns', async () => {
  const created = await createDocument(cookieA);
  await putFavorite(cookieA, created.id);
  const { person: personB } = await createPersonB();

  await prisma.document.update({
    where: { id: created.id },
    data: { ownerId: personB.id },
  });

  const hiddenList = await getFavorites(cookieA);
  const removal = await deleteFavorite(cookieA, created.id);
  const rowsWhileHidden = await prisma.favorite.count({
    where: { personId: personA.id, documentId: created.id },
  });

  await prisma.document.update({
    where: { id: created.id },
    data: { ownerId: personA.id },
  });

  const listAgain = await getFavorites(cookieA);

  expect(hiddenList.body).toEqual({ data: [] });
  expect(removal.status).toBe(404);
  expect(removal.body).toEqual({ message: NOT_FOUND_MESSAGE });
  expect(rowsWhileHidden).toBe(1);
  expect(summaryIds(listAgain)).toEqual([created.id]);
});

test('deleting the document deletes its favorites', async () => {
  const created = await createDocument(cookieA);
  await putFavorite(cookieA, created.id);

  await prisma.documentContent.deleteMany({
    where: { documentId: created.id },
  });
  await prisma.document.delete({ where: { id: created.id } });

  expect(
    await prisma.favorite.count({ where: { documentId: created.id } }),
  ).toBe(0);
});

test('deleting the person deletes their favorites', async () => {
  const created = await createDocument(cookieA);
  // Sem espaço pessoal e sem documentos: nada além do favorito segura a linha.
  const { person: personB } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
    withPersonalSpace: false,
  });

  // B não enxerga o documento de A: a linha entra direto no banco.
  await prisma.favorite.create({
    data: { personId: personB.id, documentId: created.id },
  });

  await prisma.person.delete({ where: { id: personB.id } });

  expect(await prisma.favorite.count({ where: { personId: personB.id } })).toBe(
    0,
  );
});

test('answers 403 without the X-Requested-With header', async () => {
  const created = await createDocument(cookieA);

  const put = await httpRequest(app)
    .put(`/api/documents/${created.id}/favorite`)
    .set('Cookie', cookieA)
    .send();
  const removal = await httpRequest(app)
    .delete(`/api/documents/${created.id}/favorite`)
    .set('Cookie', cookieA)
    .send();

  expect(put.status).toBe(403);
  expect(put.body).toEqual({ message: 'Requisição recusada.' });
  expect(removal.status).toBe(403);
  expect(removal.body).toEqual({ message: 'Requisição recusada.' });
  expect(await prisma.favorite.count()).toBe(0);
});

test('answers 401 without a session cookie', async () => {
  const created = await createDocument(cookieA);

  const put = await httpRequest(app)
    .put(`/api/documents/${created.id}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send();
  const removal = await httpRequest(app)
    .delete(`/api/documents/${created.id}/favorite`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send();
  const list = await httpRequest(app)
    .get('/api/documents?scope=favorites')
    .send();

  expect(put.status).toBe(401);
  expect(put.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(removal.status).toBe(401);
  expect(removal.body).toEqual({ message: 'Sessão não encontrada.' });
  expect(list.status).toBe(401);
  expect(await prisma.favorite.count()).toBe(0);
});

test('answers 400 with the scope error for an unknown scope', async () => {
  const response = await httpRequest(app)
    .get('/api/documents?scope=favoritos')
    .set('Cookie', cookieA)
    .send();

  expect(response.status).toBe(400);
  expect(response.body as ValidationErrorBody).toEqual({
    message: 'Dados inválidos.',
    errors: [{ field: 'scope', message: 'Informe um escopo válido.' }],
  });
});

test('a favorite reached only by inheritance is listed and disappears when inheritance ends', async () => {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: personA.organizationId, parentId: null },
  });
  const parent = await prisma.orgUnit.create({
    data: {
      organizationId: personA.organizationId,
      parentId: root.id,
      name: 'Secretaria',
    },
  });
  await prisma.space.create({ data: { type: 'UNIT', orgUnitId: parent.id } });
  const child = await prisma.orgUnit.create({
    data: {
      organizationId: personA.organizationId,
      parentId: parent.id,
      name: 'Protocolo',
    },
  });
  const childSpace = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: child.id, inheritsParent: true },
  });
  const { person: heir, cookie: heirCookie } = await createPersonB();
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId: child.id, personId: personA.id },
  });
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId: parent.id, personId: heir.id },
  });
  const created = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ spaceId: childSpace.id });
  const documentId = (created.body as { data: DocumentBody }).data.id;

  const put = await putFavorite(heirCookie, documentId);
  const listed = await getFavorites(heirCookie);
  await prisma.space.update({
    where: { id: childSpace.id },
    data: { inheritsParent: false },
  });
  const afterInheritance = await getFavorites(heirCookie);

  expect(created.status).toBe(201);
  expect(put.status).toBe(204);
  expect(summaryIds(listed)).toEqual([documentId]);
  expect(afterInheritance.status).toBe(200);
  expect(summaryIds(afterInheritance)).toEqual([]);
  expect(
    await prisma.favorite.count({
      where: { documentId, personId: heir.id },
    }),
  ).toBe(1);
});
