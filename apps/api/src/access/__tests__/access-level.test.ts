import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import type { PrismaService } from '../../prisma/prisma.service';
import { canEdit } from '../access-level';
import { AccessService } from '../access.service';

const OWNER_ID = 'dona';
const VIEWER_ID = 'visitante';

type ShareRow = { level: 'VIEW' | 'EDIT' };

type SpaceRow = {
  type: 'PERSONAL' | 'UNIT' | 'FREE';
  ownerId?: string | null;
  orgUnit: { assignments: { personId: string }[] } | null;
  members?: { personId: string }[];
};

const PERSONAL_SPACE: SpaceRow = { type: 'PERSONAL', orgUnit: null };

/**
 * `levelOf` é privado do `AccessService`: ele é exercitado pelo
 * `resolveAccess`, com o Prisma trocado por um dublê que devolve o documento
 * já com a linha de compartilhamento da pessoa e o espaço (pessoal, se o
 * caso não informar outro).
 */
function accessWith(document: {
  ownerId: string;
  trashedAt: Date | null;
  shares: ShareRow[];
  space?: SpaceRow;
}): AccessService {
  const prisma = {
    document: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ space: PERSONAL_SPACE, ...document }),
    },
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

/** Espaço `UNIT` com a lotação direta da pessoa já filtrada pelo `select`. */
const UNIT_SPACE_WITH_MEMBER: SpaceRow = {
  type: 'UNIT',
  orgUnit: { assignments: [{ personId: VIEWER_ID }] },
};

test('levelOf returns edit for a direct unit member', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [],
    space: UNIT_SPACE_WITH_MEMBER,
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('edit');
});

test('levelOf returns none for a unit member on a trashed document', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: new Date('2026-03-01T10:00:00.000Z'),
    shares: [],
    space: UNIT_SPACE_WITH_MEMBER,
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('none');
});

test('levelOf returns the higher level between a view share and unit membership', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [{ level: 'VIEW' }],
    space: UNIT_SPACE_WITH_MEMBER,
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('edit');
});

test('levelOf ignores membership outside a UNIT space', async () => {
  const freeAccess = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [],
    space: {
      type: 'FREE',
      ownerId: OWNER_ID,
      orgUnit: { assignments: [{ personId: VIEWER_ID }] },
      members: [],
    },
  });
  const personalAccess = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [{ level: 'VIEW' }],
    space: {
      type: 'PERSONAL',
      orgUnit: { assignments: [{ personId: VIEWER_ID }] },
    },
  });

  expect(await freeAccess.resolveAccess(VIEWER_ID, randomUUID())).toBe('none');
  expect(await personalAccess.resolveAccess(VIEWER_ID, randomUUID())).toBe(
    'view',
  );
});

const FREE_SPACE_OWNER_ID = 'dona-do-espaco';

/**
 * Espaço `FREE` como o `select` o devolve: `members` já filtrado pela pessoa
 * que pede o acesso.
 */
function freeSpace(members: { personId: string }[]): SpaceRow {
  return {
    type: 'FREE',
    ownerId: FREE_SPACE_OWNER_ID,
    orgUnit: null,
    members,
  };
}

test('levelOf returns edit for a member of a FREE space', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [],
    space: freeSpace([{ personId: VIEWER_ID }]),
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('edit');
});

test('levelOf returns edit for the owner of a FREE space on a document of a member', async () => {
  const access = accessWith({
    ownerId: VIEWER_ID,
    trashedAt: null,
    shares: [],
    space: freeSpace([]),
  });

  expect(await access.resolveAccess(FREE_SPACE_OWNER_ID, randomUUID())).toBe(
    'edit',
  );
});

test('levelOf returns none for a FREE space member on a trashed document', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: new Date('2026-03-01T10:00:00.000Z'),
    shares: [],
    space: freeSpace([{ personId: VIEWER_ID }]),
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('none');
});

test('levelOf returns none for a FREE space when the person is neither owner nor member', async () => {
  const access = accessWith({
    ownerId: OWNER_ID,
    trashedAt: null,
    shares: [],
    space: freeSpace([]),
  });

  expect(await access.resolveAccess(VIEWER_ID, randomUUID())).toBe('none');
});
