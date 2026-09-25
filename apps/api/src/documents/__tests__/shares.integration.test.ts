import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import {
  BadRequestException,
  NotFoundException,
  type INestApplication,
} from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';
import * as Y from 'yjs';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../documents.service';
import { SharesService } from '../shares.service';
import { connectCollab, waitFor } from '../../../test/collab-client';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';

const VIEW_BODY = { level: 'view' };

let app: INestApplication;
let prisma: PrismaService;

/** Dona: nasce na instalação e entra pelo login. */
let owner: Person;
let ownerCookie: string;

/** Outra pessoa da organização, com sessão, alvo do compartilhamento. */
let other: Person;
let otherCookie: string;

/** Porta do app escutando, para o `/collab` do caso de quem edita. */
let port: number;

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);

  await app.listen(0);
  const address = (app.getHttpServer() as Server).address();

  if (address === null || typeof address === 'string') {
    throw new Error('O servidor não subiu numa porta.');
  }

  port = address.port;
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

  ownerCookie = sessionCookie.split(';')[0] ?? '';
  owner = await prisma.person.findFirstOrThrow({ where: { email: EMAIL } });

  const created = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  other = created.person;
  otherCookie = created.cookie;
});

/** Cria um documento pela API e devolve o id dele. */
async function createDocument(cookie: string): Promise<string> {
  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  return (response.body as { data: { id: string } }).data.id;
}

function putShare(
  documentId: string,
  personId: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .put(`/api/documents/${documentId}/shares/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body as object,
  );
}

function shareRows(documentId: string): Promise<number> {
  return prisma.documentShare.count({ where: { documentId } });
}

function messageOf(response: Response): unknown {
  return (response.body as { message: unknown }).message;
}

test('PUT share answers 200 and creates one row', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(documentId, other.id, VIEW_BODY, ownerCookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      personId: other.id,
      name: 'João Lima',
      email: 'joao@exemplo.org',
      level: 'view',
    },
  });
  expect(
    await prisma.documentShare.findMany({
      where: { documentId },
      select: { personId: true, level: true },
    }),
  ).toEqual([{ personId: other.id, level: 'VIEW' }]);
});

test('PUT share repeated answers 200 and keeps one row', async () => {
  const documentId = await createDocument(ownerCookie);

  const first = await putShare(documentId, other.id, VIEW_BODY, ownerCookie);
  const second = await putShare(documentId, other.id, VIEW_BODY, ownerCookie);

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);
  expect(await shareRows(documentId)).toBe(1);
});

test('PUT share with oneself answers 400 with Você já é o proprietário deste documento.', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(documentId, owner.id, VIEW_BODY, ownerCookie);

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe('Você já é o proprietário deste documento.');
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share with an unknown person answers 400 with Pessoa não encontrada nesta instância.', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(
    documentId,
    randomUUID(),
    VIEW_BODY,
    ownerCookie,
  );

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe('Pessoa não encontrada nesta instância.');
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share with a malformed person id answers 400', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(
    documentId,
    'nao-e-uuid',
    VIEW_BODY,
    ownerCookie,
  );

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe('Pessoa não encontrada nesta instância.');
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share on a document without access answers 404', async () => {
  const documentId = await createDocument(ownerCookie);
  const { person: third } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });

  const response = await putShare(documentId, third.id, VIEW_BODY, otherCookie);

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ message: 'Documento não encontrado.' });
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share by a view person answers 403 with Só o proprietário pode compartilhar este documento.', async () => {
  const documentId = await createDocument(ownerCookie);
  const { person: third } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });
  await putShare(documentId, other.id, VIEW_BODY, ownerCookie);

  const response = await putShare(documentId, third.id, VIEW_BODY, otherCookie);

  expect(response.status).toBe(403);
  expect(messageOf(response)).toBe(
    'Só o proprietário pode compartilhar este documento.',
  );
  expect(await shareRows(documentId)).toBe(1);
});

test('PUT share rejects an empty body with 400', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(documentId, other.id, {}, ownerCookie);

  expect(response.status).toBe(400);
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share rejects an uppercase level with 400', async () => {
  // DV1: `edit` em minúsculas passou a ser válido; `EDIT` continua fora do
  // `enum` do contrato.
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(
    documentId,
    other.id,
    { level: 'EDIT' },
    ownerCookie,
  );

  expect(response.status).toBe(400);
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share rejects extra fields with 400', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(
    documentId,
    other.id,
    { level: 'view', personId: other.id },
    ownerCookie,
  );

  expect(response.status).toBe(400);
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share on a trashed document answers 409', async () => {
  const documentId = await createDocument(ownerCookie);
  await httpRequest(app)
    .post(`/api/documents/${documentId}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', ownerCookie)
    .send();

  const response = await putShare(documentId, other.id, VIEW_BODY, ownerCookie);

  expect(response.status).toBe(409);
  expect(messageOf(response)).toBe(
    'Este documento está na lixeira. Restaure-o para editar.',
  );
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share answers 401 without session', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(documentId, other.id, VIEW_BODY);

  expect(response.status).toBe(401);
  expect(await shareRows(documentId)).toBe(0);
});

