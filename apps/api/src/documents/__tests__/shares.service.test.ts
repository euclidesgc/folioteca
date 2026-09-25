import 'reflect-metadata';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { AccessLevel } from '../../access/access-level';
import type { AccessService } from '../../access/access.service';
import type { PersonWithOrganization } from '../../auth/session.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { SharesService } from '../shares.service';

const REQUESTER_ID = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';
const PERSON_ID = '44444444-4444-4444-8444-444444444444';

const VALID_BODY = { level: 'view' };

const requester = {
  id: REQUESTER_ID,
  organizationId: ORGANIZATION_ID,
} as unknown as PersonWithOrganization;

const storedPerson = {
  id: PERSON_ID,
  name: 'João Lima',
  email: 'joao@exemplo.org',
};

/** Linha de `documentShare.findMany` como `list` a seleciona. */
type StoredShareRow = {
  level: 'VIEW' | 'EDIT';
  person: { id: string; name: string; email: string };
};

/** Serviço com o Prisma e o acesso substituídos por dublês. */
function createService(
  level: AccessLevel,
  {
    canWrite = true,
    shareRows = [],
  }: { canWrite?: boolean; shareRows?: StoredShareRow[] } = {},
): {
  service: SharesService;
  findFirst: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  canWriteMock: ReturnType<typeof vi.fn>;
  instanceUpsert: ReturnType<typeof vi.fn>;
} {
  const findFirst = vi.fn().mockResolvedValue(storedPerson);
  const upsert = vi.fn().mockResolvedValue({});
  const findMany = vi.fn().mockResolvedValue(shareRows);
  const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
  const canWriteMock = vi.fn().mockResolvedValue(canWrite);
  const instanceUpsert = vi.fn().mockResolvedValue({});

  const prisma = {
    person: { findFirst },
    documentShare: { upsert, findMany, deleteMany },
    documentInstanceShare: {
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: instanceUpsert,
    },
  } as unknown as PrismaService;

  const access = {
    resolveAccess: vi.fn().mockResolvedValue(level),
    canWrite: canWriteMock,
  } as unknown as AccessService;

  return {
    service: new SharesService(prisma, access),
    findFirst,
    upsert,
    findMany,
    deleteMany,
    canWriteMock,
    instanceUpsert,
  };
}

/** Erro lançado pela chamada, ou `undefined` quando ela termina bem. */
function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
}

test('share answers 404 when the requester has no access', async () => {
  const { service, upsert } = createService('none');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getStatus()).toBe(404);
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 403 to a view person', async () => {
  const { service, upsert } = createService('view');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).message).toBe(
    'Só o proprietário pode compartilhar este documento.',
  );
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 409 for the owner on a trashed document', async () => {
  const { service, upsert } = createService('owner', { canWrite: false });

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).message).toBe(
    'Este documento está na lixeira. Restaure-o para editar.',
  );
  expect(upsert).not.toHaveBeenCalled();
});

test('share checks access before the body', async () => {
  const { service } = createService('none');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'owner' }),
  );

  expect(error).toBeInstanceOf(NotFoundException);
});

test('share answers 400 for an invalid body', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'owner' }),
  );

  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).getStatus()).toBe(400);
  expect(findFirst).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 400 when sharing with oneself', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, REQUESTER_ID, VALID_BODY),
  );

  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).message).toBe(
    'Você já é o proprietário deste documento.',
  );
  expect(findFirst).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

test('share answers 400 for a malformed person id without querying', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const error = await errorOf(
    service.share(requester, DOCUMENT_ID, 'nao-e-uuid', VALID_BODY),
  );

  expect(error).toBeInstanceOf(BadRequestException);
  expect((error as BadRequestException).message).toBe(
    'Pessoa não encontrada nesta instância.',
  );
  expect(findFirst).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

test('share upserts VIEW and returns the person from the database', async () => {
  const { service, findFirst, upsert } = createService('owner');

  const result = await service.share(
    requester,
    DOCUMENT_ID,
    PERSON_ID,
    VALID_BODY,
  );

  expect(findFirst).toHaveBeenCalledWith({
    where: { id: PERSON_ID, organizationId: ORGANIZATION_ID },
    select: { id: true, name: true, email: true },
  });
  expect(upsert).toHaveBeenCalledWith({
    where: {
      documentId_personId: { documentId: DOCUMENT_ID, personId: PERSON_ID },
    },
    create: { documentId: DOCUMENT_ID, personId: PERSON_ID, level: 'VIEW' },
    update: { level: 'VIEW' },
  });
  expect(result).toEqual({
    data: {
      personId: PERSON_ID,
      name: 'João Lima',
      email: 'joao@exemplo.org',
      level: 'view',
    },
  });
});

test('share maps edit to EDIT in create and update of the upsert', async () => {
  const { service, upsert } = createService('owner');

  await service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'edit' });

  expect(upsert).toHaveBeenCalledWith({
    where: {
      documentId_personId: { documentId: DOCUMENT_ID, personId: PERSON_ID },
    },
    create: { documentId: DOCUMENT_ID, personId: PERSON_ID, level: 'EDIT' },
    update: { level: 'EDIT' },
  });
});

