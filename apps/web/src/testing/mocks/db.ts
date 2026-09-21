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
  trashedAt: string | null;
  accessLevel: 'owner' | 'edit' | 'view';
};

// A favorite is personal, and the fake database has a single person: the row
// only needs the document it points at and when it was marked.
export type MockFavorite = { documentId: string; createdAt: string };

// An organization unit, in the same flat shape the API answers with:
// `parentId` is null on the root of the organization.
export type MockOrgUnit = { id: string; parentId: string | null; name: string };

type DbState = {
  installation: MockInstallation | null;
  documents: MockDocument[];
  favorites: MockFavorite[];
  orgUnits: MockOrgUnit[];
};

const initialState = (): DbState => ({
  installation: null,
  documents: [],
  favorites: [],
  orgUnits: [],
});

let state: DbState = initialState();

export const getDb = (): DbState => state;

export const seedDb = (overrides: Partial<DbState> = {}): void => {
  state = { ...initialState(), ...overrides };
};

export const resetDb = (): void => {
  state = initialState();
};

// The collaboration server bumps the document `updatedAt` when it stores the
// content; the local provider does the same here. Unknown id does nothing.
//
// The change is written into the document that is already in the database, and
// never into a copy of it: the handlers look their document up before they
// await (the network delay, the request body) and write to it afterwards, so
// replacing the documents mid-await would throw their write away — the title
// someone just typed among two keystrokes would silently go back to "Sem
// título".
export const touchDocumentUpdatedAt = (documentId: string): void => {
  const document = state.documents.find((item) => item.id === documentId);
  if (document) document.updatedAt = new Date().toISOString();
};

// Id of the unit the installation creates, the root of the organization tree.
export const ROOT_ORG_UNIT_ID = 'org-unit-root';

// The real installation creates the root unit named after the organization;
// both `seedInstalled` and the POST /installation handler mirror it.
export const rootOrgUnit = (organizationName: string): MockOrgUnit => ({
  id: ROOT_ORG_UNIT_ID,
  parentId: null,
  name: organizationName,
});

// Example installation, matching the shape a real POST /installation creates.
export const seedInstalled = ({
  signedIn,
  isAdmin = true,
}: {
  signedIn: boolean;
  isAdmin?: boolean;
}): void => {
  const organization = {
    id: 'org-1',
    name: 'Biblioteca Municipal de Exemplo',
  };

  seedDb({
    installation: {
      organization,
      person: {
        id: 'person-1',
        name: 'Ana Souza',
        email: 'ana.souza@exemplo.com.br',
        isAdmin,
      },
      password: MOCK_PASSWORD,
    },
    orgUnits: [rootOrgUnit(organization.name)],
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
    trashedAt: null,
    accessLevel: 'owner',
  }));

  state = { ...state, documents: [...state.documents, ...sample] };
};

// How many documents `seedSampleFavorites` marks: one more than the sidebar
// shows, so the "Ver todos" link appears in development.
const SAMPLE_FAVORITES_COUNT = 9;

// Marks the first documents already in the database as favorites, from the
// most recently marked to the oldest. Kept separate from `seedSampleDocuments`
// because the existing e2e journeys expect no favorite by default.
export const seedSampleFavorites = (): void => {
  const now = Date.now();

  const sample: MockFavorite[] = state.documents
    .slice(0, SAMPLE_FAVORITES_COUNT)
    .map((document, index) => ({
      documentId: document.id,
      createdAt: new Date(now - index * 1000 * 60 * 30).toISOString(),
    }));

  state = { ...state, favorites: [...state.favorites, ...sample] };
};

// A 120-character name, to exercise truncation on a deep level of the tree.
const LONG_ORG_UNIT_NAME =
  'Coordenação de Projetos Especiais de Incentivo à Leitura e Formação de Leitores nas Comunidades do Entorno da Biblioteca';

// Adds three levels of pt_BR units under the root created by the
// installation, on top of whatever is already in the database. Kept separate
// from `seedInstalled` because the existing e2e journeys expect only the root.
export const seedSampleOrgUnits = (): void => {
  if (!state.installation) return;

  const sample: MockOrgUnit[] = [
    {
      id: 'org-unit-acervo',
      parentId: ROOT_ORG_UNIT_ID,
      name: 'Acervo e Processamento Técnico',
    },
    {
      id: 'org-unit-catalogacao',
      parentId: 'org-unit-acervo',
      name: 'Catalogação',
    },
    {
      id: 'org-unit-restauro',
      parentId: 'org-unit-acervo',
      name: 'Restauro e Conservação',
    },
    {
      id: 'org-unit-atendimento',
      parentId: ROOT_ORG_UNIT_ID,
      name: 'Atendimento ao Público',
    },
    {
      id: 'org-unit-emprestimos',
      parentId: 'org-unit-atendimento',
      name: 'Empréstimos e Devoluções',
    },
    {
      id: 'org-unit-sala-infantil',
      parentId: 'org-unit-atendimento',
      name: 'Sala Infantil',
    },
    {
      id: 'org-unit-administrativa',
      parentId: ROOT_ORG_UNIT_ID,
      name: 'Área Administrativa',
    },
    {
      id: 'org-unit-projetos-especiais',
      parentId: 'org-unit-atendimento',
      name: LONG_ORG_UNIT_NAME,
    },
  ];

  state = { ...state, orgUnits: [...state.orgUnits, ...sample] };
};

// How many documents `seedSampleTrash` moves to the trash.
const SAMPLE_TRASH_COUNT = 2;

// Moves the last documents already in the database to the trash, with
// decreasing `trashedAt` dates (the most recently moved first). Kept separate
// from `seedSampleDocuments` because the existing e2e journeys expect an
// empty trash by default. Does nothing without documents.
export const seedSampleTrash = (): void => {
  const now = Date.now();

  state.documents
    .slice(-SAMPLE_TRASH_COUNT)
    .forEach((document, index) => {
      document.trashedAt = new Date(
        now - index * 1000 * 60 * 60,
      ).toISOString();
    });
};