/**
 * A organização é única por instância (`Organization_singleton_check`), então
 * o escopo é provado no serviço real, contra o mesmo Postgres, com um
 * `organizationId` que não é o da pessoa existente.
 */
test('share with another organization id answers 400', async () => {
  const documentId = await createDocument(ownerCookie);
  const requester = await prisma.person.findFirstOrThrow({
    where: { id: owner.id },
    include: { organization: true },
  });

  const error: unknown = await app
    .get(SharesService)
    .share(
      { ...requester, organizationId: randomUUID() },
      documentId,
      other.id,
      VIEW_BODY,
    )
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).message).toBe(
    'Pessoa não encontrada nesta instância.',
  );
  expect(await shareRows(documentId)).toBe(0);
});

type AccessEntry = {
  personId: string;
  name: string;
  email: string;
  level: string;
  isCurrentPerson: boolean;
};

function getShares(documentId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .get(`/api/documents/${documentId}/shares`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

function entriesOf(response: Response): AccessEntry[] {
  return (response.body as { data: AccessEntry[] }).data;
}

test('GET shares lists the owner first and people in pt-BR order', async () => {
  const documentId = await createDocument(ownerCookie);
  const { person: bruno } = await createPersonWithSession(app, {
    name: 'Bruno',
    email: 'bruno@exemplo.org',
  });
  const { person: alvaro } = await createPersonWithSession(app, {
    name: 'Álvaro',
    email: 'alvaro@exemplo.org',
  });
  await putShare(documentId, bruno.id, VIEW_BODY, ownerCookie);
  await putShare(documentId, alvaro.id, VIEW_BODY, ownerCookie);

  const response = await getShares(documentId, ownerCookie);

  expect(response.status).toBe(200);
  expect(entriesOf(response)).toEqual([
    {
      personId: owner.id,
      name: 'Maria Souza',
      email: EMAIL,
      level: 'owner',
      isCurrentPerson: true,
    },
    {
      personId: alvaro.id,
      name: 'Álvaro',
      email: 'alvaro@exemplo.org',
      level: 'view',
      isCurrentPerson: false,
    },
    {
      personId: bruno.id,
      name: 'Bruno',
      email: 'bruno@exemplo.org',
      level: 'view',
      isCurrentPerson: false,
    },
  ]);
});

test('GET shares breaks name ties by email', async () => {
  const documentId = await createDocument(ownerCookie);
  const { person: byB } = await createPersonWithSession(app, {
    name: 'Carla Dias',
    email: 'b.carla@exemplo.org',
  });
  const { person: byA } = await createPersonWithSession(app, {
    name: 'Carla Dias',
    email: 'a.carla@exemplo.org',
  });
  await putShare(documentId, byB.id, VIEW_BODY, ownerCookie);
  await putShare(documentId, byA.id, VIEW_BODY, ownerCookie);

  const response = await getShares(documentId, ownerCookie);

  expect(response.status).toBe(200);
  expect(entriesOf(response).map((entry) => entry.personId)).toEqual([
    owner.id,
    byA.id,
    byB.id,
  ]);
});

test('GET shares includes a person right after sharing', async () => {
  const documentId = await createDocument(ownerCookie);

  const shared = await putShare(documentId, other.id, VIEW_BODY, ownerCookie);
  const response = await getShares(documentId, ownerCookie);

  expect(shared.status).toBe(200);
  expect(response.status).toBe(200);
  expect(
    entriesOf(response).filter((entry) => entry.personId === other.id),
  ).toHaveLength(1);
});

test('GET shares on a document without access answers the same 404 as a missing one', async () => {
  const documentId = await createDocument(ownerCookie);

  const withoutAccess = await getShares(documentId, otherCookie);
  const missing = await getShares(randomUUID(), otherCookie);

  expect(withoutAccess.status).toBe(404);
  expect(missing.status).toBe(404);
  expect(withoutAccess.body).toEqual(missing.body);
});

test('GET shares by a view person answers 403 with Só o proprietário pode ver quem tem acesso a este documento.', async () => {
  const documentId = await createDocument(ownerCookie);
  await putShare(documentId, other.id, VIEW_BODY, ownerCookie);

  const response = await getShares(documentId, otherCookie);

  expect(response.status).toBe(403);
  expect(messageOf(response)).toBe(
    'Só o proprietário pode ver quem tem acesso a este documento.',
  );
});

test('GET shares on a trashed document answers 200 to the owner', async () => {
  const documentId = await createDocument(ownerCookie);
  await putShare(documentId, other.id, VIEW_BODY, ownerCookie);
  await httpRequest(app)
    .post(`/api/documents/${documentId}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', ownerCookie)
    .send();

  const response = await getShares(documentId, ownerCookie);

  expect(response.status).toBe(200);
  expect(entriesOf(response).map((entry) => entry.personId)).toEqual([
    owner.id,
    other.id,
  ]);
});

test('GET shares answers 401 without session', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await getShares(documentId);

  expect(response.status).toBe(401);
});

/**
 * Mesmo motivo do teste de `share` acima: a organização é única por
 * instância, então o escopo é provado no serviço real com um
 * `organizationId` aleatório.
 */
test('list with another organization id does not leak shares', async () => {
  const documentId = await createDocument(ownerCookie);
  const otherDocumentId = await createDocument(ownerCookie);
  const { person: third } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });
  await putShare(documentId, other.id, VIEW_BODY, ownerCookie);
  await putShare(otherDocumentId, third.id, VIEW_BODY, ownerCookie);
  const requester = await prisma.person.findFirstOrThrow({
    where: { id: owner.id },
    include: { organization: true },
  });
  const documentPeople = [
    owner.id,
    ...(
      await prisma.documentShare.findMany({
        where: { documentId },
        select: { personId: true },
      })
    ).map((share) => share.personId),
  ];

  const result = await app
    .get(SharesService)
    .list({ ...requester, organizationId: randomUUID() }, documentId);

  const personIds = result.data.map((entry) => entry.personId);
  expect(personIds).toEqual([owner.id, other.id]);
  expect(personIds.every((id) => documentPeople.includes(id))).toBe(true);
  expect(personIds).not.toContain(third.id);
});

const EDIT_BODY = { level: 'edit' };

const LEVEL_MESSAGE = 'Escolha o nível de acesso.';

/** Mensagens de cada campo no 400 de validação do corpo. */
function fieldMessagesOf(response: Response): unknown {
  return (
    response.body as { errors?: { field: string; message: string }[] }
  ).errors?.map((error) => error.message);
}

function getDocument(documentId: string, cookie: string): Promise<Response> {
  return httpRequest(app)
    .get(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie);
}

function patchTitle(
  documentId: string,
  title: string,
  cookie: string,
): Promise<Response> {
  return httpRequest(app)
    .patch(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send({ title });
}

function postAction(
  documentId: string,
  action: 'trash' | 'restore',
  cookie: string,
): Promise<Response> {
  return httpRequest(app)
    .post(`/api/documents/${documentId}/${action}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function deleteDocument(documentId: string, cookie: string): Promise<Response> {
  return httpRequest(app)
    .delete(`/api/documents/${documentId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();
}

function accessLevelOf(response: Response): unknown {
  return (response.body as { data: { accessLevel: unknown } }).data
    .accessLevel;
}

/**
 * A organização é única por instância (`Organization_singleton_check`): o
 * documento "de outra organização" é criado pelo `DocumentsService` real com
 * um `organizationId` de `randomUUID()`, para uma pessoa que não é quem pede
 * o compartilhamento. Nenhuma restrição do banco é tocada.
 */
async function createForeignDocument(): Promise<string> {
  const { person: foreigner } = await createPersonWithSession(app, {
    name: 'Rita Moura',
    email: 'rita@exemplo.org',
  });
  const foreignRequester = await prisma.person.findFirstOrThrow({
    where: { id: foreigner.id },
    include: { organization: true },
  });

  const document = await app
    .get(DocumentsService)
    .create({ ...foreignRequester, organizationId: randomUUID() }, {});

  return document.id;
}

/** Espaço livre da dona com João como membro no nível informado. */
async function createFreeSpaceDocument(
  memberLevel: 'VIEW' | 'EDIT',
): Promise<string> {
  const space = await prisma.space.create({
    data: {
      type: 'FREE',
      organizationId: owner.organizationId,
      name: 'Projeto Alfa',
      ownerId: owner.id,
    },
  });
  await prisma.spaceMember.create({
    data: { spaceId: space.id, personId: other.id, level: memberLevel },
  });

  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', ownerCookie)
    .send({ spaceId: space.id });

  return (response.body as { data: { id: string } }).data.id;
}

test('PUT share with level edit stores EDIT and the list shows edit', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(documentId, other.id, EDIT_BODY, ownerCookie);
  const list = await getShares(documentId, ownerCookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      personId: other.id,
      name: 'João Lima',
      email: 'joao@exemplo.org',
      level: 'edit',
    },
  });
  expect(
    await prisma.documentShare.findMany({
      where: { documentId },
      select: { personId: true, level: true },
    }),
  ).toEqual([{ personId: other.id, level: 'EDIT' }]);
  expect(
    entriesOf(list)
      .filter((entry) => entry.personId === other.id)
      .map((entry) => entry.level),
  ).toEqual(['edit']);
});

test('sharing again switches edit to view and back to edit on the same row', async () => {
  const documentId = await createDocument(ownerCookie);

  const asEdit = await putShare(documentId, other.id, EDIT_BODY, ownerCookie);
  const asView = await putShare(documentId, other.id, VIEW_BODY, ownerCookie);
  const storedAsView = await prisma.documentShare.findFirstOrThrow({
    where: { documentId, personId: other.id },
  });
  const backToEdit = await putShare(
    documentId,
    other.id,
    EDIT_BODY,
    ownerCookie,
  );

  expect(asEdit.status).toBe(200);
  expect(asView.status).toBe(200);
  expect((asView.body as { data: { level: string } }).data.level).toBe('view');
  expect(storedAsView.level).toBe('VIEW');
  expect(backToEdit.status).toBe(200);
  expect((backToEdit.body as { data: { level: string } }).data.level).toBe(
    'edit',
  );
  expect(
    await prisma.documentShare.count({
      where: { documentId, personId: other.id },
    }),
  ).toBe(1);
  expect(
    (
      await prisma.documentShare.findFirstOrThrow({
        where: { documentId, personId: other.id },
      })
    ).level,
  ).toBe('EDIT');
});

test('sharing again with the same level answers 200 without changes', async () => {
  const documentId = await createDocument(ownerCookie);

  const first = await putShare(documentId, other.id, EDIT_BODY, ownerCookie);
  const before = await prisma.documentShare.findFirstOrThrow({
    where: { documentId, personId: other.id },
  });
  const second = await putShare(documentId, other.id, EDIT_BODY, ownerCookie);
  const after = await prisma.documentShare.findFirstOrThrow({
    where: { documentId, personId: other.id },
  });

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual(first.body);
  expect(after).toEqual(before);
  expect(await shareRows(documentId)).toBe(1);
});

test('PUT share with level owner answers 400 after 404 and 403 checks', async () => {
  const OWNER_BODY = { level: 'owner' };
  const foreignDocumentId = await createForeignDocument();
  const documentId = await createDocument(ownerCookie);
  const { person: third } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });
  await putShare(documentId, other.id, EDIT_BODY, ownerCookie);

  const foreign = await putShare(
    foreignDocumentId,
    third.id,
    OWNER_BODY,
    ownerCookie,
  );
  const notOwner = await putShare(documentId, third.id, OWNER_BODY, otherCookie);
  const byOwner = await putShare(documentId, third.id, OWNER_BODY, ownerCookie);

  expect(foreign.status).toBe(404);
  expect(foreign.body).toEqual({ message: 'Documento não encontrado.' });
  expect(notOwner.status).toBe(403);
  expect(messageOf(notOwner)).toBe(
    'Só o proprietário pode compartilhar este documento.',
  );
  expect(byOwner.status).toBe(400);
  expect(fieldMessagesOf(byOwner)).toEqual([LEVEL_MESSAGE]);
  expect(await shareRows(foreignDocumentId)).toBe(0);
  expect(await shareRows(documentId)).toBe(1);
});

test('PUT share without level answers 400 with Escolha o nível de acesso.', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(documentId, other.id, {}, ownerCookie);

  expect(response.status).toBe(400);
  expect(fieldMessagesOf(response)).toEqual([LEVEL_MESSAGE]);
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share with a person from another organization answers 400 and stores nothing', async () => {
  const documentId = await createDocument(ownerCookie);
  const requester = await prisma.person.findFirstOrThrow({
    where: { id: owner.id },
    include: { organization: true },
  });

  const byHttp = await putShare(
    documentId,
    randomUUID(),
    EDIT_BODY,
    ownerCookie,
  );
  const error: unknown = await app
    .get(SharesService)
    .share(
      { ...requester, organizationId: randomUUID() },
      documentId,
      other.id,
      EDIT_BODY,
    )
    .catch((reason: unknown) => reason);

  expect(byHttp.status).toBe(400);
  expect(messageOf(byHttp)).toBe('Pessoa não encontrada nesta instância.');
  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).getStatus()).toBe(400);
  expect((error as BadRequestException).message).toBe(
    'Pessoa não encontrada nesta instância.',
  );
  expect(await shareRows(documentId)).toBe(0);
});

test('PUT share on a document of another organization answers 404', async () => {
  const foreignDocumentId = await createForeignDocument();
  const requester = await prisma.person.findFirstOrThrow({
    where: { id: owner.id },
    include: { organization: true },
  });

  const byHttp = await putShare(
    foreignDocumentId,
    other.id,
    EDIT_BODY,
    ownerCookie,
  );
  const error: unknown = await app
    .get(SharesService)
    .share(
      { ...requester, organizationId: randomUUID() },
      foreignDocumentId,
      other.id,
      EDIT_BODY,
    )
    .catch((reason: unknown) => reason);

  expect(byHttp.status).toBe(404);
  expect(byHttp.body).toEqual({ message: 'Documento não encontrado.' });
  expect(error).toBeInstanceOf(NotFoundException);
  expect(await shareRows(foreignDocumentId)).toBe(0);
});

test('an editor share can PATCH the title and the content', async () => {
  const documentId = await createDocument(ownerCookie);
  await putShare(documentId, other.id, EDIT_BODY, ownerCookie);

  const renamed = await patchTitle(documentId, 'Plano de obras', otherCookie);

  const connection = connectCollab({
    port,
    documentId,
    cookie: otherCookie,
    origin: `http://127.0.0.1:${port}`,
  });

  try {
    await connection.synced;

    expect(connection.provider.authorizedScope).not.toBe('readonly');

    connection.ydoc.getText('conteudo').insert(0, 'Texto do editor');

    await waitFor(
      () => connection.statelessPayloads.includes('{"type":"stored"}'),
      { message: 'A gravação de quem edita não foi confirmada' },
    );
  } finally {
    await connection.close();
  }

  const content = await prisma.documentContent.findFirstOrThrow({
    where: { documentId },
  });
  const stored = new Y.Doc();
  Y.applyUpdate(stored, new Uint8Array(content.state));

  expect(renamed.status).toBe(200);
  expect((renamed.body as { data: { title: string } }).data.title).toBe(
    'Plano de obras',
  );
  expect(accessLevelOf(renamed)).toBe('edit');
  expect(stored.getText('conteudo').toJSON()).toBe('Texto do editor');

  stored.destroy();
});

test('an editor share cannot share the document and gets 403', async () => {
  const documentId = await createDocument(ownerCookie);
  const { person: third } = await createPersonWithSession(app, {
    name: 'Ana Ramos',
    email: 'ana@exemplo.org',
  });
  await putShare(documentId, other.id, EDIT_BODY, ownerCookie);

  const response = await putShare(documentId, third.id, EDIT_BODY, otherCookie);

  expect(response.status).toBe(403);
  expect(messageOf(response)).toBe(
    'Só o proprietário pode compartilhar este documento.',
  );
  expect(await shareRows(documentId)).toBe(1);
});

test('an editor share cannot list the shares and gets 403', async () => {
  const documentId = await createDocument(ownerCookie);
  await putShare(documentId, other.id, EDIT_BODY, ownerCookie);

  const response = await getShares(documentId, otherCookie);

  expect(response.status).toBe(403);
  expect(messageOf(response)).toBe(
    'Só o proprietário pode ver quem tem acesso a este documento.',
  );
});

test('an editor share cannot trash or delete the document and gets 403', async () => {
  const documentId = await createDocument(ownerCookie);
  await putShare(documentId, other.id, EDIT_BODY, ownerCookie);

  const trashed = await postAction(documentId, 'trash', otherCookie);
  const deleted = await deleteDocument(documentId, otherCookie);

  expect(trashed.status).toBe(403);
  expect(deleted.status).toBe(403);
  expect(
    await prisma.document.findFirst({
      where: { id: documentId },
      select: { trashedAt: true },
    }),
  ).toEqual({ trashedAt: null });
});

test('a trashed document answers 404 to an editor share and restoring gives edit back', async () => {
  const documentId = await createDocument(ownerCookie);
  await putShare(documentId, other.id, EDIT_BODY, ownerCookie);

  const trashed = await postAction(documentId, 'trash', ownerCookie);
  const whileTrashed = await getDocument(documentId, otherCookie);
  const restored = await postAction(documentId, 'restore', ownerCookie);
  const renamed = await patchTitle(documentId, 'De volta', otherCookie);

  expect(trashed.status).toBe(200);
  expect(whileTrashed.status).toBe(404);
  expect(whileTrashed.body).toEqual({ message: 'Documento não encontrado.' });
  expect(restored.status).toBe(200);
  expect(renamed.status).toBe(200);
  expect(accessLevelOf(renamed)).toBe('edit');
});

test('an edit share with a view space membership resolves to edit', async () => {
  const documentId = await createFreeSpaceDocument('VIEW');
  await putShare(documentId, other.id, EDIT_BODY, ownerCookie);

  const read = await getDocument(documentId, otherCookie);
  const renamed = await patchTitle(documentId, 'Plano do projeto', otherCookie);

  expect(read.status).toBe(200);
  expect(accessLevelOf(read)).toBe('edit');
  expect(renamed.status).toBe(200);
});

test('a view share with an edit space membership resolves to edit', async () => {
  const documentId = await createFreeSpaceDocument('EDIT');
  await putShare(documentId, other.id, VIEW_BODY, ownerCookie);

  const read = await getDocument(documentId, otherCookie);
  const renamed = await patchTitle(documentId, 'Plano do projeto', otherCookie);

  expect(read.status).toBe(200);
  expect(accessLevelOf(read)).toBe('edit');
  expect(renamed.status).toBe(200);
});

test('a view share still gets 403 on PATCH', async () => {
  const documentId = await createDocument(ownerCookie);
  await putShare(documentId, other.id, VIEW_BODY, ownerCookie);

  const read = await getDocument(documentId, otherCookie);
  const renamed = await patchTitle(documentId, 'Rascunho', otherCookie);

  expect(accessLevelOf(read)).toBe('view');
  expect(renamed.status).toBe(403);
  expect(
    (
      await prisma.document.findFirstOrThrow({
        where: { id: documentId },
        select: { title: true },
      })
    ).title,
  ).not.toBe('Rascunho');
});
