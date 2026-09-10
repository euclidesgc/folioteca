import type { ReactElement } from "react";
import { Outlet } from "react-router";
import { AppHeader } from "./app-header";
import { SkipLink } from "./skip-link";

export function AppShell(): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col bg-papel text-tinta">
      <SkipLink />
      <AppHeader />
      {/* O `main` não mora aqui: cada seção o monta ao lado da própria
          sublateral, para que a lateral seja irmã do conteúdo e não filha dele —
          e para que continue existindo exatamente um alvo do salto por rota. */}
      <div className="flex flex-1 flex-col desde-tablet:flex-row">
        <Outlet />
      </div>
    </div>
  );
}
