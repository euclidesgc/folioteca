// Fake, hand-written in-memory database: this feature creates one
// installation and a handful of documents, so `@mswjs/data` is overkill.

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

export type MockDocument = {
  id: string;
  title: string;
  spaceId: string;
  authorId: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  accessLevel: 'owner' | 'edit' | 'view';
};

type DbState = {
  installation: MockInstallation | null;
  documents: MockDocument[];
};

const initialState = (): DbState => ({ installation: null, documents: [] });

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

// Adds a varied batch of pt_BR documents owned by the seeded person, on top
// of whatever is already in the database. Kept separate from `seedInstalled`
// because the existing e2e journey expects the empty state by default.
export const seedSampleDocuments = (): void => {
  const { installation } = state;
  if (!installation) return;

  const { person } = installation;
  const spaceId = `space-${person.id}`;
  const now = Date.now();

  const titles = [
    'Ata da reunião de diretoria',
    'Plano de leitura do trimestre',
    'Catálogo de novas aquisições',
    'Relatório de frequência da sala infantil',
    'Roteiro da oficina de contação de histórias',
    'Lista de espera para empréstimo',
    'Sem título',
    'a'.repeat(200),
    'Proposta de parceria com a escola municipal',
    'Inventário do acervo de referência',
    'Notas da visita técnica',
  ];

  const sample: MockDocument[] = titles.map((title, index) => ({
    id: `document-${index + 1}`,
    title,
    spaceId,
    authorId: person.id,
    ownerId: person.id,
    // The last document keeps an old date, to exercise a date far in the past.
    createdAt: new Date(
      index === titles.length - 1
        ? now - 1000 * 60 * 60 * 24 * 365 * 3
        : now - index * 1000 * 60 * 60,
    ).toISOString(),
    updatedAt: new Date(
      index === titles.length - 1
        ? now - 1000 * 60 * 60 * 24 * 365 * 3
        : now - index * 1000 * 60 * 60,
    ).toISOString(),
    accessLevel: 'owner',
  }));

  state = { ...state, documents: [...state.documents, ...sample] };
};
