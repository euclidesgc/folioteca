// Fake, hand-written in-memory database: this feature creates one
// installation and a handful of documents, so `@mswjs/data` is overkill.

import type { components } from '@folioteca/api-contract';

import { MOCK_PASSWORD } from './utils';

type Space = components['schemas']['Space'];
type SpaceDetail = components['schemas']['SpaceDetail'];
type SpaceMember = components['schemas']['SpaceMember'];
type PersonSummary = components['schemas']['PersonSummary'];
type DocumentAccessEntry = components['schemas']['DocumentAccessEntry'];
type DocumentPageWidth = components['schemas']['DocumentPageWidth'];
type UpdatePreferencesBody = components['schemas']['UpdatePreferencesBody'];

export type MockOrganization = { id: string; name: string };
export type MockPerson = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  // Absent means the default of the real column, `medium`: the people seeded
  // before slice 170 never chose a page width.
  documentPageWidth?: DocumentPageWidth;
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

// A share: the person reads a document someone else owns. The pair is the
// row, like the composite primary key of the real table, and `view` is the
// only level this slice gives.
export type MockDocumentShare = {
  documentId: string;
  personId: string;
  level: 'view';
};

// An organization unit, in the same flat shape the API answers with:
// `parentId` is null on the root of the organization. `spaceAccess` is the
// access mode of the unit space: only the people assigned to the unit
// (`own`), or also whoever sees the space of the parent unit (`inherit`).
export type MockOrgUnit = {
  id: string;
  parentId: string | null;
  name: string;
  spaceAccess: 'own' | 'inherit';
};

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

// The `UNIT` space of a unit. The real API creates it in the same transaction
// as the unit, and the fake database mirrors that: every place a unit is born
// also creates its space, and removing the unit removes the space. Its id is
// named after the unit, `space-${orgUnitId}`, the same convention
// `space-${person.id}` already uses for the personal space.
//
// The `FREE` space is created by a person, who becomes its owner, and carries
// its own name. `membersCanInvite` is whether its members add people too
// (closed, `false`, when it is born).
export type MockSpace =
  | { id: string; type: 'unit'; orgUnitId: string }
  | {
      id: string;
      type: 'free';
      name: string;
      ownerId: string;
      membersCanInvite: boolean;
    };

// A person added to a free space by its owner. Like `MockAssignment`, the pair
// is the whole row: the real table's composite primary key keeps the same
// person from being added twice to the same space. `level` is what the member
// does there: `edit` creates and edits, `view` only reads. A row without it is
// `edit`, the default of the real column.
export type MockSpaceMember = {
  spaceId: string;
  personId: string;
  level?: 'view' | 'edit';
};

type DbState = {
  installation: MockInstallation | null;
  documents: MockDocument[];
  favorites: MockFavorite[];
  shares: MockDocumentShare[];
  orgUnits: MockOrgUnit[];
  assignments: MockAssignment[];
  spaces: MockSpace[];
  spaceMembers: MockSpaceMember[];
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
  shares: [],
  orgUnits: [],
  assignments: [],
  spaces: [],
  spaceMembers: [],
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
  spaceAccess: 'own',
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
        documentPageWidth: 'medium',
      },
      password: MOCK_PASSWORD,
    },
    orgUnits: [rootOrgUnit(organization.name)],
  });
  addUnitSpace(ROOT_ORG_UNIT_ID);

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
      spaceAccess: 'own',
    },
    {
      id: 'org-unit-catalogacao',
      parentId: 'org-unit-acervo',
      name: 'Catalogação',
      spaceAccess: 'own',
    },
    {
      id: 'org-unit-restauro',
      parentId: 'org-unit-acervo',
      name: 'Restauro e Conservação',
      spaceAccess: 'own',
    },
    {
      id: 'org-unit-atendimento',
      parentId: ROOT_ORG_UNIT_ID,
      name: 'Atendimento ao Público',
      spaceAccess: 'own',
    },
    {
      id: 'org-unit-emprestimos',
      parentId: 'org-unit-atendimento',
      name: 'Empréstimos e Devoluções',
      spaceAccess: 'own',
    },
    {
      id: 'org-unit-sala-infantil',
      parentId: 'org-unit-atendimento',
      name: 'Sala Infantil',
      spaceAccess: 'own',
    },
    {
      id: 'org-unit-administrativa',
      parentId: ROOT_ORG_UNIT_ID,
      name: 'Área Administrativa',
      spaceAccess: 'own',
    },
    {
      id: 'org-unit-projetos-especiais',
      parentId: 'org-unit-atendimento',
      name: LONG_ORG_UNIT_NAME,
      spaceAccess: 'own',
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
  sample.forEach((unit) => addUnitSpace(unit.id));
};

