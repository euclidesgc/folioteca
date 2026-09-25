import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as Y from 'yjs';

import { AccessService } from '../../access/access.service';
import { AppModule } from '../../app.module';
import { env } from '../../config/env';
import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import {
  connectCollab,
  rawUpgrade,
  settlesWithin,
  waitFor,
  type CollabConnection,
} from '../../../test/collab-client';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';

const EMAIL = 'maria@exemplo.org';
const MALFORMED_ID = 'nao-e-uuid';
const STORED_MESSAGE = '{"type":"stored"}';
const TEXT_NAME = 'conteudo';

let app: INestApplication;
let prisma: PrismaService;
let port: number;
let origin: string;
let cookieA: string;

/** Conexões abertas no teste corrente, fechadas no `afterEach`. */
let connections: CollabConnection[] = [];

function portOf(target: INestApplication): number {
  const address = (target.getHttpServer() as Server).address();

  if (address === null || typeof address === 'string') {
    throw new Error('O servidor não subiu numa porta.');
  }

  return address.port;
}

/** App extra já escutando numa porta livre, para os casos com outro módulo. */
async function startApp(
  overrides?: Parameters<typeof createApp>[0],
): Promise<INestApplication> {
  const extra = await createApp(overrides);
  await extra.listen(0);

  return extra;
}

function open(options: {
  documentId: string;
  cookie?: string;
  origin?: string;
  port?: number;
}): CollabConnection {
  const connection = connectCollab({
    port: options.port ?? port,
    documentId: options.documentId,
    cookie: options.cookie,
    origin: options.origin ?? origin,
  });

  connections.push(connection);

  return connection;
}

function writeText(ydoc: Y.Doc, text: string): void {
  const fragment = ydoc.getText(TEXT_NAME);

  fragment.insert(fragment.length, text);
}

function readText(ydoc: Y.Doc): string {
  return ydoc.getText(TEXT_NAME).toJSON();
}

/** Texto do estado guardado no banco, ou `''` quando não há linha. */
async function storedText(documentId: string): Promise<string> {
  const content = await prisma.documentContent.findFirst({
    where: { documentId },
  });

  if (content === null) {
    return '';
  }

  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, new Uint8Array(content.state));

  const text = readText(ydoc);
  ydoc.destroy();

  return text;
}

function hasContentRow(documentId: string): Promise<boolean> {
  return prisma.documentContent
    .count({ where: { documentId } })
    .then((total) => total > 0);
}

async function createDocument(cookie: string): Promise<{
  id: string;
  updatedAt: string;
}> {
  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send();

  return (response.body as { data: { id: string; updatedAt: string } }).data;
}

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);

  await app.listen(0);
  port = portOf(app);
  origin = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  connections = [];

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
});

afterEach(async () => {
  await Promise.all(connections.map((connection) => connection.close()));
});

test('the owner writes, the content row appears and the document updatedAt advances', async () => {
  const created = await createDocument(cookieA);
  const connection = open({ documentId: created.id, cookie: cookieA });

  await connection.synced;
  writeText(connection.ydoc, 'Plano de obras');

  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });

  const stored = await prisma.document.findFirstOrThrow({
    where: { id: created.id },
  });

  expect(await storedText(created.id)).toBe('Plano de obras');
  expect(stored.updatedAt.getTime()).toBeGreaterThan(
    new Date(created.updatedAt).getTime(),
  );
});

test('a new connection with an empty Y.Doc receives the stored content', async () => {
  const created = await createDocument(cookieA);
  const first = open({ documentId: created.id, cookie: cookieA });

  await first.synced;
  writeText(first.ydoc, 'Plano de obras');
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });
  await first.close();

  const second = open({ documentId: created.id, cookie: cookieA });
  await second.synced;

  await waitFor(() => readText(second.ydoc) === 'Plano de obras', {
    message: 'A segunda conexão não recebeu o conteúdo guardado',
  });

  expect(readText(second.ydoc)).toBe('Plano de obras');
});

test('two connections of the owner converge in both directions', async () => {
  const created = await createDocument(cookieA);
  const first = open({ documentId: created.id, cookie: cookieA });
  const second = open({ documentId: created.id, cookie: cookieA });

  await first.synced;
  await second.synced;

  writeText(first.ydoc, 'Plano ');
  await waitFor(() => readText(second.ydoc) === 'Plano ', {
    message: 'A segunda conexão não recebeu o que a primeira escreveu',
  });

  writeText(second.ydoc, 'de obras');
  await waitFor(() => readText(first.ydoc) === 'Plano de obras', {
    message: 'A primeira conexão não recebeu o que a segunda escreveu',
  });

  expect(readText(first.ydoc)).toBe('Plano de obras');
  expect(readText(second.ydoc)).toBe('Plano de obras');

  // Espera a gravação sair antes de o próximo teste esvaziar as tabelas.
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });
});

test('the server sends the stored message after saving', async () => {
  const created = await createDocument(cookieA);
  const connection = open({ documentId: created.id, cookie: cookieA });

  await connection.synced;
  writeText(connection.ydoc, 'Plano de obras');

  await waitFor(
    () => connection.statelessPayloads.includes(STORED_MESSAGE),
    { message: 'A mensagem sem estado de gravação não chegou' },
  );

  expect(connection.statelessPayloads).toContain(STORED_MESSAGE);
});

test('another person is refused and receives no document content', async () => {
  const created = await createDocument(cookieA);
  const owner = open({ documentId: created.id, cookie: cookieA });

  await owner.synced;
  writeText(owner.ydoc, 'Plano de obras');
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });

  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  const intruder = open({ documentId: created.id, cookie });

  const reason = await intruder.refused;

  expect(reason).toBeTruthy();
  expect(readText(intruder.ydoc)).toBe('');
  expect(intruder.provider.isSynced).toBe(false);
  expect(intruder.provider.authorizedScope).toBeUndefined();
});

