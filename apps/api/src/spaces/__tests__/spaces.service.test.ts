import 'reflect-metadata';

import type { PrismaService } from '../../prisma/prisma.service';
import { SpacesService } from '../spaces.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

const PERSON_ID = '22222222-2222-4222-8222-222222222222';

type SpaceRow = { id: string; orgUnit: { name: string } | null };

/** Serviço com o Prisma substituído por um dublê que devolve `rows`. */
function createService(rows: SpaceRow[]): {
  service: SpacesService;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);

  const prisma = {
    space: { findMany },
  } as unknown as PrismaService;

  return { service: new SpacesService(prisma), findMany };
}

test('list queries unit spaces scoped by the given organization and person', async () => {
  const { service, findMany } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        type: 'UNIT',
        orgUnit: {
          organizationId: ORGANIZATION_ID,
          assignments: { some: { personId: PERSON_ID } },
        },
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
