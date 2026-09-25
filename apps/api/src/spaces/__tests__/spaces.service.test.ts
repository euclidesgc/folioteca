import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AccessService } from '../../access/access.service';
import type { ReachedUnitSpace } from '../../access/unit-reach';
import { PrismaService } from '../../prisma/prisma.service';
import { compareMembers, SpacesService } from '../spaces.service';
import { updateSpaceMemberSchema, updateSpaceSchema } from '../spaces.schema';
import { resetDatabase } from '../../../test/reset-database';

const ORGANIZATION_ID = '11111111-1111-4111-8111-111111111111';

const PERSON_ID = '22222222-2222-4222-8222-222222222222';

type SpaceRow = {
  id: string;
  type?: 'UNIT' | 'FREE';
  name?: string | null;
  orgUnit: { name: string } | null;
};

/**
 * `AccessService` falso: `unitSpacesReachedBy` devolve os espaços de unidade
 * dados, sem ler a árvore (a regra de alcance é testada em `unit-reach`).
 */
function createFakeAccess(reached: ReachedUnitSpace[] = []): {
  access: AccessService;
  unitSpacesReachedBy: ReturnType<typeof vi.fn>;
} {
  const unitSpacesReachedBy = vi.fn().mockResolvedValue(reached);

  return {
    access: { unitSpacesReachedBy } as unknown as AccessService,
    unitSpacesReachedBy,
  };
}

/**
 * Serviço com o Prisma e o `AccessService` substituídos por dublês: as linhas
 * de unidade viram espaços de unidade alcançados diretamente; as livres,
 * espaços livres.
 */
function createService(rows: SpaceRow[]): {
  service: SpacesService;
  findMany: ReturnType<typeof vi.fn>;
  findUnits: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(
    rows
      .filter((row) => row.orgUnit === null)
      .map((row) => ({ id: row.id, name: row.name ?? null })),
  );
  const { access, unitSpacesReachedBy: findUnits } = createFakeAccess(
    rows.flatMap((row): ReachedUnitSpace[] =>
      row.orgUnit === null
        ? []
        : [
            {
              orgUnitId: `unit-${row.id}`,
              spaceId: row.id,
              name: row.orgUnit.name,
              reach: 'direct',
            },
          ],
    ),
  );
  const findFirst = vi.fn().mockResolvedValue(null);
  const create = vi
    .fn()
    .mockResolvedValue({ id: 'space-free', name: 'Projeto Alfa' });

  const prisma = {
    space: { findMany, findFirst, create },
  } as unknown as PrismaService;

  return {
    service: new SpacesService(prisma, access),
    findMany,
    findUnits,
    findFirst,
    create,
  };
}

test('list queries unit spaces scoped by the given organization and person', async () => {
  const { service, findUnits } = createService([]);

  await service.list(ORGANIZATION_ID, PERSON_ID);

  expect(findUnits).toHaveBeenCalledWith(ORGANIZATION_ID, PERSON_ID);
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
    OR: [
      { ownerId: PERSON_ID },
      { members: { some: { personId: PERSON_ID } } },
    ],
  });
  expect(findUnits).toHaveBeenCalledTimes(1);
  expect(findUnits).toHaveBeenCalledWith(ORGANIZATION_ID, PERSON_ID);
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

test('create throws ConflictException when the owner already has a FREE space with the name', async () => {
  const { service, findFirst, create } = createService([]);
  findFirst.mockResolvedValue({ id: 'space-existing' });

  const attempt = service.create(ORGANIZATION_ID, PERSON_ID, {
    name: '  Projeto Alfa  ',
  });

  await expect(attempt).rejects.toThrow(ConflictException);
  await expect(attempt).rejects.toThrow('Você já tem um espaço com esse nome.');
  expect(findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        type: 'FREE',
        ownerId: PERSON_ID,
        name: { equals: 'Projeto Alfa', mode: 'insensitive' },
      },
    }),
  );
  expect(create).not.toHaveBeenCalled();
});