test('unknown and malformed document ids are refused exactly like a foreign document', async () => {
  const foreign = await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const foreignRefusal = await open({ documentId: foreign.id, cookie }).refused;
  const unknownRefusal = await open({ documentId: randomUUID(), cookie })
    .refused;
  const malformedRefusal = await open({ documentId: MALFORMED_ID, cookie })
    .refused;

  expect(unknownRefusal).toEqual(foreignRefusal);
  expect(malformedRefusal).toEqual(foreignRefusal);
});

test('a refused connection creates no content row', async () => {
  const created = await createDocument(cookieA);
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  const intruder = open({ documentId: created.id, cookie });
  await intruder.refused;

  expect(await prisma.documentContent.count()).toBe(0);
});

test('the upgrade fails with 401 without a cookie', async () => {
  const result = await rawUpgrade({ port, origin });

  expect(result).toEqual({ status: 401, opened: false });
});

test('the upgrade fails with 401 with an invalid cookie', async () => {
  const result = await rawUpgrade({
    port,
    origin,
    cookie: `folioteca_session=${randomUUID()}`,
  });

  expect(result).toEqual({ status: 401, opened: false });
});

test('the upgrade fails with 403 without an Origin header', async () => {
  const result = await rawUpgrade({ port, cookie: cookieA });

  expect(result).toEqual({ status: 403, opened: false });
});

test('the upgrade fails with 403 for an Origin of another host', async () => {
  const result = await rawUpgrade({
    port,
    cookie: cookieA,
    origin: 'http://outro.exemplo.org',
  });

  expect(result).toEqual({ status: 403, opened: false });
});

test('with COLLAB_ALLOWED_ORIGINS an Origin from the list connects and one outside it gets 403', async () => {
  const allowed = 'http://app.exemplo.org';
  const previousEnv = process.env.COLLAB_ALLOWED_ORIGINS;
  const previousParsed = env.COLLAB_ALLOWED_ORIGINS;

  // O ambiente é lido uma vez, na carga do módulo: o teste define a variável e
  // o valor já lido, e devolve os dois no fim.
  process.env.COLLAB_ALLOWED_ORIGINS = allowed;
  env.COLLAB_ALLOWED_ORIGINS = [allowed];

  try {
    const created = await createDocument(cookieA);
    const connection = open({
      documentId: created.id,
      cookie: cookieA,
      origin: allowed,
    });

    await connection.synced;

    const outside = await rawUpgrade({ port, cookie: cookieA, origin });

    expect(connection.provider.isSynced).toBe(true);
    expect(outside).toEqual({ status: 403, opened: false });
  } finally {
    if (previousEnv === undefined) {
      delete process.env.COLLAB_ALLOWED_ORIGINS;
    } else {
      process.env.COLLAB_ALLOWED_ORIGINS = previousEnv;
    }

    env.COLLAB_ALLOWED_ORIGINS = previousParsed;
  }
});

test('an upgrade on another path is destroyed and HTTP routes keep answering', async () => {
  const result = await rawUpgrade({
    port,
    path: '/other',
    cookie: cookieA,
    origin,
  });

  const health = await httpRequest(app).get('/api/health').send();

  expect(result).toEqual({ status: null, opened: false });
  expect(health.status).toBe(200);
});

test('a view connection receives the content and its writes never reach the server', async () => {
  const created = await createDocument(cookieA);
  const owner = open({ documentId: created.id, cookie: cookieA });

  await owner.synced;
  writeText(owner.ydoc, 'Plano de obras');
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });
  await owner.close();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AccessService)
    .useValue({
      resolveAccess: () => Promise.resolve('view'),
      // Quem só vê nunca grava: a conexão nasce somente leitura.
      canWrite: () => Promise.resolve(false),
      readableDocumentsWhere: () => ({}),
      trashedDocumentsWhere: () => ({}),
    })
    .compile();

  const viewApp = await startApp({ module: moduleRef });
  const viewPort = portOf(viewApp);

  try {
    const viewer = connectCollab({
      port: viewPort,
      documentId: created.id,
      cookie: cookieA,
      origin: `http://127.0.0.1:${viewPort}`,
    });

    await viewer.synced;

    expect(readText(viewer.ydoc)).toBe('Plano de obras');
    expect(viewer.provider.authorizedScope).toBe('readonly');

    writeText(viewer.ydoc, ' — rascunho da visitante');

    await viewer.close();
  } finally {
    // O encerramento grava o que estivesse pendente: se a escrita da conexão
    // somente leitura tivesse entrado, ela apareceria no estado guardado.
    await viewApp.close();
  }

  expect(await storedText(created.id)).toBe('Plano de obras');
});

/** Move o documento para a lixeira pela API, com o cookie da dona. */
async function trashDocument(documentId: string): Promise<number> {
  const response = await httpRequest(app)
    .post(`/api/documents/${documentId}/trash`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();

  return response.status;
}

/** Tira o documento da lixeira pela API, com o cookie da dona. */
async function restoreDocument(documentId: string): Promise<number> {
  const response = await httpRequest(app)
    .post(`/api/documents/${documentId}/restore`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();

  return response.status;
}

test('closes the open connection when the document goes to the trash and stores nothing written afterwards', async () => {
  const created = await createDocument(cookieA);
  const connection = open({ documentId: created.id, cookie: cookieA });

  await connection.synced;
  writeText(connection.ydoc, 'Plano de obras');
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });

  expect(await trashDocument(created.id)).toBe(200);

  await waitFor(() => !connection.provider.isAuthenticated, {
    message: 'A conexão aberta não foi fechada pela ida para a lixeira',
  });

  writeText(connection.ydoc, ' — escrito depois da lixeira');

  // Um documento fora da lixeira grava normalmente: quando a gravação dele
  // sai, a janela do documento na lixeira já passou.
  const control = await createDocument(cookieA);
  const controlConnection = open({ documentId: control.id, cookie: cookieA });
  await controlConnection.synced;
  writeText(controlConnection.ydoc, 'Documento de controle');
  await waitFor(() => hasContentRow(control.id), {
    message: 'A linha de conteúdo do documento de controle não apareceu',
  });

  expect(await storedText(created.id)).toBe('Plano de obras');
});

