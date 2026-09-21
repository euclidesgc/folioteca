import { env } from '@/config/env';

// Only imports and starts the worker when mocking is on: keeps MSW out of
// the production bundle.
export const enableMocking = async (): Promise<void> => {
  if (!env.ENABLE_API_MOCKING) return;

  const { worker } = await import('./browser');
  const {
    seedInstalled,
    seedSampleDocuments,
    seedSampleFavorites,
    seedSampleTrash,
    touchDocumentUpdatedAt,
  } = await import('./db');

  // Reproduces an installed instance in the browser without touching code.
  // See the `mock-installation` key documented in utils.ts.
  const installationKey = window.localStorage.getItem('mock-installation');
  if (installationKey === 'installed') seedInstalled({ signedIn: false });
  if (installationKey === 'signed-in') seedInstalled({ signedIn: true });

  // See the `mock-documents` key documented in utils.ts.
  const documentsKey = window.localStorage.getItem('mock-documents');
  if (documentsKey === 'sample') seedSampleDocuments();

  // See the `mock-favorites` key documented in utils.ts. Read after the
  // documents seed: it marks the documents already in the database.
  const favoritesKey = window.localStorage.getItem('mock-favorites');
  if (favoritesKey === 'sample') seedSampleFavorites();

  // See the `mock-trash` key documented in utils.ts. Read after the
  // documents and the favorites seed: it moves documents already in the
  // database.
  const trashKey = window.localStorage.getItem('mock-trash');
  if (trashKey === 'sample') seedSampleTrash();

  // The simulated editor writes to the in-memory provider, which has no HTTP
  // request for MSW to intercept: it reports a save straight to the fake
  // database, so the document dates move like they do against the real API.
  const { setLocalStoredListener } = await import(
    '@/features/documents/utils/local-collaboration-provider'
  );
  setLocalStoredListener(touchDocumentUpdatedAt);

  await worker.start({ onUnhandledRequest: 'bypass' });
};
