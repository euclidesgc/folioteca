import type React from 'react';
import { Link, Navigate, Outlet, useRouteError } from 'react-router';

import { SessionRequired } from '@/app/routes/app/session-required';
import { AppLayout } from '@/components/layouts/app-layout';
import { SidebarIdentity } from '@/components/layouts/sidebar-identity';
import { paths } from '@/config/paths';
import { ConnectionIndicator } from '@/features/connection/components/connection-indicator';
import { useInstallation } from '@/features/installation/api/get-installation';
import { useUser } from '@/lib/auth';
import { reportError } from '@/lib/report-error';

export function Root(): React.JSX.Element {
  const installation = useInstallation();
  const user = useUser();

  // The gate above already resolved both queries.
  if (!installation.data?.data.installed) {
    return <Navigate to={paths.install.getHref()} replace />;
  }

  if (!user.data) {
    return <SessionRequired />;
  }

  return (
    <AppLayout
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
