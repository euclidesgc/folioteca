import 'reflect-metadata';

import { randomBytes, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { hashToken } from '../../common/hash-token';
import { PrismaService } from '../../prisma/prisma.service';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';
import {
  ALREADY_A_PERSON_MESSAGE,
  INVITATION_TTL_MS,
  INVITATION_UNAVAILABLE_MESSAGE,
} from '../invitations.service';

const EMAIL = 'maria@exemplo.org';

const GUEST_EMAIL = 'convidado@exemplo.org';

const ORGANIZATION_NAME = 'Prefeitura de Exemplo';

const GUEST_NAME = 'Convidado Souza';

const INVALID_MESSAGE = 'Dados inválidos.';

const SESSION_COOKIE_PREFIX = 'folioteca_session=';

/** Cabeçalhos que variam por natureza e não entram na comparação. */
const VOLATILE_HEADERS = ['date', 'content-length'];

let app: INestApplication;
let prisma: PrismaService;

let adminPerson: Person;
let adminCookie: string;

/** Senha de teste gerada em tempo de execução, nunca um literal. */
function newPassword(): string {
  return randomUUID();
}

/** Token opaco inexistente, no mesmo formato do servidor. */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function sessionCookieOf(response: Response): string {
  const cookies = (response.headers['set-cookie'] ?? []) as string[];
  const cookie = cookies.find((item) => item.startsWith(SESSION_COOKIE_PREFIX));

  if (cookie === undefined) {
    throw new Error('A resposta não trouxe o cookie de sessão.');
  }

  return cookie;
}

function postInvitation(body: object, cookie: string): Promise<Response> {
  return httpRequest(app)
    .post('/api/invitations')
    .set('X-Requested-With', 'XMLHttpRequest')
    .set('Cookie', cookie)
    .send(body);
}

/** Cria um convite pela API e devolve o token em claro dele. */
async function inviteToken(email: string): Promise<string> {
  const response = await postInvitation({ email }, adminCookie);

  return (response.body as { data: { token: string } }).data.token;
}

function getInvitation(token: string, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .get(`/api/invitations/${token}`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

function postAccept(
  token: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .post(`/api/invitations/${token}/accept`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body as object,
  );
}

/** Resposta reduzida ao que precisa ser idêntico entre as recusas. */
function comparable(response: Response): unknown {
  const headers = Object.entries(response.headers as Record<string, unknown>)
    .filter(([name]) => !VOLATILE_HEADERS.includes(name.toLowerCase()))
    .map(([name, value]) => `${name.toLowerCase()}: ${String(value)}`)
    .sort();

  return {
    status: response.status,
    body: JSON.stringify(response.body),
    headers,
  };
}

beforeAll(async () => {
  app = await createApp();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDatabase(prisma);

  const install = await httpRequest(app)
    .post('/api/installation')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      code: process.env.INSTALL_CODE ?? '',
      organizationName: ORGANIZATION_NAME,
      name: 'Maria Souza',
      email: EMAIL,
      password: newPassword(),
    });

  adminCookie = sessionCookieOf(install).split(';')[0] ?? '';
  adminPerson = await prisma.person.findFirstOrThrow({ where: { email: EMAIL } });
});

test('accepting a valid invitation answers 201 with the current user and an HttpOnly session cookie', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await postAccept(token, {
    name: GUEST_NAME,
    password: newPassword(),
  });

  expect(response.status).toBe(201);

  const body = response.body as {
    data: {
      person: { id: string; name: string; email: string; isAdmin: boolean };
      organization: { name: string };
    };
  };

  expect(body.data.person.name).toBe(GUEST_NAME);
  expect(body.data.person.email).toBe(GUEST_EMAIL);
  expect(body.data.person.isAdmin).toBe(false);
  expect(body.data.organization.name).toBe(ORGANIZATION_NAME);

  const cookie = sessionCookieOf(response);
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Lax');

  const sessionToken = cookie.slice(SESSION_COOKIE_PREFIX.length).split(';')[0];
  const session = await prisma.session.findUniqueOrThrow({
    where: { tokenHash: hashToken(sessionToken ?? '') },
  });

  expect(session.personId).toBe(body.data.person.id);
});

