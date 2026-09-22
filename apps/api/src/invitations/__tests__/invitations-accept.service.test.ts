import 'reflect-metadata';

import { randomBytes, randomUUID } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PasswordService } from '../../auth/password.service';
import { DomainNotFoundException } from '../../common/domain-not-found.exception';
import type { SessionService } from '../../auth/session.service';
import { hashToken } from '../../common/hash-token';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  ALREADY_A_PERSON_MESSAGE,
  INVITATION_UNAVAILABLE_MESSAGE,
  InvitationsService,
} from '../invitations.service';

const ORGANIZATION_ID = 'organizacao-1';

const ORGANIZATION_NAME = 'Prefeitura de Exemplo';

const INVITATION_ID = '9d5b1c3a-2f77-4a51-b8f0-6d41a1f9c0e2';

const PERSON_ID = 'pessoa-2';

const INVITED_EMAIL = 'convidado@exemplo.org';

const NAME = 'Convidado Souza';

type Mock = ReturnType<typeof vi.fn>;

type InvitationRow = {
  id: string;
  organizationId: string;
  email: string;
  tokenHash: string;
  invitedById: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

/** O `where` que `findPending` monta: hash do token mais "pendente". */
type PendingQuery = {
  where: {
    tokenHash: string;
    acceptedAt: null;
    revokedAt: null;
    expiresAt: { gt: Date };
  };
};

type ServiceDouble = {
  service: InvitationsService;
  findFirst: Mock;
  findOrganization: Mock;
  createPerson: Mock;
  createSpace: Mock;
  updateInvitation: Mock;
  createSession: Mock;
  hash: Mock;
  transaction: Mock;
};

/** Token opaco de teste, gerado em tempo de execução como o do servidor. */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Senha de teste: nada com cara de credencial fica no repositório. */
function newPassword(): string {
  return randomUUID();
}

function invitationRow(
  token: string,
  overrides: Partial<InvitationRow> = {},
): InvitationRow {
  return {
    id: INVITATION_ID,
    organizationId: ORGANIZATION_ID,
    email: INVITED_EMAIL,
    tokenHash: hashToken(token),
    invitedById: 'pessoa-1',
    createdAt: new Date('2026-03-10T12:00:00.000Z'),
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

/**
 * Serviço com um Prisma falso: `invitation` é a linha que existe na tabela e
 * `transactionError` faz a transação inteira falhar. O falso aplica o `where`
 * que recebe, como o Postgres faria: desde a 087 quem decide se o convite está
 * pendente é a consulta, não o serviço.
 */
function createService(options: {
  invitation?: InvitationRow | null;
  transactionError?: unknown;
}): ServiceDouble {
  const findFirst = vi.fn().mockImplementation((args: PendingQuery) => {
    const row = options.invitation ?? null;

    if (row === null) {
      return null;
    }

    const matches =
      row.tokenHash === args.where.tokenHash &&
      row.acceptedAt === args.where.acceptedAt &&
      row.revokedAt === args.where.revokedAt &&
      row.expiresAt.getTime() > args.where.expiresAt.gt.getTime();

    return matches ? row : null;
  });
  const findOrganization = vi
    .fn()
    .mockResolvedValue({ id: ORGANIZATION_ID, name: ORGANIZATION_NAME });
  const createPerson = vi
    .fn()
    .mockImplementation((args: { data: Record<string, unknown> }) => ({
      id: PERSON_ID,
      createdAt: new Date(),
      ...args.data,
    }));
  const createSpace = vi.fn().mockResolvedValue({ id: 'espaco-1' });
  const updateInvitation = vi.fn().mockResolvedValue({ id: INVITATION_ID });
  const createSession = vi
    .fn()
    .mockResolvedValue({ token: newToken(), expiresAt: new Date() });
  const hash = vi.fn().mockResolvedValue('argon2-hash');

  const tx = {
    person: { create: createPerson },
    space: { create: createSpace },
    invitation: { update: updateInvitation },
    organization: { findUniqueOrThrow: findOrganization },
  };

  const transaction =
    'transactionError' in options
      ? vi.fn().mockRejectedValue(options.transactionError)
      : vi
          .fn()
          .mockImplementation((run: (client: typeof tx) => unknown) => run(tx));

  const prisma = {
    $transaction: transaction,
    invitation: { findFirst },
    organization: { findUniqueOrThrow: findOrganization },
  } as unknown as PrismaService;

  const passwords = { hash } as unknown as PasswordService;
  const sessions = { create: createSession } as unknown as SessionService;

  return {
    service: new InvitationsService(prisma, passwords, sessions),
    findFirst,
    findOrganization,
    createPerson,
    createSpace,
    updateInvitation,
    createSession,
    hash,
    transaction,
  };
}

/** Violação do `@unique` de `Person.email` como o Prisma a entrega. */
function personEmailViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('índice único violado', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { modelName: 'Person', target: ['email'] },
  });
}

test('findPending returns null for an unknown token', async () => {
  const { service, findFirst } = createService({ invitation: null });
  const token = newToken();

  await expect(service.getPreview(token)).rejects.toThrow(
    new DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE),
  );

  expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
    where: { tokenHash: hashToken(token) },
  });
});