// Adds a unit under `parentId`, the way POST /org-units does, together with
// the `UNIT` space the real API creates in the same transaction.
export const addOrgUnit = ({
  parentId,
  name,
}: {
  parentId: string;
  name: string;
}): MockOrgUnit => {
  const unit: MockOrgUnit = {
    id: crypto.randomUUID(),
    parentId,
    name,
    spaceAccess: 'own',
  };
  state.orgUnits.push(unit);
  addUnitSpace(unit.id);
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

// Removes a unit already in the database, the way DELETE /org-units/:id does,
// and its space with it.
//
// Both are taken out of their arrays in place, never by replacing the arrays
// (same reason as `touchDocumentUpdatedAt` above): the handler reads the units
// before it awaits and writes afterwards. Unknown id does nothing.
export const removeOrgUnit = (id: string): void => {
  const index = state.orgUnits.findIndex((item) => item.id === id);
  if (index !== -1) state.orgUnits.splice(index, 1);

  const spaceIndex = state.spaces.findIndex(
    (item) => item.type === 'unit' && item.orgUnitId === id,
  );
  if (spaceIndex !== -1) state.spaces.splice(spaceIndex, 1);
};

// Sets the access mode of a unit space, the way PATCH
// /org-units/:orgUnitId/space does. Written on the unit already in the
// database, never on a copy of it (same reason as `touchDocumentUpdatedAt`
// above).
export const setOrgUnitSpaceAccess = (
  id: string,
  access: 'own' | 'inherit',
): MockOrgUnit => {
  const unit = state.orgUnits.find((item) => item.id === id);
  if (!unit) throw new Error(`Unknown org unit: ${id}`);

  unit.spaceAccess = access;
  return unit;
};

// Creates the `UNIT` space of a unit (see `MockSpace` above). Called wherever
// a unit is born: `seedInstalled`, `seedSampleOrgUnits`, `addOrgUnit` and the
// POST /installation handler. Pushed into the array already in the database,
// never into a copy of it (same reason as `touchDocumentUpdatedAt` above).
export const addUnitSpace = (orgUnitId: string): MockSpace => {
  const space: MockSpace = {
    id: `space-${orgUnitId}`,
    type: 'unit',
    orgUnitId,
  };
  state.spaces.push(space);
  return space;
};

// Creates a `FREE` space owned by `ownerId` (see `MockSpace` above). The only
// place a free space is born, used by the POST /spaces handler and by the
// tests. Pushed into the array already in the database, never into a copy of
// it (same reason as `touchDocumentUpdatedAt` above). It does not check the
// name: the POST /spaces handler refuses a repeated name of the same owner,
// and the tests seed whatever they need. The counter keeps every id unique.
let freeSpaceCounter = 0;

export const addFreeSpace = (ownerId: string, name: string): MockSpace => {
  freeSpaceCounter += 1;
  const space: MockSpace = {
    id: `space-free-${freeSpaceCounter}`,
    type: 'free',
    name,
    ownerId,
    membersCanInvite: false,
  };
  state.spaces.push(space);
  return space;
};

// Sets who adds people to a free space, the way PATCH /spaces/:spaceId does.
// Written on the space already in the database (same reason as
// `touchDocumentUpdatedAt` above). An unknown id or a unit space does
// nothing: a unit space is always closed.
export const setSpaceMembersCanInvite = (
  spaceId: string,
  value: boolean,
): void => {
  const space = state.spaces.find((item) => item.id === spaceId);
  if (space?.type === 'free') space.membersCanInvite = value;
};

// Whether a person was added to a free space by its owner.
const isSpaceMember = (personId: string, spaceId: string): boolean =>
  state.spaceMembers.some(
    (item) => item.spaceId === spaceId && item.personId === personId,
  );

// The level of a member of a free space, `edit` when the row has none (the
// default of the real column). `null` for whoever is not a member, the owner
// included: the owner has no row and no level.
export const spaceMemberLevelOf = (
  personId: string,
  spaceId: string,
): 'view' | 'edit' | null => {
  const row = state.spaceMembers.find(
    (item) => item.spaceId === spaceId && item.personId === personId,
  );
  return row ? (row.level ?? 'edit') : null;
};

// Sets the level of a member of a free space, the way PATCH
// /spaces/:spaceId/members/:personId does. Written on the row already in the
// database (same reason as `touchDocumentUpdatedAt` above). A person who is
// not a member does nothing.
export const setSpaceMemberLevel = (
  spaceId: string,
  personId: string,
  level: 'view' | 'edit',
): void => {
  const row = state.spaceMembers.find(
    (item) => item.spaceId === spaceId && item.personId === personId,
  );
  if (row) row.level = level;
};

// The spaces of a person, the way GET /spaces answers: the unit spaces the
// person reaches and the free spaces the person owns or is a member of, mixed and sorted by the
// pt-BR collator with the tie broken by `id`, the same pair of rules the
// service applies.
//
// A unit is reached when the person is assigned to it, or when its space
// inherits and its parent is reached — the chain climbs while the spaces
// inherit and stops at the first one with its own access. The root never
// inherits, and a cycle (which must not exist) counts as not reached.
const spacesCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

const reachesUnit = (
  personId: string,
  orgUnitId: string,
  visited: Set<string> = new Set(),
): boolean => {
  if (visited.has(orgUnitId)) return false;
  visited.add(orgUnitId);

  const unit = state.orgUnits.find((item) => item.id === orgUnitId);
  if (!unit) return false;

  const assigned = state.assignments.some(
    (item) => item.orgUnitId === unit.id && item.personId === personId,
  );
  if (assigned) return true;

  return (
    unit.spaceAccess === 'inherit' &&
    unit.parentId !== null &&
    reachesUnit(personId, unit.parentId, visited)
  );
};

export const listSpacesOf = (personId: string): Space[] =>
  state.spaces
    .flatMap((space): Space[] => {
      if (space.type === 'free') {
        return space.ownerId === personId || isSpaceMember(personId, space.id)
          ? [{ id: space.id, type: 'free', name: space.name }]
          : [];
      }

      const unit = state.orgUnits.find((item) => item.id === space.orgUnitId);
      return unit && reachesUnit(personId, unit.id)
        ? [{ id: space.id, type: 'unit', name: unit.name }]
        : [];
    })
    .sort(
      (a, b) =>
        spacesCollator.compare(a.name, b.name) || a.id.localeCompare(b.id),
    );

// How a person reaches a space, the way `SpacesService.reachOf` answers: the
// same rule as `listSpacesOf` above, split in two. The owner or a member of a
// free space and whoever is assigned to the unit are `direct`; reached only
// through the chain of inheriting spaces is `inherited`. A free space of
// someone else, an unknown id and an unreached unit are `none`.
export const spaceReachOf = (
  personId: string,
  spaceId: string,
): 'direct' | 'inherited' | 'none' => {
  const space = state.spaces.find((item) => item.id === spaceId);
  if (!space) return 'none';

  if (space.type === 'free') {
    return space.ownerId === personId || isSpaceMember(personId, space.id)
      ? 'direct'
      : 'none';
  }

  const assigned = state.assignments.some(
    (item) => item.orgUnitId === space.orgUnitId && item.personId === personId,
  );
  if (assigned) return 'direct';

  return reachesUnit(personId, space.orgUnitId) ? 'inherited' : 'none';
};

// One space of a person, the way GET /spaces/:spaceId answers: a free space
// only for its owner (`owner`) and its members (`member`), a unit space for whoever reaches the unit, directly or
// by inheritance. Anything else (unknown id, free space of someone else,
// unreached unit) is `null`, the 404 of the handler.
export const spaceDetailOf = (
  personId: string,
  spaceId: string,
): SpaceDetail | null => {
  const space = state.spaces.find((item) => item.id === spaceId);
  if (!space) return null;

  if (space.type === 'free') {
    if (space.ownerId === personId) {
      return {
        id: space.id,
        type: 'free',
        name: space.name,
        reach: 'owner',
        membersCanInvite: space.membersCanInvite,
        canCreateDocuments: true,
        canAddPeople: true,
      };
    }

    // An editor creates, and adds people when the space is open; a viewer
    // does neither.
    const level = spaceMemberLevelOf(personId, space.id);
    return level
      ? {
          id: space.id,
          type: 'free',
          name: space.name,
          reach: 'member',
          membersCanInvite: space.membersCanInvite,
          canCreateDocuments: level === 'edit',
          canAddPeople: level === 'edit' && space.membersCanInvite,
        }
      : null;
  }

  const reach = spaceReachOf(personId, spaceId);
  const unit = state.orgUnits.find((item) => item.id === space.orgUnitId);
  if (reach === 'none' || !unit) return null;

  return {
    id: space.id,
    type: 'unit',
    name: unit.name,
    reach,
    membersCanInvite: false,
    canCreateDocuments: reach === 'direct',
    canAddPeople: false,
  };
};

// What adding a member answers: the refusal with its status and message, or
// the person added.
export type AddSpaceMemberResult =
  | { ok: false; status: 400 | 403 | 404; message: string }
  | { ok: true; person: PersonSummary };

// Adds a person to a free space, the way PUT /spaces/:spaceId/members/
// :personId does, in the same order as `SpacesService.addMember`: a space the
// requester does not reach (unknown, a unit, a free space of someone else) is
// 404, a member of a closed space is 403, a viewer of an open space is 403,
// then the owner and an unknown
// person are 400 (a member of an open space adding the owner or themselves is
// refused by the PUT handler first). Adding the same pair again keeps a single
// row, the upsert of the real service.
export const addSpaceMember = (
  requesterId: string,
  spaceId: string,
  personId: string,
): AddSpaceMemberResult => {
  const space = state.spaces.find((item) => item.id === spaceId);
  if (
    space?.type !== 'free' ||
    (space.ownerId !== requesterId && !isSpaceMember(requesterId, spaceId))
  ) {
    return { ok: false, status: 404, message: 'Espaço não encontrado.' };
  }

  const isOwner = space.ownerId === requesterId;

  if (!isOwner && !space.membersCanInvite) {
    return {
      ok: false,
      status: 403,
      message: 'Só o dono do espaço pode adicionar pessoas.',
    };
  }

  if (!isOwner && spaceMemberLevelOf(requesterId, spaceId) === 'view') {
    return {
      ok: false,
      status: 403,
      message: 'Só quem pode editar adiciona pessoas a este espaço.',
    };
  }

  if (personId === space.ownerId) {
    return {
      ok: false,
      status: 400,
      message: 'Você já é o dono deste espaço.',
    };
  }

  const person = allPeople().find((item) => item.id === personId);
  if (!person) {
    return {
      ok: false,
      status: 400,
      message: 'Pessoa não encontrada nesta instância.',
    };
  }

  if (!isSpaceMember(person.id, spaceId)) {
    state.spaceMembers.push({ spaceId, personId: person.id });
  }

  return {
    ok: true,
    person: { id: person.id, name: person.name, email: person.email },
  };
};

// The order of GET /spaces/:spaceId/members, the one of
// `compareMembers`: the owner first, then whoever asks, then by name and
// e-mail with the pt-BR collator, the tie broken by `id`.
const compareSpaceMembers = (a: SpaceMember, b: SpaceMember): number =>
  Number(b.role === 'owner') - Number(a.role === 'owner') ||
  Number(b.isCurrentPerson) - Number(a.isCurrentPerson) ||
  spacesCollator.compare(a.name, b.name) ||
  spacesCollator.compare(a.email, b.email) ||
  a.id.localeCompare(b.id);

// The people of a space, the way GET /spaces/:spaceId/members answers. A free
// space: its owner (`owner`) and its members (`member`), only to the owner
// and the members. A unit space: the people assigned directly to the unit
// (`assigned`), to whoever reaches it. `null` otherwise, the 404 of the
// handler.
export const listSpaceMembers = (
  personId: string,
  spaceId: string,
): SpaceMember[] | null => {
  const space = state.spaces.find((item) => item.id === spaceId);
  if (!space) return null;

  const people = allPeople();
  const toMember = (
    id: string,
    role: SpaceMember['role'],
  ): SpaceMember[] => {
    const person = people.find((candidate) => candidate.id === id);
    return person
      ? [
          {
            id: person.id,
            name: person.name,
            email: person.email,
            isCurrentPerson: person.id === personId,
            role,
            level:
              role === 'member' ? (spaceMemberLevelOf(id, spaceId) ?? 'edit') : null,
          },
        ]
      : [];
  };

  if (space.type === 'free') {
    if (space.ownerId !== personId && !isSpaceMember(personId, space.id)) {
      return null;
    }

    return [
      ...toMember(space.ownerId, 'owner'),
      ...state.spaceMembers
        .filter((item) => item.spaceId === space.id)
        .flatMap((item) => toMember(item.personId, 'member')),
    ].sort(compareSpaceMembers);
  }

  if (spaceReachOf(personId, spaceId) === 'none') return null;

  return state.assignments
    .filter((item) => item.orgUnitId === space.orgUnitId)
    .flatMap((item) => toMember(item.personId, 'assigned'))
    .sort(compareSpaceMembers);
};

// What removing a member answers: the refusal with its status and message,
// or done.
export type RemoveSpaceMemberResult =
  | { ok: false; status: 400 | 403 | 404; message: string }
  | { ok: true };

// Removes a person from a free space, the way DELETE /spaces/:spaceId/
// members/:personId does, in the same order as `SpacesService.removeMember`:
// a space the requester does not reach (unknown, a unit, a free space of
// someone else) is 404, a member is 403, the owner is 400. Removing someone
// who is not a member is done all the same.
export const removeSpaceMember = (
  requesterId: string,
  spaceId: string,
  personId: string,
): RemoveSpaceMemberResult => {
  const space = state.spaces.find((item) => item.id === spaceId);
  if (
    space?.type !== 'free' ||
    (space.ownerId !== requesterId && !isSpaceMember(requesterId, spaceId))
  ) {
    return { ok: false, status: 404, message: 'Espaço não encontrado.' };
  }

  if (space.ownerId !== requesterId) {
    return {
      ok: false,
      status: 403,
      message: 'Só o dono do espaço pode remover pessoas.',
    };
  }

  if (personId === space.ownerId) {
    return {
      ok: false,
      status: 400,
      message: 'O dono não pode ser removido.',
    };
  }

  state.spaceMembers = state.spaceMembers.filter(
    (item) => !(item.spaceId === spaceId && item.personId === personId),
  );

  return { ok: true };
};

// The same hard limit the real list of a space has.
const SPACE_DOCUMENTS_LIMIT = 100;

// The documents of a space, the way GET /spaces/:spaceId/documents answers:
// outside the trash, the most recently updated first, the tie broken by `id`.
export const listSpaceDocuments = (spaceId: string): MockDocument[] =>
  state.documents
    .filter((item) => item.spaceId === spaceId && item.trashedAt === null)
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
    )
    .slice(0, SPACE_DOCUMENTS_LIMIT);

