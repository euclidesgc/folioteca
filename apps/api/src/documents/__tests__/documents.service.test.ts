import 'reflect-metadata';

import {
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
    canWrite: vi.fn().mockResolvedValue(true),
    readableDocumentsWhere: vi.fn().mockReturnValue({ ownerId: 'pessoa' }),
    trashedDocumentsWhere: vi
      .fn()
      .mockReturnValue({ ownerId: 'pessoa', trashedAt: { not: null } }),
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
    canWrite: vi.fn(),
    readableDocumentsWhere: vi.fn(),
    trashedDocumentsWhere: vi.fn(),
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
  ).resolves.toBe(false);

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
function documentRecord(
  favorites: { personId: string }[],
  trashedAt: Date | null = null,
): unknown {
  return {
    id: 'documento',
    title: 'Plano de obras',
    spaceId: 'espaco',
    authorId: 'pessoa',
    ownerId: 'pessoa',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:00:00.000Z'),
    trashedAt,
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
    canWrite: vi.fn().mockResolvedValue(true),
    readableDocumentsWhere: vi.fn().mockReturnValue({ ownerId: 'pessoa' }),
    trashedDocumentsWhere: vi
      .fn()
      .mockReturnValue({ ownerId: 'pessoa', trashedAt: { not: null } }),
  } as unknown as DocumentsServiceAccess;

  return new DocumentsService(prisma, access as unknown as AccessService);
}

/** Dublê do `AccessService` com as quatro portas. */
type DocumentsServiceAccess = {
  resolveAccess: ReturnType<typeof vi.fn>;
  canWrite: ReturnType<typeof vi.fn>;
  readableDocumentsWhere: ReturnType<typeof vi.fn>;
  trashedDocumentsWhere: ReturnType<typeof vi.fn>;
};

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
    canWrite: vi.fn(),
    readableDocumentsWhere: vi.fn(),
    trashedDocumentsWhere: vi.fn(),
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

  const document = await service.create(
    {
      id: 'pessoa',
    } as Parameters<DocumentsService['create']>[0],
    undefined,
  );

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

/** `expect.any(Date)` tipado, para o objeto comparado por `toHaveBeenCalledWith`. */
const ANY_DATE = expect.any(Date) as unknown as Date;

const READABLE_WHERE = { ownerId: 'pessoa', trashedAt: null };
const TRASHED_WHERE = { ownerId: 'pessoa', trashedAt: { not: null } };

const TRASHED_DOCUMENT_MESSAGE =
  'Este documento está na lixeira. Restaure-o para editar.';
const DELETE_OUTSIDE_TRASH_MESSAGE =
  'Mova o documento para a lixeira antes de apagá-lo definitivamente.';
const NOT_FOUND_MESSAGE = 'Documento não encontrado.';

type TrashDoubles = {
  service: DocumentsService;
  findMany: ReturnType<typeof vi.fn>;
  findFirst: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  access: DocumentsServiceAccess;
};

/** Serviço com as quatro portas e a tabela `Document` inteira substituídas. */
function createTrashService(
  options: {
    level?: AccessLevel;
    canWrite?: boolean;
    record?: unknown;
    rows?: unknown[];
    deletedCount?: number;
  } = {},
): TrashDoubles {
  const record = options.record ?? documentRecord([]);
  const findMany = vi.fn().mockResolvedValue(options.rows ?? []);
  const findFirst = vi.fn().mockResolvedValue(record);
  const update = vi.fn().mockResolvedValue(record);
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const deleteMany = vi
    .fn()
    .mockResolvedValue({ count: options.deletedCount ?? 1 });

  const prisma = {
    document: { findMany, findFirst, update, updateMany, deleteMany },
  } as unknown as PrismaService;

  const access: DocumentsServiceAccess = {
    resolveAccess: vi.fn().mockResolvedValue(options.level ?? 'owner'),
    canWrite: vi.fn().mockResolvedValue(options.canWrite ?? true),
    readableDocumentsWhere: vi.fn().mockReturnValue(READABLE_WHERE),
    trashedDocumentsWhere: vi.fn().mockReturnValue(TRASHED_WHERE),
  };

  return {
    service: new DocumentsService(prisma, access as unknown as AccessService),
    findMany,
    findFirst,
    update,
    updateMany,
    deleteMany,
    access,
  };
}

test('toDocument turns trashedAt into an ISO string or null', async () => {
  const trashed = createTrashService({
    record: documentRecord([], new Date('2026-03-01T10:00:00.000Z')),
  });
  const active = createTrashService({ record: documentRecord([]) });

  const inTrash = await trashed.service.get('pessoa', 'documento');
  const outside = await active.service.get('pessoa', 'documento');

  expect(inTrash.trashedAt).toBe('2026-03-01T10:00:00.000Z');
  expect(outside.trashedAt).toBeNull();
});

