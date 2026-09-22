import 'reflect-metadata';

import { createHash } from 'node:crypto';

import type { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../../auth/session.service';
import { hashToken } from '../hash-token';

/** Entrada trivial e legível: o vetor do teste não é segredo nenhum. */
const FIXED_INPUT = 'folioteca';

test('hashToken returns a stable sha256 hex digest for a fixed input', () => {
  const digest = hashToken(FIXED_INPUT);

  expect(digest).toBe(createHash('sha256').update(FIXED_INPUT).digest('hex'));
  expect(digest).toMatch(/^[0-9a-f]{64}$/);
  expect(hashToken(FIXED_INPUT)).toBe(digest);
});

test('hashToken matches the digest the session service stores', async () => {
  const create = vi.fn().mockResolvedValue({});
  const prisma = { session: { create } } as unknown as PrismaService;

  const session = await new SessionService(prisma).create('pessoa-1');

  const written = create.mock.calls[0]?.[0] as { data: { tokenHash: string } };

  expect(written.data.tokenHash).toBe(hashToken(session.token));
});
