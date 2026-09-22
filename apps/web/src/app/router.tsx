import type React from 'react';
import { useState } from 'react';
import { createBrowserRouter, type RouteObject, RouterProvider } from 'react-router';

import { AppGate } from '@/app/routes/app-gate';
import { ErrorBoundary as RootErrorBoundary, Root } from '@/app/routes/app/root';
import { HydrateFallback } from '@/app/routes/app/hydrate-fallback';
import { NotFound } from '@/app/routes/not-found';
import { paths } from '@/config/paths';

export const createRoutes = (): RouteObject[] => [
  {
    // Pathless parent: every address of the app waits for the gate to know
    // whether the instance is installed and who is signed in.
    element: <AppGate />,
    HydrateFallback,
    children: [
      {
        path: paths.install.path,
        lazy: () => import('@/app/routes/install'),
      },
      {
        // Outside the layout route: signing in happens without the sidebar.
        path: paths.login.path,
        lazy: () => import('@/app/routes/login'),
      },
      {
        // Public as well: whoever opens an invitation link has no account yet.
        // Outside the layout route, outside `ProtectedRoute` and outside any
        // installation check — the gate above only waits, it never redirects.
        path: paths.invitationAccept.path,
        lazy: () => import('@/app/routes/invitation-accept'),
      },
      {
        path: paths.home.path,
        element: <Root />,
        ErrorBoundary: RootErrorBoundary,
        HydrateFallback,
        children: [
          { index: true, lazy: () => import('@/app/routes/app/home') },
          {
            path: paths.favorites.path.slice(1),
            lazy: () => import('@/app/routes/app/favorites'),
          },
          {
            path: paths.myDocuments.path.slice(1),
            lazy: () => import('@/app/routes/app/my-documents'),
          },
          {
            path: paths.document.path.slice(1),
            lazy: () => import('@/app/routes/app/document'),
          },
          {
            path: paths.spaces.path.slice(1),
            lazy: () => import('@/app/routes/app/spaces'),
          },
          {
            path: paths.unitSpace.path.slice(1),
            lazy: () => import('@/app/routes/app/unit-space'),
          },
          {
            path: paths.trash.path.slice(1),
            lazy: () => import('@/app/routes/app/trash'),
          },
          {
            path: paths.admin.structure.path.slice(1),
            lazy: () => import('@/app/routes/app/admin/structure'),
          },
          {
            path: paths.admin.orgUnitPeople.path.slice(1),
            lazy: () => import('@/app/routes/app/admin/org-unit-people'),
          },
          {
            path: paths.admin.invitations.path.slice(1),
            lazy: () => import('@/app/routes/app/admin/invitations'),
          },
          {
            path: paths.admin.admins.path.slice(1),
            lazy: () => import('@/app/routes/app/admin/admins'),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
];

export const createAppRouter = (): ReturnType<typeof createBrowserRouter> =>
  createBrowserRouter(createRoutes());

export function AppRouter(): React.JSX.Element {
  const [router] = useState(createAppRouter);
  return <RouterProvider router={router} />;
}
