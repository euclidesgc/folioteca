import 'reflect-metadata';

import { createHash } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import {
  ALREADY_A_PERSON_MESSAGE,
  INVITATION_TTL_MS,
  InvitationsService,
  RACE_MESSAGE,
} from '../invitations.service';

const ORGANIZATION_ID = 'organizacao-1';

const INVITED_BY_ID = 'pessoa-1';

const EMAIL = 'convidado@exemplo.org';

const INVITATION_ID = '9d5b1c3a-2f77-4a51-b8f0-6d41a1f9c0e2';

type Mock = ReturnType<typeof vi.fn>;

type ServiceDouble = {
  service: InvitationsService;
  findFirst: Mock;
  deleteMany: Mock;
  createInvitation: Mock;
  transaction: Mock;
};

/** Momento fixo em que o convite é criado, para conferir `expiresAt`. */
const CREATED_AT = new Date('2026-03-10T12:00:00.000Z');

/**
 * Serviço com um Prisma falso: `person` é o que a busca por pessoa devolve e
 * `transactionError` faz a transação inteira falhar.
 */
function createService(options: {
  person?: { id: string } | null;
  transactionError?: unknown;
}): ServiceDouble {
  const findFirst = vi.fn().mockResolvedValue(options.person ?? null);
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const createInvitation = vi.fn().mockImplementation(
    (args: { data: { expiresAt: Date } }) => ({
      id: INVITATION_ID,
      email: EMAIL,
      createdAt: CREATED_AT,
      expiresAt: args.data.expiresAt,
    }),
  );

  const tx = {
    person: { findFirst },
    invitation: { deleteMany, create: createInvitation },
  };

  const transaction =
    'transactionError' in options
      ? vi.fn().mockRejectedValue(options.transactionError)
      : vi
          .fn()
          .mockImplementation((run: (client: typeof tx) => unknown) => run(tx));

  const prisma = { $transaction: transaction } as unknown as PrismaService;

  return {
    service: new InvitationsService(prisma),
    findFirst,
    deleteMany,
    createInvitation,
    transaction,
  };
}

/** Violação do índice `lower("email")` como o Prisma a entrega. */
function lowerEmailViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('índice único violado', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: 'Invitation_lower_email_key' },
  });
}

test('create trims and lowercases the e-mail before any query', async () => {
  const { service, findFirst, deleteMany, createInvitation } = createService({});

  await service.create(ORGANIZATION_ID, INVITED_BY_ID, {
    email: '  CONVIDADO@Exemplo.ORG  ',
  });

  expect(findFirst).toHaveBeenCalledWith({
    where: { email: EMAIL },
    select: { id: true },
  });
  expect(deleteMany).toHaveBeenCalledWith({ where: { email: EMAIL } });
  expect(createInvitation.mock.calls[0]?.[0]).toMatchObject({
    data: { email: EMAIL },
  });
});

test('create answers conflict when a person already has the e-mail', async () => {
  const { service } = createService({ person: { id: INVITED_BY_ID } });

  await expect(
    service.create(ORGANIZATION_ID, INVITED_BY_ID, { email: EMAIL }),
  ).rejects.toThrow(new ConflictException(ALREADY_A_PERSON_MESSAGE));
});

test('create does not reach create when the person already exists', async () => {
  const { service, deleteMany, createInvitation } = createService({
    person: { id: INVITED_BY_ID },
  });

  await expect(
    service.create(ORGANIZATION_ID, INVITED_BY_ID, { email: EMAIL }),
  ).rejects.toThrow(ALREADY_A_PERSON_MESSAGE);

  expect(deleteMany).not.toHaveBeenCalled();
  expect(createInvitation).not.toHaveBeenCalled();
});

test('create deletes the previous invitation before creating the new one in the same transaction', async () => {
  const { service, transaction, deleteMany, createInvitation } = createService(
    {},
  );

  await service.create(ORGANIZATION_ID, INVITED_BY_ID, { email: EMAIL });

  expect(transaction).toHaveBeenCalledTimes(1);
  expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
    createInvitation.mock.invocationCallOrder[0] ?? 0,
  );
});

test('create stores the sha256 of the returned token and never the token itself', async () => {
  const { service, createInvitation } = createService({});

  const invitation = await service.create(ORGANIZATION_ID, INVITED_BY_ID, {
    email: EMAIL,
  });

  const written = createInvitation.mock.calls[0]?.[0] as {
    data: Record<string, unknown>;
  };

  expect(invitation.token).not.toBe('');
  expect(written.data.tokenHash).toBe(
    createHash('sha256').update(invitation.token).digest('hex'),
  );
  expect(
    Object.values(written.data).filter(
      (value) => typeof value === 'string' && value.includes(invitation.token),
    ),
  ).toEqual([]);
});

test('create sets expiresAt seven days after now', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(CREATED_AT);

  try {
    const { service, createInvitation } = createService({});

    await service.create(ORGANIZATION_ID, INVITED_BY_ID, { email: EMAIL });

    const written = createInvitation.mock.calls[0]?.[0] as {
      data: { expiresAt: Date };
    };

    expect(written.data.expiresAt).toEqual(
      new Date(CREATED_AT.getTime() + INVITATION_TTL_MS),
    );
  } finally {
    vi.useRealTimers();
  }
});

test('create turns a P2002 on the lower e-mail index into ConflictException with the race message', async () => {
  const { service } = createService({ transactionError: lowerEmailViolation() });

  await expect(
    service.create(ORGANIZATION_ID, INVITED_BY_ID, { email: EMAIL }),
  ).rejects.toThrow(new ConflictException(RACE_MESSAGE));
});

test('create rethrows any other error without the token in the message', async () => {
  const { service } = createService({
    transactionError: new Error('banco fora do ar'),
  });

  const error = await service
    .create(ORGANIZATION_ID, INVITED_BY_ID, { email: EMAIL })
    .then(
      () => undefined,
      (thrown: unknown) => thrown,
    );

  expect(error).toBeInstanceOf(Error);
  // A mensagem continua a do banco: nada de token colado nela (o token tem 43
  // caracteres de `base64url`).
  expect((error as Error).message).toBe('banco fora do ar');
  expect((error as Error).message).not.toMatch(/[\w-]{30,}/);
});
