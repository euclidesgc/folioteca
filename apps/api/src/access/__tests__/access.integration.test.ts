import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';
import { AccessService } from '../access.service';

let app: INestApplication;
let prisma: PrismaService;
let access: AccessService;

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
  access = app.get(AccessService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

/** Instala a instância e devolve a pessoa administradora criada por ela. */
async function install(): Promise<Person> {
  await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: 'Prefeitura de Exemplo',
      name: 'Maria Souza',
      email: 'maria@exemplo.org',
      password: randomUUID(),
    });

  return prisma.person.findFirstOrThrow({ where: { email: 'maria@exemplo.org' } });
}

/** Cria um documento no espaço pessoal da pessoa, direto pelo Prisma. */
async function createDocument(person: Person, title: string): Promise<string> {
  const space = await prisma.space.findFirstOrThrow({
    where: { personId: person.id },
  });

  const document = await prisma.document.create({
    data: {
      title,
      spaceId: space.id,
      authorId: person.id,
      ownerId: person.id,
    },
  });

  return document.id;
}

/** Cria um documento já na lixeira da pessoa, direto pelo Prisma. */
async function createTrashedDocument(
  person: Person,
  title: string,
): Promise<string> {
  const documentId = await createDocument(person, title);

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });

  return documentId;
}

test('resolveAccess returns owner for the person who owns the document', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');

  expect(await access.resolveAccess(owner.id, documentId)).toBe('owner');
});

test('resolveAccess returns none for another person', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');
  const { person: other } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  expect(await access.resolveAccess(other.id, documentId)).toBe('none');
});

test('resolveAccess returns none for an administrator who is not the owner', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');
  const { person: admin } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
    isAdmin: true,
  });

  expect(admin.isAdmin).toBe(true);
  expect(await access.resolveAccess(admin.id, documentId)).toBe('none');
});

test('resolveAccess returns none for a document that does not exist', async () => {
  const owner = await install();

  expect(await access.resolveAccess(owner.id, randomUUID())).toBe('none');
});

test('resolveAccess returns none for a malformed id without querying the database', async () => {
  const owner = await install();

  expect(await access.resolveAccess(owner.id, 'nao-e-uuid')).toBe('none');

  // Prisma espiado: qualquer toque em `document` fica registrado, então o
  // teste prova que a decisão saiu sem nenhuma consulta.
  const touches: string[] = [];
  const spiedPrisma = {
    document: new Proxy(
      {},
      {
        get(_target, property) {
          touches.push(String(property));

          return () => {
            throw new Error('O banco não devia ser consultado.');
          };
        },
      },
    ),
  } as unknown as PrismaService;

  const level = await new AccessService(spiedPrisma).resolveAccess(
    owner.id,
    'nao-e-uuid',
  );

  expect(level).toBe('none');
  expect(touches).toEqual([]);
});

test('readableDocumentsWhere lists only the documents of the person', async () => {
  const owner = await install();
  const mine = await createDocument(owner, 'Documento da Maria');
  const { person: other } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await createDocument(other, 'Documento do João');

  const readable = await prisma.document.findMany({
    where: access.readableDocumentsWhere(owner.id),
    select: { id: true },
  });

  expect(readable).toEqual([{ id: mine }]);
});

test('the owner of a trashed document still resolves to owner', async () => {
  const owner = await install();
  const documentId = await createTrashedDocument(owner, 'Documento na lixeira');

  expect(await access.resolveAccess(owner.id, documentId)).toBe('owner');
});

test('another person resolves to none for a trashed document', async () => {
  const owner = await install();
  const documentId = await createTrashedDocument(owner, 'Documento na lixeira');
  const { person: other } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  expect(await access.resolveAccess(other.id, documentId)).toBe('none');
});

test('canWrite is true outside the trash and false in the trash, for another person and for a malformed id', async () => {
  const owner = await install();
  const active = await createDocument(owner, 'Documento da Maria');
  const trashed = await createTrashedDocument(owner, 'Documento na lixeira');
  const { person: other } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  expect(await access.canWrite(owner.id, active)).toBe(true);
  expect(await access.canWrite(owner.id, trashed)).toBe(false);
  expect(await access.canWrite(other.id, active)).toBe(false);
  expect(await access.canWrite(owner.id, randomUUID())).toBe(false);
  expect(await access.canWrite(owner.id, 'nao-e-uuid')).toBe(false);
});

test('readableDocumentsWhere excludes trashed documents and trashedDocumentsWhere includes only the trashed documents of the owner', async () => {
  const owner = await install();
  const active = await createDocument(owner, 'Documento da Maria');
  const trashed = await createTrashedDocument(owner, 'Documento na lixeira');
  const { person: other } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await createTrashedDocument(other, 'Documento do João na lixeira');

  const readable = await prisma.document.findMany({
    where: access.readableDocumentsWhere(owner.id),
    select: { id: true },
  });
  const inTrash = await prisma.document.findMany({
    where: access.trashedDocumentsWhere(owner.id),
    select: { id: true },
  });

  expect(readable).toEqual([{ id: active }]);
  expect(inTrash).toEqual([{ id: trashed }]);
});

test('the doors agree: resolveAccess is not none exactly when the document is in the readable or in the trashed list, never in both', async () => {
  const owner = await install();
  const { person: other } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  const { person: admin } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
    isAdmin: true,
  });

  const documentIds = [
    await createDocument(owner, 'Documento da Maria'),
    await createTrashedDocument(owner, 'Documento da Maria na lixeira'),
    await createDocument(other, 'Documento do João'),
    await createTrashedDocument(other, 'Documento do João na lixeira'),
  ];

  const people = [owner, other, admin];

  const pairs = await Promise.all(
    people.map(async (person) => {
      const readable = await prisma.document.findMany({
        where: access.readableDocumentsWhere(person.id),
        select: { id: true },
      });
      const trashed = await prisma.document.findMany({
        where: access.trashedDocumentsWhere(person.id),
        select: { id: true },
      });
      const readableIds = readable.map((document) => document.id);
      const trashedIds = trashed.map((document) => document.id);

      return Promise.all(
        documentIds.map(async (documentId) => ({
          personId: person.id,
          documentId,
          resolved:
            (await access.resolveAccess(person.id, documentId)) !== 'none',
          readable: readableIds.includes(documentId),
          trashed: trashedIds.includes(documentId),
        })),
      );
    }),
  );

  const disagreements = pairs
    .flat()
    .filter((pair) => pair.resolved !== (pair.readable || pair.trashed));
  const inBothLists = pairs.flat().filter((pair) => pair.readable && pair.trashed);

  expect(disagreements).toEqual([]);
  expect(inBothLists).toEqual([]);
  expect(pairs.flat()).toHaveLength(12);
});
