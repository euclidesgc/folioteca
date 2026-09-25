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

/** Linha de `documentShare.findMany` como `list` a seleciona. */
type StoredShareRow = {
  level: 'VIEW' | 'EDIT';
  person: { id: string; name: string; email: string };
};

/** Serviço com o Prisma e o acesso substituídos por dublês. */
function createService(
  level: AccessLevel,
  {
    canWrite = true,
    shareRows = [],
  }: { canWrite?: boolean; shareRows?: StoredShareRow[] } = {},
): {
  service: SharesService;
  findFirst: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  canWriteMock: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(storedPerson);
  const upsert = vi.fn().mockResolvedValue({});
  const findMany = vi.fn().mockResolvedValue(shareRows);
  const canWriteMock = vi.fn().mockResolvedValue(canWrite);

  const prisma = {
    person: { findFirst },
    documentShare: { upsert, findMany },
  } as unknown as PrismaService;

  const access = {
    resolveAccess: vi.fn().mockResolvedValue(level),
    canWrite: canWriteMock,
  } as unknown as AccessService;

  return {
    service: new SharesService(prisma, access),
    findFirst,
    upsert,
    findMany,
    canWriteMock,
  };
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
    service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'owner' }),
  );

  expect(error).toBeInstanceOf(NotFoundException);
});

test('share answers 400 for an invalid body', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'owner' }),
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

test('share maps edit to EDIT in create and update of the upsert', async () => {
  const { service, upsert } = createService('owner');

  await service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'edit' });

  expect(upsert).toHaveBeenCalledWith({
    where: {
      documentId_personId: { documentId: DOCUMENT_ID, personId: PERSON_ID },
    },
    create: { documentId: DOCUMENT_ID, personId: PERSON_ID, level: 'EDIT' },
    update: { level: 'EDIT' },
  });
});

test('share maps view to VIEW in create and update of the upsert', async () => {
  const { service, upsert } = createService('owner');

  await service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'view' });

  expect(upsert).toHaveBeenCalledWith({
    where: {
      documentId_personId: { documentId: DOCUMENT_ID, personId: PERSON_ID },
    },
    create: { documentId: DOCUMENT_ID, personId: PERSON_ID, level: 'VIEW' },
    update: { level: 'VIEW' },
  });
});

test('share returns the requested level in lowercase', async () => {
  const editor = createService('owner');
  const viewer = createService('owner');

  const edited = await editor.service.share(
    requester,
    DOCUMENT_ID,
    PERSON_ID,
    { level: 'edit' },
  );
  const viewed = await viewer.service.share(
    requester,
    DOCUMENT_ID,
    PERSON_ID,
    { level: 'view' },
  );

  expect(edited.data.level).toBe('edit');
  expect(viewed.data.level).toBe('view');
});

const OTHER_PERSON_ID = '55555555-5555-4555-8555-555555555555';

const owner = {
  id: REQUESTER_ID,
  organizationId: ORGANIZATION_ID,
  name: 'Maria Souza',
  email: 'maria@exemplo.org',
} as unknown as PersonWithOrganization;

test('list answers 404 when the requester has no access', async () => {
  const { service } = createService('none');

  const error = await errorOf(service.list(owner, DOCUMENT_ID));

  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getStatus()).toBe(404);
});

test('list answers 403 to a view person', async () => {
  const { service } = createService('view');

  const error = await errorOf(service.list(owner, DOCUMENT_ID));

  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).message).toBe(
    'Só o proprietário pode ver quem tem acesso a este documento.',
  );
});

test('list checks access before reading shares', async () => {
  const hidden = createService('none');
  const viewer = createService('view');

  await errorOf(hidden.service.list(owner, DOCUMENT_ID));
  await errorOf(viewer.service.list(owner, DOCUMENT_ID));

  expect(hidden.findMany).not.toHaveBeenCalled();
  expect(viewer.findMany).not.toHaveBeenCalled();
});

test('list does not check canWrite', async () => {
  const { service, canWriteMock } = createService('owner', {
    canWrite: false,
  });

  const result = await service.list(owner, DOCUMENT_ID);

  expect(canWriteMock).not.toHaveBeenCalled();
  expect(result.data).toHaveLength(1);
});

test('list maps VIEW to view and EDIT to edit', async () => {
  const { service } = createService('owner', {
    shareRows: [
      { level: 'VIEW', person: storedPerson },
      {
        level: 'EDIT',
        person: {
          id: OTHER_PERSON_ID,
          name: 'Pedro Alves',
          email: 'pedro@exemplo.org',
        },
      },
    ],
  });

  const result = await service.list(owner, DOCUMENT_ID);

  expect(
    result.data.map((entry) => [entry.personId, entry.level]),
  ).toEqual([
    [REQUESTER_ID, 'owner'],
    [PERSON_ID, 'view'],
    [OTHER_PERSON_ID, 'edit'],
  ]);
});

test('list puts the owner first with isCurrentPerson true', async () => {
  const { service } = createService('owner', {
    shareRows: [
      {
        level: 'VIEW',
        person: {
          id: OTHER_PERSON_ID,
          name: 'Abel Costa',
          email: 'abel@exemplo.org',
        },
      },
    ],
  });

  const result = await service.list(owner, DOCUMENT_ID);

  expect(result.data).toEqual([
    {
      personId: REQUESTER_ID,
      name: 'Maria Souza',
      email: 'maria@exemplo.org',
      level: 'owner',
      isCurrentPerson: true,
    },
    {
      personId: OTHER_PERSON_ID,
      name: 'Abel Costa',
      email: 'abel@exemplo.org',
      level: 'view',
      isCurrentPerson: false,
    },
  ]);
});