test('create turns a P2002 from the database into the same ConflictException', async () => {
  const { service, create } = createService([]);
  create.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`ownerId`,`name`)',
      { code: 'P2002', clientVersion: 'test' },
    ),
  );

  const attempt = service.create(ORGANIZATION_ID, PERSON_ID, {
    name: 'Projeto Alfa',
  });

  await expect(attempt).rejects.toThrow(ConflictException);
  await expect(attempt).rejects.toThrow('Você já tem um espaço com esse nome.');
});

test('create rethrows an error that is not a unique violation', async () => {
  const { service, create } = createService([]);
  const failure = new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    { code: 'P2003', clientVersion: 'test' },
  );
  create.mockRejectedValue(failure);

  const attempt = service.create(ORGANIZATION_ID, PERSON_ID, {
    name: 'Projeto Alfa',
  });

  await expect(attempt).rejects.toBe(failure);
  await expect(attempt).rejects.not.toThrow(ConflictException);
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * do `addMember` é provado no serviço real, ligado ao Prisma de teste, com um
 * `organizationId` que não é o da organização do espaço.
 */
describe('addMember on the test database', () => {
  const prisma = new PrismaService();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  test('addMember with another organization id throws not found', async () => {
    const organization = await prisma.organization.create({
      data: { name: 'Prefeitura de Exemplo' },
    });
    const owner = await prisma.person.create({
      data: {
        organizationId: organization.id,
        name: 'João Souza',
        email: 'joao@exemplo.org',
        passwordHash: randomUUID(),
      },
    });
    const other = await prisma.person.create({
      data: {
        organizationId: organization.id,
        name: 'Ana Lima',
        email: 'ana@exemplo.org',
        passwordHash: randomUUID(),
      },
    });
    const space = await prisma.space.create({
      data: {
        type: 'FREE',
        organizationId: organization.id,
        ownerId: owner.id,
        name: 'Projeto Alfa',
      },
    });
    const service = new SpacesService(prisma, new AccessService(prisma));

    const attempt = service.addMember(
      { organizationId: randomUUID(), id: owner.id },
      space.id,
      other.id,
    );

    await expect(attempt).rejects.toThrow(NotFoundException);
    await expect(attempt).rejects.toThrow('Espaço não encontrado.');
    expect(await prisma.spaceMember.count()).toBe(0);
  });
});

test('compareMembers puts the owner before the current person', () => {
  const owner = {
    id: 'b',
    name: 'Zilda Rocha',
    email: 'zilda@exemplo.org',
    isCurrentPerson: false,
    role: 'owner' as const,
    level: null,
  };
  const current = {
    id: 'a',
    name: 'Álvaro Dias',
    email: 'alvaro@exemplo.org',
    isCurrentPerson: true,
    role: 'member' as const,
    level: 'edit' as const,
  };

  expect(compareMembers(owner, current)).toBeLessThan(0);
  expect(compareMembers(current, owner)).toBeGreaterThan(0);
  expect([current, owner].sort(compareMembers).map((item) => item.id)).toEqual([
    'b',
    'a',
  ]);
});

/**
 * Organização única por instância (`Organization_singleton_check`): o escopo
 * de `listMembers` e `removeMember` no espaço livre é provado no serviço real,
 * ligado ao Prisma de teste, com um `organizationId` que não é o do espaço.
 */
describe('free space members on the test database', () => {
  const prisma = new PrismaService();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  /** Espaço livre de João com Ana como membro. */
  async function createFreeSpaceWithMember(): Promise<{
    organizationId: string;
    ownerId: string;
    memberId: string;
    spaceId: string;
  }> {
    const organization = await prisma.organization.create({
      data: { name: 'Prefeitura de Exemplo' },
    });
    const owner = await prisma.person.create({
      data: {
        organizationId: organization.id,
        name: 'João Souza',
        email: 'joao@exemplo.org',
        passwordHash: randomUUID(),
      },
    });
    const member = await prisma.person.create({
      data: {
        organizationId: organization.id,
        name: 'Ana Lima',
        email: 'ana@exemplo.org',
        passwordHash: randomUUID(),
      },
    });
    const space = await prisma.space.create({
      data: {
        type: 'FREE',
        organizationId: organization.id,
        ownerId: owner.id,
        name: 'Projeto Alfa',
      },
    });
    await prisma.spaceMember.create({
      data: { spaceId: space.id, personId: member.id },
    });

    return {
      organizationId: organization.id,
      ownerId: owner.id,
      memberId: member.id,
      spaceId: space.id,
    };
  }

  test('listMembers with another organization id returns null for a FREE space', async () => {
    const { organizationId, ownerId, memberId, spaceId } =
      await createFreeSpaceWithMember();
    const service = new SpacesService(prisma, new AccessService(prisma));

    const mine = await service.listMembers(organizationId, ownerId, spaceId);
    const others = await service.listMembers(randomUUID(), ownerId, spaceId);

    expect(mine?.data.map((item) => item.id)).toEqual([ownerId, memberId]);
    expect(others).toBeNull();
  });

  test('removeMember with another organization id throws not found', async () => {
    const { ownerId, memberId, spaceId } = await createFreeSpaceWithMember();
    const service = new SpacesService(prisma, new AccessService(prisma));

    const attempt = service.removeMember(
      { organizationId: randomUUID(), id: ownerId },
      spaceId,
      memberId,
    );

    await expect(attempt).rejects.toThrow(NotFoundException);
    await expect(attempt).rejects.toThrow('Espaço não encontrado.');
    expect(
      await prisma.spaceMember.count({ where: { spaceId, personId: memberId } }),
    ).toBe(1);
  });
});

test('updateSpaceSchema accepts true and false', () => {
  expect(updateSpaceSchema.safeParse({ membersCanInvite: true })).toEqual({
    success: true,
    data: { membersCanInvite: true },
  });
  expect(updateSpaceSchema.safeParse({ membersCanInvite: false })).toEqual({
    success: true,
    data: { membersCanInvite: false },
  });
});

test('updateSpaceSchema rejects a missing value with Escolha quem adiciona pessoas.', () => {
  const result = updateSpaceSchema.safeParse({});

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Escolha quem adiciona pessoas.');
});

test('updateSpaceSchema rejects extra fields with Campo não permitido.', () => {
  const result = updateSpaceSchema.safeParse({
    membersCanInvite: true,
    ownerId: PERSON_ID,
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Campo não permitido.');
});

const OWNER_ID = '33333333-3333-4333-8333-333333333333';

const TARGET_ID = '44444444-4444-4444-8444-444444444444';

const FREE_SPACE_ID = '55555555-5555-4555-8555-555555555555';

/**
 * Serviço com o Prisma falso para `updateSettings`, `getDetail` e
 * `addMember`: cada `space.findFirst` devolve, em ordem, as linhas dadas.
 */
function createSettingsService(spaceRows: unknown[]): {
  service: SpacesService;
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn();
  for (const row of spaceRows) {
    findFirst.mockResolvedValueOnce(row);
  }
  const update = vi.fn().mockResolvedValue({});
  const upsert = vi.fn().mockResolvedValue({});
  const personFindFirst = vi.fn().mockResolvedValue({
    id: TARGET_ID,
    name: 'Ana Lima',
    email: 'ana@exemplo.org',
  });

  const prisma = {
    space: { findFirst, update },
    person: { findFirst: personFindFirst },
    spaceMember: { upsert },
  } as unknown as PrismaService;

  return {
    service: new SpacesService(prisma, createFakeAccess().access),
    findFirst,
    update,
    upsert,
  };
}

test('updateSettings throws not found for a malformed id', async () => {
  const { service, findFirst, update } = createSettingsService([]);

  const attempt = service.updateSettings(
    { organizationId: ORGANIZATION_ID, id: OWNER_ID },
    'nao-e-uuid',
    { membersCanInvite: true },
  );

  await expect(attempt).rejects.toThrow(NotFoundException);
  expect(findFirst).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test('updateSettings throws forbidden to a member', async () => {
  const { service, update } = createSettingsService([{ ownerId: OWNER_ID }]);

  const attempt = service.updateSettings(
    { organizationId: ORGANIZATION_ID, id: PERSON_ID },
    FREE_SPACE_ID,
    { membersCanInvite: true },
  );

  await expect(attempt).rejects.toThrow(ForbiddenException);
  await expect(attempt).rejects.toThrow(
    'Só o dono do espaço pode mudar quem adiciona pessoas.',
  );
  expect(update).not.toHaveBeenCalled();
});

test('updateSettings updates membersCanInvite by id', async () => {
  const { service, findFirst, update } = createSettingsService([
    { ownerId: OWNER_ID },
    {
      id: FREE_SPACE_ID,
      type: 'FREE',
      name: 'Projeto Alfa',
      ownerId: OWNER_ID,
      membersCanInvite: true,
      orgUnit: null,
    },
  ]);

  const result = await service.updateSettings(
    { organizationId: ORGANIZATION_ID, id: OWNER_ID },
    FREE_SPACE_ID,
    { membersCanInvite: true },
  );

  expect(findFirst).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      where: expect.objectContaining({
        id: FREE_SPACE_ID,
        type: 'FREE',
        organizationId: ORGANIZATION_ID,
      }) as unknown,
    }),
  );
  expect(update).toHaveBeenCalledWith({
    where: { id: FREE_SPACE_ID },
    data: { membersCanInvite: true },
  });
  expect(result).toEqual({
    data: {
      id: FREE_SPACE_ID,
      type: 'free',
      name: 'Projeto Alfa',
      reach: 'owner',
      membersCanInvite: true,
      canCreateDocuments: true,
      canAddPeople: true,
    },
  });
});

test('getDetail returns membersCanInvite false for a unit space', async () => {
  // A linha de unidade vem com `true` de propósito: o serviço devolve `false`
  // para espaço de unidade independentemente da coluna.
  const { service } = createSettingsService([
    {
      id: 'space-unit',
      type: 'UNIT',
      name: null,
      ownerId: null,
      membersCanInvite: true,
      orgUnit: { id: 'unit-1', name: 'Protocolo' },
    },
    {
      orgUnit: { id: 'unit-1', assignments: [{ personId: PERSON_ID }] },
    },
  ]);

  const detail = await service.getDetail(ORGANIZATION_ID, PERSON_ID, 'space-unit');

  expect(detail).toEqual({
    id: 'space-unit',
    type: 'unit',
    name: 'Protocolo',
    reach: 'direct',
    membersCanInvite: false,
    canCreateDocuments: true,
    canAddPeople: false,
  });
});

test('addMember accepts a member when membersCanInvite is true', async () => {
  const { service, upsert } = createSettingsService([
    { ownerId: OWNER_ID, membersCanInvite: true, members: [{ level: 'EDIT' }] },
  ]);

  const result = await service.addMember(
    { organizationId: ORGANIZATION_ID, id: PERSON_ID },
    FREE_SPACE_ID,
    TARGET_ID,
  );

  expect(result).toEqual({
    data: { id: TARGET_ID, name: 'Ana Lima', email: 'ana@exemplo.org' },
  });
  expect(upsert).toHaveBeenCalledWith({
    where: { spaceId_personId: { spaceId: FREE_SPACE_ID, personId: TARGET_ID } },
    create: { spaceId: FREE_SPACE_ID, personId: TARGET_ID },
    update: {},
  });
});

test('addMember throws forbidden to a member when membersCanInvite is false', async () => {
  const { service, upsert } = createSettingsService([
    { ownerId: OWNER_ID, membersCanInvite: false },
  ]);

  const attempt = service.addMember(
    { organizationId: ORGANIZATION_ID, id: PERSON_ID },
    FREE_SPACE_ID,
    TARGET_ID,
  );

  await expect(attempt).rejects.toThrow(ForbiddenException);
  await expect(attempt).rejects.toThrow(
    'Só o dono do espaço pode adicionar pessoas.',
  );
  expect(upsert).not.toHaveBeenCalled();
});

test('updateSpaceMemberSchema accepts view and edit', () => {
  expect(updateSpaceMemberSchema.safeParse({ level: 'view' })).toEqual({
    success: true,
    data: { level: 'view' },
  });
  expect(updateSpaceMemberSchema.safeParse({ level: 'edit' })).toEqual({
    success: true,
    data: { level: 'edit' },
  });
});

test('updateSpaceMemberSchema rejects a missing value with Escolha o nível do membro.', () => {
  const result = updateSpaceMemberSchema.safeParse({});

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Escolha o nível do membro.');
});

test('updateSpaceMemberSchema rejects extra fields with Campo não permitido.', () => {
  const result = updateSpaceMemberSchema.safeParse({
    level: 'view',
    personId: PERSON_ID,
  });

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.message).toBe('Campo não permitido.');
});

/**
 * Serviço com o Prisma falso para `updateMemberLevel`: o `space.findFirst`
 * devolve a linha dada e `spaceMember.findUnique` devolve o membro dado.
 */
function createLevelService(
  spaceRow: unknown,
  memberRow: unknown,
): {
  service: SpacesService;
  findFirst: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(spaceRow);
  const findUnique = vi.fn().mockResolvedValue(memberRow);
  const update = vi.fn().mockResolvedValue({ level: 'VIEW' });

  const prisma = {
    space: { findFirst },
    spaceMember: { findUnique, update },
  } as unknown as PrismaService;

  return {
    service: new SpacesService(prisma, createFakeAccess().access),
    findFirst,
    findUnique,
    update,
  };
}

const TARGET_MEMBER_ROW = {
  person: { id: TARGET_ID, name: 'Ana Lima', email: 'ana@exemplo.org' },
};

test('updateMemberLevel throws not found for a malformed space id', async () => {
  const { service, findFirst, update } = createLevelService(
    { ownerId: OWNER_ID },
    TARGET_MEMBER_ROW,
  );

  const attempt = service.updateMemberLevel(
    { organizationId: ORGANIZATION_ID, id: OWNER_ID },
    'nao-e-uuid',
    TARGET_ID,
    { level: 'view' },
  );

  await expect(attempt).rejects.toThrow(NotFoundException);
  await expect(attempt).rejects.toThrow('Espaço não encontrado.');
  expect(findFirst).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test('updateMemberLevel throws forbidden to a member', async () => {
  const { service, update } = createLevelService(
    { ownerId: OWNER_ID },
    TARGET_MEMBER_ROW,
  );

  const attempt = service.updateMemberLevel(
    { organizationId: ORGANIZATION_ID, id: PERSON_ID },
    FREE_SPACE_ID,
    TARGET_ID,
    { level: 'view' },
  );

  await expect(attempt).rejects.toThrow(ForbiddenException);
  await expect(attempt).rejects.toThrow(
    'Só o dono do espaço pode mudar o nível de um membro.',
  );
  expect(update).not.toHaveBeenCalled();
});

test('updateMemberLevel throws bad request for the owner', async () => {
  const { service, update } = createLevelService(
    { ownerId: OWNER_ID },
    TARGET_MEMBER_ROW,
  );

  const attempt = service.updateMemberLevel(
    { organizationId: ORGANIZATION_ID, id: OWNER_ID },
    FREE_SPACE_ID,
    OWNER_ID,
    { level: 'view' },
  );

  await expect(attempt).rejects.toThrow(BadRequestException);
  await expect(attempt).rejects.toThrow('O dono do espaço não tem nível.');
  expect(update).not.toHaveBeenCalled();
});

test('updateMemberLevel throws not found for a person who is not a member', async () => {
  const { service, update } = createLevelService({ ownerId: OWNER_ID }, null);

  const attempt = service.updateMemberLevel(
    { organizationId: ORGANIZATION_ID, id: OWNER_ID },
    FREE_SPACE_ID,
    TARGET_ID,
    { level: 'view' },
  );

  await expect(attempt).rejects.toThrow(NotFoundException);
  await expect(attempt).rejects.toThrow(
    'Esta pessoa não é membro deste espaço.',
  );
  expect(update).not.toHaveBeenCalled();
});

test('updateMemberLevel updates the level by spaceId and personId', async () => {
  const { service, findFirst, update } = createLevelService(
    { ownerId: OWNER_ID },
    TARGET_MEMBER_ROW,
  );

  const result = await service.updateMemberLevel(
    { organizationId: ORGANIZATION_ID, id: OWNER_ID },
    FREE_SPACE_ID,
    TARGET_ID,
    { level: 'view' },
  );

  expect(findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: FREE_SPACE_ID,
        type: 'FREE',
        organizationId: ORGANIZATION_ID,
      }) as unknown,
    }),
  );
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        spaceId_personId: { spaceId: FREE_SPACE_ID, personId: TARGET_ID },
      },
      data: { level: 'VIEW' },
    }),
  );
  expect(result).toEqual({
    data: {
      id: TARGET_ID,
      name: 'Ana Lima',
      email: 'ana@exemplo.org',
      isCurrentPerson: false,
      role: 'member',
      level: 'view',
    },
  });
});

