import type React from 'react';
import { Link, Navigate, useNavigate } from 'react-router';

import { paths } from '@/config/paths';
import { useInstallation } from '@/features/installation/api/get-installation';
import { InstallationForm } from '@/features/installation/components/installation-form';
import { useUser } from '@/lib/auth';

export function Component(): React.JSX.Element {
  const navigate = useNavigate();
  const installation = useInstallation();
  const user = useUser();

  const isInstalled = installation.data?.data.installed ?? false;

  if (isInstalled && user.data) {
    return <Navigate to={paths.home.getHref()} replace />;
  }

  if (isInstalled) {
    return (
      <main id="main-content" className="mx-auto max-w-md p-8">
        <h1 className="text-2xl font-bold">Instância já instalada</h1>
        <p className="mt-2 text-gray-600">
          Esta instância da Folioteca já foi instalada. A instalação só acontece
          uma vez.
        </p>
        <Link
          to={paths.home.getHref()}
          className="mt-6 inline-block font-medium text-blue-600 underline-offset-4 hover:underline"
        >
          Ir para o início
        </Link>
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Instalar a Folioteca</h1>
      <p className="mt-2 text-gray-600">
        Informe o código de instalação recebido na contratação e crie a
        organização e a sua conta de administrador.
      </p>
      <InstallationForm
        onSuccess={() => {
          void navigate(paths.home.getHref(), { replace: true });
        }}
      />
    </main>
  );
}
