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

/** Serviço com o Prisma substituído por um dublê que devolve `rows`. */
function createService(rows: SpaceRow[]): {
  service: SpacesService;
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  const create = vi
    .fn()
    .mockResolvedValue({ id: 'space-free', name: 'Projeto Alfa' });

  const prisma = {
    space: { findMany, create },
  } as unknown as PrismaService;

  return { service: new SpacesService(prisma), findMany, create };
}

test('list queries unit spaces scoped by the given organization and person', async () => {
  const { service, findMany } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        OR: [
          {
            type: 'UNIT',
            orgUnit: {
              organizationId: ORGANIZATION_ID,
              assignments: { some: { personId: PERSON_ID } },
            },
          },
          { type: 'FREE', organizationId: ORGANIZATION_ID, ownerId: PERSON_ID },
        ],
      },
    }),
  );
});

test('list never reads isAdmin', async () => {
  const { service, findMany } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  const serialized = JSON.stringify(findMany.mock.calls);

  expect(serialized).not.toContain('isAdmin');
  expect(serialized).not.toContain('parentId');
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
  const { service, findMany } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(findMany).toHaveBeenCalledTimes(1);
  expect((findMany.mock.calls[0]?.[0] as { where: unknown }).where).toEqual({
    OR: [
      {
        type: 'UNIT',
        orgUnit: {
          organizationId: ORGANIZATION_ID,
          assignments: { some: { personId: PERSON_ID } },
        },
      },
      { type: 'FREE', organizationId: ORGANIZATION_ID, ownerId: PERSON_ID },
    ],
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
