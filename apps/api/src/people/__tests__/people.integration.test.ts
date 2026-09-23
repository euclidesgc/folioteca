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
import { PEOPLE_SEARCH_LIMIT, PeopleService } from '../people.service';

const EMAIL = 'maria@exemplo.org';

const FORBIDDEN_MESSAGE = 'Apenas a administração pode fazer isso.';

type PersonSummary = { id: string; name: string; email: string };

type PeopleBody = { data: PersonSummary[]; hasMore: boolean };

let app: INestApplication;
let prisma: PrismaService;
let people: PeopleService;

let adminPerson: Person;
let adminCookie: string;

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
  people = app.get(PeopleService);
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

  adminCookie = sessionCookie.split(';')[0] ?? '';
  adminPerson = await prisma.person.findFirstOrThrow({ where: { email: EMAIL } });
});

/** `GET /api/people`, com `q` só quando ele é informado. */
function searchPeople(q?: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app).get('/api/people');
  const withQuery = q === undefined ? request : request.query({ q });

  return cookie === undefined ? withQuery : withQuery.set('Cookie', cookie);
}

/** Cria uma pessoa da organização, sem sessão. */
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

/** Cria `quantity` pessoas cujo nome casa o termo "Silva". */
async function createSilvas(quantity: number): Promise<void> {
  for (let index = 0; index < quantity; index += 1) {
    await createPerson(`Pessoa Silva ${index}`, `silva${index}@exemplo.org`);
  }
}

function bodyOf(response: Response): PeopleBody {
  return response.body as PeopleBody;
}

test('a missing q answers an empty list', async () => {
  await createSilvas(1);

  const response = await searchPeople(undefined, adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response)).toEqual({ data: [], hasMore: false });
});

test('an empty q answers an empty list', async () => {
  await createSilvas(1);

  const response = await searchPeople('', adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response)).toEqual({ data: [], hasMore: false });
});

test('a blank q answers an empty list', async () => {
  await createSilvas(1);

  const response = await searchPeople('   ', adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response)).toEqual({ data: [], hasMore: false });
});

test('the search matches by name', async () => {
  const personId = await createPerson('Ana Silva', 'ana@exemplo.org');
  await createPerson('João Souza', 'joao@exemplo.org');

  const response = await searchPeople('Silva', adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response).data.map((person) => person.id)).toEqual([personId]);
});

test('the search matches by email', async () => {
  const personId = await createPerson('Ana Lima', 'ana.lima@exemplo.org');
  await createPerson('João Souza', 'joao@exemplo.org');

  const response = await searchPeople('ana.lima@', adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response).data.map((person) => person.id)).toEqual([personId]);
});

test('the search ignores case', async () => {
  const personId = await createPerson('Ana Silva', 'ana@exemplo.org');

  const upper = await searchPeople('SILVA', adminCookie);
  const lower = await searchPeople('silva', adminCookie);

  expect(upper.status).toBe(200);
  expect(bodyOf(upper).data.map((person) => person.id)).toEqual([personId]);
  expect(bodyOf(lower).data).toEqual(bodyOf(upper).data);
});

test('eleven matches answer ten people and hasMore true', async () => {
  await createSilvas(PEOPLE_SEARCH_LIMIT + 1);

  const response = await searchPeople('Silva', adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response).data).toHaveLength(PEOPLE_SEARCH_LIMIT);
  expect(bodyOf(response).hasMore).toBe(true);
});

test('exactly ten matches answer hasMore false', async () => {
  await createSilvas(PEOPLE_SEARCH_LIMIT);

  const response = await searchPeople('Silva', adminCookie);

  expect(response.status).toBe(200);
  expect(bodyOf(response).data).toHaveLength(PEOPLE_SEARCH_LIMIT);
  expect(bodyOf(response).hasMore).toBe(false);
});

/**
 * A organização é única por instância — a `0002` a tranca com o check
 * `Organization_singleton_check` —, então uma segunda organização não pode ser
 * gravada e o caso não chega a existir por HTTP. O filtro é provado onde ele
 * mora: o serviço, contra o mesmo Postgres, com outro `organizationId`.
 */
test('a person of another organization never appears', async () => {
  await createSilvas(1);

  const mine = await people.search(adminPerson.organizationId, 'Silva');
  const others = await people.search(randomUUID(), 'Silva');

  expect(mine.data).toHaveLength(1);
  expect(others).toEqual({ data: [], hasMore: false });
});

test('a non-admin answers 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await searchPeople('silva', cookie);

  expect(response.status).toBe(403);
  expect((response.body as { message: string }).message).toBe(
    FORBIDDEN_MESSAGE,
  );
});

test('an anonymous request answers 401', async () => {
  const response = await searchPeople('silva');

  expect(response.status).toBe(401);
});
