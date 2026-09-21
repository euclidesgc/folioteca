import { afterEach, beforeEach, expect, test, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test('defaults API_URL to /api and ENABLE_API_MOCKING to false', async () => {
  const { env } = await import('../env');

  expect(env.API_URL).toBe('/api');
  expect(env.ENABLE_API_MOCKING).toBe(false);
});

test('parses the string true as the boolean true', async () => {
  vi.stubEnv('VITE_APP_ENABLE_API_MOCKING', 'true');

  const { env } = await import('../env');

  expect(env.ENABLE_API_MOCKING).toBe(true);
});

test('treats any other value as false', async () => {
  vi.stubEnv('VITE_APP_ENABLE_API_MOCKING', 'yes');

  const { env } = await import('../env');

  expect(env.ENABLE_API_MOCKING).toBe(false);
});

test('throws at startup when API_URL is invalid', async () => {
  vi.stubEnv('VITE_APP_API_URL', '');

  await expect(import('../env')).rejects.toThrow(
    /Invalid env provided\. Missing or invalid variables:\n- API_URL:/,
  );
});
