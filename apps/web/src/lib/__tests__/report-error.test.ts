import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { reportError } from '../report-error';

// This module logs deliberately: silence and restore console.error per test.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('logs the error and context when both are provided', () => {
  const error = new Error('boom');
  const context = { userId: '123' };

  reportError(error, context);

  expect(console.error).toHaveBeenCalledWith(error, context);
});

test('logs the error with undefined context when none is provided', () => {
  const error = new Error('boom');

  reportError(error);

  expect(console.error).toHaveBeenCalledWith(error, undefined);
});
