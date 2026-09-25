import { env } from '@/config/env';

// Only imports and starts the worker when mocking is on: keeps MSW out of
// the production bundle.
export const enableMocking = async (): Promise<void> => {
  if (!env.ENABLE_API_MOCKING) return;

  const { worker } = await import('./browser');
  const {
    seedFreeSpaceMembership,
    seedFreeSpaceViewer,
    seedInstalled,
    seedOpenFreeSpaceMembership,
    seedRemovedFromFreeSpace,
    seedSampleDocuments,
    seedSampleFavorites,
    seedSampleInvitations,
    seedSampleOrgUnits,
    seedSamplePeople,
    seedSampleTrash,
    seedSharedEditableDocument,
    seedSharedReadOnlyDocument,
    seedSpaceMembers,
    seedUnitSpaceDocuments,
    touchDocumentUpdatedAt,
  } = await import('./db');

  // See the `mock-role` key documented in utils.ts. Read before the seed: the
  // role belongs to the person the installation creates.
  const isAdmin = window.localStorage.getItem('mock-role') !== 'member';

  // Reproduces an installed instance in the browser without touching code.
  // See the `mock-installation` key documented in utils.ts.
  const installationKey = window.localStorage.getItem('mock-installation');
  if (installationKey === 'installed') {
    seedInstalled({ signedIn: false, isAdmin });
  }
  if (installationKey === 'signed-in') {
    seedInstalled({ signedIn: true, isAdmin });
  }

  // See the `mock-org-units` key documented in utils.ts. Read after the
  // installation seed: it hangs the sample units under the root unit.
  const orgUnitsKey = window.localStorage.getItem('mock-org-units');
  if (orgUnitsKey === 'sample') seedSampleOrgUnits();

  // See the `mock-people` key documented in utils.ts. Read after the
  // installation seed: the people belong to the installed organization.
  const peopleKey = window.localStorage.getItem('mock-people');
  if (peopleKey === 'sample') seedSamplePeople();

  // See the `mock-invitations` key documented in utils.ts. Read after the
  // installation seed: the invitation belongs to the installed organization.
  const invitationsKey = window.localStorage.getItem('mock-invitations');
  if (invitationsKey === 'sample') seedSampleInvitations();

  // See the `mock-documents` key documented in utils.ts.
  const documentsKey = window.localStorage.getItem('mock-documents');
  if (documentsKey === 'sample') seedSampleDocuments();
  // `shared-view` adds a document of someone else that the signed-in person
  // only reads (needs an installation already seeded).
  if (documentsKey === 'shared-view') seedSharedReadOnlyDocument();
  // `shared-edit` adds a document of someone else that the signed-in person
  // edits (needs an installation already seeded).
  if (documentsKey === 'shared-edit') seedSharedEditableDocument();
  // `unit-space` assigns the signed-in person to a sample unit and adds a
  // document of a colleague to its space (needs the sample units already
  // seeded, see `mock-org-units` above).
  if (documentsKey === 'unit-space') seedUnitSpaceDocuments();

  // See the `mock-space-members` key documented in utils.ts. Read after the
  // sample units: it assigns people to one of them.
  const spaceMembersKey = window.localStorage.getItem('mock-space-members');
  if (spaceMembersKey === 'sample') seedSpaceMembers();
  // `free-member` adds a free space of someone else with the signed-in person
  // as its member (needs an installation already seeded).
  if (spaceMembersKey === 'free-member') seedFreeSpaceMembership();
  // `free-removed` adds the same free space without the signed-in person, as
  // it is after the owner removes them (needs an installation already seeded).
  if (spaceMembersKey === 'free-removed') seedRemovedFromFreeSpace();
  // `free-open` adds the same free space open to its members, with the
  // signed-in person as a member and someone to add (needs an installation
  // already seeded).
  if (spaceMembersKey === 'free-open') seedOpenFreeSpaceMembership();
  // `free-viewer` adds the same open free space with the signed-in person as
  // a member who only reads, and a document of the owner in it (needs an
  // installation already seeded).
  if (spaceMembersKey === 'free-viewer') seedFreeSpaceViewer();

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