// The name a new document gets, the same rule as the API: the smallest
// integer from 1 not taken among the documents of the owner, trash included.
// Only a title that matches exactly takes a number ("documento-sem-titulo-01"
// and "Sem título" do not).
const DEFAULT_TITLE_PREFIX = 'documento-sem-titulo-';
const DEFAULT_TITLE_PATTERN = /^documento-sem-titulo-([1-9]\d*)$/;

export const nextDefaultTitleOf = (ownerId: string): string => {
  const taken = new Set<number>();
  for (const item of state.documents) {
    if (item.ownerId !== ownerId) continue;
    const match = DEFAULT_TITLE_PATTERN.exec(item.title);
    if (match?.[1]) taken.add(Number(match[1]));
  }
  let number = 1;
  while (taken.has(number)) number += 1;
  return `${DEFAULT_TITLE_PREFIX}${number}`;
};

// Creates a document owned by `personId` in `spaceId`, the way POST
// /documents does, named by `nextDefaultTitleOf`. Pushed into the array already in the database, never into
// a copy of it (same reason as `touchDocumentUpdatedAt` above).
export const createDocumentIn = (
  personId: string,
  spaceId: string,
): MockDocument => {
  const now = new Date().toISOString();
  const document: MockDocument = {
    id: crypto.randomUUID(),
    title: nextDefaultTitleOf(personId),
    spaceId,
    authorId: personId,
    ownerId: personId,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
    accessLevel: 'owner',
  };
  state.documents.push(document);
  return document;
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

// The page width a person reads the documents in, the way GET /auth/me
// answers: the default of the real column when the person never chose one.
export const pageWidthOf = (person: MockPerson): DocumentPageWidth =>
  person.documentPageWidth ?? 'medium';

// Stores the preferences of a person, the way PATCH /auth/me/preferences
// does. Written into the person that is already in the database (same reason
// as `touchDocumentUpdatedAt` above). Unknown id answers null.
export const updatePersonPreferences = (
  personId: string,
  body: UpdatePreferencesBody,
): MockPerson | null => {
  const person = allPeople().find((item) => item.id === personId);
  if (!person) return null;

  person.documentPageWidth = body.documentPageWidth;
  return person;
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

// Promotes a person to administration, the way PUT /admins/:personId does.
// Promoting whoever already administers answers the person, with no error:
// the fake repeats the idempotence of the real one. Unknown id answers null.
//
// The flag is written into the person that is already in the database, and
// never into a copy of it (same reason as `touchDocumentUpdatedAt` above): the
// handler looks the person up before it awaits the network delay and answers
// afterwards.
export const promotePerson = (personId: string): MockPerson | null => {
  const person = allPeople().find((item) => item.id === personId);
  if (!person) return null;

  person.isAdmin = true;
  return person;
};

// Takes the administration role away, the way DELETE /admins/:personId does.
// Unknown id answers null; `'last-admin'` is the refusal of the real server,
// which never leaves the instance without any administration. Demoting whoever
// already is a member answers the person, with no error: the fake repeats the
// idempotence of the real one.
//
// The flag is written into the person that is already in the database, and
// never into a copy of it (same reason as `touchDocumentUpdatedAt` above): it
// is what makes demoting yourself work in the browser and in the e2e, since
// `installation.person` is the very object GET /auth/me answers with and the
// one the handlers read to decide the 403.
export const demotePerson = (
  personId: string,
): MockPerson | 'last-admin' | null => {
  const person = allPeople().find((item) => item.id === personId);
  if (!person) return null;

  if (person.isAdmin) {
    const others = allPeople().filter(
      (item) => item.isAdmin && item.id !== personId,
    );
    if (others.length === 0) return 'last-admin';

    person.isAdmin = false;
  }

  return person;
};

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

// Shares a document with a person, the way PUT /documents/:documentId/shares/
// :personId does: sharing the same pair again keeps a single row, the upsert
// of the real service. Pushed into the array already in the database, never
// into a copy of it (same reason as `touchDocumentUpdatedAt` above).
export const shareDocument = (
  documentId: string,
  personId: string,
): MockDocumentShare => {
  const existing = state.shares.find(
    (item) => item.documentId === documentId && item.personId === personId,
  );
  if (existing) {
    existing.level = 'view';
    return existing;
  }

  const share: MockDocumentShare = { documentId, personId, level: 'view' };
  state.shares.push(share);
  return share;
};

// The same hard limit the real search has, with no parameter to raise it.
const SHARE_SEARCH_LIMIT = 10;

const shareSearchCollator = new Intl.Collator('pt-BR', {
  sensitivity: 'base',
});

// Case and accents ignored, name or e-mail, like the real search.
const normalizeSearchText = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// The people a document can be shared with, the way GET /people/search
// answers: at least 2 letters, whoever asks is left out, sorted by the pt-BR
// collator with the tie broken by `id`, and at most ten with `hasMore`.
export const searchPeopleToShare = (
  term: string,
  requesterId: string,
): { data: MockPerson[]; hasMore: boolean } => {
  const trimmed = term.trim();
  if (trimmed.length < 2) return { data: [], hasMore: false };

  const needle = normalizeSearchText(trimmed);
  const matches = allPeople()
    .filter(
      (person) =>
        person.id !== requesterId &&
        (normalizeSearchText(person.name).includes(needle) ||
          normalizeSearchText(person.email).includes(needle)),
    )
    .sort(
      (a, b) =>
        shareSearchCollator.compare(a.name, b.name) ||
        a.id.localeCompare(b.id),
    );

  return {
    data: matches.slice(0, SHARE_SEARCH_LIMIT),
    hasMore: matches.length > SHARE_SEARCH_LIMIT,
  };
};

// Who has access to a document, the way GET /documents/:documentId/shares
// answers its owner: the owner first (the handler only answers the owner, so
// it is the signed-in person), then the shares sorted by name, e-mail and id
// with the pt-BR order of the real service.
export const listDocumentShares = (
  documentId: string,
): DocumentAccessEntry[] => {
  const document = state.documents.find((item) => item.id === documentId);
  const people = allPeople();
  const owner =
    people.find((person) => person.id === document?.ownerId) ??
    getSignedInPerson();

  const shared = state.shares
    .filter((share) => share.documentId === documentId)
    .flatMap((share) => {
      const person = people.find((item) => item.id === share.personId);
      if (!person) return [];
      return [
        {
          personId: person.id,
          name: person.name,
          email: person.email,
          level: share.level,
          isCurrentPerson: false,
        },
      ];
    })
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'pt-BR') ||
        a.email.localeCompare(b.email, 'pt-BR') ||
        a.personId.localeCompare(b.personId, 'pt-BR'),
    );

  if (!owner) return shared;

  return [
    {
      personId: owner.id,
      name: owner.name,
      email: owner.email,
      level: 'owner',
      isCurrentPerson: true,
    },
    ...shared,
  ];
};