test('a new connection to a trashed document syncs the content, discards writes and gets no stored message', async () => {
  const created = await createDocument(cookieA);
  const first = open({ documentId: created.id, cookie: cookieA });

  await first.synced;
  writeText(first.ydoc, 'Plano de obras');
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });
  await first.close();

  expect(await trashDocument(created.id)).toBe(200);

  const viewer = open({ documentId: created.id, cookie: cookieA });
  await viewer.synced;

  await waitFor(() => readText(viewer.ydoc) === 'Plano de obras', {
    message: 'A conexão com o documento na lixeira não recebeu o conteúdo',
  });

  expect(viewer.provider.authorizedScope).toBe('readonly');

  writeText(viewer.ydoc, ' — rascunho na lixeira');

  const control = await createDocument(cookieA);
  const controlConnection = open({ documentId: control.id, cookie: cookieA });
  await controlConnection.synced;
  writeText(controlConnection.ydoc, 'Documento de controle');
  await waitFor(
    () => controlConnection.statelessPayloads.includes(STORED_MESSAGE),
    { message: 'A gravação do documento de controle não foi confirmada' },
  );

  expect(await storedText(created.id)).toBe('Plano de obras');
  expect(viewer.statelessPayloads).not.toContain(STORED_MESSAGE);
});

test('after restore the text written in the trash does not come back and a new connection stores normally', async () => {
  const created = await createDocument(cookieA);
  const first = open({ documentId: created.id, cookie: cookieA });

  await first.synced;
  writeText(first.ydoc, 'Plano de obras');
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });

  expect(await trashDocument(created.id)).toBe(200);

  await waitFor(() => !first.provider.isAuthenticated, {
    message: 'A conexão aberta não foi fechada pela ida para a lixeira',
  });

  writeText(first.ydoc, ' — rascunho na lixeira');
  await first.close();

  expect(await restoreDocument(created.id)).toBe(200);

  const second = open({ documentId: created.id, cookie: cookieA });
  await second.synced;

  await waitFor(() => readText(second.ydoc) === 'Plano de obras', {
    message: 'A conexão depois da restauração não recebeu o conteúdo guardado',
  });

  writeText(second.ydoc, ' e viadutos');

  await waitFor(
    async () => (await storedText(created.id)) === 'Plano de obras e viadutos',
    { message: 'A gravação depois da restauração não chegou ao banco' },
  );

  expect(readText(second.ydoc)).toBe('Plano de obras e viadutos');
  expect(await storedText(created.id)).toBe('Plano de obras e viadutos');
});

test('closing the app stores the pending content', { timeout: 15000 }, async () => {
  const created = await createDocument(cookieA);
  const pendingApp = await startApp();
  const pendingPort = portOf(pendingApp);

  const connection = connectCollab({
    port: pendingPort,
    documentId: created.id,
    cookie: cookieA,
    origin: `http://127.0.0.1:${pendingPort}`,
  });

  try {
    await connection.synced;
    writeText(connection.ydoc, 'Plano de obras');

    await waitFor(() => !connection.provider.hasUnsyncedChanges, {
      message: 'O servidor não confirmou a escrita',
    });

    const closed = settlesWithin(pendingApp.close(), 3000);

    await waitFor(() => hasContentRow(created.id), {
      message: 'O encerramento não gravou o conteúdo pendente',
    });

    expect(await storedText(created.id)).toBe('Plano de obras');
    expect(await closed).toBe(true);
  } finally {
    await connection.close();
  }
});

