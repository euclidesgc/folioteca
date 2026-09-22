import 'reflect-metadata';

import { createHash, randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import type { Person } from '@prisma/client';
import type { Response } from 'supertest';

import { createApp } from '../../create-app';
import { DomainNotFoundException } from '../../common/domain-not-found.exception';
import { PrismaService } from '../../prisma/prisma.service';
import { createPersonWithSession } from '../../../test/create-person';
import { httpRequest } from '../../../test/http';
import { resetDatabase } from '../../../test/reset-database';
import {
  ALREADY_A_PERSON_MESSAGE,
  INVITATION_TTL_MS,
  INVITATION_UNAVAILABLE_MESSAGE,
  InvitationsService,
} from '../invitations.service';

const EMAIL = 'maria@exemplo.org';

const GUEST_EMAIL = 'convidado@exemplo.org';

const ORGANIZATION_NAME = 'Prefeitura de Exemplo';

const FORBIDDEN_MESSAGE = 'Apenas a administração pode fazer isso.';

const UNAUTHORIZED_MESSAGE = 'Sessão não encontrada.';

const INVALID_MESSAGE = 'Dados inválidos.';

type CreatedInvitationBody = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  token: string;
};

let app: INestApplication;
let prisma: PrismaService;

let adminPerson: Person;
let adminCookie: string;

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
  adminPerson = await prisma.person.findFirstOrThrow({
    where: { email: EMAIL },
  });
});

/** Envia `POST /api/invitations` com o cabeçalho que o CSRF do projeto exige. */
function postInvitation(body: unknown, cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .post('/api/invitations')
    .set('X-Requested-With', 'XMLHttpRequest');

  return (cookie === undefined ? request : request.set('Cookie', cookie)).send(
    body as object,
  );
}

/** Envia `GET /api/invitations` com o cabeçalho que o CSRF do projeto exige. */
function getInvitations(cookie?: string): Promise<Response> {
  const request = httpRequest(app)
    .get('/api/invitations')
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

function invitationOf(response: Response): CreatedInvitationBody {
  return (response.body as { data: CreatedInvitationBody }).data;
}

type InvitationListItemBody = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
};

function listOf(response: Response): InvitationListItemBody[] {
  return (response.body as { data: InvitationListItemBody[] }).data;
}

function messageOf(response: Response): string {
  return (response.body as { message: string }).message;
}

test('an admin creates an invitation and gets 201 with a non-empty token', async () => {
  const response = await postInvitation({ email: GUEST_EMAIL }, adminCookie);

  expect(response.status).toBe(201);

  const invitation = invitationOf(response);
  expect(invitation.email).toBe(GUEST_EMAIL);
  expect(invitation.id).not.toBe('');
  expect(invitation.token.length).toBeGreaterThan(0);

  const stored = await prisma.invitation.findFirstOrThrow();
  expect(stored.id).toBe(invitation.id);
  expect(stored.organizationId).toBe(adminPerson.organizationId);
  expect(stored.invitedById).toBe(adminPerson.id);
});

test('expiresAt is seven days after createdAt', async () => {
  const response = await postInvitation({ email: GUEST_EMAIL }, adminCookie);
  const invitation = invitationOf(response);

  const distance =
    new Date(invitation.expiresAt).getTime() -
    new Date(invitation.createdAt).getTime();

  expect(Math.abs(distance - INVITATION_TTL_MS)).toBeLessThan(5_000);
});

test('only the hash reaches the database', async () => {
  const response = await postInvitation({ email: GUEST_EMAIL }, adminCookie);
  const { token } = invitationOf(response);

  const row = await prisma.invitation.findFirstOrThrow();

  expect(row.tokenHash).toBe(
    createHash('sha256').update(token).digest('hex'),
  );
  expect(
    Object.values(row).filter(
      (value) => typeof value === 'string' && value.includes(token),
    ),
  ).toEqual([]);
});

test('a person who is not admin gets 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await postInvitation({ email: GUEST_EMAIL }, cookie);

  expect(response.status).toBe(403);
  expect(messageOf(response)).toBe(FORBIDDEN_MESSAGE);
  expect(await prisma.invitation.count()).toBe(0);
});

test('answers 401 without a session cookie', async () => {
  const response = await postInvitation({ email: GUEST_EMAIL });

  expect(response.status).toBe(401);
  expect(messageOf(response)).toBe(UNAUTHORIZED_MESSAGE);
  expect(await prisma.invitation.count()).toBe(0);
});

