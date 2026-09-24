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

/** Dá à pessoa acesso de leitura ao documento, direto pelo Prisma. */
async function shareView(documentId: string, person: Person): Promise<void> {
  await prisma.documentShare.create({
    data: { documentId, personId: person.id, level: 'VIEW' },
  });
}

/** Pessoa da organização sem nenhuma relação com o documento. */
async function createViewer(): Promise<Person> {
  const { person } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  return person;
}

test('resolveAccess returns view for a person with a view share', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');
  const viewer = await createViewer();
  await shareView(documentId, viewer);

  expect(await access.resolveAccess(viewer.id, documentId)).toBe('view');
});

test('canWrite is false for a view share', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');
  const viewer = await createViewer();
  await shareView(documentId, viewer);

  expect(await access.canWrite(viewer.id, documentId)).toBe(false);
});

test('resolveAccess returns none without a share', async () => {
  const owner = await install();
  const sharedId = await createDocument(owner, 'Documento compartilhado');
  const notSharedId = await createDocument(owner, 'Documento não compartilhado');
  const viewer = await createViewer();
  await shareView(sharedId, viewer);

  expect(await access.resolveAccess(viewer.id, notSharedId)).toBe('none');
});

test('a shared document in the trash is none and view again after restore', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');
  const viewer = await createViewer();
  await shareView(documentId, viewer);

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });
  const inTrash = await access.resolveAccess(viewer.id, documentId);

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: null },
  });
  const restored = await access.resolveAccess(viewer.id, documentId);

  expect(inTrash).toBe('none');
  expect(restored).toBe('view');
});

test('readableDocumentsWhere includes the shared document and excludes it in the trash', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');
  await createDocument(owner, 'Documento não compartilhado');
  const viewer = await createViewer();
  await shareView(documentId, viewer);

  const beforeTrash = await prisma.document.findMany({
    where: access.readableDocumentsWhere(viewer.id),
    select: { id: true },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });

  const afterTrash = await prisma.document.findMany({
    where: access.readableDocumentsWhere(viewer.id),
    select: { id: true },
  });

  expect(beforeTrash).toEqual([{ id: documentId }]);
  expect(afterTrash).toEqual([]);
});

test('deleting the share row makes the next resolveAccess none', async () => {
  const owner = await install();
  const documentId = await createDocument(owner, 'Documento da Maria');
  const viewer = await createViewer();
  await shareView(documentId, viewer);

  expect(await access.resolveAccess(viewer.id, documentId)).toBe('view');

  await prisma.documentShare.delete({
    where: {
      documentId_personId: { documentId, personId: viewer.id },
    },
  });

  expect(await access.resolveAccess(viewer.id, documentId)).toBe('none');
});

type UnitWithSpace = { orgUnitId: string; spaceId: string };

/** Cria uma unidade sob a raiz (ou sob `parentId`) com o espaço `UNIT` dela. */
async function createUnitSpace(
  organizationId: string,
  name: string,
  options: { parentId?: string; inheritsParent?: boolean } = {},
): Promise<UnitWithSpace> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId, parentId: null },
  });
  const unit = await prisma.orgUnit.create({
    data: { organizationId, parentId: options.parentId ?? root.id, name },
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
async function assign(orgUnitId: string, person: Person): Promise<void> {
  await prisma.orgUnitAssignment.create({
    data: { orgUnitId, personId: person.id },
  });
}

/** Documento da dona gravado no espaço informado, pelo Prisma. */
async function createDocumentIn(
  spaceId: string,
  owner: Person,
  title: string,
): Promise<string> {
  const document = await prisma.document.create({
    data: { title, spaceId, authorId: owner.id, ownerId: owner.id },
  });

  return document.id;
}

type UnitScenario = {
  owner: Person;
  member: Person;
  unit: UnitWithSpace;
  documentId: string;
};

/** Dona e colega lotadas na mesma unidade, com um documento da dona no espaço dela. */
async function createUnitScenario(): Promise<UnitScenario> {
  const owner = await install();
  const unit = await createUnitSpace(owner.organizationId, 'Protocolo');
  const member = await createViewer();
  await assign(unit.orgUnitId, owner);
  await assign(unit.orgUnitId, member);
  const documentId = await createDocumentIn(
    unit.spaceId,
    owner,
    'Regulamento do protocolo',
  );

  return { owner, member, unit, documentId };
}

test('resolveAccess returns edit for a direct member of the unit space', async () => {
  const { member, documentId } = await createUnitScenario();

  expect(await access.resolveAccess(member.id, documentId)).toBe('edit');
});

test('canWrite is true for a direct unit member', async () => {
  const { member, documentId } = await createUnitScenario();

  expect(await access.canWrite(member.id, documentId)).toBe(true);
});

test('removing the assignment makes the next resolveAccess none', async () => {
  const { member, unit, documentId } = await createUnitScenario();

  const before = await access.resolveAccess(member.id, documentId);

  await prisma.orgUnitAssignment.delete({
    where: {
      orgUnitId_personId: { orgUnitId: unit.orgUnitId, personId: member.id },
    },
  });

  expect(before).toBe('edit');
  expect(await access.resolveAccess(member.id, documentId)).toBe('none');
});

test('a person assigned only to the parent unit gets none on an inheriting child space', async () => {
  const owner = await install();
  const parent = await createUnitSpace(owner.organizationId, 'Secretaria');
  const child = await createUnitSpace(owner.organizationId, 'Protocolo', {
    parentId: parent.orgUnitId,
    inheritsParent: true,
  });
  const parentMember = await createViewer();
  await assign(parent.orgUnitId, parentMember);
  const documentId = await createDocumentIn(
    child.spaceId,
    owner,
    'Regulamento do protocolo',
  );

  const childSpace = await prisma.space.findUniqueOrThrow({
    where: { id: child.spaceId },
  });

  expect(childSpace.inheritsParent).toBe(true);
  expect(await access.resolveAccess(parentMember.id, documentId)).toBe('none');
});

test('a trashed unit space document is none for the member and owner for the owner, edit again after restore', async () => {
  const { owner, member, documentId } = await createUnitScenario();

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });
  const memberInTrash = await access.resolveAccess(member.id, documentId);
  const ownerInTrash = await access.resolveAccess(owner.id, documentId);

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: null },
  });
  const memberRestored = await access.resolveAccess(member.id, documentId);

  expect(memberInTrash).toBe('none');
  expect(ownerInTrash).toBe('owner');
  expect(memberRestored).toBe('edit');
});