test('the accepted invitation creates a non-admin person with a single personal space and no unit space', async () => {
  const unitSpacesBefore = await prisma.space.count({ where: { type: 'UNIT' } });
  const token = await inviteToken(GUEST_EMAIL);

  await postAccept(token, { name: GUEST_NAME, password: newPassword() });

  const person = await prisma.person.findFirstOrThrow({
    where: { email: GUEST_EMAIL },
  });

  expect(person.isAdmin).toBe(false);
  expect(person.organizationId).toBe(adminPerson.organizationId);
  expect(
    await prisma.space.count({ where: { personId: person.id, type: 'PERSONAL' } }),
  ).toBe(1);
  expect(await prisma.space.count({ where: { personId: person.id } })).toBe(1);
  expect(await prisma.space.count({ where: { type: 'UNIT' } })).toBe(
    unitSpacesBefore,
  );
});

test('the created session cookie works on GET /auth/me', async () => {
  const token = await inviteToken(GUEST_EMAIL);
  const accepted = await postAccept(token, {
    name: GUEST_NAME,
    password: newPassword(),
  });

  const cookie = sessionCookieOf(accepted).split(';')[0] ?? '';

  const me = await httpRequest(app).get('/api/auth/me').set('Cookie', cookie);

  expect(me.status).toBe(200);
  expect(me.body).toEqual(accepted.body);
});

test('the invitation is marked as accepted inside the same transaction', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  await postAccept(token, { name: GUEST_NAME, password: newPassword() });

  const invitation = await prisma.invitation.findUniqueOrThrow({
    where: { tokenHash: hashToken(token) },
  });
  const person = await prisma.person.findFirstOrThrow({
    where: { email: GUEST_EMAIL },
  });

  expect(invitation.acceptedAt).not.toBeNull();
  expect(await prisma.session.count({ where: { personId: person.id } })).toBe(1);
});

test('using the same link twice answers 404', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  await postAccept(token, { name: GUEST_NAME, password: newPassword() });

  const second = await postAccept(token, {
    name: GUEST_NAME,
    password: newPassword(),
  });

  expect(second.status).toBe(404);
  expect(second.body).toMatchObject({
    message: INVITATION_UNAVAILABLE_MESSAGE,
  });
  expect(await prisma.person.count({ where: { email: GUEST_EMAIL } })).toBe(1);
});

test('an expired invitation answers 404 on GET and on POST', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  await prisma.invitation.update({
    where: { tokenHash: hashToken(token) },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });

  const preview = await getInvitation(token);
  const accepted = await postAccept(token, {
    name: GUEST_NAME,
    password: newPassword(),
  });

  expect(preview.status).toBe(404);
  expect(accepted.status).toBe(404);
  expect(await prisma.person.count({ where: { email: GUEST_EMAIL } })).toBe(0);
});

test('the three refusals answer byte-identical responses', async () => {
  const unknown = newToken();

  const expired = await inviteToken('expirado@exemplo.org');
  await prisma.invitation.update({
    where: { tokenHash: hashToken(expired) },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });

  const accepted = await inviteToken('aceito@exemplo.org');
  await postAccept(accepted, { name: GUEST_NAME, password: newPassword() });

  const previews = [
    await getInvitation(unknown),
    await getInvitation(expired),
    await getInvitation(accepted),
  ].map(comparable);

  const body = { name: GUEST_NAME, password: newPassword() };
  const accepts = [
    await postAccept(unknown, body),
    await postAccept(expired, body),
    await postAccept(accepted, body),
  ].map(comparable);

  expect(previews[1]).toEqual(previews[0]);
  expect(previews[2]).toEqual(previews[0]);
  expect(accepts[1]).toEqual(accepts[0]);
  expect(accepts[2]).toEqual(accepts[0]);
});

test('an e-mail that already belongs to a person answers 409 and leaves the invitation pending', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  await prisma.person.create({
    data: {
      organizationId: adminPerson.organizationId,
      name: 'Outro Convidado',
      email: GUEST_EMAIL,
      passwordHash: randomUUID(),
    },
  });

  const response = await postAccept(token, {
    name: GUEST_NAME,
    password: newPassword(),
  });

  expect(response.status).toBe(409);
  expect(response.body).toMatchObject({ message: ALREADY_A_PERSON_MESSAGE });

  const invitation = await prisma.invitation.findUniqueOrThrow({
    where: { tokenHash: hashToken(token) },
  });

  expect(invitation.acceptedAt).toBeNull();
  expect(await prisma.person.count({ where: { email: GUEST_EMAIL } })).toBe(1);
});