test('listTrash filters by trashedDocumentsWhere, orders by trashedAt desc then id desc and takes 100', async () => {
  const { service, findMany, access } = createTrashService({
    rows: [
      {
        id: 'documento-1',
        title: 'Plano de obras',
        updatedAt: new Date('2026-02-01T10:00:00.000Z'),
        trashedAt: new Date('2026-03-01T10:00:00.000Z'),
      },
    ],
  });

  const summaries = await service.listTrash('pessoa');

  expect(access.trashedDocumentsWhere).toHaveBeenCalledWith('pessoa');
  expect(findMany).toHaveBeenCalledWith({
    where: TRASHED_WHERE,
    orderBy: [{ trashedAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: { id: true, title: true, updatedAt: true, trashedAt: true },
  });
  expect(summaries).toEqual([
    {
      id: 'documento-1',
      title: 'Plano de obras',
      updatedAt: '2026-02-01T10:00:00.000Z',
      trashedAt: '2026-03-01T10:00:00.000Z',
    },
  ]);
});

test('listMine reports trashedAt null', async () => {
  const { service } = createTrashService({
    rows: [
      {
        id: 'documento-1',
        title: 'Plano de obras',
        updatedAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ],
  });

  const summaries = await service.listMine('pessoa', { scope: 'mine' });

  expect(summaries).toEqual([
    {
      id: 'documento-1',
      title: 'Plano de obras',
      updatedAt: '2026-02-01T10:00:00.000Z',
      trashedAt: null,
    },
  ]);
});

test('get reads through the readable or the trashed documents of the person', async () => {
  const { service, findFirst, access } = createTrashService();

  await service.get('pessoa', 'documento');

  expect(access.readableDocumentsWhere).toHaveBeenCalledWith('pessoa');
  expect(access.trashedDocumentsWhere).toHaveBeenCalledWith('pessoa');
  expect(findFirst).toHaveBeenCalledWith({
    where: {
      AND: [
        { id: 'documento' },
        { OR: [READABLE_WHERE, TRASHED_WHERE] },
      ],
    },
    include: {
      favorites: { where: { personId: 'pessoa' }, select: { personId: true } },
    },
  });
});

test('rename throws 409 before parsing the body when canWrite is false and writes nothing', async () => {
  const { service, update } = createTrashService({ canWrite: false });

  const error: unknown = await service
    .rename('pessoa', 'documento', { title: 42 })
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).getStatus()).toBe(409);
  expect((error as ConflictException).message).toBe(TRASHED_DOCUMENT_MESSAGE);
  expect(update).not.toHaveBeenCalled();
});

test('trash, restore and delete throw document not found when access is not owner and write nothing', async () => {
  const { service, updateMany, deleteMany } = createTrashService({
    level: 'view',
  });

  const errors: unknown[] = await Promise.all([
    service.trash('pessoa', 'documento').catch((reason: unknown) => reason),
    service.restore('pessoa', 'documento').catch((reason: unknown) => reason),
    service.delete('pessoa', 'documento').catch((reason: unknown) => reason),
  ]);

  expect(
    errors.every((error) => error instanceof NotFoundException),
  ).toBe(true);
  expect(
    errors.map((error) => (error as NotFoundException).message),
  ).toEqual([NOT_FOUND_MESSAGE, NOT_FOUND_MESSAGE, NOT_FOUND_MESSAGE]);
  expect(updateMany).not.toHaveBeenCalled();
  expect(deleteMany).not.toHaveBeenCalled();
});

test('delete throws 409 when no row was deleted', async () => {
  const { service } = createTrashService({ deletedCount: 0 });

  const error: unknown = await service
    .delete('pessoa', 'documento')
    .catch((reason: unknown) => reason);

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).getStatus()).toBe(409);
  expect((error as ConflictException).message).toBe(
    DELETE_OUTSIDE_TRASH_MESSAGE,
  );
});

/** Serviço cujo `saveContent` roda numa transação simulada. */
function createSavingService(updatedCount: number): {
  service: DocumentsService;
  updateMany: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
} {
  const updateMany = vi.fn().mockResolvedValue({ count: updatedCount });
  const upsert = vi.fn().mockResolvedValue(undefined);
  const tx = {
    document: { updateMany },
    documentContent: { upsert },
  };

  const prisma = {
    $transaction: vi
      .fn()
      .mockImplementation((run: (client: typeof tx) => unknown) => run(tx)),
  } as unknown as PrismaService;

  return { service: createContentService(prisma), updateMany, upsert };
}

test('saveContent returns false without upsert when no document row was updated', async () => {
  // O descarte registra um aviso de propósito: silenciado para o console dos
  // testes ficar limpo.
  const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  const { service, updateMany, upsert } = createSavingService(0);

  await expect(
    service.saveContent('documento', new Uint8Array([1, 2, 3])),
  ).resolves.toBe(false);

  expect(updateMany).toHaveBeenCalledWith({
    where: { id: 'documento', trashedAt: null },
    data: { updatedAt: ANY_DATE },
  });
  expect(upsert).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalled();

  warn.mockRestore();
});

test('saveContent returns true after storing', async () => {
  const { service, upsert } = createSavingService(1);
  const state = new Uint8Array([1, 2, 3]);

  await expect(service.saveContent('documento', state)).resolves.toBe(true);

  expect(upsert).toHaveBeenCalledWith({
    where: { documentId: 'documento' },
    create: { documentId: 'documento', state },
    update: { state },
  });
});

test('closed listeners run after a successful trash and delete, never on restore or failure', async () => {
  const succeeding = createTrashService();
  const closed: string[] = [];
  succeeding.service.onDocumentClosed((id) => closed.push(id));

  await succeeding.service.trash('pessoa', 'documento');
  await succeeding.service.restore('pessoa', 'documento');
  await succeeding.service.delete('pessoa', 'documento');

  const denied = createTrashService({ level: 'none' });
  const deniedClosed: string[] = [];
  denied.service.onDocumentClosed((id) => deniedClosed.push(id));

  await denied.service.trash('pessoa', 'documento').catch(() => undefined);
  await denied.service.delete('pessoa', 'documento').catch(() => undefined);

  const conflicting = createTrashService({ deletedCount: 0 });
  const conflictingClosed: string[] = [];
  conflicting.service.onDocumentClosed((id) => conflictingClosed.push(id));

  await conflicting.service.delete('pessoa', 'documento').catch(() => undefined);

  expect(closed).toEqual(['documento', 'documento']);
  expect(deniedClosed).toEqual([]);
  expect(conflictingClosed).toEqual([]);
});
