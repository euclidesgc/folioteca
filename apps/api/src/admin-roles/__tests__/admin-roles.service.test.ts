import 'reflect-metadata';

import { ConflictException } from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import {
  AdminRolesService,
  LAST_ADMIN_MESSAGE,
  PERSON_NOT_FOUND_MESSAGE,
} from '../admin-roles.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

type AdminRecord = { id: string; name: string; email: string };

/** Serviço com o Prisma substituído por um dublê que devolve `admins`. */
function createService(admins: AdminRecord[]): {
  service: AdminRolesService;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(admins);

  const prisma = {
    person: { findMany },
  } as unknown as PrismaService;

  return { service: new AdminRolesService(prisma), findMany };
}

test('list filters by the organization and by isAdmin only', async () => {
  const { service, findMany } = createService([]);

  await service.list(ORGANIZATION_ID);

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { organizationId: ORGANIZATION_ID, isAdmin: true },
    }),
  );
});

test('list selects only id, name and email', async () => {
  const { service, findMany } = createService([]);

  await service.list(ORGANIZATION_ID);

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      select: { id: true, name: true, email: true },
    }),
  );
});

test('list sorts in the service, not in the database', async () => {
  const { service, findMany } = createService([
    { id: 'a', name: 'Zilda', email: 'zilda@exemplo.org' },
    { id: 'b', name: 'Álvaro', email: 'alvaro@exemplo.org' },
    { id: 'c', name: 'Beatriz', email: 'beatriz@exemplo.org' },
  ]);

  const result = await service.list(ORGANIZATION_ID);

  const call = findMany.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(Object.keys(call).sort()).toEqual(['select', 'where']);
  expect(result.data.map((admin) => admin.name)).toEqual([
    'Álvaro',
    'Beatriz',
    'Zilda',
  ]);
});

test('namesakes keep a stable order by id', async () => {
  const { service } = createService([
    { id: 'zzz', name: 'Ana Silva', email: 'ana1@exemplo.org' },
    { id: 'aaa', name: 'Ana Silva', email: 'ana2@exemplo.org' },
  ]);

  const result = await service.list(ORGANIZATION_ID);

  expect(result.data.map((admin) => admin.id)).toEqual(['aaa', 'zzz']);
});

test('an empty database answers an empty data array', async () => {
  const { service } = createService([]);

  const result = await service.list(ORGANIZATION_ID);

  expect(result).toEqual({ data: [] });
});

const PERSON_ID = '22222222-2222-4222-8222-222222222222';

const MALFORMED_ID = 'nao-e-um-uuid';

const PERSON: AdminRecord = {
  id: PERSON_ID,
  name: 'João Souza',
  email: 'joao@exemplo.org',
};

/** Serviço com o Prisma substituído por um dublê para `promote`. */
function createPromoteService(person: AdminRecord | null): {
  service: AdminRolesService;
  findFirst: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(person);
  const updateMany = vi.fn().mockResolvedValue({ count: person ? 1 : 0 });

  const prisma = {
    person: { findFirst, updateMany },
  } as unknown as PrismaService;

  return { service: new AdminRolesService(prisma), findFirst, updateMany };
}

test('promote looks the person up scoped by organization', async () => {
  const { service, findFirst } = createPromoteService(PERSON);

  await service.promote(ORGANIZATION_ID, PERSON_ID);

  const call = findFirst.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(call.where).toEqual({
    id: PERSON_ID,
    organizationId: ORGANIZATION_ID,
  });
  expect(call.select).toEqual({ id: true, name: true, email: true });
});

test('promote writes with the organization in the where clause', async () => {
  const { service, updateMany } = createPromoteService(PERSON);

  const result = await service.promote(ORGANIZATION_ID, PERSON_ID);

  const call = updateMany.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(call.where).toEqual({
    id: PERSON_ID,
    organizationId: ORGANIZATION_ID,
  });
  expect(call.data).toEqual({ isAdmin: true });
  expect(result).toEqual({ data: PERSON });
});

test('promote never reads isAdmin before writing', async () => {
  const { service, findFirst, updateMany } = createPromoteService(PERSON);

  await service.promote(ORGANIZATION_ID, PERSON_ID);

  const read = findFirst.mock.calls[0]?.[0] as {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  };
  expect(Object.keys(read.select).sort()).toEqual(['email', 'id', 'name']);
  expect(Object.keys(read.where).sort()).toEqual(['id', 'organizationId']);
  expect(updateMany).toHaveBeenCalledTimes(1);

  // Quem já administra passa pelo mesmo caminho: o serviço grava de novo.
  await service.promote(ORGANIZATION_ID, PERSON_ID);

  expect(updateMany).toHaveBeenCalledTimes(2);
});

test('a person that is not found throws with PERSON_NOT_FOUND_MESSAGE', async () => {
  const { service, updateMany } = createPromoteService(null);

  await expect(service.promote(ORGANIZATION_ID, PERSON_ID)).rejects.toThrow(
    PERSON_NOT_FOUND_MESSAGE,
  );
  expect(updateMany).not.toHaveBeenCalled();
});

