import 'reflect-metadata';

import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../prisma/prisma.service';
import { SpacesService } from '../spaces.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

const PERSON_ID = '22222222-2222-4222-8222-222222222222';

type SpaceRow = {
  id: string;
  type?: 'UNIT' | 'FREE';
  name?: string | null;
  orgUnit: { name: string } | null;
};

/**
 * Serviço com o Prisma substituído por um dublê: as linhas de unidade viram
 * unidades raiz com o espaço e a pessoa lotada; as livres, espaços livres.
 */
function createService(rows: SpaceRow[]): {
  service: SpacesService;
  findMany: ReturnType<typeof vi.fn>;
  findUnits: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(
    rows
      .filter((row) => row.orgUnit === null)
      .map((row) => ({ id: row.id, name: row.name ?? null })),
  );
  const findUnits = vi.fn().mockResolvedValue(
    rows.flatMap((row) =>
      row.orgUnit === null
        ? []
        : [
            {
              id: `unit-${row.id}`,
              parentId: null,
              name: row.orgUnit.name,
              space: { id: row.id, inheritsParent: false },
              assignments: [{ personId: PERSON_ID }],
            },
          ],
    ),
  );
  const create = vi
    .fn()
    .mockResolvedValue({ id: 'space-free', name: 'Projeto Alfa' });

  const prisma = {
    space: { findMany, create },
    orgUnit: { findMany: findUnits },
  } as unknown as PrismaService;

  return { service: new SpacesService(prisma), findMany, findUnits, create };
}

test('list queries unit spaces scoped by the given organization and person', async () => {
  const { service, findUnits } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(findUnits).toHaveBeenCalledWith({
    where: { organizationId: ORGANIZATION_ID },
    select: {
      id: true,
      parentId: true,
      name: true,
      space: { select: { id: true, inheritsParent: true } },
      assignments: {
        where: { personId: PERSON_ID },
        select: { personId: true },
      },
    },
  });
});

test('list never reads isAdmin', async () => {
  const { service, findMany, findUnits } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  const serialized = JSON.stringify([
    findMany.mock.calls,
    findUnits.mock.calls,
  ]);

  expect(serialized).not.toContain('isAdmin');
});

test('list sorts by name with the pt-BR collator ignoring accents and case', async () => {
  const { service } = createService([
    { id: 'a', orgUnit: { name: 'zilda' } },
    { id: 'b', orgUnit: { name: 'Álvaro' } },
    { id: 'c', orgUnit: { name: 'Beatriz' } },
  ]);

  const result = await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(result.data.map((space) => space.name)).toEqual([
    'Álvaro',
    'Beatriz',
    'zilda',
  ]);
});

test('list breaks name ties by id', async () => {
  const { service } = createService([
    { id: 'c', orgUnit: { name: 'Protocolo' } },
    { id: 'a', orgUnit: { name: 'protocolo' } },
    { id: 'b', orgUnit: { name: 'Protocolo' } },
  ]);

  const result = await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(result.data.map((space) => space.id)).toEqual(['a', 'b', 'c']);
});

test('list maps rows to id, type unit and name', async () => {
  const { service } = createService([
    { id: 'space-1', orgUnit: { name: 'Protocolo' } },
  ]);

  const result = await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(result).toEqual({
    data: [{ id: 'space-1', type: 'unit', name: 'Protocolo' }],
  });
});

test('list queries unit and free spaces with the OR scoped by organization and person', async () => {
  const { service, findMany, findUnits } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(findMany).toHaveBeenCalledTimes(1);
  expect((findMany.mock.calls[0]?.[0] as { where: unknown }).where).toEqual({
    type: 'FREE',
    organizationId: ORGANIZATION_ID,
    ownerId: PERSON_ID,
  });
  expect(findUnits).toHaveBeenCalledTimes(1);
  expect((findUnits.mock.calls[0]?.[0] as { where: unknown }).where).toEqual({
    organizationId: ORGANIZATION_ID,
  });
});

test('list maps free rows to id, type free and name', async () => {
  const { service } = createService([
    { id: 'space-free', type: 'FREE', name: 'Projeto Alfa', orgUnit: null },
  ]);

  const result = await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(result).toEqual({
    data: [{ id: 'space-free', type: 'free', name: 'Projeto Alfa' }],
  });
});

test('list sorts unit and free spaces together with the pt-BR collator', async () => {
  const { service } = createService([
    { id: 'a', type: 'UNIT', name: null, orgUnit: { name: 'zilda' } },
    { id: 'b', type: 'FREE', name: 'Álvaro', orgUnit: null },
    { id: 'c', type: 'UNIT', name: null, orgUnit: { name: 'Beatriz' } },
    { id: 'd', type: 'FREE', name: 'érico', orgUnit: null },
  ]);

  const result = await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(result.data).toEqual([
    { id: 'b', type: 'free', name: 'Álvaro' },
    { id: 'c', type: 'unit', name: 'Beatriz' },
    { id: 'd', type: 'free', name: 'érico' },
    { id: 'a', type: 'unit', name: 'zilda' },
  ]);
});