test('a view person connects read only and an update is not stored', async () => {
  const created = await createDocument(cookieA);
  const first = open({ documentId: created.id, cookie: cookieA });

  await first.synced;
  writeText(first.ydoc, 'Plano de obras');
  await waitFor(() => hasContentRow(created.id), {
    message: 'A linha de conteúdo não apareceu',
  });
  await first.close();

  const { person: viewerPerson, cookie: viewerCookie } =
    await createPersonWithSession(app, {
      name: 'João Lima',
      email: 'joao@exemplo.org',
    });
  const share = await httpRequest(app)
    .put(`/api/documents/${created.id}/shares/${viewerPerson.id}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level: 'view' });

  expect(share.status).toBe(200);

  const viewer = open({ documentId: created.id, cookie: viewerCookie });
  await viewer.synced;

  await waitFor(() => readText(viewer.ydoc) === 'Plano de obras', {
    message: 'A pessoa com leitura não recebeu o conteúdo',
  });

  expect(viewer.provider.authorizedScope).toBe('readonly');

  writeText(viewer.ydoc, ' — rascunho da visitante');

  // Um documento de controle grava normalmente: quando a confirmação dele
  // chega, a janela em que a escrita da visitante teria sido gravada já passou.
  const control = await createDocument(cookieA);
  const controlConnection = open({ documentId: control.id, cookie: cookieA });
  await controlConnection.synced;
  writeText(controlConnection.ydoc, 'Documento de controle');
  await waitFor(
    () => controlConnection.statelessPayloads.includes(STORED_MESSAGE),
    { message: 'A gravação do documento de controle não foi confirmada' },
  );

  expect(await storedText(created.id)).toBe('Plano de obras');
  expect(viewer.statelessPayloads).not.toContain(STORED_MESSAGE);
});

type UnitMember = {
  documentId: string;
  orgUnitId: string;
  memberId: string;
  memberCookie: string;
};

/**
 * A dona e o colega lotados diretamente na mesma unidade, com um documento da
 * dona criado pela API no espaço dela.
 */
async function createUnitSpaceDocument(): Promise<UnitMember> {
  const owner = await prisma.person.findFirstOrThrow({
    where: { email: EMAIL },
  });
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: owner.organizationId, parentId: null },
  });
  const unit = await prisma.orgUnit.create({
    data: {
      organizationId: owner.organizationId,
      parentId: root.id,
      name: 'Protocolo',
    },
  });
  const space = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: unit.id },
  });
  const { person: member, cookie: memberCookie } =
    await createPersonWithSession(app, {
      name: 'João Lima',
      email: 'joao@exemplo.org',
    });
  await prisma.orgUnitAssignment.createMany({
    data: [
      { orgUnitId: unit.id, personId: owner.id },
      { orgUnitId: unit.id, personId: member.id },
    ],
  });

  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ spaceId: space.id });

  expect(response.status).toBe(201);

  return {
    documentId: (response.body as { data: { id: string } }).data.id,
    orgUnitId: unit.id,
    memberId: member.id,
    memberCookie,
  };
}

test('a direct unit member connects and an update is stored', async () => {
  const { documentId, memberCookie } = await createUnitSpaceDocument();
  const member = open({ documentId, cookie: memberCookie });

  await member.synced;

  expect(member.provider.authorizedScope).not.toBe('readonly');

  writeText(member.ydoc, 'Ata do protocolo');

  await waitFor(() => member.statelessPayloads.includes(STORED_MESSAGE), {
    message: 'A gravação do colega da unidade não foi confirmada',
  });

  expect(await storedText(documentId)).toBe('Ata do protocolo');
});

test('after removing the assignment the next connection is refused', async () => {
  const { documentId, orgUnitId, memberId, memberCookie } =
    await createUnitSpaceDocument();
  const first = open({ documentId, cookie: memberCookie });

  await first.synced;
  await first.close();

  await prisma.orgUnitAssignment.delete({
    where: { orgUnitId_personId: { orgUnitId, personId: memberId } },
  });

  const next = open({ documentId, cookie: memberCookie });
  const reason = await next.refused;

  expect(reason).toBeTruthy();
  expect(next.provider.isSynced).toBe(false);
  expect(readText(next.ydoc)).toBe('');
});

type UnitHeir = {
  documentId: string;
  childSpaceId: string;
  heirCookie: string;
};

/**
 * A dona lotada na filha "Protocolo", cujo espaço herda da mãe "Secretaria";
 * a herdeira lotada só na mãe; um documento da dona criado pela API no espaço
 * da filha.
 */
async function createInheritedSpaceDocument(): Promise<UnitHeir> {
  const owner = await prisma.person.findFirstOrThrow({
    where: { email: EMAIL },
  });
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: owner.organizationId, parentId: null },
  });
  const parent = await prisma.orgUnit.create({
    data: {
      organizationId: owner.organizationId,
      parentId: root.id,
      name: 'Secretaria',
    },
  });
  await prisma.space.create({ data: { type: 'UNIT', orgUnitId: parent.id } });
  const child = await prisma.orgUnit.create({
    data: {
      organizationId: owner.organizationId,
      parentId: parent.id,
      name: 'Protocolo',
    },
  });
  const childSpace = await prisma.space.create({
    data: { type: 'UNIT', orgUnitId: child.id, inheritsParent: true },
  });
  const { person: heir, cookie: heirCookie } = await createPersonWithSession(
    app,
    { name: 'João Lima', email: 'joao@exemplo.org' },
  );
  await prisma.orgUnitAssignment.createMany({
    data: [
      { orgUnitId: child.id, personId: owner.id },
      { orgUnitId: parent.id, personId: heir.id },
    ],
  });

  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ spaceId: childSpace.id });

  expect(response.status).toBe(201);

  return {
    documentId: (response.body as { data: { id: string } }).data.id,
    childSpaceId: childSpace.id,
    heirCookie,
  };
}

test('an heir connects and writes to an inherited unit space document', async () => {
  const { documentId, heirCookie } = await createInheritedSpaceDocument();
  const heir = open({ documentId, cookie: heirCookie });

  await heir.synced;

  expect(heir.provider.authorizedScope).not.toBe('readonly');

  writeText(heir.ydoc, 'Ata herdada');

  await waitFor(() => heir.statelessPayloads.includes(STORED_MESSAGE), {
    message: 'A gravação da herdeira não foi confirmada',
  });

  expect(await storedText(documentId)).toBe('Ata herdada');
});

test('after losing inheritance a new connection is refused', async () => {
  const { documentId, childSpaceId, heirCookie } =
    await createInheritedSpaceDocument();
  const first = open({ documentId, cookie: heirCookie });

  await first.synced;
  await first.close();

  await prisma.space.update({
    where: { id: childSpaceId },
    data: { inheritsParent: false },
  });

  const next = open({ documentId, cookie: heirCookie });
  const reason = await next.refused;

  expect(reason).toBeTruthy();
  expect(next.provider.isSynced).toBe(false);
  expect(readText(next.ydoc)).toBe('');
});

type FreeSpaceMember = {
  documentId: string;
  spaceId: string;
  memberId: string;
  memberCookie: string;
};

/**
 * A dona de um espaço livre e um membro dele, com um documento da dona criado
 * pela API no espaço.
 */
async function createFreeSpaceDocument(): Promise<FreeSpaceMember> {
  const owner = await prisma.person.findFirstOrThrow({
    where: { email: EMAIL },
  });
  const space = await prisma.space.create({
    data: {
      type: 'FREE',
      organizationId: owner.organizationId,
      name: 'Projeto Alfa',
      ownerId: owner.id,
    },
  });
  const { person: member, cookie: memberCookie } =
    await createPersonWithSession(app, {
      name: 'João Lima',
      email: 'joao@exemplo.org',
    });
  await prisma.spaceMember.create({
    data: { spaceId: space.id, personId: member.id },
  });

  const response = await httpRequest(app)
    .post('/api/documents')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ spaceId: space.id });

  expect(response.status).toBe(201);

  return {
    documentId: (response.body as { data: { id: string } }).data.id,
    spaceId: space.id,
    memberId: member.id,
    memberCookie,
  };
}

test('a free space member connects and an update is stored', async () => {
  const { documentId, memberCookie } = await createFreeSpaceDocument();
  const member = open({ documentId, cookie: memberCookie });

  await member.synced;

  expect(member.provider.authorizedScope).not.toBe('readonly');

  writeText(member.ydoc, 'Plano do projeto');

  await waitFor(() => member.statelessPayloads.includes(STORED_MESSAGE), {
    message: 'A gravação do membro do espaço livre não foi confirmada',
  });

  expect(await storedText(documentId)).toBe('Plano do projeto');
});

test('after removing the free space member the next connection is refused', async () => {
  const { documentId, spaceId, memberId, memberCookie } =
    await createFreeSpaceDocument();
  const first = open({ documentId, cookie: memberCookie });

  await first.synced;
  await first.close();

  await prisma.spaceMember.delete({
    where: { spaceId_personId: { spaceId, personId: memberId } },
  });

  const next = open({ documentId, cookie: memberCookie });
  const reason = await next.refused;

  expect(reason).toBeTruthy();
  expect(next.provider.isSynced).toBe(false);
  expect(readText(next.ydoc)).toBe('');
});

test('after demoting the free space member to view the next connection is read only and an update is not stored', async () => {
  const { documentId, spaceId, memberId, memberCookie } =
    await createFreeSpaceDocument();
  const first = open({ documentId, cookie: memberCookie });

  await first.synced;
  writeText(first.ydoc, 'Plano do projeto');
  await waitFor(() => first.statelessPayloads.includes(STORED_MESSAGE), {
    message: 'A gravação do membro do espaço livre não foi confirmada',
  });
  await first.close();

  const demoted = await httpRequest(app)
    .patch(`/api/spaces/${spaceId}/members/${memberId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level: 'view' });

  expect(demoted.status).toBe(200);

  const next = open({ documentId, cookie: memberCookie });
  await next.synced;

  await waitFor(() => readText(next.ydoc) === 'Plano do projeto', {
    message: 'O membro rebaixado não recebeu o conteúdo',
  });

  expect(next.provider.authorizedScope).toBe('readonly');

  writeText(next.ydoc, ' — rascunho do leitor');

  // Um documento de controle grava normalmente: quando a confirmação dele
  // chega, a janela em que a escrita do leitor teria sido gravada já passou.
  const control = await createDocument(cookieA);
  const controlConnection = open({ documentId: control.id, cookie: cookieA });
  await controlConnection.synced;
  writeText(controlConnection.ydoc, 'Documento de controle');
  await waitFor(
    () => controlConnection.statelessPayloads.includes(STORED_MESSAGE),
    { message: 'A gravação do documento de controle não foi confirmada' },
  );

  expect(await storedText(documentId)).toBe('Plano do projeto');
  expect(next.statelessPayloads).not.toContain(STORED_MESSAGE);
});

