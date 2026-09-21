import type React from 'react';
import { Link, Outlet, useRouteError } from 'react-router';

import { AppLayout } from '@/components/layouts/app-layout';
import { paths } from '@/config/paths';
import { ConnectionIndicator } from '@/features/connection/components/connection-indicator';
import { reportError } from '@/lib/report-error';

export function Root(): React.JSX.Element {
  return (
    <AppLayout sidebarFooter={<ConnectionIndicator />}>
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