test('a password with eleven characters answers 400 on the password field', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await postAccept(token, {
    name: GUEST_NAME,
    password: newPassword().slice(0, 11),
  });

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: INVALID_MESSAGE,
    errors: [
      {
        field: 'password',
        message: 'A senha precisa ter pelo menos 12 caracteres.',
      },
    ],
  });
  expect(await prisma.person.count({ where: { email: GUEST_EMAIL } })).toBe(0);
});

test('an empty name answers 400 on the name field', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await postAccept(token, {
    name: '   ',
    password: newPassword(),
  });

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: INVALID_MESSAGE,
    errors: [{ field: 'name', message: 'Informe o seu nome.' }],
  });
});

test('an unknown field in the body answers 400', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await postAccept(token, {
    name: GUEST_NAME,
    password: newPassword(),
    email: 'outro@exemplo.org',
  });

  expect(response.status).toBe(400);
  expect((response.body as { message: string }).message).toBe(INVALID_MESSAGE);
  expect(await prisma.person.count({ where: { email: GUEST_EMAIL } })).toBe(0);
});

test('an invalid body answers 400 even when the token is unknown', async () => {
  const response = await postAccept(newToken(), {
    name: '',
    password: newPassword().slice(0, 11),
  });

  expect(response.status).toBe(400);
});

test('accepting without X-Requested-With answers 403', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const response = await httpRequest(app)
    .post(`/api/invitations/${token}/accept`)
    .send({ name: GUEST_NAME, password: newPassword() });

  expect(response.status).toBe(403);
  expect(await prisma.person.count({ where: { email: GUEST_EMAIL } })).toBe(0);
});

test('a session cookie from another person changes nothing and stays valid', async () => {
  const token = await inviteToken(GUEST_EMAIL);

  const anonymousPreview = await getInvitation(token);
  const signedInPreview = await getInvitation(token, adminCookie);

  expect(signedInPreview.status).toBe(anonymousPreview.status);
  expect(signedInPreview.body).toEqual(anonymousPreview.body);

  const unknown = newToken();
  const body = { name: GUEST_NAME, password: newPassword() };

  expect(comparable(await postAccept(unknown, body, adminCookie))).toEqual(
    comparable(await postAccept(unknown, body)),
  );

  const accepted = await postAccept(token, body, adminCookie);
  expect(accepted.status).toBe(201);

  const me = await httpRequest(app)
    .get('/api/auth/me')
    .set('Cookie', adminCookie);

  expect(me.status).toBe(200);
  expect((me.body as { data: { person: { email: string } } }).data.person.email).toBe(
    EMAIL,
  );
});

test('the same e-mail can be invited again after accepting', async () => {
  // Convite já aceito, gravado direto no banco com outra caixa: a remoção por
  // e-mail exato da criação não o alcança, então quem decide é o índice
  // parcial da `0010` — com o índice da `0009` este convite novo daria P2002.
  await prisma.invitation.create({
    data: {
      organizationId: adminPerson.organizationId,
      invitedById: adminPerson.id,
      email: GUEST_EMAIL.toUpperCase(),
      tokenHash: hashToken(newToken()),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      acceptedAt: new Date(),
    },
  });

  const response = await postInvitation({ email: GUEST_EMAIL }, adminCookie);

  expect(response.status).toBe(201);
  expect(await prisma.invitation.count()).toBe(2);
});

test('two pending invitations for the same e-mail are still rejected', async () => {
  const base = {
    organizationId: adminPerson.organizationId,
    invitedById: adminPerson.id,
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  };

  await prisma.invitation.create({
    data: { ...base, email: GUEST_EMAIL, tokenHash: hashToken(newToken()) },
  });

  await expect(
    prisma.invitation.create({
      data: {
        ...base,
        email: GUEST_EMAIL.toUpperCase(),
        tokenHash: hashToken(newToken()),
      },
    }),
  ).rejects.toMatchObject({ code: 'P2002' });
});
