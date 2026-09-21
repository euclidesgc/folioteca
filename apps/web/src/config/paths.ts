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
  favorites: {
    path: '/favorites',
    getHref: (): string => '/favorites',
  },
  myDocuments: {
    path: '/my-documents',
    getHref: (): string => '/my-documents',
  },
  spaces: {
    path: '/spaces',
    getHref: (): string => '/spaces',
  },
  trash: {
    path: '/trash',
    getHref: (): string => '/trash',
  },
};
