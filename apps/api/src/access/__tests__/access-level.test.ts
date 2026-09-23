import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { PrismaService } from '../../prisma/prisma.service';
import { canEdit } from '../access-level';
import { AccessService } from '../access.service';

const OWNER_ID = 'dona';
const VIEWER_ID = 'visitante';

type ShareRow = { level: 'VIEW' | 'EDIT' };

/**
 * `levelOf` é privado do `AccessService`: ele é exercitado pelo
 * `resolveAccess`, com o Prisma trocado por um dublê que devolve o documento
 * já com a linha de compartilhamento da pessoa.
 */
function accessWith(document: {
  ownerId: string;
  trashedAt: Date | null;
  shares: ShareRow[];
}): AccessService {
  const prisma = {
    document: { findFirst: vi.fn().mockResolvedValue(document) },
  } as unknown as PrismaService;

  return new AccessService(prisma);
}

test('canEdit returns true for owner', () => {
  expect(canEdit('owner')).toBe(true);
});

test('canEdit returns true for edit', () => {
  expect(canEdit('edit')).toBe(true);
});

test('canEdit returns false for view', () => {
  expect(canEdit('view')).toBe(false);
});

test('canEdit returns false for none', () => {
  expect(canEdit('none')).toBe(false);
});

test('levelOf returns view for a view share', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [{ level: 'VIEW' }],
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('view');
});

test('levelOf returns none for a shared document in the trash', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: new Date('2026-03-01T10:00:00.000Z'),
    shares: [{ level: 'VIEW' }],
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('none');
});

test('levelOf returns owner for the owner even with a share row', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [{ level: 'VIEW' }],
  });

  expect(await access.resolveAccess(OWNER_ID, randomUUID())).toBe('owner');
});
