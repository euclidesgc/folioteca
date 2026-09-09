import type { ReactElement, SVGProps } from "react";
import { NavLink } from "react-router";
import { Dialog } from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/cn";

const DESTINOS = [
  { rotulo: "Documentos", para: "/documentos" },
  { rotulo: "Canais", para: "/canais" },
  { rotulo: "Pesquisa", para: "/pesquisa" },
  { rotulo: "Organização", para: "/organizacao" },
] as const;

function FecharMark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}

function NavegacaoDeDestinos({ comFechar = false }: { comFechar?: boolean }) {
  return (
    <nav aria-label="Destinos do produto" className="flex flex-col gap-1">
      {comFechar ? (
        <Dialog.CloseTrigger
          aria-label="Fechar navegação"
          className="mb-2 self-end bg-transparent px-2 text-tinta hover:bg-fio"
        >
          <FecharMark />
        </Dialog.CloseTrigger>
      ) : null}
      {DESTINOS.map((destino) => (
        <NavLink
          key={destino.para}
          to={destino.para}
          className={({ isActive }) =>
            cn(
              "rounded-padrao px-3 py-2 text-sm font-normal text-tinta hover:bg-fio",
              isActive && "font-semibold bg-fio",
            )
          }
        >
          {destino.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppSidebar() {
  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r border-fio p-4 desde-tablet:block">
        <NavegacaoDeDestinos />
      </aside>

      <Dialog.Backdrop className="desde-tablet:hidden" />
      <Dialog.Positioner className="desde-tablet:hidden items-stretch justify-start p-0">
        <Dialog.Content className="h-dvh w-64 max-w-none flex-none rounded-none p-4">
          <Dialog.Title className="sr-only">Destinos do produto</Dialog.Title>
          <NavegacaoDeDestinos comFechar />
        </Dialog.Content>
      </Dialog.Positioner>
    </>
  );
}