test('findPending returns null for an expired invitation', async () => {
  const token = newToken();
  const { service } = createService({
    invitation: invitationRow(token, {
      expiresAt: new Date(Date.now() - 60_000),
    }),
  });

  await expect(service.getPreview(token)).rejects.toThrow(
    new DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE),
  );
});

test('findPending returns null for an already accepted invitation', async () => {
  const token = newToken();
  const { service } = createService({
    invitation: invitationRow(token, { acceptedAt: new Date() }),
  });

  await expect(service.getPreview(token)).rejects.toThrow(
    new DomainNotFoundException(INVITATION_UNAVAILABLE_MESSAGE),
  );
});

test('findPending runs every check without an extra query', async () => {
  const token = newToken();
  const { service, findFirst, findOrganization } = createService({
    invitation: invitationRow(token, {
      expiresAt: new Date(Date.now() - 60_000),
      acceptedAt: new Date(),
    }),
  });

  await expect(service.getPreview(token)).rejects.toThrow(
    INVITATION_UNAVAILABLE_MESSAGE,
  );

  expect(findFirst).toHaveBeenCalledTimes(1);
  expect(findOrganization).not.toHaveBeenCalled();
});

test('accept hashes the password before opening the transaction', async () => {
  const token = newToken();
  const { service, hash, transaction } = createService({
    invitation: invitationRow(token),
  });

  await service.accept(token, { name: NAME, password: newPassword() });

  expect(hash).toHaveBeenCalledTimes(1);
  expect(hash.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
    transaction.mock.invocationCallOrder[0] ?? 0,
  );
});

test('accept creates the person, the personal space, the invitation update and the session in this order', async () => {
  const token = newToken();
  const {
    service,
    createPerson,
    createSpace,
    updateInvitation,
    createSession,
  } = createService({ invitation: invitationRow(token) });

  await service.accept(token, { name: NAME, password: newPassword() });

  const order = [
    createPerson.mock.invocationCallOrder[0] ?? 0,
    createSpace.mock.invocationCallOrder[0] ?? 0,
    updateInvitation.mock.invocationCallOrder[0] ?? 0,
    createSession.mock.invocationCallOrder[0] ?? 0,
  ];

  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(createSpace).toHaveBeenCalledWith({
    data: { type: 'PERSONAL', personId: PERSON_ID },
  });
  expect(updateInvitation.mock.calls[0]?.[0]).toMatchObject({
    where: { id: INVITATION_ID },
  });
  expect(createSession.mock.calls[0]?.[0]).toBe(PERSON_ID);
});

test('accept creates the person with isAdmin false and the e-mail from the invitation', async () => {
  const token = newToken();
  const { service, createPerson } = createService({
    invitation: invitationRow(token),
  });

  const result = await service.accept(token, {
    name: NAME,
    password: newPassword(),
  });

  expect(createPerson.mock.calls[0]?.[0]).toMatchObject({
    data: {
      organizationId: ORGANIZATION_ID,
      name: NAME,
      email: INVITED_EMAIL,
      isAdmin: false,
    },
  });
  expect(result.user.person.email).toBe(INVITED_EMAIL);
  expect(result.user.person.isAdmin).toBe(false);
  expect(result.user.organization.name).toBe(ORGANIZATION_NAME);
});

test('accept turns a P2002 on the person e-mail index into ConflictException', async () => {
  const token = newToken();
  const { service } = createService({
    invitation: invitationRow(token),
    transactionError: personEmailViolation(),
  });

  await expect(
    service.accept(token, { name: NAME, password: newPassword() }),
  ).rejects.toThrow(new ConflictException(ALREADY_A_PERSON_MESSAGE));
});

test('accept rethrows any other error without the token in the message', async () => {
  const token = newToken();
  const { service } = createService({
    invitation: invitationRow(token),
    transactionError: new Error('banco fora do ar'),
  });

  const thrown = await service
    .accept(token, { name: NAME, password: newPassword() })
    .then(
      () => undefined,
      (error: unknown) => error,
    );

  expect(thrown).toBeInstanceOf(Error);
  expect((thrown as Error).message).toBe('banco fora do ar');
  expect((thrown as Error).message).not.toContain(token);
});
