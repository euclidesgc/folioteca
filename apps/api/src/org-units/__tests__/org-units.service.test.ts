import 'reflect-metadata';

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../prisma/prisma.service';
import {
  CHANGED_MESSAGE,
  HAS_CHILDREN_MESSAGE,
  HAS_DOCUMENTS_MESSAGE,
  OrgUnitsService,
  ROOT_MESSAGE,
} from '../org-units.service';

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

const ORGANIZATION_ID = 'organizacao-1';

const PARENT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

const UNIT_ID = '9d5b1c3a-2f77-4a51-b8f0-6d41a1f9c0e2';

const NAME_TAKEN_MESSAGE = 'Já existe uma unidade com esse nome neste nível.';

const NOT_FOUND_MESSAGE = 'Unidade não encontrada.';

type UnitRecord = { id: string; parentId: string | null; name: string };

type Mock = ReturnType<typeof vi.fn>;

type WriteDouble = {
  service: OrgUnitsService;
  findFirst: Mock;
  createUnit: Mock;
  createSpace: Mock;
  updateUnit: Mock;
  updateOrganization: Mock;
  transaction: Mock;
};

/**
 * Serviço com um Prisma falso para escrita: `found` é o que a busca devolve e
 * `transactionError` faz a transação inteira falhar.
 */
function createWriteService(options: {
  found?: UnitRecord | null;
  written?: UnitRecord;
  transactionError?: unknown;
}): WriteDouble {
  const written = options.written ?? {
    id: UNIT_ID,
    parentId: PARENT_ID,
    name: 'Acervo',
  };

  const findFirst = vi.fn().mockResolvedValue(options.found ?? null);
  const createUnit = vi.fn().mockResolvedValue(written);
  const createSpace = vi.fn().mockResolvedValue({ id: 'espaco-1' });
  const updateUnit = vi.fn().mockResolvedValue(written);
  const updateOrganization = vi.fn().mockResolvedValue({ id: ORGANIZATION_ID });

  const tx = {
    orgUnit: { create: createUnit, update: updateUnit },
    space: { create: createSpace },
    organization: { update: updateOrganization },
  };

  const transaction =
    'transactionError' in options
      ? vi.fn().mockRejectedValue(options.transactionError)
      : vi
          .fn()
          .mockImplementation((run: (client: typeof tx) => unknown) => run(tx));

  const prisma = {
    orgUnit: { findFirst },
    $transaction: transaction,
  } as unknown as PrismaService;

  return {
    service: new OrgUnitsService(prisma),
    findFirst,
    createUnit,
    createSpace,
    updateUnit,
    updateOrganization,
    transaction,
  };
}

