import 'reflect-metadata';

import { ForbiddenException, NotFoundException } from '@nestjs/common';

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