test('the owner removed from the unit still gets owner', async () => {
  const { owner, unit, documentId } = await createUnitScenario();

  await prisma.orgUnitAssignment.delete({
    where: {
      orgUnitId_personId: { orgUnitId: unit.orgUnitId, personId: owner.id },
    },
  });

  expect(await access.resolveAccess(owner.id, documentId)).toBe('owner');
});

test('a view share plus unit membership resolves to edit', async () => {
  const { member, documentId } = await createUnitScenario();
  await shareView(documentId, member);

  expect(await access.resolveAccess(member.id, documentId)).toBe('edit');
  expect(await access.canWrite(member.id, documentId)).toBe(true);
});

test('readableDocumentsWhere includes the unit space document and excludes it in the trash', async () => {
  const { owner, member, documentId } = await createUnitScenario();
  await createDocument(owner, 'Documento pessoal da Maria');

  const beforeTrash = await prisma.document.findMany({
    where: access.readableDocumentsWhere(member.id),
    select: { id: true },
  });

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });

  const afterTrash = await prisma.document.findMany({
    where: access.readableDocumentsWhere(member.id),
    select: { id: true },
  });

  expect(beforeTrash).toEqual([{ id: documentId }]);
  expect(afterTrash).toEqual([]);
});

type FreeScenario = {
  spaceOwner: Person;
  member: Person;
  spaceId: string;
  documentId: string;
};

/** Espaço livre da pessoa, gravado direto pelo Prisma. */
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
async function addFreeMember(spaceId: string, person: Person): Promise<void> {
  await prisma.spaceMember.create({ data: { spaceId, personId: person.id } });
}

/** Dona do espaço livre e um membro, com um documento da dona no espaço. */
async function createFreeScenario(): Promise<FreeScenario> {
  const spaceOwner = await install();
  const spaceId = await createFreeSpace(spaceOwner);
  const member = await createViewer();
  await addFreeMember(spaceId, member);
  const documentId = await createDocumentIn(
    spaceId,
    spaceOwner,
    'Plano do projeto',
  );

  return { spaceOwner, member, spaceId, documentId };
}

test('resolveAccess returns edit for a member of the free space', async () => {
  const { member, documentId } = await createFreeScenario();

  expect(await access.resolveAccess(member.id, documentId)).toBe('edit');
});

test('canWrite is true for a member of the free space', async () => {
  const { member, documentId } = await createFreeScenario();

  expect(await access.canWrite(member.id, documentId)).toBe(true);
});

test('the free space owner gets edit on a document created by a member', async () => {
  const { spaceOwner, member, spaceId } = await createFreeScenario();
  const memberDocumentId = await createDocumentIn(
    spaceId,
    member,
    'Rascunho do João',
  );

  expect(await access.resolveAccess(spaceOwner.id, memberDocumentId)).toBe(
    'edit',
  );
  expect(await access.canWrite(spaceOwner.id, memberDocumentId)).toBe(true);
});

