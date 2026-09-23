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