test('an e-mail already registered as a person answers 409', async () => {
  const response = await postInvitation(
    { email: `  ${EMAIL.toUpperCase()}  ` },
    adminCookie,
  );

  expect(response.status).toBe(409);
  expect(messageOf(response)).toBe(ALREADY_A_PERSON_MESSAGE);
  expect(await prisma.invitation.count()).toBe(0);
});

test('inviting the same e-mail again replaces the invitation', async () => {
  const first = invitationOf(
    await postInvitation({ email: GUEST_EMAIL }, adminCookie),
  );
  const second = invitationOf(
    await postInvitation({ email: GUEST_EMAIL }, adminCookie),
  );

  expect(second.id).not.toBe(first.id);
  expect(await prisma.invitation.count({ where: { email: GUEST_EMAIL } })).toBe(
    1,
  );

  const oldHash = createHash('sha256').update(first.token).digest('hex');
  expect(await prisma.invitation.count({ where: { tokenHash: oldHash } })).toBe(
    0,
  );
});

test('an invalid e-mail answers 400 with the field error', async () => {
  const response = await postInvitation({ email: 'nao-e-email' }, adminCookie);

  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    message: INVALID_MESSAGE,
    errors: [{ field: 'email', message: 'Informe um e-mail válido.' }],
  });
  expect(await prisma.invitation.count()).toBe(0);
});

test('an unknown field answers 400', async () => {
  const response = await postInvitation(
    { email: GUEST_EMAIL, name: 'Convidado' },
    adminCookie,
  );

  expect(response.status).toBe(400);
  expect(messageOf(response)).toBe(INVALID_MESSAGE);
  expect(await prisma.invitation.count()).toBe(0);
});

test('the database refuses two invitations for the same e-mail differing only in case', async () => {
  const base = {
    organizationId: adminPerson.organizationId,
    invitedById: adminPerson.id,
    expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
  };

  await prisma.invitation.create({
    data: { ...base, email: GUEST_EMAIL, tokenHash: randomUUID() },
  });

  await expect(
    prisma.invitation.create({
      data: {
        ...base,
        email: GUEST_EMAIL.toUpperCase(),
        tokenHash: randomUUID(),
      },
    }),
  ).rejects.toMatchObject({ code: 'P2002' });
});

test('an admin sees only the pending invitations', async () => {
  const created = invitationOf(
    await postInvitation({ email: GUEST_EMAIL }, adminCookie),
  );

  const response = await getInvitations(adminCookie);

  expect(response.status).toBe(200);
  const invitations = listOf(response);
  expect(invitations).toHaveLength(1);
  expect(invitations[0]?.id).toBe(created.id);
  expect(invitations[0]?.email).toBe(GUEST_EMAIL);
});

test('an accepted invitation is not listed', async () => {
  const created = invitationOf(
    await postInvitation({ email: GUEST_EMAIL }, adminCookie),
  );

  await prisma.invitation.update({
    where: { id: created.id },
    data: { acceptedAt: new Date() },
  });

  const response = await getInvitations(adminCookie);

  expect(listOf(response)).toEqual([]);
});

test('an expired invitation is not listed', async () => {
  const created = invitationOf(
    await postInvitation({ email: GUEST_EMAIL }, adminCookie),
  );

  await prisma.invitation.update({
    where: { id: created.id },
    data: { expiresAt: new Date(Date.now() - 1_000) },
  });

  const response = await getInvitations(adminCookie);

  expect(listOf(response)).toEqual([]);
});

test('the invitations come from the newest to the oldest', async () => {
  const first = invitationOf(
    await postInvitation({ email: 'primeiro@exemplo.org' }, adminCookie),
  );
  const second = invitationOf(
    await postInvitation({ email: 'segundo@exemplo.org' }, adminCookie),
  );
  const third = invitationOf(
    await postInvitation({ email: 'terceiro@exemplo.org' }, adminCookie),
  );

  await prisma.invitation.update({
    where: { id: first.id },
    data: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
  });
  await prisma.invitation.update({
    where: { id: second.id },
    data: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
  });
  await prisma.invitation.update({
    where: { id: third.id },
    data: { createdAt: new Date('2026-01-03T00:00:00.000Z') },
  });

  const response = await getInvitations(adminCookie);

  expect(listOf(response).map((item) => item.id)).toEqual([
    third.id,
    second.id,
    first.id,
  ]);
});