test('create writes a FREE space with the given organization and owner', async () => {
  const { service, create } = createService([]);

  const result = await service.create(ORGANIZATION_ID, PERSON_ID, {
    name: '  Projeto Alfa  ',
  });

  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: {
        type: 'FREE',
        organizationId: ORGANIZATION_ID,
        ownerId: PERSON_ID,
        name: 'Projeto Alfa',
      },
    }),
  );
  expect(result).toEqual({
    data: { id: 'space-free', type: 'free', name: 'Projeto Alfa' },
  });
});

test('create ignores organizationId and ownerId sent in the body', async () => {
  const { service, create } = createService([]);

  await expect(
    service.create(ORGANIZATION_ID, PERSON_ID, {
      name: 'Projeto Alfa',
      organizationId: '33333333-3333-4333-8333-333333333333',
      ownerId: '44444444-4444-4444-8444-444444444444',
    }),
  ).rejects.toThrow(BadRequestException);
  expect(create).not.toHaveBeenCalled();
});

type UnitRow = {
  id: string;
  parentId: string | null;
  name: string;
  space: { id: string; inheritsParent: boolean } | null;
  assignments: { personId: string }[];
};

/** Unidade do dublê: `assigned` lota a pessoa; `inherits` marca o espaço. */
function unitRow(
  id: string,
  parentId: string | null,
  options: { assigned?: boolean; inherits?: boolean } = {},
): UnitRow {
  return {
    id,
    parentId,
    name: `Unidade ${id}`,
    space: { id: `space-${id}`, inheritsParent: options.inherits ?? false },
    assignments: options.assigned === true ? [{ personId: PERSON_ID }] : [],
  };
}

/** Serviço cujo Prisma falso devolve a árvore `units` e nenhum espaço livre. */
function createTreeService(units: UnitRow[]): SpacesService {
  const prisma = {
    space: { findMany: vi.fn().mockResolvedValue([]) },
    orgUnit: { findMany: vi.fn().mockResolvedValue(units) },
  } as unknown as PrismaService;

  return new SpacesService(prisma);
}

async function listedSpaceIds(units: UnitRow[]): Promise<string[]> {
  const result = await createTreeService(units).list(ORGANIZATION_ID, PERSON_ID);

  return result.data.map((space) => space.id);
}

test('list shows a child unit space that inherits to a person assigned to the parent', async () => {
  const ids = await listedSpaceIds([
    unitRow('root', null),
    unitRow('parent', 'root', { assigned: true }),
    unitRow('child', 'parent', { inherits: true }),
    unitRow('other', 'parent'),
  ]);

  expect(ids.sort()).toEqual(['space-child', 'space-parent']);
});

test('list follows the inheritance chain while spaces inherit', async () => {
  const ids = await listedSpaceIds([
    unitRow('root', null, { assigned: true }),
    unitRow('parent', 'root', { inherits: true }),
    unitRow('child', 'parent', { inherits: true }),
    unitRow('grandchild', 'child', { inherits: true }),
  ]);

  expect(ids.sort()).toEqual([
    'space-child',
    'space-grandchild',
    'space-parent',
    'space-root',
  ]);
});

test('list stops the chain at the first own space', async () => {
  const ids = await listedSpaceIds([
    unitRow('root', null, { assigned: true }),
    unitRow('parent', 'root'),
    unitRow('child', 'parent', { inherits: true }),
  ]);

  expect(ids).toEqual(['space-root']);
});

test('list ignores inherit on a root unit', async () => {
  const ids = await listedSpaceIds([
    unitRow('root', null, { inherits: true }),
    unitRow('child', 'root', { assigned: true }),
  ]);

  expect(ids).toEqual(['space-child']);
});

test('list treats a parent cycle as not reaching', async () => {
  const ids = await listedSpaceIds([
    unitRow('a', 'b', { inherits: true }),
    unitRow('b', 'a', { inherits: true }),
    unitRow('c', 'a', { inherits: true }),
  ]);

  expect(ids).toEqual([]);
});

test('list returns each unit space once when reached twice', async () => {
  const ids = await listedSpaceIds([
    unitRow('root', null),
    unitRow('parent', 'root', { assigned: true }),
    unitRow('child', 'parent', { assigned: true, inherits: true }),
  ]);

  expect(ids.sort()).toEqual(['space-child', 'space-parent']);
});
