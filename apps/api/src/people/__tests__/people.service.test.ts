import 'reflect-metadata';

import type { PrismaService } from '../../prisma/prisma.service';
import { PEOPLE_SEARCH_LIMIT, PeopleService } from '../people.service';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

type PersonRecord = { id: string; name: string; email: string };

/** Serviço com o Prisma substituído por um dublê que devolve `people`. */
function createService(people: PersonRecord[]): {
  service: PeopleService;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(people);

  const prisma = {
    person: { findMany },
  } as unknown as PrismaService;

  return { service: new PeopleService(prisma), findMany };
}

/** `quantity` pessoas com nomes distintos, para medir o recorte do limite. */
function peopleList(quantity: number): PersonRecord[] {
  return Array.from({ length: quantity }, (_item, index) => ({
    id: `pessoa-${index}`,
    name: `Pessoa ${index}`,
    email: `pessoa${index}@exemplo.org`,
  }));
}

test('a blank term never touches the database', async () => {
  const { service, findMany } = createService(peopleList(1));

  const missing = await service.search(ORGANIZATION_ID);
  const empty = await service.search(ORGANIZATION_ID, '');
  const spaces = await service.search(ORGANIZATION_ID, '   ');

  expect(missing).toEqual({ data: [], hasMore: false });
  expect(empty).toEqual({ data: [], hasMore: false });
  expect(spaces).toEqual({ data: [], hasMore: false });
  expect(findMany).not.toHaveBeenCalled();
});

test('the search filters by organization with case-insensitive contains', async () => {
  const { service, findMany } = createService(peopleList(1));

  await service.search(ORGANIZATION_ID, '  Silva  ');

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        organizationId: ORGANIZATION_ID,
        OR: [
          { name: { contains: 'Silva', mode: 'insensitive' } },
          { email: { contains: 'Silva', mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    }),
  );
});

test('the search takes the limit plus one', async () => {
  const { service, findMany } = createService(peopleList(1));

  await service.search(ORGANIZATION_ID, 'silva');

  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ take: PEOPLE_SEARCH_LIMIT + 1 }),
  );
});

test('ten results answer hasMore false', async () => {
  const { service } = createService(peopleList(PEOPLE_SEARCH_LIMIT));

  const result = await service.search(ORGANIZATION_ID, 'pessoa');

  expect(result.data).toHaveLength(PEOPLE_SEARCH_LIMIT);
  expect(result.hasMore).toBe(false);
});

test('eleven results answer ten items and hasMore true', async () => {
  const { service } = createService(peopleList(PEOPLE_SEARCH_LIMIT + 1));

  const result = await service.search(ORGANIZATION_ID, 'pessoa');

  expect(result.data).toHaveLength(PEOPLE_SEARCH_LIMIT);
  expect(result.hasMore).toBe(true);
  expect(result.data.at(-1)?.id).toBe(`pessoa-${PEOPLE_SEARCH_LIMIT - 1}`);
});
