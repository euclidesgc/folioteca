import { beforeEach, expect, test } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { ConflictError } from '@/lib/errors';
import { seedInstalled } from '@/testing/mocks/db';

import { createInvitation } from '../create-invitation';

beforeEach(() => {
  seedInstalled({ signedIn: true });
});

test('sends POST to the invitations path with the e-mail', async () => {
  const response = await createInvitation({
    data: { email: 'novo.convidado@exemplo.com.br' },
  });

  expect(response.data).toMatchObject({
    email: 'novo.convidado@exemplo.com.br',
  });
  expect(response.data.id).toEqual(expect.any(String));
  expect(response.data.token).toEqual(expect.any(String));
  expect(response.data.token.length).toBeGreaterThan(0);
});

test('rejects on 409 without a global notification', async () => {
  // The e-mail of the installed person: already part of the organization.
  await expect(
    createInvitation({ data: { email: 'ana.souza@exemplo.com.br' } }),
  ).rejects.toBeInstanceOf(ConflictError);

  expect(useNotifications.getState().notifications).toEqual([]);
});
