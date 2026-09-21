import { expect, test } from 'vitest';

import { seedInstalled } from '@/testing/mocks/db';

import {
  getInstallation,
  getInstallationQueryOptions,
} from '../get-installation';

test('returns installed false on a fresh instance', async () => {
  await expect(getInstallation()).resolves.toEqual({
    data: { installed: false },
  });
});

test('returns installed true after seedInstalled', async () => {
  seedInstalled({ signedIn: false });

  await expect(getInstallation()).resolves.toEqual({
    data: { installed: true },
  });
});

test('uses the installation query key', () => {
  expect(getInstallationQueryOptions().queryKey).toEqual(['installation']);
});