test('with no pending invitation the list answers 200 with an empty data array', async () => {
  const response = await getInvitations(adminCookie);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ data: [] });
});

test('a non-admin answers 403', async () => {
  const { cookie } = await createPersonWithSession(app, {
    name: 'João Souza',
    email: 'joao@exemplo.org',
  });

  const response = await getInvitations(cookie);

  expect(response.status).toBe(403);
  expect(messageOf(response)).toBe(FORBIDDEN_MESSAGE);
});

test('an anonymous request answers 401', async () => {
  const response = await getInvitations();

  expect(response.status).toBe(401);
  expect(messageOf(response)).toBe(UNAUTHORIZED_MESSAGE);
});

test('the list body never contains the invitation token', async () => {
  const created = invitationOf(
    await postInvitation({ email: GUEST_EMAIL }, adminCookie),
  );
  const tokenHash = createHash('sha256').update(created.token).digest('hex');

  const response = await getInvitations(adminCookie);

  const raw = JSON.stringify(response.body);
  expect(raw).not.toContain(created.token);
  expect(raw).not.toContain(tokenHash);
});

test('the list items expose exactly id, email, createdAt and expiresAt', async () => {
  await postInvitation({ email: GUEST_EMAIL }, adminCookie);

  const response = await getInvitations(adminCookie);
  const invitations = listOf(response);

  expect(Object.keys(invitations[0] ?? {}).sort()).toEqual([
    'createdAt',
    'email',
    'expiresAt',
    'id',
  ]);
});

/** O único corpo de recusa do convite, o mesmo para os cinco estados. */
const UNAVAILABLE_BODY = { message: INVITATION_UNAVAILABLE_MESSAGE };

const SECOND_GUEST_EMAIL = 'ana@exemplo.com.br';

/** Envia a revogação com o cabeçalho que o CSRF do projeto exige. */
function revokeInvitation(
  invitationId: string,
  cookie?: string,
): Promise<Response> {
  const request = httpRequest(app)
    .post(`/api/invitations/${invitationId}/revoke`)
    .set('X-Requested-With', 'XMLHttpRequest');

  return cookie === undefined ? request : request.set('Cookie', cookie);
}

/** Abre o link do convite, como quem o recebeu por e-mail. */
function getInvitationByToken(token: string): Promise<Response> {
  return httpRequest(app).get(`/api/invitations/${token}`);
}

/** Envia o aceite com o cabeçalho que o CSRF do projeto exige. */
function postAccept(token: string, body: object): Promise<Response> {
  return httpRequest(app)
    .post(`/api/invitations/${token}/accept`)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(body);
}

/** Cria um convite pela API e devolve o corpo dele. */
async function invite(email: string): Promise<CreatedInvitationBody> {
  return invitationOf(await postInvitation({ email }, adminCookie));
}

