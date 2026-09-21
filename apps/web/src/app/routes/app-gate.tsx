import type React from 'react';
import { Outlet } from 'react-router';

import { HydrateFallback } from '@/app/routes/app/hydrate-fallback';
import { Button } from '@/components/ui/button/button';
import { useInstallation } from '@/features/installation/api/get-installation';
import { AuthLoader, useUser } from '@/lib/auth';

type GateErrorProps = {
  onRetry: () => void;
};

function GateError({ onRetry }: GateErrorProps): React.JSX.Element {
  return (
    <main id="main-content" className="mx-auto max-w-md p-8">
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 p-4"
      >
        <h1 className="text-2xl font-bold text-red-800">
          Não foi possível abrir a Folioteca.
        </h1>
        <Button
          className="mt-3 bg-red-600 hover:bg-red-700 focus-visible:outline-red-600"
          onClick={onRetry}
        >
          Tentar de novo
        </Button>
      </div>
    </main>
  );
}

// Nothing renders before the app knows whether this instance is installed and
// who is signed in: every screen below depends on those two answers.
export function AppGate(): React.JSX.Element {
  const installation = useInstallation();
  const user = useUser();

  const retry = (): void => {
    void installation.refetch();
    void user.refetch();
  };

  if (installation.isPending) return <HydrateFallback />;
  if (installation.isError) return <GateError onRetry={retry} />;

  return (
    <AuthLoader
      renderLoading={() => <HydrateFallback />}
      renderError={() => <GateError onRetry={retry} />}
    >
      <Outlet />
    </AuthLoader>
  );
}