/** João com um compartilhamento no nível informado num documento da dona. */
async function shareWithJoao(
  documentId: string,
  level: 'view' | 'edit',
): Promise<string> {
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  const share = await httpRequest(app)
    .put(`/api/documents/${documentId}/shares/${person.id}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level });

  expect(share.status).toBe(200);

  return cookie;
}

test('a person with an edit share connects and their change reaches another client', async () => {
  const created = await createDocument(cookieA);
  const editorCookie = await shareWithJoao(created.id, 'edit');
  const owner = open({ documentId: created.id, cookie: cookieA });
  const editor = open({ documentId: created.id, cookie: editorCookie });

  await owner.synced;
  await editor.synced;

  expect(editor.provider.authorizedScope).not.toBe('readonly');

  writeText(editor.ydoc, 'Texto de quem edita');

  await waitFor(() => readText(owner.ydoc) === 'Texto de quem edita', {
    message: 'A alteração de quem edita não chegou ao outro cliente',
  });
  await waitFor(
    async () => (await storedText(created.id)) === 'Texto de quem edita',
    { message: 'A alteração de quem edita não foi gravada' },
  );

  expect(readText(owner.ydoc)).toBe('Texto de quem edita');
});

test('a person with a view share connects read only', async () => {
  const created = await createDocument(cookieA);
  const viewerCookie = await shareWithJoao(created.id, 'view');
  const owner = open({ documentId: created.id, cookie: cookieA });
  const viewer = open({ documentId: created.id, cookie: viewerCookie });

  await owner.synced;
  await viewer.synced;

  expect(viewer.provider.authorizedScope).toBe('readonly');

  writeText(viewer.ydoc, 'Rascunho de quem só vê');

  // O cliente da dona escreve depois: quando a escrita dela chega e é
  // gravada, a janela em que a de quem só vê teria chegado já passou.
  writeText(owner.ydoc, 'Texto da dona');
  await waitFor(() => owner.statelessPayloads.includes(STORED_MESSAGE), {
    message: 'A gravação da dona não foi confirmada',
  });

  expect(readText(owner.ydoc)).toBe('Texto da dona');
  expect(await storedText(created.id)).toBe('Texto da dona');
});

test('a trashed document refuses a person with an edit share', async () => {
  const created = await createDocument(cookieA);
  const editorCookie = await shareWithJoao(created.id, 'edit');

  expect(await trashDocument(created.id)).toBe(200);

  const editor = open({ documentId: created.id, cookie: editorCookie });
  const reason = await editor.refused;

  expect(reason).toBeTruthy();
  expect(editor.provider.isSynced).toBe(false);
  expect(readText(editor.ydoc)).toBe('');
});

const ACCESS_CHANGED = '{"type":"access-changed"}';

/** Troca, pela API e com o cookie da dona, o nível de uma pessoa. */
async function putShare(
  documentId: string,
  personId: string,
  level: 'view' | 'edit',
): Promise<void> {
  const response = await httpRequest(app)
    .put(`/api/documents/${documentId}/shares/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level });

  expect(response.status).toBe(200);
}

