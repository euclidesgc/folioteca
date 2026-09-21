import { env } from '@/config/env';

// Only imports and starts the worker when mocking is on: keeps MSW out of
// the production bundle.
export const enableMocking = async (): Promise<void> => {
  if (!env.ENABLE_API_MOCKING) return;

  const { worker } = await import('./browser');
  const { seedInstalled } = await import('./db');

  // Reproduces an installed instance in the browser without touching code.
  // See the `mock-installation` key documented in utils.ts.
  const installationKey = window.localStorage.getItem('mock-installation');
  if (installationKey === 'installed') seedInstalled({ signedIn: false });
  if (installationKey === 'signed-in') seedInstalled({ signedIn: true });

  await worker.start({ onUnhandledRequest: 'bypass' });
};