test('share maps view to VIEW in create and update of the upsert', async () => {
  const { service, upsert } = createService('owner');

  await service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'view' });

  expect(upsert).toHaveBeenCalledWith({
    where: {
      documentId_personId: { documentId: DOCUMENT_ID, personId: PERSON_ID },
    },
    create: { documentId: DOCUMENT_ID, personId: PERSON_ID, level: 'VIEW' },
    update: { level: 'VIEW' },
  });
});

test('share returns the requested level in lowercase', async () => {
  const editor = createService('owner');
  const viewer = createService('owner');

  const edited = await editor.service.share(
    requester,
    DOCUMENT_ID,
    PERSON_ID,
    { level: 'edit' },
  );
  const viewed = await viewer.service.share(
    requester,
    DOCUMENT_ID,
    PERSON_ID,
    { level: 'view' },
  );

  expect(edited.data.level).toBe('edit');
  expect(viewed.data.level).toBe('view');
});

const OTHER_PERSON_ID = '55555555-5555-4555-8555-555555555555';

const owner = {
  id: REQUESTER_ID,
  organizationId: ORGANIZATION_ID,
  name: 'Maria Souza',
  email: 'maria@exemplo.org',
} as unknown as PersonWithOrganization;

test('list answers 404 when the requester has no access', async () => {
  const { service } = createService('none');

  const error = await errorOf(service.list(owner, DOCUMENT_ID));

  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getStatus()).toBe(404);
});

test('list answers 403 to a view person', async () => {
  const { service } = createService('view');

  const error = await errorOf(service.list(owner, DOCUMENT_ID));

  expect(error).toBeInstanceOf(ForbiddenException);
  expect((error as ForbiddenException).message).toBe(
    'Só o proprietário pode ver quem tem acesso a este documento.',
  );
});

test('list checks access before reading shares', async () => {
  const hidden = createService('none');
  const viewer = createService('view');

  await errorOf(hidden.service.list(owner, DOCUMENT_ID));
  await errorOf(viewer.service.list(owner, DOCUMENT_ID));

  expect(hidden.findMany).not.toHaveBeenCalled();
  expect(viewer.findMany).not.toHaveBeenCalled();
});

test('list does not check canWrite', async () => {
  const { service, canWriteMock } = createService('owner', {
    canWrite: false,
  });

  const result = await service.list(owner, DOCUMENT_ID);

  expect(canWriteMock).not.toHaveBeenCalled();
  expect(result.data).toHaveLength(1);
});

test('list maps VIEW to view and EDIT to edit', async () => {
  const { service } = createService('owner', {
    shareRows: [
      { level: 'VIEW', person: storedPerson },
      {
        level: 'EDIT',
        person: {
          id: OTHER_PERSON_ID,
          name: 'Pedro Alves',
          email: 'pedro@exemplo.org',
        },
      },
    ],
  });

  const result = await service.list(owner, DOCUMENT_ID);

  expect(
    result.data.map((entry) => [entry.personId, entry.level]),
  ).toEqual([
    [REQUESTER_ID, 'owner'],
    [PERSON_ID, 'view'],
    [OTHER_PERSON_ID, 'edit'],
  ]);
});

test('list puts the owner first with isCurrentPerson true', async () => {
  const { service } = createService('owner', {
    shareRows: [
      {
        level: 'VIEW',
        person: {
          id: OTHER_PERSON_ID,
          name: 'Abel Costa',
          email: 'abel@exemplo.org',
        },
      },
    ],
  });

  const result = await service.list(owner, DOCUMENT_ID);

  expect(result.data).toEqual([
    {
      personId: REQUESTER_ID,
      name: 'Maria Souza',
      email: 'maria@exemplo.org',
      level: 'owner',
      isCurrentPerson: true,
    },
    {
      personId: OTHER_PERSON_ID,
      name: 'Abel Costa',
      email: 'abel@exemplo.org',
      level: 'view',
      isCurrentPerson: false,
    },
  ]);
});