/** Remove, pela API e com o cookie da dona, o compartilhamento de uma pessoa. */
async function deleteShare(documentId: string, personId: string): Promise<void> {
  const response = await httpRequest(app)
    .delete(`/api/documents/${documentId}/shares/${personId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();

  expect(response.status).toBe(204);
}

/** Espera a mensagem `access-changed` chegar à conexão. */
function accessChanged(connection: CollabConnection): Promise<void> {
  return waitFor(
    () => connection.statelessPayloads.includes(ACCESS_CHANGED),
    { message: 'A mensagem access-changed não chegou' },
  );
}

/** Espera o estado guardado do documento ficar igual ao texto informado. */
function storedEquals(documentId: string, text: string): Promise<void> {
  return waitFor(async () => (await storedText(documentId)) === text, {
    message: `O estado guardado não chegou a "${text}"`,
  });
}

/**
 * João com o documento da dona aberto por um compartilhamento no nível
 * informado, e a dona conectada ao mesmo documento.
 */
async function openSharedDocument(level: 'view' | 'edit'): Promise<{
  documentId: string;
  personId: string;
  owner: CollabConnection;
  person: CollabConnection;
}> {
  const created = await createDocument(cookieA);
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });

  await putShare(created.id, person.id, level);

  const owner = open({ documentId: created.id, cookie: cookieA });
  const joao = open({ documentId: created.id, cookie });

  await owner.synced;
  await joao.synced;

  return {
    documentId: created.id,
    personId: person.id,
    owner,
    person: joao,
  };
}

test('downgrading a share to view sends access-changed and later writes are not stored', async () => {
  const { documentId, personId, owner, person } =
    await openSharedDocument('edit');

  writeText(person.ydoc, 'Texto de João');
  await storedEquals(documentId, 'Texto de João');

  await putShare(documentId, personId, 'view');
  await accessChanged(person);

  writeText(person.ydoc, ' — depois do rebaixamento');

  // A dona escreve depois e força a gravação: quando o texto dela está no
  // banco, a escrita de João já teria entrado junto.
  await waitFor(() => readText(owner.ydoc) === 'Texto de João', {
    message: 'A dona não recebeu o texto de João',
  });
  writeText(owner.ydoc, ' e da dona');
  await storedEquals(documentId, 'Texto de João e da dona');

  expect(person.statelessPayloads).toContain(ACCESS_CHANGED);
  expect(await storedText(documentId)).toBe('Texto de João e da dona');
  expect(readText(owner.ydoc)).toBe('Texto de João e da dona');
});

test('upgrading a share to edit sends access-changed and later writes are stored', async () => {
  const { documentId, personId, person } = await openSharedDocument('view');

  expect(person.provider.authorizedScope).toBe('readonly');

  await putShare(documentId, personId, 'edit');
  await accessChanged(person);

  writeText(person.ydoc, 'Texto de João promovido');
  await storedEquals(documentId, 'Texto de João promovido');

  expect(person.statelessPayloads).toContain(ACCESS_CHANGED);
  expect(await storedText(documentId)).toBe('Texto de João promovido');
});

test('removing a share sends access-changed and closes the connection', async () => {
  const { documentId, personId, owner, person } =
    await openSharedDocument('edit');
  let payloadsAtClose: string[] | undefined;

  person.provider.on('close', () => {
    payloadsAtClose ??= [...person.statelessPayloads];
  });

  await deleteShare(documentId, personId);

  await waitFor(() => payloadsAtClose !== undefined, {
    message: 'A conexão de João não foi encerrada',
  });

  expect(payloadsAtClose).toContain(ACCESS_CHANGED);
  expect(person.provider.isAuthenticated).toBe(false);
  expect(owner.statelessPayloads).not.toContain(ACCESS_CHANGED);
});

test('after removal the person cannot connect again', async () => {
  const created = await createDocument(cookieA);
  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Lima',
    email: 'joao@exemplo.org',
  });
  await putShare(created.id, person.id, 'edit');

  const owner = open({ documentId: created.id, cookie: cookieA });
  const first = open({ documentId: created.id, cookie });
  await owner.synced;
  await first.synced;

  await deleteShare(created.id, person.id);
  await waitFor(() => !first.provider.isAuthenticated, {
    message: 'A conexão de João não foi encerrada',
  });

  const next = open({ documentId: created.id, cookie });
  const reason = await next.refused;

  expect(reason).toBeTruthy();
  expect(next.provider.isSynced).toBe(false);
  expect(readText(next.ydoc)).toBe('');
});

test('removing a view share of an edit space member keeps writing', async () => {
  const { documentId, memberId, memberCookie } =
    await createFreeSpaceDocument();
  await putShare(documentId, memberId, 'view');

  const owner = open({ documentId, cookie: cookieA });
  const member = open({ documentId, cookie: memberCookie });
  await owner.synced;
  await member.synced;

  await deleteShare(documentId, memberId);
  await accessChanged(member);

  writeText(member.ydoc, 'Plano do projeto');
  await storedEquals(documentId, 'Plano do projeto');

  expect(member.provider.isAuthenticated).toBe(true);
  expect(await storedText(documentId)).toBe('Plano do projeto');
});

test('removing an edit share of a view space member makes the connection read only', async () => {
  const { documentId, spaceId, memberId, memberCookie } =
    await createFreeSpaceDocument();
  const demoted = await httpRequest(app)
    .patch(`/api/spaces/${spaceId}/members/${memberId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level: 'view' });

  expect(demoted.status).toBe(200);

  await putShare(documentId, memberId, 'edit');

  const owner = open({ documentId, cookie: cookieA });
  const member = open({ documentId, cookie: memberCookie });
  await owner.synced;
  await member.synced;

  writeText(member.ydoc, 'Plano do projeto');
  await storedEquals(documentId, 'Plano do projeto');

  await deleteShare(documentId, memberId);
  await accessChanged(member);

  writeText(member.ydoc, ' — rascunho do leitor');

  await waitFor(() => readText(owner.ydoc) === 'Plano do projeto', {
    message: 'A dona não recebeu o texto do membro',
  });
  writeText(owner.ydoc, ' e da dona');
  await storedEquals(documentId, 'Plano do projeto e da dona');

  expect(member.provider.isAuthenticated).toBe(true);
  expect(await storedText(documentId)).toBe('Plano do projeto e da dona');
});