// Id of the document `seedSharedReadOnlyDocument` creates.
const SHARED_READ_ONLY_DOCUMENT_ID = 'document-shared-view';

// Adds a document owned by someone else and shared with the signed-in person
// in `view`, so the read-only page can be opened in the browser. Kept separate
// from the other seeds because the existing journeys expect only documents of
// their own. Answers the id of the document, or null without an installation.
export const seedSharedReadOnlyDocument = (): string | null => {
  const reader = getSignedInPerson();
  if (!reader) return null;

  const owner: MockPerson = {
    id: 'person-shared-owner',
    name: 'Roberto Lima',
    email: 'roberto.lima@exemplo.com.br',
    isAdmin: false,
  };
  if (!state.people.some((person) => person.id === owner.id)) {
    state.people.push(owner);
  }

  const now = new Date().toISOString();
  state.documents.push({
    id: SHARED_READ_ONLY_DOCUMENT_ID,
    title: 'Normas de uso do acervo de obras raras',
    spaceId: `space-${owner.id}`,
    authorId: owner.id,
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
    accessLevel: 'view',
  });
  shareDocument(SHARED_READ_ONLY_DOCUMENT_ID, reader.id);

  return SHARED_READ_ONLY_DOCUMENT_ID;
};

// The unit the signed-in person is directly assigned to by
// `seedUnitSpaceDocuments`, one of the units of `seedSampleOrgUnits`.
const UNIT_SPACE_SAMPLE_ORG_UNIT_ID = 'org-unit-catalogacao';

