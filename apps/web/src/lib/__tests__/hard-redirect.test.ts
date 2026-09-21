import { afterEach, expect, test, vi } from 'vitest';

import { hardRedirect } from '../hard-redirect';

const originalLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

test('calls window.location.assign with the target', () => {
  // jsdom does not navigate: the call itself is what the module promises,
  // and `location` has to be replaced wholesale because `assign` is read-only.
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...originalLocation, assign },
  });

  hardRedirect('/login?redirectTo=%2Ffavorites');

  expect(assign).toHaveBeenCalledWith('/login?redirectTo=%2Ffavorites');
});
