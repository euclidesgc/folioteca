import type React from 'react';
import { useState } from 'react';
import { createBrowserRouter, type RouteObject, RouterProvider } from 'react-router';

import { ErrorBoundary as RootErrorBoundary, Root } from '@/app/routes/app/root';
import { HydrateFallback } from '@/app/routes/app/hydrate-fallback';
import { NotFound } from '@/app/routes/not-found';
import { paths } from '@/config/paths';

export const createRoutes = (): RouteObject[] => [
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
        path: paths.spaces.path.slice(1),
        lazy: () => import('@/app/routes/app/spaces'),
      },
      {
        path: paths.trash.path.slice(1),
        lazy: () => import('@/app/routes/app/trash'),
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
