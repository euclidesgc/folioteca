// Fake, hand-written in-memory database: this feature only creates one
// installation (never updates or deletes it), so `@mswjs/data` is overkill.

import { MOCK_PASSWORD } from './utils';

export type MockOrganization = { id: string; name: string };
export type MockPerson = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
};

export type MockInstallation = {
  organization: MockOrganization;
  person: MockPerson;
  // Kept in the fake database only to answer POST /auth/login; it never
  // reaches a response body.
  password: string;
};

type DbState = {
  installation: MockInstallation | null;
};

const initialState = (): DbState => ({ installation: null });

let state: DbState = initialState();

export const getDb = (): DbState => state;

export const seedDb = (overrides: Partial<DbState> = {}): void => {
  state = { ...initialState(), ...overrides };
};

export const resetDb = (): void => {
  state = initialState();
};

// Example installation, matching the shape a real POST /installation creates.
export const seedInstalled = ({ signedIn }: { signedIn: boolean }): void => {
  seedDb({
    installation: {
      organization: { id: 'org-1', name: 'Biblioteca Municipal de Exemplo' },
      person: {
        id: 'person-1',
        name: 'Ana Souza',
        email: 'ana.souza@exemplo.com.br',
        isAdmin: true,
      },
      password: MOCK_PASSWORD,
    },
  });

  if (signedIn) {
    document.cookie = 'folioteca_session=mock-session-token; path=/';
  }
};
