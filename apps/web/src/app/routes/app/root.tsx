import type React from 'react';
import { Link, Navigate, Outlet, useRouteError } from 'react-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { SidebarAdmin } from '@/components/layouts/sidebar-admin';
import { SidebarIdentity } from '@/components/layouts/sidebar-identity';
import { paths } from '@/config/paths';
import { ConnectionIndicator } from '@/features/connection/components/connection-indicator';
import { NewDocumentButton } from '@/features/documents/components/new-document-button';
import { SidebarDocuments } from '@/features/documents/components/sidebar-documents';
import { useInstallation } from '@/features/installation/api/get-installation';
import { SidebarFreeSpaces } from '@/features/spaces/components/sidebar-free-spaces';
import { SidebarUnitSpaces } from '@/features/spaces/components/sidebar-unit-spaces';
import { ProtectedRoute } from '@/lib/auth';
import { reportError } from '@/lib/report-error';

export function Root(): React.JSX.Element {
  const installation = useInstallation();

  // The gate above already resolved the installation query.
  if (!installation.data?.data.installed) {
    return <Navigate to={paths.install.getHref()} replace />;
  }

  return (
    <ProtectedRoute>
      <AppLayout
        sidebarActions={<NewDocumentButton />}
        sidebarSection={
          <>
            <SidebarDocuments scope="favorites" />
            <SidebarDocuments />
            <SidebarUnitSpaces />
            <SidebarFreeSpaces />
            <SidebarAdmin />
          </>
        }
        sidebarFooter={
          <>
            <SidebarIdentity />
            <div className="mt-3">
              <ConnectionIndicator />
            </div>
          </>
        }
      >
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}

export function ErrorBoundary(): React.JSX.Element {
  const error = useRouteError();
  reportError(error);

  return (
    <div role="alert" className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="mt-2 text-gray-600">
        Não foi possível abrir esta página. Tente de novo em instantes.
      </p>
      <Link
        to={paths.home.getHref()}
        className="mt-6 inline-block font-medium text-blue-600 underline-offset-4 hover:underline"
      >
        Voltar para o início
      </Link>
    </div>
  );
}