// The colleague of the unit space samples, added once to the organization.
const addUnitColleague = (): MockPerson => {
  const colleague: MockPerson = {
    id: 'person-unit-colleague',
    name: 'Marta Ribeiro',
    email: 'marta.ribeiro@exemplo.com.br',
    isAdmin: false,
  };
  if (!state.people.some((item) => item.id === colleague.id)) {
    state.people.push(colleague);
  }
  return colleague;
};

// Assigns the signed-in person and the colleague directly to "Catalogação",
// so "Pessoas nesta unidade" shows two rows. Needs the sample units already
// seeded; does nothing without them.
export const seedSpaceMembers = (): void => {
  const person = getSignedInPerson();
  const unit = state.orgUnits.find(
    (item) => item.id === UNIT_SPACE_SAMPLE_ORG_UNIT_ID,
  );
  if (!person || !unit) return;

  addAssignment(unit.id, person.id);
  addAssignment(unit.id, addUnitColleague().id);
};

// Assigns the signed-in person directly to "Catalogação" and adds a document
// of a colleague to the space of that unit, so the list of a unit space can be
// opened in the browser with something in it. Needs the sample units already
// seeded; does nothing without them.
export const seedUnitSpaceDocuments = (): void => {
  const person = getSignedInPerson();
  const unit = state.orgUnits.find(
    (item) => item.id === UNIT_SPACE_SAMPLE_ORG_UNIT_ID,
  );
  if (!person || !unit) return;

  addAssignment(unit.id, person.id);

  const colleague = addUnitColleague();

  const now = new Date().toISOString();
  state.documents.push({
    id: 'document-unit-space-colleague',
    title: 'Manual de catalogação de periódicos',
    spaceId: `space-${unit.id}`,
    authorId: colleague.id,
    ownerId: colleague.id,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
    accessLevel: 'edit',
  });
};

