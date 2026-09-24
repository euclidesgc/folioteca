import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { BadRequestException, type INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from '../shares.service';
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

test('PUT share rejects level edit with 400', async () => {
  const documentId = await createDocument(ownerCookie);

  const response = await putShare(
    documentId,
    other.id,
    { level: 'edit' },
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