test('removing the member makes the next resolveAccess none and the member keeps owner on their own document', async () => {
  const { member, spaceId, documentId } = await createFreeScenario();
  const memberDocumentId = await createDocumentIn(
    spaceId,
    member,
    'Rascunho do João',
  );

  const before = await access.resolveAccess(member.id, documentId);

  await prisma.spaceMember.delete({
    where: { spaceId_personId: { spaceId, personId: member.id } },
  });

  expect(before).toBe('edit');
  expect(await access.resolveAccess(member.id, documentId)).toBe('none');
  expect(await access.resolveAccess(member.id, memberDocumentId)).toBe('owner');
});

test('a trashed free space document is none for the space owner and members and edit again after restore', async () => {
  const { spaceOwner, member, spaceId } = await createFreeScenario();
  const { person: author } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });
  await addFreeMember(spaceId, author);
  const documentId = await createDocumentIn(spaceId, author, 'Rascunho da Ana');

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });
  const ownerInTrash = await access.resolveAccess(spaceOwner.id, documentId);
  const memberInTrash = await access.resolveAccess(member.id, documentId);
  const authorInTrash = await access.resolveAccess(author.id, documentId);

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: null },
  });
  const ownerRestored = await access.resolveAccess(spaceOwner.id, documentId);
  const memberRestored = await access.resolveAccess(member.id, documentId);

  expect(ownerInTrash).toBe('none');
  expect(memberInTrash).toBe('none');
  expect(authorInTrash).toBe('owner');
  expect(ownerRestored).toBe('edit');
  expect(memberRestored).toBe('edit');
});

test('a view share to a non member of the free space resolves to view', async () => {
  const { documentId } = await createFreeScenario();
  const { person: outsider } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });
  await shareView(documentId, outsider);

  expect(await access.resolveAccess(outsider.id, documentId)).toBe('view');
  expect(await access.canWrite(outsider.id, documentId)).toBe(false);
});

test('readableDocumentsWhere includes the free space document for owner and member and excludes it in the trash and for a third person', async () => {
  const { spaceOwner, member, documentId } = await createFreeScenario();
  const { person: third } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });

  const readableBy = (person: Person): Promise<{ id: string }[]> =>
    prisma.document.findMany({
      where: access.readableDocumentsWhere(person.id),
      select: { id: true },
    });

  const ownerBefore = await readableBy(spaceOwner);
  const memberBefore = await readableBy(member);
  const thirdBefore = await readableBy(third);

  await prisma.document.update({
    where: { id: documentId },
    data: { trashedAt: new Date('2026-03-01T10:00:00.000Z') },
  });

  const ownerAfter = await readableBy(spaceOwner);
  const memberAfter = await readableBy(member);

  expect(ownerBefore).toEqual([{ id: documentId }]);
  expect(memberBefore).toEqual([{ id: documentId }]);
  expect(thirdBefore).toEqual([]);
  expect(ownerAfter).toEqual([]);
  expect(memberAfter).toEqual([]);
});

/** Grava o nível de leitura para o membro do espaço livre, pelo Prisma. */
async function demoteToView(spaceId: string, person: Person): Promise<void> {
  await prisma.spaceMember.update({
    where: { spaceId_personId: { spaceId, personId: person.id } },
    data: { level: 'VIEW' },
  });
}

test('resolveAccess returns view for a viewer member of the free space', async () => {
  const { member, spaceId, documentId } = await createFreeScenario();
  await demoteToView(spaceId, member);

  expect(await access.resolveAccess(member.id, documentId)).toBe('view');
});

test('canWrite is false for a viewer member of the free space', async () => {
  const { member, spaceId, documentId } = await createFreeScenario();
  await demoteToView(spaceId, member);

  expect(await access.canWrite(member.id, documentId)).toBe(false);
});

test('an edit share to a viewer member of the free space resolves to edit', async () => {
  const { member, spaceId, documentId } = await createFreeScenario();
  await demoteToView(spaceId, member);
  await prisma.documentShare.create({
    data: { documentId, personId: member.id, level: 'EDIT' },
  });

  expect(await access.resolveAccess(member.id, documentId)).toBe('edit');
  expect(await access.canWrite(member.id, documentId)).toBe(true);
});

test('a space member created without level is EDIT', async () => {
  const { member, spaceId } = await createFreeScenario();

  const row = await prisma.spaceMember.findUniqueOrThrow({
    where: { spaceId_personId: { spaceId, personId: member.id } },
    select: { level: true },
  });

  expect(row.level).toBe('EDIT');
});
