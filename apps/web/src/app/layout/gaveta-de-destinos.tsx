import type { ReactElement, SVGProps } from "react";
import { Dialog } from "@/shared/components/ui/dialog";
import { NavegacaoDeDestinos } from "./navegacao-de-destinos";

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

// motivo: o diálogo tem raiz própria, e não a do esqueleto. Enquanto a barra
// lateral era global, ela e o cabeçalho dividiam a mesma raiz; com a navegação
// no topo, quem abre e quem fecha moram no mesmo componente, e um segundo
// diálogo no esqueleto passaria a competir por essa raiz.
export function GavetaDeDestinos(): ReactElement {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Abrir navegação"
        className="desde-tablet:hidden h-10 w-10 bg-transparent px-0 text-tinta hover:bg-fio"
      >
        <MenuMark />
      </Dialog.Trigger>

      <Dialog.Backdrop className="desde-tablet:hidden" />
      <Dialog.Positioner className="desde-tablet:hidden items-stretch justify-start p-0">
        <Dialog.Content className="h-dvh w-64 max-w-none flex-none rounded-none p-4">
          <Dialog.Title className="sr-only">Destinos do produto</Dialog.Title>
          <NavegacaoDeDestinos
            orientacao="vertical"
            antesDosDestinos={
              <Dialog.CloseTrigger
                aria-label="Fechar navegação"
                className="mb-2 self-end bg-transparent px-2 text-tinta hover:bg-fio"
              >
                <FecharMark />
              </Dialog.CloseTrigger>
            }
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