// Name of the free space `seedFreeSpaceMembership` creates.
const MEMBER_FREE_SPACE_NAME = 'Clube de leitura';

// Adds a free space owned by someone else with the signed-in person as its
// member, and a document of the owner in it, so the sidebar and the page of a
// space the person only reads, with a document to edit, can be opened in the
// browser. Kept separate from `seedSpaceMembers`, which assigns
// people to a unit. Needs an installation already seeded; does nothing
// without it.
export const seedFreeSpaceMembership = (): void => {
  const member = getSignedInPerson();
  if (!member) return;

  const owner: MockPerson = {
    id: 'person-free-space-owner',
    name: 'Otávio Mendes',
    email: 'otavio.mendes@exemplo.com.br',
    isAdmin: false,
  };
  if (!state.people.some((person) => person.id === owner.id)) {
    state.people.push(owner);
  }

  const space = addFreeSpace(owner.id, MEMBER_FREE_SPACE_NAME);
  state.spaceMembers.push({ spaceId: space.id, personId: member.id });

  // A member edits every document of the space, the owner's included.
  const now = new Date().toISOString();
  state.documents.push({
    id: 'document-free-space-owner',
    title: 'Ata da primeira reunião',
    spaceId: space.id,
    authorId: owner.id,
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
    accessLevel: 'edit',
  });
};

