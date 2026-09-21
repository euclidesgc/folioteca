import type React from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { paths } from '@/config/paths';
import { LoginForm } from '@/features/auth/components/login-form';
import { useInstallation } from '@/features/installation/api/get-installation';
import { useUser } from '@/lib/auth';
import { getSafeRedirectPath } from '@/utils/get-safe-redirect-path';

export function Component(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const installation = useInstallation();
  const user = useUser();

  // The gate above already resolved both queries.
  if (!installation.data?.data.installed) {
    return <Navigate to={paths.install.getHref()} replace />;
  }

  // The only mechanism for "already signed in" and "just signed in": after
  // the login writes the user to the cache, this guard re-renders and sends
  // the person to where they were going.
  if (user.data) {
    return (
      <Navigate
        to={getSafeRedirectPath(
          searchParams.get('redirectTo'),
          paths.home.getHref(),
        )}
        replace
      />
    );
  }

  return (
    <main id="main-content" className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Entrar</h1>
      <p className="mt-2 text-gray-600">
        Informe o e-mail e a senha da sua conta na Folioteca.
      </p>
      <LoginForm />
    </main>
  );
}
