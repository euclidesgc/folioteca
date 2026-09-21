// Fake, hand-written in-memory database: this feature only creates one
// installation (never updates or deletes it), so `@mswjs/data` is overkill.

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
    },
  });

  if (signedIn) {
    document.cookie = 'folioteca_session=mock-session-token; path=/';
  }
};