test('a share change for another person does not message nor change this connection', async () => {
  const { documentId, person } = await openSharedDocument('edit');
  const { person: ana, cookie: anaCookie } = await createPersonWithSession(
    app,
    { name: 'Ana Reis', email: 'ana@exemplo.org' },
  );
  await putShare(documentId, ana.id, 'edit');

  const anaConnection = open({ documentId, cookie: anaCookie });
  await anaConnection.synced;

  await putShare(documentId, ana.id, 'view');
  // A reavaliação de Ana e a de João, se houvesse, saem do mesmo aviso: quando
  // a mensagem chega a Ana, a de João já teria sido enviada.
  await accessChanged(anaConnection);

  writeText(person.ydoc, 'Texto de João');
  await storedEquals(documentId, 'Texto de João');

  expect(person.statelessPayloads).not.toContain(ACCESS_CHANGED);
  expect(person.provider.isAuthenticated).toBe(true);
  expect(await storedText(documentId)).toBe('Texto de João');
});

test('the access-changed message carries only the type', async () => {
  const { documentId, personId, person } = await openSharedDocument('edit');

  await putShare(documentId, personId, 'view');
  await accessChanged(person);

  const received = person.statelessPayloads.filter(
    (payload) => payload !== STORED_MESSAGE,
  );

  expect(received).toHaveLength(1);
  expect(JSON.parse(received[0] ?? '')).toEqual({ type: 'access-changed' });
  expect(received[0]).not.toContain(personId);
  expect(received[0]).not.toContain('João');
  expect(received[0]).not.toContain('joao@exemplo.org');
  expect(received[0]).not.toContain('view');
});

