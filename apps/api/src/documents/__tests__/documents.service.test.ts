import 'reflect-metadata';

import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AccessLevel } from '../../access/access-level';
import type { AccessService } from '../../access/access.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { DocumentsService } from '../documents.service';

const CANNOT_EDIT_MESSAGE =
  'Você não tem permissão para editar este documento.';

/**
 * Serviço com as duas dependências substituídas. O nível `view` ainda não
 * aparece com dados reais nesta fatia, então só o teste unitário alcança o
 * ramo do 403.
 */
function createService(level: AccessLevel): {
  service: DocumentsService;
  update: ReturnType<typeof vi.fn>;
} {
  const update = vi.fn();

  const prisma = {
    document: { update },
  } as unknown as PrismaService;

  const access = {
    resolveAccess: vi.fn().mockResolvedValue(level),
    readableDocumentsWhere: vi.fn().mockReturnValue({ ownerId: 'pessoa' }),
  } as unknown as AccessService;

  return { service: new DocumentsService(prisma, access), update };
}

test('rename throws 403 with the literal message when the access level is view', async () => {
  const { service } = createService('view');

  const error: unknown = await service
    .rename('pessoa', 'documento', { title: 'Novo título' })
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).getStatus()).toBe(403);
  expect((error as ForbiddenException).message).toBe(CANNOT_EDIT_MESSAGE);
});

test('rename does not write when the access level is view', async () => {
  const { service, update } = createService('view');

  await service
    .rename('pessoa', 'documento', { title: 'Novo título' })
    .catch(() => undefined);

  expect(update).not.toHaveBeenCalled();
});

test('rename checks the access before validating the body', async () => {
  const { service, update } = createService('none');

  const error: unknown = await service
    .rename('pessoa', 'documento', { title: 42 })
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getStatus()).toBe(404);
  expect(update).not.toHaveBeenCalled();
});

/** Serviço com o Prisma substituído pelo dublê recebido. */
function createContentService(prisma: Partial<PrismaService>): DocumentsService {
  const access = {
    resolveAccess: vi.fn(),
    readableDocumentsWhere: vi.fn(),
  } as unknown as AccessService;

  return new DocumentsService(prisma as PrismaService, access);
}

/** Erro do Prisma para "o documento sumiu no meio da gravação". */
function missingDocumentError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Registro não encontrado.', {
    code: 'P2025',
    clientVersion: '6.0.0',
  });
}

test('saveContent swallows a missing document error and logs a warning', async () => {
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  const service = createContentService({
    $transaction: vi.fn().mockRejectedValue(missingDocumentError()),
  });

  await expect(
    service.saveContent('documento', new Uint8Array([1, 2, 3])),
  ).resolves.toBeUndefined();

  expect(warn).toHaveBeenCalled();

  warn.mockRestore();
});

test('saveContent rethrows any other error', async () => {
  const service = createContentService({
    $transaction: vi.fn().mockRejectedValue(new Error('banco fora do ar')),
  });

  await expect(
    service.saveContent('documento', new Uint8Array([1, 2, 3])),
  ).rejects.toThrow('banco fora do ar');
});

/** Registro de documento como o Prisma devolve, com a relação incluída. */
function documentRecord(favorites: { personId: string }[]): unknown {
  return {
    id: 'documento',
    title: 'Plano de obras',
    spaceId: 'espaco',
    authorId: 'pessoa',
    ownerId: 'pessoa',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:00:00.000Z'),
    favorites,
  };
}

/** Serviço com `findFirst` e `update` devolvendo o registro informado. */
function createFavoriteService(record: unknown): DocumentsService {
  const prisma = {
    document: {
      findFirst: vi.fn().mockResolvedValue(record),
      update: vi.fn().mockResolvedValue(record),
    },
  } as unknown as PrismaService;

  const access = {
    resolveAccess: vi.fn().mockResolvedValue('owner'),
    readableDocumentsWhere: vi.fn().mockReturnValue({ ownerId: 'pessoa' }),
  } as unknown as AccessService;

  return new DocumentsService(prisma, access);
}

/** Serviço cujo `create` roda dentro de uma transação simulada. */
function createCreatingService(): DocumentsService {
  const tx = {
    space: { upsert: vi.fn().mockResolvedValue({ id: 'espaco' }) },
    document: {
      create: vi.fn().mockResolvedValue(documentRecord([])),
    },
  };

  const prisma = {
    $transaction: vi
      .fn()
      .mockImplementation((run: (client: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;

  const access = {
    resolveAccess: vi.fn(),
    readableDocumentsWhere: vi.fn(),
  } as unknown as AccessService;

  return new DocumentsService(prisma, access);
}

test('get reports isFavorite true when the favorites relation has a row', async () => {
  const service = createFavoriteService(documentRecord([{ personId: 'pessoa' }]));

  const document = await service.get('pessoa', 'documento');

  expect(document.isFavorite).toBe(true);
});

test('get reports isFavorite false when the relation is empty', async () => {
  const service = createFavoriteService(documentRecord([]));

  const document = await service.get('pessoa', 'documento');

  expect(document.isFavorite).toBe(false);
});

test('rename reports isFavorite from the include', async () => {
  const service = createFavoriteService(documentRecord([{ personId: 'pessoa' }]));

  const document = await service.rename('pessoa', 'documento', {
    title: 'Plano de obras',
  });

  expect(document.isFavorite).toBe(true);
});

test('create reports isFavorite false', async () => {
  const service = createCreatingService();

  const document = await service.create({
    id: 'pessoa',
  } as Parameters<DocumentsService['create']>[0]);

  expect(document.isFavorite).toBe(false);
});

test('the favorites array never leaks into the body', async () => {
  const service = createFavoriteService(documentRecord([{ personId: 'pessoa' }]));

  const document = await service.get('pessoa', 'documento');

  expect(Object.keys(document)).not.toContain('favorites');
});

test('loadContent returns null when there is no content row', async () => {
  const service = createContentService({
    documentContent: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaService);

  await expect(service.loadContent('documento')).resolves.toBeNull();
});
