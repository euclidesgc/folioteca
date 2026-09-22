import 'reflect-metadata';

import type { PrismaService } from '../../prisma/prisma.service';
import {
  AdminRolesService,
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
