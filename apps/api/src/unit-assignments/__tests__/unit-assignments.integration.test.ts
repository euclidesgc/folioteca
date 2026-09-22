import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { HttpException, type INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';
import {
  ALREADY_ASSIGNED_MESSAGE,
  PERSON_NOT_FOUND_MESSAGE,
  UnitAssignmentsService,
} from '../unit-assignments.service';

const EMAIL = 'maria@exemplo.org';

const ORGANIZATION_NAME = 'Prefeitura de Exemplo';

const FORBIDDEN_MESSAGE = 'Apenas a administração pode fazer isso.';

const ORG_UNIT_NOT_FOUND_BODY = { message: 'Unidade não encontrada.' };

const PERSON_NOT_FOUND_BODY = { message: PERSON_NOT_FOUND_MESSAGE };

const INVALID_MESSAGE = 'Dados inválidos.';

const MALFORMED_ID = 'nao-e-uuid';

type AssignedPerson = { id: string; name: string; email: string };

type PeopleBody = {
  data: AssignedPerson[];
  orgUnit: { id: string; name: string };
};

/** Par status/corpo, o que a rota devolve e o que a comparação olha. */
type Result = { status: number; body: unknown };

let app: INestApplication;
let prisma: PrismaService;
let unitAssignments: UnitAssignmentsService;

let adminPerson: Person;
let adminCookie: string;

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
  unitAssignments = app.get(UnitAssignmentsService);
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
      organizationName: ORGANIZATION_NAME,
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

  adminCookie = sessionCookie.split(';')[0] ?? '';
  adminPerson = await prisma.person.findFirstOrThrow({ where: { email: EMAIL } });
});

