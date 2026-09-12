import type { ReactElement } from "react";
import { Link, Outlet } from "react-router";
import { BarraLateral } from "./barra-lateral";
import { GavetaDeDestinos } from "./gaveta-de-destinos";
import { SkipLink } from "./skip-link";

export function AppShell(): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col bg-papel text-tinta desde-tablet:flex-row">
      <SkipLink />
      <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-fio bg-papel px-4 desde-tablet:hidden">
        <GavetaDeDestinos />
        <Link
          to="/inicio"
          className="font-display text-lg font-semibold text-tinta"
        >
          Folioteca
        </Link>
      </header>
      <BarraLateral />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
