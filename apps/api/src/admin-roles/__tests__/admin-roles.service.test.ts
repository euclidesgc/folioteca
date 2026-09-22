import 'reflect-metadata';

import type { PrismaService } from '../../prisma/prisma.service';
import { AdminRolesService } from '../admin-roles.service';

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