test('a malformed id takes the same path, with no uuid check', async () => {
  const { service, findFirst, updateMany } = createPromoteService(null);

  await expect(service.promote(ORGANIZATION_ID, MALFORMED_ID)).rejects.toThrow(
    PERSON_NOT_FOUND_MESSAGE,
  );
  expect(findFirst).toHaveBeenCalledTimes(1);
  expect(
    (findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where,
  ).toEqual({ id: MALFORMED_ID, organizationId: ORGANIZATION_ID });
  expect(updateMany).not.toHaveBeenCalled();
});

type DemotePerson = AdminRecord & { isAdmin: boolean };

type DemoteDouble = {
  service: AdminRolesService;
  queryRaw: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  outsideTransaction: {
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

/**
 * Serviço com o Prisma substituído por um dublê para `demote`. O cliente da
 * transação tem dublês próprios, separados dos de `this.prisma`: é assim que o
 * teste prova que nada é consultado fora da transação.
 */
function createDemoteService(
  person: DemotePerson | null,
  others = 1,
): DemoteDouble {
  const queryRaw = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(person);
  const count = vi.fn().mockResolvedValue(others);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });

  const outsideTransaction = {
    findFirst: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  };

  const tx = { $queryRaw: queryRaw, person: { findFirst, count, updateMany } };

  const prisma = {
    person: outsideTransaction,
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;

  return {
    service: new AdminRolesService(prisma),
    queryRaw,
    findFirst,
    count,
    updateMany,
    outsideTransaction,
  };
}

const ADMIN_PERSON: DemotePerson = { ...PERSON, isAdmin: true };

const MEMBER_PERSON: DemotePerson = { ...PERSON, isAdmin: false };

test('demote runs every query inside the transaction client', async () => {
  const { service, queryRaw, findFirst, count, updateMany, outsideTransaction } =
    createDemoteService(ADMIN_PERSON);

  await service.demote(ORGANIZATION_ID, PERSON_ID);

  expect(queryRaw).toHaveBeenCalledTimes(1);
  expect(findFirst).toHaveBeenCalledTimes(1);
  expect(count).toHaveBeenCalledTimes(1);
  expect(updateMany).toHaveBeenCalledTimes(1);
  expect(outsideTransaction.findFirst).not.toHaveBeenCalled();
  expect(outsideTransaction.count).not.toHaveBeenCalled();
  expect(outsideTransaction.updateMany).not.toHaveBeenCalled();
});

test('demote locks the admin rows before counting', async () => {
  const { service, queryRaw, count } = createDemoteService(ADMIN_PERSON);

  await service.demote(ORGANIZATION_ID, PERSON_ID);

  const statement = (queryRaw.mock.calls[0]?.[0] as string[]).join('?');
  expect(statement).toContain('FOR UPDATE');
  expect(statement).toContain('ORDER BY "id"');
  expect(queryRaw.mock.calls[0]?.[1]).toBe(ORGANIZATION_ID);
  expect(queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
    count.mock.invocationCallOrder[0] as number,
  );
});

test('demote looks the person up scoped by organization', async () => {
  const { service, findFirst } = createDemoteService(ADMIN_PERSON);

  await service.demote(ORGANIZATION_ID, PERSON_ID);

  const call = findFirst.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(call.where).toEqual({
    id: PERSON_ID,
    organizationId: ORGANIZATION_ID,
  });
});

test('demote counts the other admins only', async () => {
  const { service, count } = createDemoteService(ADMIN_PERSON);

  await service.demote(ORGANIZATION_ID, PERSON_ID);

  expect(count).toHaveBeenCalledWith({
    where: {
      organizationId: ORGANIZATION_ID,
      isAdmin: true,
      id: { not: PERSON_ID },
    },
  });
});

test('demote writes with the organization in the where clause', async () => {
  const { service, updateMany } = createDemoteService(ADMIN_PERSON);

  const result = await service.demote(ORGANIZATION_ID, PERSON_ID);

  const call = updateMany.mock.calls[0]?.[0] as Record<string, unknown>;
  expect(call.where).toEqual({
    id: PERSON_ID,
    organizationId: ORGANIZATION_ID,
  });
  expect(call.data).toEqual({ isAdmin: false });
  expect(result).toEqual({ data: PERSON });
});

test('demoting someone who is already a member skips the count and the write', async () => {
  const { service, count, updateMany } = createDemoteService(MEMBER_PERSON);

  const result = await service.demote(ORGANIZATION_ID, PERSON_ID);

  expect(count).not.toHaveBeenCalled();
  expect(updateMany).not.toHaveBeenCalled();
  expect(result).toEqual({ data: PERSON });
});

test('a person that is not found throws with PERSON_NOT_FOUND_MESSAGE on demote', async () => {
  const { service, count, updateMany } = createDemoteService(null);

  await expect(service.demote(ORGANIZATION_ID, PERSON_ID)).rejects.toThrow(
    PERSON_NOT_FOUND_MESSAGE,
  );
  expect(count).not.toHaveBeenCalled();
  expect(updateMany).not.toHaveBeenCalled();
});

test('the last admin throws ConflictException with LAST_ADMIN_MESSAGE', async () => {
  const { service, updateMany } = createDemoteService(ADMIN_PERSON, 0);

  const thrown = await service.demote(ORGANIZATION_ID, PERSON_ID).then(
    () => undefined,
    (error: unknown) => error,
  );

  expect(thrown).toBeInstanceOf(ConflictException);
  expect((thrown as ConflictException).getStatus()).toBe(409);
  expect((thrown as ConflictException).message).toBe(LAST_ADMIN_MESSAGE);
  expect(updateMany).not.toHaveBeenCalled();
});

test('a malformed id takes the same demote path, with no uuid check', async () => {
  const { service, findFirst, updateMany } = createDemoteService(null);

  await expect(service.demote(ORGANIZATION_ID, MALFORMED_ID)).rejects.toThrow(
    PERSON_NOT_FOUND_MESSAGE,
  );
  expect(findFirst).toHaveBeenCalledTimes(1);
  expect(
    (findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where,
  ).toEqual({ id: MALFORMED_ID, organizationId: ORGANIZATION_ID });
  expect(updateMany).not.toHaveBeenCalled();
});