/** Violação de unicidade como o Prisma a entrega. */
function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('índice único violado', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

test('create looks the parent up by id and organization', async () => {
  const { service, findFirst } = createWriteService({
    found: { id: PARENT_ID, parentId: null, name: 'Raiz' },
  });

  await service.create(ORGANIZATION_ID, { parentId: PARENT_ID, name: 'Acervo' });

  expect(findFirst).toHaveBeenCalledWith({
    where: { id: PARENT_ID, organizationId: ORGANIZATION_ID },
    select: { id: true },
  });
});

test('create throws not found when the parent is not in the organization', async () => {
  const { service } = createWriteService({ found: null });

  await expect(
    service.create(ORGANIZATION_ID, { parentId: PARENT_ID, name: 'Acervo' }),
  ).rejects.toThrow(NOT_FOUND_MESSAGE);
});

test('create throws not found for a malformed parentId without querying', async () => {
  const { service, findFirst } = createWriteService({});

  await expect(
    service.create(ORGANIZATION_ID, { parentId: 'nao-e-uuid', name: 'Acervo' }),
  ).rejects.toThrow(NOT_FOUND_MESSAGE);

  expect(findFirst).not.toHaveBeenCalled();
});

test('create writes the unit and its UNIT space in one transaction', async () => {
  const { service, transaction, createUnit, createSpace } = createWriteService({
    found: { id: PARENT_ID, parentId: null, name: 'Raiz' },
  });

  const unit = await service.create(ORGANIZATION_ID, {
    parentId: PARENT_ID,
    name: 'Acervo',
  });

  expect(transaction).toHaveBeenCalledTimes(1);
  expect(createUnit).toHaveBeenCalledWith({
    data: { organizationId: ORGANIZATION_ID, parentId: PARENT_ID, name: 'Acervo' },
    select: { id: true, parentId: true, name: true },
  });
  expect(createSpace).toHaveBeenCalledWith({
    data: { type: 'UNIT', orgUnitId: UNIT_ID },
  });
  expect(unit).toEqual({ id: UNIT_ID, parentId: PARENT_ID, name: 'Acervo' });
});

test('create turns a unique violation into ConflictException with the message', async () => {
  const { service } = createWriteService({
    found: { id: PARENT_ID, parentId: null, name: 'Raiz' },
    transactionError: uniqueViolation(),
  });

  await expect(
    service.create(ORGANIZATION_ID, { parentId: PARENT_ID, name: 'Acervo' }),
  ).rejects.toThrow(new ConflictException(NAME_TAKEN_MESSAGE));
});

test('create rethrows any other error', async () => {
  const { service } = createWriteService({
    found: { id: PARENT_ID, parentId: null, name: 'Raiz' },
    transactionError: new Error('banco fora do ar'),
  });

  await expect(
    service.create(ORGANIZATION_ID, { parentId: PARENT_ID, name: 'Acervo' }),
  ).rejects.toThrow('banco fora do ar');
});

test('rename looks the unit up by id and organization', async () => {
  const { service, findFirst } = createWriteService({
    found: { id: UNIT_ID, parentId: PARENT_ID, name: 'Acervo' },
  });

  await service.rename(ORGANIZATION_ID, UNIT_ID, { name: 'Acervo Geral' });

  expect(findFirst).toHaveBeenCalledWith({
    where: { id: UNIT_ID, organizationId: ORGANIZATION_ID },
    select: { id: true, parentId: true },
  });
});

test('rename throws not found before validating the body', async () => {
  const { service } = createWriteService({ found: null });

  await expect(
    service.rename(ORGANIZATION_ID, UNIT_ID, { name: '' }),
  ).rejects.toThrow(NOT_FOUND_MESSAGE);
});

test('rename of the root also updates the organization name', async () => {
  const { service, updateUnit, updateOrganization } = createWriteService({
    found: { id: UNIT_ID, parentId: null, name: 'Prefeitura' },
    written: { id: UNIT_ID, parentId: null, name: 'Prefeitura Nova' },
  });

  await service.rename(ORGANIZATION_ID, UNIT_ID, { name: 'Prefeitura Nova' });

  expect(updateUnit).toHaveBeenCalledWith({
    where: { id: UNIT_ID },
    data: { name: 'Prefeitura Nova' },
    select: { id: true, parentId: true, name: true },
  });
  expect(updateOrganization).toHaveBeenCalledWith({
    where: { id: ORGANIZATION_ID },
    data: { name: 'Prefeitura Nova' },
  });
});

test('rename of a child does not touch the organization', async () => {
  const { service, updateOrganization } = createWriteService({
    found: { id: UNIT_ID, parentId: PARENT_ID, name: 'Acervo' },
  });

  await service.rename(ORGANIZATION_ID, UNIT_ID, { name: 'Acervo Geral' });

  expect(updateOrganization).not.toHaveBeenCalled();
});

test('rename turns a unique violation into ConflictException with the message', async () => {
  const { service } = createWriteService({
    found: { id: UNIT_ID, parentId: PARENT_ID, name: 'Acervo' },
    transactionError: uniqueViolation(),
  });

  await expect(
    service.rename(ORGANIZATION_ID, UNIT_ID, { name: 'Zeladoria' }),
  ).rejects.toThrow(new ConflictException(NAME_TAKEN_MESSAGE));
});

test('rename rethrows any other error', async () => {
  const { service } = createWriteService({
    found: { id: UNIT_ID, parentId: PARENT_ID, name: 'Acervo' },
    transactionError: new Error('banco fora do ar'),
  });

  await expect(
    service.rename(ORGANIZATION_ID, UNIT_ID, { name: 'Zeladoria' }),
  ).rejects.toThrow('banco fora do ar');
});

const SPACE_ID = 'e0c1a6d2-8b4f-4f1e-9a3c-1b2d3e4f5a6b';

/** A unidade como a consulta de `remove` a traz. */
type RemovableRecord = {
  id: string;
  parentId: string | null;
  _count: { children: number; assignments: number };
  space: { id: string; _count: { documents: number } } | null;
};

/** Unidade folha, com espaço vazio: o caminho feliz de `remove`. */
function removable(
  overrides: Partial<RemovableRecord> = {},
): RemovableRecord {
  return {
    id: UNIT_ID,
    parentId: PARENT_ID,
    _count: { children: 0, assignments: 0 },
    space: { id: SPACE_ID, _count: { documents: 0 } },
    ...overrides,
  };
}

type RemoveDouble = {
  service: OrgUnitsService;
  findFirst: Mock;
  deleteSpace: Mock;
  deleteUnit: Mock;
  order: string[];
};

/**
 * Serviço com um Prisma falso para `remove`: a busca acontece dentro da
 * transação, e `order` guarda a sequência das exclusões.
 */
function createRemoveService(options: {
  found?: RemovableRecord | null;
  transactionError?: unknown;
}): RemoveDouble {
  const order: string[] = [];

  const findFirst = vi.fn().mockResolvedValue(options.found ?? null);
  const deleteSpace = vi.fn().mockImplementation(() => {
    order.push('space');

    return Promise.resolve({ id: SPACE_ID });
  });
  const deleteUnit = vi.fn().mockImplementation(() => {
    order.push('unit');

    return Promise.resolve({ id: UNIT_ID });
  });

  const tx = {
    orgUnit: { findFirst, delete: deleteUnit },
    space: { delete: deleteSpace },
  };

  const transaction =
    'transactionError' in options
      ? vi.fn().mockRejectedValue(options.transactionError)
      : vi
          .fn()
          .mockImplementation((run: (client: typeof tx) => unknown) => run(tx));

  const prisma = {
    orgUnit: { findFirst: vi.fn() },
    $transaction: transaction,
  } as unknown as PrismaService;

  return {
    service: new OrgUnitsService(prisma),
    findFirst,
    deleteSpace,
    deleteUnit,
    order,
  };
}

/** Violação de chave estrangeira como o Prisma a entrega. */
function foreignKeyViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('chave estrangeira violada', {
    code: 'P2003',
    clientVersion: 'test',
  });
}

