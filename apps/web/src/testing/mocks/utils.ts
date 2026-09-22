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
//     (also accepts 'installation', 'auth', 'documents', 'org-units',
//     'unit-assignments', 'people' or 'invitations', matching the resource)
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
//     units under the root (needs an installation already seeded), plus one
//     document in the space of "Sala Infantil" — that document also shows up
//     in the person's document lists, which the fake database does not filter
//     by space; the people screen of any of these units also gives something to
//     remove, since whoever is assigned there in the browser can be taken out
//     again
//   localStorage.setItem('mock-people', 'sample')  -> adds twelve people in
//     pt_BR to the organization (needs an installation already seeded), so the
//     search of the unit people screen finds someone and, with a broad term,
//     shows the "há mais resultados" warning of the hard limit of 10
//     (localStorage.setItem('mock-error', 'people') shows its error state and
//     localStorage.setItem('mock-error', 'unit-assignments') the error state
//     of the list of assigned people)
//   localStorage.setItem('mock-invitations', 'sample')  -> seeds a pending
//     invitation for convidado@exemplo.com.br (needs an installation already
//     seeded), to see inviting the same address replace it, and to open the
//     invitation link: the seeded invitation is the first of the page load, so
//     its token is 'mock-invitation-token-1' and the link is
//     /invitations/mock-invitation-token-1 (the link of an invitation created
//     in the browser is shown once, on the invitations screen); the seeded
//     invitation also fills the pending list of that screen, so it is what
//     there is to revoke there — after revoking it, the link above stops
//     opening and answers the same error an invented link answers
//     (localStorage.setItem('mock-error', 'invitations') shows its error state
//     and localStorage.setItem('mock-role', 'member') its 403)
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
