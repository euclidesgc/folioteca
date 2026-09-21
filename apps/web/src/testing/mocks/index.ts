import { env } from '@/config/env';

// Only imports and starts the worker when mocking is on: keeps MSW out of
// the production bundle.
export const enableMocking = async (): Promise<void> => {
  if (!env.ENABLE_API_MOCKING) return;

  const { worker } = await import('./browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
};