/** `GET /api/org-units/:orgUnitId/people`. */
function getUnitPeople(orgUnitId: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get(`/api/org-units/${orgUnitId}/people`);

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** `POST /api/org-units/:orgUnitId/people`, com o cabeçalho do CSRF. */
function assignPerson(
  orgUnitId: string,
  body: object,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .post(`/api/org-units/${orgUnitId}/people`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body,
  );
}

/** `GET /api/people`, a terceira rota da fatia. */
function searchPeople(term: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get('/api/people').query({ q: term });

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

function resultOf(response: Response): Result {
  return { status: response.status, body: response.body };
}

/**
 * A organização é única por instância — a `0002` a tranca com o check
 * `Organization_singleton_check` —, então uma segunda organização não pode ser
 * gravada e o caso "de outra organização" não chega a existir por HTTP. A
 * recusa é provada onde ela mora: o serviço, contra o mesmo Postgres, com um
 * `organizationId` que não é o da unidade. A conversão abaixo devolve o mesmo
 * par status/corpo que o filtro HTTP produziria.
 */
async function resultOfRefusal(run: () => Promise<unknown>): Promise<Result> {
  const thrown = await run().then(
    () => undefined,
    (error: unknown) => error,
  );

  if (!(thrown instanceof HttpException)) {
    throw new Error('A chamada devia ter sido recusada.');
  }

  return { status: thrown.getStatus(), body: { message: thrown.message } };
}

/** Id da unidade raiz criada pela instalação. */
async function getRootId(): Promise<string> {
  const root = await prisma.orgUnit.findFirstOrThrow({
    where: { organizationId: adminPerson.organizationId, parentId: null },
  });

  return root.id;
}

/** Cria uma unidade filha da raiz, com o espaço `UNIT` dela. */
async function createUnit(name: string): Promise<string> {
  const unit = await prisma.orgUnit.create({
    data: {
      organizationId: adminPerson.organizationId,
      parentId: await getRootId(),
      name,
    },
  });

  await prisma.space.create({ data: { type: 'UNIT', orgUnitId: unit.id } });

  return unit.id;
}

/** Cria uma pessoa da organização, sem sessão, e devolve o id dela. */
async function createPerson(name: string, email: string): Promise<string> {
  const person = await prisma.person.create({
    data: {
      organizationId: adminPerson.organizationId,
      name,
      email,
      passwordHash: randomUUID(),
    },
  });

  return person.id;
}

function peopleOf(response: Response): PeopleBody {
  return response.body as PeopleBody;
}

function messageOf(response: Response): string {
  return (response.body as { message: string }).message;
}

test('an admin assigns a person and gets 201 with the person', async () => {
  const orgUnitId = await createUnit('Acervo');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  const response = await assignPerson(orgUnitId, { personId }, adminCookie);

  expect(response.status).toBe(201);
  expect((response.body as { data: AssignedPerson }).data).toEqual({
    id: personId,
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });
});

test('the unit list shows the assigned person with the unit name', async () => {
  const orgUnitId = await createUnit('Acervo');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  await assignPerson(orgUnitId, { personId }, adminCookie);
  const response = await getUnitPeople(orgUnitId, adminCookie);

  expect(response.status).toBe(200);
  expect(peopleOf(response)).toEqual({
    data: [{ id: personId, name: 'Ana Lima', email: 'ana@exemplo.org' }],
    orgUnit: { id: orgUnitId, name: 'Acervo' },
  });
});

test('assigning the same person twice answers 409 and keeps one row', async () => {
  const orgUnitId = await createUnit('Acervo');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  const first = await assignPerson(orgUnitId, { personId }, adminCookie);
  const second = await assignPerson(orgUnitId, { personId }, adminCookie);

  expect(first.status).toBe(201);
  expect(second.status).toBe(409);
  expect(messageOf(second)).toBe(ALREADY_ASSIGNED_MESSAGE);
  expect(await prisma.orgUnitAssignment.count({ where: { orgUnitId } })).toBe(1);
});

test('two simultaneous assignments produce one 201, one 409 and one row', async () => {
  const orgUnitId = await createUnit('Acervo');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  const first = assignPerson(orgUnitId, { personId }, adminCookie);
  const second = assignPerson(orgUnitId, { personId }, adminCookie);
  const responses = await Promise.all([first, second]);

  expect(responses.map((response) => response.status).sort()).toEqual([
    201, 409,
  ]);
  expect(
    await prisma.orgUnitAssignment.count({ where: { orgUnitId, personId } }),
  ).toBe(1);
});

test('the same person can be assigned to two units', async () => {
  const firstUnitId = await createUnit('Acervo');
  const secondUnitId = await createUnit('Restauro');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  const first = await assignPerson(firstUnitId, { personId }, adminCookie);
  const second = await assignPerson(secondUnitId, { personId }, adminCookie);

  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(
    peopleOf(await getUnitPeople(firstUnitId, adminCookie)).data.map(
      (person) => person.id,
    ),
  ).toEqual([personId]);
  expect(
    peopleOf(await getUnitPeople(secondUnitId, adminCookie)).data.map(
      (person) => person.id,
    ),
  ).toEqual([personId]);
});

test('assigning in the second unit does not touch the first', async () => {
  const firstUnitId = await createUnit('Acervo');
  const secondUnitId = await createUnit('Restauro');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  await assignPerson(firstUnitId, { personId }, adminCookie);
  const before = peopleOf(await getUnitPeople(firstUnitId, adminCookie));

  await assignPerson(secondUnitId, { personId }, adminCookie);
  const after = peopleOf(await getUnitPeople(firstUnitId, adminCookie));

  expect(after).toEqual(before);
  expect(
    await prisma.orgUnitAssignment.count({ where: { orgUnitId: firstUnitId } }),
  ).toBe(1);
});

test('the list is sorted by the pt-BR collator', async () => {
  const orgUnitId = await createUnit('Acervo');
  const zilda = await createPerson('Zilda Rocha', 'zilda@exemplo.org');
  const ana = await createPerson('ana Lima', 'ana@exemplo.org');
  const alvaro = await createPerson('Álvaro Dias', 'alvaro@exemplo.org');

  for (const personId of [zilda, ana, alvaro]) {
    await assignPerson(orgUnitId, { personId }, adminCookie);
  }

  const response = await getUnitPeople(orgUnitId, adminCookie);

  expect(peopleOf(response).data.map((person) => person.name)).toEqual([
    'Álvaro Dias',
    'ana Lima',
    'Zilda Rocha',
  ]);
});

test('the root unit accepts an assignment', async () => {
  const rootId = await getRootId();
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  const response = await assignPerson(rootId, { personId }, adminCookie);

  expect(response.status).toBe(201);
  expect(
    peopleOf(await getUnitPeople(rootId, adminCookie)).data.map(
      (person) => person.id,
    ),
  ).toEqual([personId]);
});

/**
 * Os três jeitos de a unidade não ser encontrada. Cada caso devolve o par
 * status/corpo do `GET` e do `POST`, e o teste compara os três **entre si**.
 */
const orgUnitNotFoundCases: [
  string,
  (rootId: string) => Promise<Result>,
  (rootId: string) => Promise<Result>,
][] = [
  [
    'an unknown org unit',
    async () => resultOf(await getUnitPeople(randomUUID(), adminCookie)),
    async () =>
      resultOf(
        await assignPerson(
          randomUUID(),
          { personId: randomUUID() },
          adminCookie,
        ),
      ),
  ],
  [
    'an org unit of another organization',
    (rootId) => resultOfRefusal(() => unitAssignments.list(randomUUID(), rootId)),
    (rootId) =>
      resultOfRefusal(() =>
        unitAssignments.assign(randomUUID(), rootId, {
          personId: randomUUID(),
        }),
      ),
  ],
  [
    'a malformed org unit id',
    async () => resultOf(await getUnitPeople(MALFORMED_ID, adminCookie)),
    async () =>
      resultOf(
        await assignPerson(
          MALFORMED_ID,
          { personId: randomUUID() },
          adminCookie,
        ),
      ),
  ],
];

test.each(orgUnitNotFoundCases)(
  '%s answers the same not found on GET and on POST',
  async (_name, fromGet, fromPost) => {
    const rootId = await getRootId();
    const reference = resultOf(await getUnitPeople(randomUUID(), adminCookie));

    const getResult = await fromGet(rootId);
    const postResult = await fromPost(rootId);

    expect(reference.status).toBe(404);
    expect(reference.body).toEqual(ORG_UNIT_NOT_FOUND_BODY);
    expect(getResult.status).toBe(reference.status);
    expect(postResult.status).toBe(reference.status);
    expect(getResult.body).toEqual(reference.body);
    expect(postResult.body).toEqual(reference.body);
    expect(postResult.body).toEqual(getResult.body);
  },
);

/** Os três jeitos de a pessoa não ser encontrada, todos no `POST`. */
const personNotFoundCases: [string, () => Promise<string>][] = [
  ['an unknown person', () => Promise.resolve(randomUUID())],
  [
    // A instância tem uma organização só (check `Organization_singleton_check`
    // da `0002`), então o caso representável é um id que existe no banco mas
    // não é pessoa desta organização; que o filtro é por organização está
    // afirmado em `unit-assignments.service.test.ts`.
    'a person of another organization',
    () => getRootId(),
  ],
  ['a malformed person id', () => Promise.resolve(MALFORMED_ID)],
];

test.each(personNotFoundCases)(
  '%s answers the same person not found',
  async (_name, resolvePersonId) => {
    const orgUnitId = await createUnit('Acervo');
    const reference = resultOf(
      await assignPerson(orgUnitId, { personId: randomUUID() }, adminCookie),
    );

    const result = resultOf(
      await assignPerson(
        orgUnitId,
        { personId: await resolvePersonId() },
        adminCookie,
      ),
    );

    expect(reference.status).toBe(404);
    expect(reference.body).toEqual(PERSON_NOT_FOUND_BODY);
    expect(result.status).toBe(reference.status);
    expect(result.body).toEqual(reference.body);
  },
);

test('the person not found body differs from the org unit not found body', async () => {
  const orgUnitId = await createUnit('Acervo');

  const person = await assignPerson(
    orgUnitId,
    { personId: randomUUID() },
    adminCookie,
  );
  const orgUnit = await getUnitPeople(randomUUID(), adminCookie);

  expect(person.status).toBe(404);
  expect(orgUnit.status).toBe(404);
  expect(person.body).not.toEqual(orgUnit.body);
  expect(messageOf(person)).toBe(PERSON_NOT_FOUND_MESSAGE);
  expect(messageOf(orgUnit)).toBe(ORG_UNIT_NOT_FOUND_BODY.message);
});

test('a body without personId answers 400 on the personId field', async () => {
  const orgUnitId = await createUnit('Acervo');

  const response = await assignPerson(orgUnitId, {}, adminCookie);

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe(INVALID_MESSAGE);
  expect((response.body as { errors: { field: string }[] }).errors[0]?.field).toBe(
    'personId',
  );
});

test('an empty personId answers 400 on the personId field', async () => {
  const orgUnitId = await createUnit('Acervo');

  const response = await assignPerson(orgUnitId, { personId: '' }, adminCookie);

  expect(response.status).toBe(400);
  expect((response.body as { errors: { field: string }[] }).errors[0]).toEqual({
    field: 'personId',
    message: 'Informe a pessoa.',
  });
});

test('an unknown field answers 400 on that field', async () => {
  const orgUnitId = await createUnit('Acervo');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  const response = await assignPerson(
    orgUnitId,
    { personId, papel: 'chefia' },
    adminCookie,
  );

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe(INVALID_MESSAGE);
  // Campo desconhecido é problema do objeto inteiro, e não de um campo: o
  // `field` vem vazio, como no `PATCH` de unidades. É a mensagem que aponta
  // o que aconteceu.
  expect((response.body as { errors: { message: string }[] }).errors[0]).toEqual(
    { field: '', message: 'Campo não permitido.' },
  );
});

test('a non-admin answers 403 on all three routes', async () => {
  const orgUnitId = await createUnit('Acervo');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const list = await getUnitPeople(orgUnitId, cookie);
  const assign = await assignPerson(orgUnitId, { personId }, cookie);
  const search = await searchPeople('ana', cookie);

  for (const response of [list, assign, search]) {
    expect(response.status).toBe(403);
    expect(messageOf(response)).toBe(FORBIDDEN_MESSAGE);
  }

  expect(await prisma.orgUnitAssignment.count()).toBe(0);
});

test('an anonymous request answers 401 on all three routes', async () => {
  const orgUnitId = await createUnit('Acervo');
  const personId = await createPerson('Ana Lima', 'ana@exemplo.org');

  const list = await getUnitPeople(orgUnitId);
  const assign = await assignPerson(orgUnitId, { personId });
  const search = await searchPeople('ana');

  for (const response of [list, assign, search]) {
    expect(response.status).toBe(401);
  }

  expect(await prisma.orgUnitAssignment.count()).toBe(0);
});

test('an assignment grants no document access', async () => {
  const orgUnitId = await createUnit('Acervo');
  const space = await prisma.space.findFirstOrThrow({ where: { orgUnitId } });

  await prisma.document.create({
    data: {
      title: 'Regulamento',
      spaceId: space.id,
      authorId: adminPerson.id,
      ownerId: adminPerson.id,
    },
  });

  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const before = await httpRequest(app)
    .get('/api/documents')
    .query({ scope: 'mine' })
    .set('Cookie', cookie);

  const assigned = await assignPerson(
    orgUnitId,
    { personId: person.id },
    adminCookie,
  );
  expect(assigned.status).toBe(201);

  const after = await httpRequest(app)
    .get('/api/documents')
    .query({ scope: 'mine' })
    .set('Cookie', cookie);

  expect(before.status).toBe(200);
  expect(after.status).toBe(200);
  expect(after.body).toEqual(before.body);
});

test('a document of the unit space stays 404 after the assignment', async () => {
  const orgUnitId = await createUnit('Acervo');
  const space = await prisma.space.findFirstOrThrow({ where: { orgUnitId } });

  const document = await prisma.document.create({
    data: {
      title: 'Regulamento',
      spaceId: space.id,
      authorId: adminPerson.id,
      ownerId: adminPerson.id,
    },
  });

  const { person, cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  await assignPerson(orgUnitId, { personId: person.id }, adminCookie);

  const response = await httpRequest(app)
    .get(`/api/documents/${document.id}`)
    .set('Cookie', cookie);

  expect(response.status).toBe(404);
});