// Id of the free space `seedRemovedFromFreeSpace` creates, fixed so its page
// can be opened by URL.
export const REMOVED_FREE_SPACE_ID = 'space-free-removed';

// Adds "Clube de leitura", the free space of Otávio Mendes, without the
// signed-in person among its members: the state the person is left in after
// the owner removes them. The fake database lives in each tab, so a removal
// made in one browser never reaches another; this seed reproduces the result.
// Needs an installation already seeded; does nothing without it.
export const seedRemovedFromFreeSpace = (): void => {
  if (!getSignedInPerson()) return;

  const owner: MockPerson = {
    id: 'person-free-space-owner',
    name: 'Otávio Mendes',
    email: 'otavio.mendes@exemplo.com.br',
    isAdmin: false,
  };
  if (!state.people.some((person) => person.id === owner.id)) {
    state.people.push(owner);
  }

  state.spaces.push({
    id: REMOVED_FREE_SPACE_ID,
    type: 'free',
    name: MEMBER_FREE_SPACE_NAME,
    ownerId: owner.id,
    membersCanInvite: false,
  });
};

// A person who is in the organization but not in the free space
// `seedOpenFreeSpaceMembership` creates, for its member to find and add.
const OPEN_FREE_SPACE_NON_MEMBER: MockPerson = {
  id: 'person-free-space-non-member',
  name: 'Lívia Castro',
  email: 'livia.castro@exemplo.com.br',
  isAdmin: false,
};

