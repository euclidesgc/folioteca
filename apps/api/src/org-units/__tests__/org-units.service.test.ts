import 'reflect-metadata';

import type { PrismaService } from '../../prisma/prisma.service';
import { OrgUnitsService } from '../org-units.service';

/** Serviço com o Prisma substituído por um dublê que devolve `units`. */
function createService(units: { id: string; parentId: string | null; name: string }[]): {
  service: OrgUnitsService;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(units);

  const prisma = {
    orgUnit: { findMany },
  } as unknown as PrismaService;

  return { service: new OrgUnitsService(prisma), findMany };
}

test('reads only the units of the given organization selecting id, parentId and name', async () => {
  const { service, findMany } = createService([
    { id: '1', parentId: null, name: 'Raiz' },
  ]);

  await service.list('organizacao-1');

  expect(findMany).toHaveBeenCalledWith({
    where: { organizationId: 'organizacao-1' },
    select: { id: true, parentId: true, name: true },
  });
});

test('orders by name with the pt-BR collator ignoring accents and case', async () => {
  const { service } = createService([
    { id: '1', parentId: null, name: 'Zeladoria' },
    { id: '2', parentId: null, name: 'Área Técnica' },
    { id: '3', parentId: null, name: 'acervo' },
  ]);

  const result = await service.list('organizacao-1');

  expect(result.map((unit) => unit.name)).toEqual([
    'acervo',
    'Área Técnica',
    'Zeladoria',
  ]);
});

test('breaks ties between equal names by id', async () => {
  const { service } = createService([
    { id: 'b', parentId: null, name: 'Mesmo Nome' },
    { id: 'a', parentId: null, name: 'Mesmo Nome' },
  ]);

  const result = await service.list('organizacao-1');

  expect(result.map((unit) => unit.id)).toEqual(['a', 'b']);
});

test('returns an empty list when the organization has no units', async () => {
  const { service } = createService([]);

  const result = await service.list('organizacao-1');

  expect(result).toEqual([]);
});
