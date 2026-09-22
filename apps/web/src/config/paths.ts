export const paths = {
  home: {
    path: '/',
    getHref: (): string => '/',
  },
  install: {
    path: '/install',
    getHref: (): string => '/install',
  },
  login: {
    path: '/login',
    getHref: (redirectTo?: string): string =>
      redirectTo
        ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
        : '/login',
  },
  invitationAccept: {
    path: '/invitations/:token',
    getHref: (token: string): string =>
      `/invitations/${encodeURIComponent(token)}`,
  },
  favorites: {
    path: '/favorites',
    getHref: (): string => '/favorites',
  },
  myDocuments: {
    path: '/my-documents',
    getHref: (): string => '/my-documents',
  },
  document: {
    path: '/documents/:documentId',
    getHref: (documentId: string): string => `/documents/${documentId}`,
  },
  spaces: {
    path: '/spaces',
    getHref: (): string => '/spaces',
  },
  unitSpace: {
    path: '/spaces/:spaceId',
    getHref: (spaceId: string): string =>
      `/spaces/${encodeURIComponent(spaceId)}`,
  },
  trash: {
    path: '/trash',
    getHref: (): string => '/trash',
  },
  admin: {
    structure: {
      path: '/admin/structure',
      getHref: (): string => '/admin/structure',
    },
    // Under `/admin/structure` because that is where one comes from and where
    // one goes back to: a sibling route would hide that relation in the URL.
    orgUnitPeople: {
      path: '/admin/structure/:orgUnitId/people',
      getHref: (orgUnitId: string): string =>
        `/admin/structure/${orgUnitId}/people`,
    },
    invitations: {
      path: '/admin/invitations',
      getHref: (): string => '/admin/invitations',
    },
    admins: {
      path: '/admin/admins',
      getHref: (): string => '/admin/admins',
    },
  },
};