// Adds "Clube de leitura", the free space of Otávio Mendes, open to its
// members (`membersCanInvite: true`) with the signed-in person as a member,
// and Lívia Castro, who is not a member, so the member can open the space,
// see "Adicionar pessoa" and add someone in the browser. The fake database
// lives in each tab, so an opening made by the owner in one browser never
// reaches another; this seed reproduces the result. Needs an installation
// already seeded; does nothing without it.
export const seedOpenFreeSpaceMembership = (): void => {
  const member = getSignedInPerson();
  if (!member) return;

  const owner: MockPerson = {
    id: 'person-free-space-owner',
    name: 'Otávio Mendes',
    email: 'otavio.mendes@exemplo.com.br',
    isAdmin: false,
  };
  [owner, OPEN_FREE_SPACE_NON_MEMBER].forEach((person) => {
    if (!state.people.some((item) => item.id === person.id)) {
      state.people.push(person);
    }
  });

  const space = addFreeSpace(owner.id, MEMBER_FREE_SPACE_NAME);
  setSpaceMembersCanInvite(space.id, true);
  state.spaceMembers.push({ spaceId: space.id, personId: member.id });
};

// Adds "Clube de leitura", the free space of Otávio Mendes, open to its
// members (`membersCanInvite: true`) with the signed-in person as a member
// who only reads (`level: 'view'`), and "Ata da primeira reunião", a document
// of Otávio in it, so the viewer can open the space without "Novo documento"
// nor "Adicionar pessoa" and open the document read only. The fake database
// lives in each tab, so a level changed by the owner in one browser never
// reaches another; this seed reproduces the result. Needs an installation
// already seeded; does nothing without it.
export const seedFreeSpaceViewer = (): void => {
  const viewer = getSignedInPerson();
  if (!viewer) return;

  const owner: MockPerson = {
    id: 'person-free-space-owner',
    name: 'Otávio Mendes',
    email: 'otavio.mendes@exemplo.com.br',
    isAdmin: false,
  };
  if (!state.people.some((person) => person.id === owner.id)) {
    state.people.push(owner);
  }

  const space = addFreeSpace(owner.id, MEMBER_FREE_SPACE_NAME);
  setSpaceMembersCanInvite(space.id, true);
  state.spaceMembers.push({
    spaceId: space.id,
    personId: viewer.id,
    level: 'view',
  });

  // GET /documents/:documentId answers `view` to the viewer, whatever the
  // level kept here (see the documents handler).
  const now = new Date().toISOString();
  state.documents.push({
    id: 'document-free-space-viewer',
    title: 'Ata da primeira reunião',
    spaceId: space.id,
    authorId: owner.id,
    ownerId: owner.id,
    createdAt: now,
    updatedAt: now,
    trashedAt: null,
    accessLevel: 'edit',
  });
};
