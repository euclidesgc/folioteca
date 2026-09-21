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

test('both gates agree for every person and document pair', async () => {
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
    await createDocument(other, 'Documento do João'),
  ];

  const people = [owner, other, admin];

  const pairs = await Promise.all(
    people.map(async (person) => {
      const readable = await prisma.document.findMany({
        where: access.readableDocumentsWhere(person.id),
        select: { id: true },
      });
      const readableIds = readable.map((document) => document.id);

      return Promise.all(
        documentIds.map(async (documentId) => ({
          personId: person.id,
          documentId,
          resolved: (await access.resolveAccess(person.id, documentId)) !== 'none',
          listed: readableIds.includes(documentId),
        })),
      );
    }),
  );

  const disagreements = pairs
    .flat()
    .filter((pair) => pair.resolved !== pair.listed);

  expect(disagreements).toEqual([]);
  expect(pairs.flat()).toHaveLength(6);
});