test('remove throws not found for a malformed id without querying', async () => {
  const { service, findFirst } = createRemoveService({ found: removable() });

  await expect(service.remove(ORGANIZATION_ID, 'nao-e-uuid')).rejects.toThrow(
    NOT_FOUND_MESSAGE,
  );

  expect(findFirst).not.toHaveBeenCalled();
});

test('remove looks the unit up by id and organization', async () => {
  const { service, findFirst } = createRemoveService({ found: removable() });

  await service.remove(ORGANIZATION_ID, UNIT_ID);

  expect(findFirst).toHaveBeenCalledWith({
    where: { id: UNIT_ID, organizationId: ORGANIZATION_ID },
    select: {
      id: true,
      parentId: true,
      _count: { select: { children: true, assignments: true } },
      space: { select: { id: true, _count: { select: { documents: true } } } },
    },
  });
});

test('remove throws not found when the unit is not in the organization', async () => {
  const { service } = createRemoveService({ found: null });

  await expect(service.remove(ORGANIZATION_ID, UNIT_ID)).rejects.toThrow(
    NOT_FOUND_MESSAGE,
  );
});

test('remove answers conflict with the root message for the root', async () => {
  const { service, deleteUnit } = createRemoveService({
    found: removable({ parentId: null }),
  });

  await expect(service.remove(ORGANIZATION_ID, UNIT_ID)).rejects.toThrow(
    new ConflictException(ROOT_MESSAGE),
  );
  expect(deleteUnit).not.toHaveBeenCalled();
});

