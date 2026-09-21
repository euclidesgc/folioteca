import 'reflect-metadata';

import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessLevel } from '../../access/access-level';
import type { AccessService } from '../../access/access.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { FavoritesService } from '../favorites.service';

const NOT_FOUND_MESSAGE = 'Documento não encontrado.';

const READABLE_WHERE = { ownerId: 'pessoa' };

type Doubles = {
  service: FavoritesService;
  upsert: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  readableDocumentsWhere: ReturnType<typeof vi.fn>;
};

/** Serviço com o Prisma e o `AccessService` substituídos. */
function createService(level: AccessLevel = 'owner'): Doubles {
  const upsert = vi.fn().mockResolvedValue(undefined);
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const findMany = vi.fn().mockResolvedValue([]);
  const readableDocumentsWhere = vi.fn().mockReturnValue(READABLE_WHERE);

  const prisma = {
    favorite: { upsert, deleteMany, findMany },
  } as unknown as PrismaService;

  const access = {
    resolveAccess: vi.fn().mockResolvedValue(level),
    readableDocumentsWhere,
  } as unknown as AccessService;

  return {
    service: new FavoritesService(prisma, access),
    upsert,
    deleteMany,
    findMany,
    readableDocumentsWhere,
  };
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Falha do banco.', {
    code,
    clientVersion: '6.0.0',
  });
}

test('add upserts by the composite key with an empty update', async () => {
  const { service, upsert } = createService();

  await service.add('pessoa', 'documento');

  expect(upsert).toHaveBeenCalledWith({
    where: {
      personId_documentId: { personId: 'pessoa', documentId: 'documento' },
    },
    create: { personId: 'pessoa', documentId: 'documento' },
    update: {},
  });
});

test('add treats P2002 as success', async () => {
  const { service, upsert } = createService();
  upsert.mockRejectedValue(prismaError('P2002'));

  await expect(service.add('pessoa', 'documento')).resolves.toBeUndefined();
});

test('add turns P2003 into document not found', async () => {
  const { service, upsert } = createService();
  upsert.mockRejectedValue(prismaError('P2003'));

  const error: unknown = await service
    .add('pessoa', 'documento')
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getStatus()).toBe(404);
  expect((error as NotFoundException).message).toBe(NOT_FOUND_MESSAGE);
});

test('add rethrows an unknown error', async () => {
  const { service, upsert } = createService();
  upsert.mockRejectedValue(new Error('banco fora do ar'));

  await expect(service.add('pessoa', 'documento')).rejects.toThrow(
    'banco fora do ar',
  );
});

test('add and remove throw document not found when access is none and write nothing', async () => {
  const { service, upsert, deleteMany } = createService('none');

  const addError: unknown = await service
    .add('pessoa', 'documento')
    .catch((reason: unknown) => reason);
  const removeError: unknown = await service
    .remove('pessoa', 'documento')
    .catch((reason: unknown) => reason);

  expect(addError).toBeInstanceOf(NotFoundException);
  expect((addError as NotFoundException).message).toBe(NOT_FOUND_MESSAGE);
  expect(removeError).toBeInstanceOf(NotFoundException);
  expect((removeError as NotFoundException).message).toBe(NOT_FOUND_MESSAGE);
  expect(upsert).not.toHaveBeenCalled();
  expect(deleteMany).not.toHaveBeenCalled();
});

test('remove deletes by person and document and succeeds with zero rows', async () => {
  const { service, deleteMany } = createService();
  deleteMany.mockResolvedValue({ count: 0 });

  await expect(service.remove('pessoa', 'documento')).resolves.toBeUndefined();

  expect(deleteMany).toHaveBeenCalledWith({
    where: { personId: 'pessoa', documentId: 'documento' },
  });
});

test('list filters by person and readable documents, orders by createdAt desc then documentId desc and takes 100', async () => {
  const { service, findMany, readableDocumentsWhere } = createService();

  await service.list('pessoa');

  expect(readableDocumentsWhere).toHaveBeenCalledWith('pessoa');
  expect(findMany).toHaveBeenCalledWith({
    where: { personId: 'pessoa', document: READABLE_WHERE },
    orderBy: [{ createdAt: 'desc' }, { documentId: 'desc' }],
    take: 100,
    select: {
      document: { select: { id: true, title: true, updatedAt: true } },
    },
  });
});

test('list maps the related documents to summaries with ISO dates', async () => {
  const { service, findMany } = createService();
  findMany.mockResolvedValue([
    {
      document: {
        id: 'documento-1',
        title: 'Plano de obras',
        updatedAt: new Date('2026-03-01T10:00:00.000Z'),
      },
    },
    {
      document: {
        id: 'documento-2',
        title: 'Sem título',
        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
    },
  ]);

  await expect(service.list('pessoa')).resolves.toEqual([
    {
      id: 'documento-1',
      title: 'Plano de obras',
      updatedAt: '2026-03-01T10:00:00.000Z',
      trashedAt: null,
    },
    {
      id: 'documento-2',
      title: 'Sem título',
      updatedAt: '2026-01-01T10:00:00.000Z',
      trashedAt: null,
    },
  ]);
});

test('list reports trashedAt null in every summary', async () => {
  const { service, findMany } = createService();
  findMany.mockResolvedValue([
    {
      document: {
        id: 'documento-1',
        title: 'Plano de obras',
        updatedAt: new Date('2026-03-01T10:00:00.000Z'),
      },
    },
    {
      document: {
        id: 'documento-2',
        title: 'Sem título',
        updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      },
    },
  ]);

  const summaries = await service.list('pessoa');

  expect(summaries.map((summary) => summary.trashedAt)).toEqual([null, null]);
});