test('listMembers returns level null for the owner and the member level', async () => {
  const findFirst = vi.fn().mockResolvedValue({
    owner: { id: OWNER_ID, name: 'João Souza', email: 'joao@exemplo.org' },
    members: [
      {
        level: 'VIEW',
        person: { id: TARGET_ID, name: 'Ana Lima', email: 'ana@exemplo.org' },
      },
      {
        level: 'EDIT',
        person: { id: PERSON_ID, name: 'Bruno Reis', email: 'bruno@exemplo.org' },
      },
    ],
  });
  const service = new SpacesService(
    { space: { findFirst } } as unknown as PrismaService,
    createFakeAccess().access,
  );

  const result = await service.listMembers(
    ORGANIZATION_ID,
    OWNER_ID,
    FREE_SPACE_ID,
  );

  expect(
    result?.data.map(({ id, role, level }) => ({ id, role, level })),
  ).toEqual([
    { id: OWNER_ID, role: 'owner', level: null },
    { id: TARGET_ID, role: 'member', level: 'view' },
    { id: PERSON_ID, role: 'member', level: 'edit' },
  ]);
});

test('addMember throws forbidden to a viewer of an open space', async () => {
  const { service, upsert } = createSettingsService([
    { ownerId: OWNER_ID, membersCanInvite: true, members: [{ level: 'VIEW' }] },
  ]);

  const attempt = service.addMember(
    { organizationId: ORGANIZATION_ID, id: PERSON_ID },
    FREE_SPACE_ID,
    TARGET_ID,
  );

  await expect(attempt).rejects.toThrow(ForbiddenException);
  await expect(attempt).rejects.toThrow(
    'Só quem pode editar adiciona pessoas a este espaço.',
  );
  expect(upsert).not.toHaveBeenCalled();
});

test('getDetail returns canCreateDocuments and canAddPeople false to a viewer', async () => {
  const { service } = createSettingsService([
    {
      id: FREE_SPACE_ID,
      type: 'FREE',
      name: 'Projeto Alfa',
      ownerId: OWNER_ID,
      membersCanInvite: true,
      orgUnit: null,
      members: [{ level: 'VIEW' }],
    },
  ]);

  const detail = await service.getDetail(
    ORGANIZATION_ID,
    PERSON_ID,
    FREE_SPACE_ID,
  );

  expect(detail).toEqual({
    id: FREE_SPACE_ID,
    type: 'free',
    name: 'Projeto Alfa',
    reach: 'member',
    membersCanInvite: true,
    canCreateDocuments: false,
    canAddPeople: false,
  });
});
