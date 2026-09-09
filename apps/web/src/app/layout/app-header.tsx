import type { ReactElement, SVGProps } from "react";
import { Link } from "react-router";
import { Dialog } from "@/shared/components/ui/dialog";
import { Menu } from "@/shared/components/ui/menu";
import { useTema } from "@/app/providers/theme-provider";

function MenuMark(props: SVGProps<SVGSVGElement>): ReactElement {
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
      <line x1="2" y1="4.5" x2="14" y2="4.5" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="11.5" x2="14" y2="11.5" />
    </svg>
  );
}

export function AppHeader() {
  const { tema, alternarTema } = useTema();
  const rotuloAlternador = tema === "claro" ? "Tema escuro" : "Tema claro";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-fio bg-papel px-4 desde-tablet:px-6">
      <div className="flex items-center gap-3">
        <Dialog.Trigger
          aria-label="Abrir navegação"
          className="desde-tablet:hidden h-10 w-10 bg-transparent px-0 text-tinta hover:bg-fio"
        >
          <MenuMark />
        </Dialog.Trigger>
        <Link to="/" className="font-display text-lg font-semibold text-tinta">
          Folioteca
        </Link>
      </div>

      <Menu.Root
        onSelect={(detalhe) => {
          if (detalhe.value === "alternar-tema") {
            alternarTema();
          }
        }}
      >
        <Menu.Trigger className="bg-transparent px-3 text-tinta hover:bg-fio">
          Menu de conta
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="alternar-tema">
              <Menu.ItemText>{rotuloAlternador}</Menu.ItemText>
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </header>
  );
}
