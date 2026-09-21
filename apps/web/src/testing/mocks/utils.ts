import { delay, HttpResponse, type StrictResponse } from 'msw';

// Name of the session cookie set by both the real API and this mock.
export const SESSION_COOKIE_NAME = 'folioteca_session';

// Not a secret: readable and low-entropy on purpose, so it never looks like
// a leaked credential to a secret scanner.
export const MOCK_INSTALL_CODE = ['mock', 'install', 'code', '0'.repeat(16)].join(
  '-',
);

// Same reasoning as the install code above: assembled at runtime so no secret
// scanner ever sees a credential-looking literal in the repository.
export const MOCK_PASSWORD = ['mock', 'password', '0'.repeat(12)].join('-');

// Short in tests, realistic in the browser so loading states are visible.
export const networkDelay = (): Promise<void> =>
  delay(import.meta.env.MODE === 'test' ? 0 : 'real');

// Development keys, read from localStorage in the browser only:
//   localStorage.setItem('mock-error', 'health')   -> the /health handler answers 500
//     (also accepts 'installation', 'auth', 'documents' or 'org-units', matching
//     the resource)
//   localStorage.setItem('mock-delay', 'infinite')  -> requests never resolve (loading state)
//   localStorage.setItem('mock-installation', 'installed')  -> seeds an installation, signed out;
//     sign in with the seeded person's e-mail and the MOCK_PASSWORD above
//   localStorage.setItem('mock-installation', 'signed-in')  -> seeds an installation, signed in
//   localStorage.setItem('mock-documents', 'sample')  -> adds a varied batch of documents
//     owned by the signed-in person (needs an installation already seeded)
//   localStorage.setItem('mock-favorites', 'sample')  -> marks the first documents
//     as favorites (needs the documents already seeded)
//   localStorage.setItem('mock-trash', 'sample')  -> moves the last documents
//     to the trash (needs the documents already seeded)
//   localStorage.setItem('mock-role', 'member')  -> the seeded person is not an
//     administrator (read before the installation is seeded)
//   localStorage.setItem('mock-org-units', 'sample')  -> adds three levels of
//     units under the root (needs an installation already seeded)
// Remove the key (or run localStorage.clear()) to go back to normal.
const devKey = (key: string): string | null => {
  if (import.meta.env.MODE === 'test' || typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(key);
};

export const serverError = (): StrictResponse<{ message: string }> =>
  HttpResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 });

// Call at the top of every handler of a resource.
// Returns a response when a development key forces one, otherwise null.
export const devOverride = async (
  resource: string,
): Promise<StrictResponse<{ message: string }> | null> => {
  if (devKey('mock-delay') === 'infinite') await delay('infinite');
  if (devKey('mock-error') === resource) return serverError();
  return null;
};
