import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { useNotifications } from '@/components/ui/notifications/notifications-store';
import { resetDb } from '@/testing/mocks/db';
import { server } from '@/testing/mocks/server';
import { SESSION_COOKIE_NAME } from '@/testing/mocks/utils';

const clearSessionCookie = (): void => {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  resetDb();
  clearSessionCookie();
  useNotifications.setState(useNotifications.getInitialState());
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