test('remove throws not found when access is none and deletes nothing', async () => {
  const { service, deleteMany } = createService('none');

  const error = await errorOf(service.remove(owner, DOCUMENT_ID, PERSON_ID));

  expect(error).toBeInstanceOf(NotFoundException);
  expect((error as NotFoundException).getStatus()).toBe(404);
  expect(deleteMany).not.toHaveBeenCalled();
});

test('remove throws forbidden when access is not owner and deletes nothing', async () => {
  const viewer = createService('view');
  const editor = createService('edit');

  const viewError = await errorOf(
    viewer.service.remove(owner, DOCUMENT_ID, PERSON_ID),
  );
  const editError = await errorOf(
    editor.service.remove(owner, DOCUMENT_ID, PERSON_ID),
  );

  expect(viewError).toBeInstanceOf(ForbiddenException);
  expect((viewError as ForbiddenException).message).toBe(
    'Só o proprietário pode remover o acesso a este documento.',
  );
  expect(editError).toBeInstanceOf(ForbiddenException);
  expect((editError as ForbiddenException).message).toBe(
    'Só o proprietário pode remover o acesso a este documento.',
  );
  expect(viewer.deleteMany).not.toHaveBeenCalled();
  expect(editor.deleteMany).not.toHaveBeenCalled();
});

test('remove throws conflict when the document is trashed and deletes nothing', async () => {
  const { service, deleteMany } = createService('owner', { canWrite: false });

  const error = await errorOf(service.remove(owner, DOCUMENT_ID, PERSON_ID));

  expect(error).toBeInstanceOf(ConflictException);
  expect((error as ConflictException).message).toBe(
    'Este documento está na lixeira. Restaure-o para editar.',
  );
  expect(deleteMany).not.toHaveBeenCalled();
});

test('remove skips the query for a malformed personId', async () => {
  const { service, deleteMany } = createService('owner');

  const result = await service.remove(owner, DOCUMENT_ID, 'nao-e-uuid');

  expect(result).toBeUndefined();
  expect(deleteMany).not.toHaveBeenCalled();
});

test('remove calls deleteMany with documentId and personId', async () => {
  const { service, deleteMany } = createService('owner');

  await service.remove(owner, DOCUMENT_ID, PERSON_ID);

  expect(deleteMany).toHaveBeenCalledTimes(1);
  expect(deleteMany).toHaveBeenCalledWith({
    where: { documentId: DOCUMENT_ID, personId: PERSON_ID },
  });
});


test('share notifies the listeners with documentId and personId after the upsert', async () => {
  const { service, upsert } = createService('owner');
  const first = vi.fn();
  const second = vi.fn();
  service.onShareChanged(first);
  service.onShareChanged(second);

  await service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'edit' });

  expect(first).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenCalledWith(DOCUMENT_ID, PERSON_ID);
  expect(second).toHaveBeenCalledWith(DOCUMENT_ID, PERSON_ID);
  expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(
    first.mock.invocationCallOrder[0] ?? 0,
  );
});

test('share notifies again on a reshare', async () => {
  const { service, upsert } = createService('owner');
  const listener = vi.fn();
  service.onShareChanged(listener);

  await service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'edit' });
  await service.share(requester, DOCUMENT_ID, PERSON_ID, { level: 'view' });

  expect(upsert).toHaveBeenCalledTimes(2);
  expect(listener).toHaveBeenCalledTimes(2);
  expect(listener).toHaveBeenNthCalledWith(2, DOCUMENT_ID, PERSON_ID);
});

test('remove notifies the listeners when a row was deleted', async () => {
  const { service, deleteMany } = createService('owner');
  const listener = vi.fn();
  service.onShareChanged(listener);

  await service.remove(owner, DOCUMENT_ID, PERSON_ID);

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener).toHaveBeenCalledWith(DOCUMENT_ID, PERSON_ID);
  expect(deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
    listener.mock.invocationCallOrder[0] ?? 0,
  );
});

test('remove does not notify when no row was deleted', async () => {
  const { service, deleteMany } = createService('owner');
  deleteMany.mockResolvedValue({ count: 0 });
  const listener = vi.fn();
  service.onShareChanged(listener);

  await service.remove(owner, DOCUMENT_ID, PERSON_ID);

  expect(deleteMany).toHaveBeenCalledTimes(1);
  expect(listener).not.toHaveBeenCalled();
});