test('remove answers conflict with the children message when the unit has children', async () => {
  const { service, deleteUnit } = createRemoveService({
    found: removable({ _count: { children: 2, assignments: 0 } }),
  });

  await expect(service.remove(ORGANIZATION_ID, UNIT_ID)).rejects.toThrow(
    new ConflictException(HAS_CHILDREN_MESSAGE),
  );
  expect(deleteUnit).not.toHaveBeenCalled();
});

test('remove answers conflict with the documents message when the space has documents', async () => {
  const { service, deleteSpace, deleteUnit } = createRemoveService({
    found: removable({ space: { id: SPACE_ID, _count: { documents: 1 } } }),
  });

  await expect(service.remove(ORGANIZATION_ID, UNIT_ID)).rejects.toThrow(
    new ConflictException(HAS_DOCUMENTS_MESSAGE),
  );
  expect(deleteSpace).not.toHaveBeenCalled();
  expect(deleteUnit).not.toHaveBeenCalled();
});

test('remove checks root before children and children before documents', async () => {
  const everything = {
    parentId: null,
    _count: { children: 3, assignments: 4 },
    space: { id: SPACE_ID, _count: { documents: 5 } },
  };

  const root = createRemoveService({ found: removable(everything) });
  await expect(root.service.remove(ORGANIZATION_ID, UNIT_ID)).rejects.toThrow(
    new ConflictException(ROOT_MESSAGE),
  );

  const withChildren = createRemoveService({
    found: removable({ ...everything, parentId: PARENT_ID }),
  });
  await expect(
    withChildren.service.remove(ORGANIZATION_ID, UNIT_ID),
  ).rejects.toThrow(new ConflictException(HAS_CHILDREN_MESSAGE));
});

test('remove deletes the space before the unit', async () => {
  const { service, deleteSpace, deleteUnit, order } = createRemoveService({
    found: removable(),
  });

  await service.remove(ORGANIZATION_ID, UNIT_ID);

  expect(deleteSpace).toHaveBeenCalledWith({ where: { id: SPACE_ID } });
  expect(deleteUnit).toHaveBeenCalledWith({ where: { id: UNIT_ID } });
  expect(order).toEqual(['space', 'unit']);
});

test('remove deletes only the unit when it has no space', async () => {
  const { service, deleteSpace, deleteUnit } = createRemoveService({
    found: removable({ space: null }),
  });

  await service.remove(ORGANIZATION_ID, UNIT_ID);

  expect(deleteSpace).not.toHaveBeenCalled();
  expect(deleteUnit).toHaveBeenCalledWith({ where: { id: UNIT_ID } });
});

test('remove turns a foreign key violation into ConflictException with the changed message', async () => {
  const { service } = createRemoveService({
    transactionError: foreignKeyViolation(),
  });

  await expect(service.remove(ORGANIZATION_ID, UNIT_ID)).rejects.toThrow(
    new ConflictException(CHANGED_MESSAGE),
  );
});

test('remove rethrows any other error', async () => {
  const { service } = createRemoveService({
    transactionError: new Error('banco fora do ar'),
  });

  await expect(service.remove(ORGANIZATION_ID, UNIT_ID)).rejects.toThrow(
    'banco fora do ar',
  );
});