const unavailableCases: Array<[string, () => Promise<string>]> = [
  [
    'an accepted invitation',
    async () => {
      const created = await invite(GUEST_EMAIL);

      await postAccept(created.token, {
        name: 'Convidado Souza',
        password: randomUUID(),
      });

      return created.id;
    },
  ],
  [
    'an expired invitation',
    async () => {
      const created = await invite(GUEST_EMAIL);

      await prisma.invitation.update({
        where: { id: created.id },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      return created.id;
    },
  ],
  ['an unknown id', () => Promise.resolve(randomUUID())],
];

describe('revoking an invitation', () => {
  test('revoking a pending invitation answers 204 with no body', async () => {
    const created = await invite(GUEST_EMAIL);

    const response = await revokeInvitation(created.id, adminCookie);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(response.text).toBe('');
  });

  test('a revoked invitation disappears from the list', async () => {
    const created = await invite(GUEST_EMAIL);

    await revokeInvitation(created.id, adminCookie);

    expect(listOf(await getInvitations(adminCookie))).toEqual([]);
  });

  test('the revoked link answers exactly what an unknown link answers', async () => {
    const created = await invite(GUEST_EMAIL);

    const unknown = await getInvitationByToken(randomUUID());

    await revokeInvitation(created.id, adminCookie);

    const revoked = await getInvitationByToken(created.token);

    const unknownBody: unknown = unknown.body;
    const revokedBody: unknown = revoked.body;

    expect(revoked.status).toBe(unknown.status);
    expect(revokedBody).toEqual(unknownBody);
  });

  test('accepting a revoked token answers the same not found', async () => {
    const created = await invite(GUEST_EMAIL);

    await revokeInvitation(created.id, adminCookie);

    const response = await postAccept(created.token, {
      name: 'Convidado Souza',
      password: randomUUID(),
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  test('revoking twice answers the same not found', async () => {
    const created = await invite(GUEST_EMAIL);

    await revokeInvitation(created.id, adminCookie);

    const response = await revokeInvitation(created.id, adminCookie);

    expect(response.status).toBe(404);
    expect(response.body).toEqual(UNAVAILABLE_BODY);
  });

  test.each(unavailableCases)(
    '%s answers the same not found',
    async (_name, createInvitationId) => {
      const invitationId = await createInvitationId();

      const response = await revokeInvitation(invitationId, adminCookie);

      expect(response.status).toBe(404);
      expect(response.body).toEqual(UNAVAILABLE_BODY);
    },
  );

  /**
   * A organização é única por instância — a `0002` a tranca com o check
   * `Organization_singleton_check` —, então uma segunda organização não pode
   * ser gravada e o caso não chega a existir por HTTP. A recusa é provada onde
   * ela mora: o serviço, contra o mesmo Postgres, com um `organizationId` que
   * não é o do convite.
   */
  test('an invitation of another organization answers the same not found', async () => {
    const created = await invite(GUEST_EMAIL);
    const service = app.get(InvitationsService);

    const error = await service.revoke(randomUUID(), created.id).then(
      () => undefined,
      (thrown: unknown) => thrown,
    );

    expect(error).toBeInstanceOf(DomainNotFoundException);
    expect((error as Error).message).toBe(UNAVAILABLE_BODY.message);
    expect(
      await prisma.invitation.count({
        where: { id: created.id, revokedAt: null },
      }),
    ).toBe(1);
  });

  test('a non-admin answers 403', async () => {
    const created = await invite(GUEST_EMAIL);
    const { cookie } = await createPersonWithSession(app, {
      name: 'João Souza',
      email: 'joao@exemplo.org',
    });

    const response = await revokeInvitation(created.id, cookie);

    expect(response.status).toBe(403);
    expect(messageOf(response)).toBe(FORBIDDEN_MESSAGE);
    expect(
      await prisma.invitation.count({ where: { id: created.id, revokedAt: null } }),
    ).toBe(1);
  });

  test('an anonymous request answers 401', async () => {
    const created = await invite(GUEST_EMAIL);

    const response = await revokeInvitation(created.id);

    expect(response.status).toBe(401);
    expect(messageOf(response)).toBe(UNAUTHORIZED_MESSAGE);
    expect(
      await prisma.invitation.count({ where: { id: created.id, revokedAt: null } }),
    ).toBe(1);
  });

  test('the same e-mail can be invited again after a revoke', async () => {
    const first = await invite(SECOND_GUEST_EMAIL);

    await revokeInvitation(first.id, adminCookie);

    const again = await postInvitation(
      { email: SECOND_GUEST_EMAIL },
      adminCookie,
    );

    expect(again.status).toBe(201);
    expect(listOf(await getInvitations(adminCookie))).toHaveLength(1);

    const revoked = await prisma.invitation.findUniqueOrThrow({
      where: { id: first.id },
    });

    expect(revoked.revokedAt).toBeInstanceOf(Date);
  });

  test('revoking keeps the session of who already accepted', async () => {
    const accepted = await invite(GUEST_EMAIL);
    const acceptance = await postAccept(accepted.token, {
      name: 'Convidado Souza',
      password: randomUUID(),
    });

    const guestCookies = (acceptance.headers['set-cookie'] ?? []) as string[];
    const guestCookie = (
      guestCookies.find((item) => item.startsWith('folioteca_session=')) ?? ''
    ).split(';')[0];

    const pending = await invite(SECOND_GUEST_EMAIL);
    const people = await prisma.person.count();
    const sessions = await prisma.session.count();

    await revokeInvitation(pending.id, adminCookie);

    const me = await httpRequest(app)
      .get('/api/auth/me')
      .set('Cookie', guestCookie ?? '');

    expect(me.status).toBe(200);
    expect(await prisma.person.count()).toBe(people);
    expect(await prisma.session.count()).toBe(sessions);
  });
});
