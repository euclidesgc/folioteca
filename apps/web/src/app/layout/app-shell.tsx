import { Outlet } from "react-router";
import { Dialog } from "@/shared/components/ui/dialog";
import { SkipLink } from "./skip-link";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export function AppShell() {
  return (
    <Dialog.Root>
      <div className="flex min-h-dvh flex-col bg-papel text-tinta">
        <SkipLink />
        <AppHeader />
        <div className="flex flex-1">
          <AppSidebar />
          <main
            id="conteudo"
            tabIndex={-1}
            className="min-w-0 flex-1 px-4 py-8 desde-tablet:px-8"
          >
            <div className="mx-auto max-w-4xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </Dialog.Root>
  );
}
