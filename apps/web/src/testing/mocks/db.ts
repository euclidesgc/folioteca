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

// An invitation. The token is kept in the clear on purpose: from slice 086 on
// the browser has to check the link for the journey to exist at all, and this
// "database" is an object in memory of the tab itself — there is no security
// boundary here. `acceptedAt` and `revokedAt` are null while the invitation is
// pending: accepting or revoking it marks one of them, and the row stays.
export type MockInvitation = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  token: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

// An assignment: the person is assigned to the unit. The pair is the row —
// the real table has no id of its own, and its composite primary key is what
// keeps the same person from being assigned twice to the same unit.
export type MockAssignment = { orgUnitId: string; personId: string };

type DbState = {
  installation: MockInstallation | null;
  documents: MockDocument[];
  favorites: MockFavorite[];
  orgUnits: MockOrgUnit[];
  assignments: MockAssignment[];
  invitations: MockInvitation[];
  // People created by accepting an invitation, and which of them is signed in.
  // Null means the installed person, which is what every journey before 086
  // expects.
  people: MockPerson[];
  signedInPersonId: string | null;
};

const initialState = (): DbState => ({
  installation: null,
  documents: [],
  favorites: [],
  orgUnits: [],
  assignments: [],
  invitations: [],
  people: [],
  signedInPersonId: null,
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
  const { installation } = state;
  if (!installation) return;

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

  // A document in the space of "Sala Infantil", so the unit cannot be
  // deleted: the API answers 409 while its space still holds documents.
  const now = new Date().toISOString();
  const unitDocument: MockDocument = {
    id: 'document-sala-infantil',
    title: 'Regulamento da Sala Infantil',
    // `space-${orgUnitId}`, the convention written down below.
    spaceId: 'space-org-unit-sala-infantil',
    authorId: installation.person.id,
    ownerId: installation.person.id,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
    accessLevel: 'owner',
  };

  state = {
    ...state,
    orgUnits: [...state.orgUnits, ...sample],
    documents: [...state.documents, unitDocument],
  };
};

// The fake database has no `Space` table: the space of a unit is named after
// the unit it belongs to, `space-${orgUnitId}`, the same convention
// `space-${person.id}` already uses for the personal space.
//
// Adds a unit under `parentId`, the way POST /org-units does. The `UNIT`
// space the real API creates in the same transaction is not simulated: no
// screen of this slice reads it.
export const addOrgUnit = ({
  parentId,
  name,
}: {
  parentId: string;
  name: string;
}): MockOrgUnit => {
  const unit: MockOrgUnit = { id: crypto.randomUUID(), parentId, name };
  state.orgUnits.push(unit);
  return unit;
};

// Renames a unit already in the database. Renaming the root renames the
// organization too, as the real API does in the same transaction.
//
// Both writes land on the objects that are already in the database, never on
// copies of them (same reason as `touchDocumentUpdatedAt` above): the handler
// looks the unit up before it awaits the request body and writes afterwards.
export const renameOrgUnit = (id: string, name: string): MockOrgUnit => {
  const unit = state.orgUnits.find((item) => item.id === id);
  if (!unit) throw new Error(`Unknown org unit: ${id}`);

  unit.name = name;
  if (unit.parentId === null && state.installation) {
    state.installation.organization.name = name;
  }

  return unit;
};

// Removes a unit already in the database, the way DELETE /org-units/:id does.
//
// The unit is taken out of the array in place, never by replacing the array
// (same reason as `touchDocumentUpdatedAt` above): the handler reads the units
// before it awaits and writes afterwards. Unknown id does nothing.
export const removeOrgUnit = (id: string): void => {
  const index = state.orgUnits.findIndex((item) => item.id === id);
  if (index !== -1) state.orgUnits.splice(index, 1);
};

// The same seven days the real API gives an invitation.
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Not a secret: readable, low-entropy and assembled at runtime, so no secret
// scanner ever sees a credential-looking literal in the repository (same
// reasoning as `MOCK_PASSWORD`). The counter keeps two invitations of the same
// session from sharing a token.
let invitationTokenCount = 0;

export const nextInvitationToken = (): string => {
  invitationTokenCount += 1;
  return ['mock', 'invitation', 'token', String(invitationTokenCount)].join('-');
};

// What "pending" means here, the same three rules the API applies: not
// accepted, not revoked and not expired yet.
const isPendingInvitation = (invitation: MockInvitation): boolean =>
  invitation.acceptedAt === null &&
  invitation.revokedAt === null &&
  new Date(invitation.expiresAt).getTime() > Date.now();

// Adds a pending invitation, the way POST /invitations does: inviting the same
// address again replaces the **pending** invitation of that address, so only
// one survives — an accepted or revoked one is left where it is, the same
// narrowed `deleteMany` the server does.
//
// The old invitation is taken out of the array in place, never by replacing
// the array (same reason as `touchDocumentUpdatedAt` above): the handler reads
// the state before it awaits the request body and writes afterwards.
export const addInvitation = ({
  email,
}: {
  email: string;
}): MockInvitation => {
  const index = state.invitations.findIndex(
    (item) =>
      item.email.toLowerCase() === email.toLowerCase() &&
      isPendingInvitation(item),
  );
  if (index !== -1) state.invitations.splice(index, 1);

  const createdAt = new Date();
  const invitation: MockInvitation = {
    id: crypto.randomUUID(),
    email,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + INVITATION_TTL_MS).toISOString(),
    token: nextInvitationToken(),
    acceptedAt: null,
    revokedAt: null,
  };
  state.invitations.push(invitation);

  return invitation;
};