/** Compartilha, pela API e com o cookie da dona, com toda a organização. */
async function putInstanceShare(
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

/** Remove, pela API e com o cookie da dona, o compartilhamento com a organização. */
async function deleteInstanceShare(documentId: string): Promise<void> {
  const response = await httpRequest(app)
    .delete(`/api/documents/${documentId}/instance-share`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send();

  expect(response.status).toBe(204);
}

/** Guarda as mensagens recebidas até a conexão fechar. */
function payloadsAtClose(connection: CollabConnection): () => string[] | undefined {
  let payloads: string[] | undefined;

  connection.provider.on('close', () => {
    payloads ??= [...connection.statelessPayloads];
  });

  return () => payloads;
}

/**
 * João e Ana, da organização da dona, com o documento dela aberto pelo
 * compartilhamento com a organização no nível informado; a dona também
 * conectada.
 */
async function openInstanceDocument(level: 'view' | 'edit'): Promise<{
  documentId: string;
  joaoId: string;
  owner: CollabConnection;
  joao: CollabConnection;
  ana: CollabConnection;
}> {
  const created = await createDocument(cookieA);
  const { person: joaoPerson, cookie: joaoCookie } =
    await createPersonWithSession(app, {
      name: 'João Lima',
      email: 'joao@exemplo.org',
    });
  const { cookie: anaCookie } = await createPersonWithSession(app, {
    name: 'Ana Reis',
    email: 'ana@exemplo.org',
  });

  await putInstanceShare(created.id, level);

  const owner = open({ documentId: created.id, cookie: cookieA });
  const joao = open({ documentId: created.id, cookie: joaoCookie });
  const ana = open({ documentId: created.id, cookie: anaCookie });

  await owner.synced;
  await joao.synced;
  await ana.synced;

  return { documentId: created.id, joaoId: joaoPerson.id, owner, joao, ana };
}

test('downgrading the instance share to view sends access-changed to every open connection and blocks writes', async () => {
  const { documentId, owner, joao, ana } = await openInstanceDocument('edit');

  writeText(joao.ydoc, 'Texto de João');
  await storedEquals(documentId, 'Texto de João');

  await putInstanceShare(documentId, 'view');
  await accessChanged(joao);
  await accessChanged(ana);

  writeText(joao.ydoc, ' — depois do rebaixamento');
  writeText(ana.ydoc, ' — rascunho de Ana');

  // A dona escreve depois e força a gravação: quando o texto dela está no
  // banco, as escritas de João e de Ana já teriam entrado junto.
  await waitFor(() => readText(owner.ydoc) === 'Texto de João', {
    message: 'A dona não recebeu o texto de João',
  });
  writeText(owner.ydoc, ' e da dona');
  await storedEquals(documentId, 'Texto de João e da dona');

  expect(joao.statelessPayloads).toContain(ACCESS_CHANGED);
  expect(ana.statelessPayloads).toContain(ACCESS_CHANGED);
  expect(joao.provider.isAuthenticated).toBe(true);
  expect(ana.provider.isAuthenticated).toBe(true);
  expect(await storedText(documentId)).toBe('Texto de João e da dona');
});

test('upgrading the instance share to edit lets the connections write again', async () => {
  const { documentId, joao, ana } = await openInstanceDocument('view');

  expect(joao.provider.authorizedScope).toBe('readonly');
  expect(ana.provider.authorizedScope).toBe('readonly');

  await putInstanceShare(documentId, 'edit');
  await accessChanged(joao);
  await accessChanged(ana);

  writeText(joao.ydoc, 'Texto de João');
  await storedEquals(documentId, 'Texto de João');

  writeText(ana.ydoc, ' e de Ana');
  await storedEquals(documentId, 'Texto de João e de Ana');

  expect(await storedText(documentId)).toBe('Texto de João e de Ana');
});

test('removing the instance share sends access-changed and closes connections left without access', async () => {
  const { documentId, owner, joao, ana } = await openInstanceDocument('edit');
  const joaoAtClose = payloadsAtClose(joao);
  const anaAtClose = payloadsAtClose(ana);

  await deleteInstanceShare(documentId);

  await waitFor(() => joaoAtClose() !== undefined, {
    message: 'A conexão de João não foi encerrada',
  });
  await waitFor(() => anaAtClose() !== undefined, {
    message: 'A conexão de Ana não foi encerrada',
  });
  await accessChanged(owner);

  expect(joaoAtClose()).toContain(ACCESS_CHANGED);
  expect(anaAtClose()).toContain(ACCESS_CHANGED);
  expect(joao.provider.isAuthenticated).toBe(false);
  expect(ana.provider.isAuthenticated).toBe(false);
  expect(owner.provider.isAuthenticated).toBe(true);

  writeText(owner.ydoc, 'Texto da dona');
  await storedEquals(documentId, 'Texto da dona');
});

test('a person with a personal edit share keeps writing after the instance share is downgraded or removed', async () => {
  const { documentId, joaoId, joao, ana } = await openInstanceDocument('edit');

  await putShare(documentId, joaoId, 'edit');
  await accessChanged(joao);
  joao.statelessPayloads.length = 0;

  await putInstanceShare(documentId, 'view');
  await accessChanged(joao);
  await accessChanged(ana);

  writeText(joao.ydoc, 'Texto de João');
  await storedEquals(documentId, 'Texto de João');

  joao.statelessPayloads.length = 0;
  const anaAtClose = payloadsAtClose(ana);

  await deleteInstanceShare(documentId);
  await accessChanged(joao);
  await waitFor(() => anaAtClose() !== undefined, {
    message: 'A conexão de Ana não foi encerrada',
  });

  writeText(joao.ydoc, ' depois da remoção');
  await storedEquals(documentId, 'Texto de João depois da remoção');

  expect(joao.provider.isAuthenticated).toBe(true);
  expect(joao.provider.authorizedScope).not.toBe('readonly');
  expect(await storedText(documentId)).toBe('Texto de João depois da remoção');
});

test('a person with view through a space becomes read only after an instance edit share is removed', async () => {
  const { documentId, spaceId, memberId, memberCookie } =
    await createFreeSpaceDocument();
  const demoted = await httpRequest(app)
    .patch(`/api/spaces/${spaceId}/members/${memberId}`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookieA)
    .send({ level: 'view' });

  expect(demoted.status).toBe(200);

  await putInstanceShare(documentId, 'edit');

  const owner = open({ documentId, cookie: cookieA });
  const member = open({ documentId, cookie: memberCookie });
  await owner.synced;
  await member.synced;

  writeText(member.ydoc, 'Plano do projeto');
  await storedEquals(documentId, 'Plano do projeto');

  await deleteInstanceShare(documentId);
  await accessChanged(member);

  writeText(member.ydoc, ' — rascunho do leitor');

  await waitFor(() => readText(owner.ydoc) === 'Plano do projeto', {
    message: 'A dona não recebeu o texto do membro',
  });
  writeText(owner.ydoc, ' e da dona');
  await storedEquals(documentId, 'Plano do projeto e da dona');

  expect(member.provider.isAuthenticated).toBe(true);
  expect(await storedText(documentId)).toBe('Plano do projeto e da dona');
});

test('removing a missing instance share sends no message', async () => {
  const { documentId, owner, person } = await openSharedDocument('edit');

  await deleteInstanceShare(documentId);

  // A gravação sai muito depois de qualquer reavaliação: quando a confirmação
  // dela chega a João, um access-changed do DELETE já teria chegado.
  writeText(owner.ydoc, 'Texto da dona');
  await waitFor(() => person.statelessPayloads.includes(STORED_MESSAGE), {
    message: 'A gravação da dona não foi confirmada a João',
  });

  expect(person.statelessPayloads).not.toContain(ACCESS_CHANGED);
  expect(owner.statelessPayloads).not.toContain(ACCESS_CHANGED);
  expect(person.provider.isAuthenticated).toBe(true);
});

test('the instance share message is exactly {"type":"access-changed"}', async () => {
  const { documentId, joaoId, joao } = await openInstanceDocument('edit');

  await putInstanceShare(documentId, 'view');
  await accessChanged(joao);

  const received = joao.statelessPayloads.filter(
    (payload) => payload !== STORED_MESSAGE,
  );

  expect(received).toEqual([ACCESS_CHANGED]);
  expect(JSON.parse(received[0] ?? '')).toEqual({ type: 'access-changed' });
  expect(received[0]).not.toContain(joaoId);
  expect(received[0]).not.toContain('João');
  expect(received[0]).not.toContain('joao@exemplo.org');
  expect(received[0]).not.toContain('view');
});