test('share and remove do not notify when access is refused', async () => {
  const hidden = createService('none');
  const viewer = createService('view');
  const trashed = createService('owner', { canWrite: false });
  const invalid = createService('owner');
  const listener = vi.fn();
  hidden.service.onShareChanged(listener);
  viewer.service.onShareChanged(listener);
  trashed.service.onShareChanged(listener);
  invalid.service.onShareChanged(listener);

  const errors = await Promise.all([
    errorOf(
      hidden.service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
    ),
    errorOf(
      viewer.service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
    ),
    errorOf(
      trashed.service.share(requester, DOCUMENT_ID, PERSON_ID, VALID_BODY),
    ),
    errorOf(
      invalid.service.share(requester, DOCUMENT_ID, PERSON_ID, {
        level: 'owner',
      }),
    ),
    errorOf(hidden.service.remove(owner, DOCUMENT_ID, PERSON_ID)),
    errorOf(viewer.service.remove(owner, DOCUMENT_ID, PERSON_ID)),
    errorOf(trashed.service.remove(owner, DOCUMENT_ID, PERSON_ID)),
  ]);

  expect(errors.map((error) => (error as HttpException).getStatus())).toEqual(
    [404, 403, 409, 400, 404, 403, 409],
  );
  expect(listener).not.toHaveBeenCalled();
});

test('a throwing listener does not break share', async () => {
  // O ouvinte que lança é proposital: o erro vai para o log, que fica mudo
  // aqui para o console dos testes continuar limpo.
  const logError = vi
    .spyOn(Logger.prototype, 'error')
    .mockImplementation(() => undefined);

  try {
    const { service } = createService('owner');
    const next = vi.fn();
    service.onShareChanged(() => {
      throw new Error('falha do ouvinte');
    });
    service.onShareChanged(next);

    const result = await service.share(
      requester,
      DOCUMENT_ID,
      PERSON_ID,
      VALID_BODY,
    );

    expect(result.data.personId).toBe(PERSON_ID);
    expect(next).toHaveBeenCalledWith(DOCUMENT_ID, PERSON_ID);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logError.mock.calls[0])).not.toContain(PERSON_ID);
    expect(JSON.stringify(logError.mock.calls[0])).not.toContain(DOCUMENT_ID);
  } finally {
    logError.mockRestore();
  }
});

test('shareInstance checks 404 then 403 then 409 then 400', async () => {
  const invalidBody = { level: 'owner' };
  const none = createService('none', { canWrite: false });
  const view = createService('view', { canWrite: false });
  const edit = createService('edit', { canWrite: false });
  const trashed = createService('owner', { canWrite: false });
  const owner = createService('owner');

  const notFound = await errorOf(
    none.service.shareInstance(requester, DOCUMENT_ID, invalidBody),
  );
  const forbiddenView = await errorOf(
    view.service.shareInstance(requester, DOCUMENT_ID, invalidBody),
  );
  const forbiddenEdit = await errorOf(
    edit.service.shareInstance(requester, DOCUMENT_ID, invalidBody),
  );
  const conflict = await errorOf(
    trashed.service.shareInstance(requester, DOCUMENT_ID, invalidBody),
  );
  const badRequest = await errorOf(
    owner.service.shareInstance(requester, DOCUMENT_ID, invalidBody),
  );

  expect(notFound).toBeInstanceOf(NotFoundException);
  expect((notFound as NotFoundException).message).toBe(
    'Documento não encontrado.',
  );
  expect(forbiddenView).toBeInstanceOf(ForbiddenException);
  expect(forbiddenEdit).toBeInstanceOf(ForbiddenException);
  expect((forbiddenEdit as ForbiddenException).message).toBe(
    'Só o proprietário pode compartilhar este documento.',
  );
  expect(conflict).toBeInstanceOf(ConflictException);
  expect((conflict as ConflictException).message).toBe(
    'Este documento está na lixeira. Restaure-o para editar.',
  );
  expect(badRequest).toBeInstanceOf(BadRequestException);
  expect(none.instanceUpsert).not.toHaveBeenCalled();
  expect(view.instanceUpsert).not.toHaveBeenCalled();
  expect(edit.instanceUpsert).not.toHaveBeenCalled();
  expect(trashed.instanceUpsert).not.toHaveBeenCalled();
  expect(owner.instanceUpsert).not.toHaveBeenCalled();
  expect(none.canWriteMock).not.toHaveBeenCalled();
  expect(view.canWriteMock).not.toHaveBeenCalled();
});
