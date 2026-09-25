import 'reflect-metadata';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import type { AccessLevel } from '../../access/access-level';
import type { AccessService } from '../../access/access.service';
import type { PersonWithOrganization } from '../../auth/session.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from '../shares.service';

const REQUESTER_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';
const PERSON_ID = '44444444-4444-4444-8444-444444444444';

const VALID_BODY = { level: 'view' };

const requester = {
  id: REQUESTER_ID,
  organizationId: ORGANIZATION_ID,
} as unknown as PersonWithOrganization;

const storedPerson = {
  id: PERSON_ID,
  name: 'João Lima',
  email: 'joao@exemplo.org',
};

/** Serviço com o Prisma e o acesso substituídos por dublês. */
function createService(
  level: AccessLevel,
  { canWrite = true }: { canWrite?: boolean } = {},
): {
  service: SharesService;
  findFirst: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(storedPerson);
  const upsert = vi.fn().mockResolvedValue({});

  const prisma = {
    person: { findFirst },
    documentShare: { upsert },
  } as unknown as PrismaService;

  const access = {
    resolveAccess: vi.fn().mockResolvedValue(level),
    canWrite: vi.fn().mockResolvedValue(canWrite),
  } as unknown as AccessService;

  return { service: new SharesService(prisma, access), findFirst, upsert };
}

/** Erro lançado pela chamada, ou `undefined` quando ela termina bem. */
function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
}

test('share answers 404 when the requester has no access', async () => {
  const { service, upsert } = createService('none');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getStatus()).toBe(404);
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 403 to a view person', async () => {
  const { service, upsert } = createService('view');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).message).toBe(
    'Só o proprietário pode compartilhar este documento.',
  );
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 409 for the owner on a trashed document', async () => {
  const { service, upsert } = createService('owner', { canWrite: false });

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).message).toBe(
    'Este documento está na lixeira. Restaure-o para editar.',
  );
  expect(upsert).not.toHaveBeenCalled();
});

test('share checks access before the body', async () => {
  const { service } = createService('none');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'edit' }),
  );

  expect(error).toBeInstanceOf(NotFoundException);
});

test('share answers 400 for an invalid body', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'edit' }),
  );

  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).getStatus()).toBe(400);
  expect(findFirst).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 400 when sharing with oneself', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, REQUESTER_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).message).toBe(
    'Você já é o proprietário deste documento.',
  );
  expect(findFirst).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 400 for a malformed person id without querying', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, 'nao-e-uuid', VALID_BODY),
  );

  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).message).toBe(
    'Pessoa não encontrada nesta instância.',
  );
  expect(findFirst).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

test('share upserts VIEW and returns the person from the database', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const result = await service.share(
    requester,
    DOCUMENT_ID,
    PERSON_ID,
    VALID_BODY,
  );

  expect(findFirst).toHaveBeenCalledWith({
    where: { id: PERSON_ID, organizationId: ORGANIZATION_ID },
    select: { id: true, name: true, email: true },
  });
  expect(upsert).toHaveBeenCalledWith({
    where: {
      documentId_personId: { documentId: DOCUMENT_ID, personId: PERSON_ID },
    },
    create: { documentId: DOCUMENT_ID, personId: PERSON_ID, level: 'VIEW' },
    update: { level: 'VIEW' },
  });
  expect(result).toEqual({
    data: {
      personId: PERSON_ID,
      name: 'João Lima',
      email: 'joao@exemplo.org',
      level: 'view',
    },
  });
});