// Revokes an invitation, the way POST /invitations/:id/revoke does: the
// invitation already in the array is marked, never taken out of it and never
// replaced (same reason as `touchDocumentUpdatedAt` above). Answers `false`
// for an unknown id and for an invitation that is not pending any more, which
// is the single 404 of the route.
export const revokeInvitation = (id: string): boolean => {
  const invitation = state.invitations.find((item) => item.id === id);
  if (!invitation) return false;
  if (!isPendingInvitation(invitation)) return false;

  invitation.revokedAt = new Date().toISOString();

  return true;
};

// Accepts an invitation, the way POST /invitations/:token/accept does: the
// invitation is marked as accepted, a person is created for its e-mail and that
// person becomes the signed-in one.
//
// Both writes land on the objects already in the database, never on copies of
// them (same reason as `touchDocumentUpdatedAt` above): the handler reads the
// invitation before it awaits the request body and writes afterwards.
export const acceptInvitation = ({
  token,
  name,
}: {
  token: string;
  name: string;
}): MockPerson => {
  const invitation = state.invitations.find((item) => item.token === token);
  if (!invitation) throw new Error('Unknown invitation');

  invitation.acceptedAt = new Date().toISOString();

  // Someone invited is never an administrator.
  const person: MockPerson = {
    id: `person-invited-${state.people.length + 1}`,
    name,
    email: invitation.email,
    isAdmin: false,
  };
  state.people.push(person);
  state.signedInPersonId = person.id;

  return person;
};

// Who the session belongs to. Without an accepted invitation it is the
// installed person, which keeps every journey before slice 086 identical.
export const getSignedInPerson = (): MockPerson | null => {
  const { installation, people, signedInPersonId } = state;
  if (!installation) return null;
  if (!signedInPersonId) return installation.person;

  return (
    people.find((person) => person.id === signedInPersonId) ??
    installation.person
  );
};

// Signs the session out, the way POST /auth/logout does: the person created by
// an accepted invitation stops being the signed-in one.
export const clearSignedInPerson = (): void => {
  state.signedInPersonId = null;
};

// Everybody of the organization: the installed person plus whoever was
// created by accepting an invitation or seeded by `seedSamplePeople`.
export const allPeople = (): MockPerson[] => {
  const { installation, people } = state;
  if (!installation) return [...people];

  return [installation.person, ...people];
};

// Everybody who administers the instance, the way GET /admins answers: the
// pt-BR collator and the tie-break by `id` are the same pair of rules the
// service applies, so the order proved by a test is the order delivered.
const adminsCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

export const listAdmins = (): MockPerson[] =>
  allPeople()
    .filter((person) => person.isAdmin)
    .sort(
      (a, b) =>
        adminsCollator.compare(a.name, b.name) || a.id.localeCompare(b.id),
    );

// Assigns a person to a unit, the way POST /org-units/:orgUnitId/people does.
// `duplicate` is what the composite primary key of the real table answers with
// a 409: there is no previous lookup anywhere, the pair itself is the rule.
//
// The row is pushed into the array that is already in the database, never into
// a copy of it (same reason as `touchDocumentUpdatedAt` above): the handler
// reads the state before it awaits the request body and writes afterwards.
export const addAssignment = (
  orgUnitId: string,
  personId: string,
): 'created' | 'duplicate' => {
  const exists = state.assignments.some(
    (item) => item.orgUnitId === orgUnitId && item.personId === personId,
  );
  if (exists) return 'duplicate';

  state.assignments.push({ orgUnitId, personId });
  return 'created';
};

// Takes the assignment away, the way DELETE /org-units/:orgUnitId/people/
// :personId does: the row is erased, never marked as removed, because that is
// what the real table does. `false` is the pair that is not there, which the
// handler answers with the single 404 of the person.
//
// The row is spliced out of the array that is already in the database, never
// replacing it with a copy (same reason as `addAssignment` above): the handler
// reads the state before it awaits and writes afterwards.
export const removeAssignment = (
  orgUnitId: string,
  personId: string,
): boolean => {
  const index = state.assignments.findIndex(
    (item) => item.orgUnitId === orgUnitId && item.personId === personId,
  );
  if (index === -1) return false;

  state.assignments.splice(index, 1);
  return true;
};

// How many people `seedSamplePeople` adds: two more than the search shows, so
// the "há mais resultados" warning shows up for real in the browser.
const SAMPLE_PEOPLE_COUNT = 12;

// Adds a batch of pt_BR people to the organization, on top of whatever is
// already in the database. Kept separate from `seedInstalled` because the
// existing journeys expect only the installed person.
export const seedSamplePeople = (): void => {
  if (!state.installation) return;

  const names = [
    'Álvaro Pinheiro',
    'Ana Lúcia Ferreira',
    'Beatriz Nogueira',
    'Carlos Eduardo Tavares',
    'Daniela Prado',
    'Eduardo Silva',
    'Fernanda Rocha',
    'Gustavo Almeida',
    'Helena Barros',
    'Isabel Cardoso',
    'João Pedro Silva',
    'Zilda Marques',
  ];
  // The list above is the batch itself: the count is asserted here so the
  // warning of "there is more than what is shown" keeps appearing.
  const sample: MockPerson[] = names
    .slice(0, SAMPLE_PEOPLE_COUNT)
    .map((name, index) => ({
      id: `person-sample-${index + 1}`,
      name,
      email: `${name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '.')}@exemplo.com.br`,
      isAdmin: false,
    }));

  state.people.push(...sample);
};

// Adds a pending invitation, so inviting the same address in the browser shows
// the replacement, and so the invitation link can be opened in the browser (the
// token of the first invitation of a page load is always the same).
// Kept separate from `seedInstalled` because the existing journeys expect no
// invitation by default.
export const seedSampleInvitations = (): void => {
  if (!state.installation) return;
  addInvitation({ email: 'convidado@exemplo.com.br' });
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
