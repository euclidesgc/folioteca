import type { ReactElement, SVGProps } from "react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Dialog } from "@/shared/components/ui/dialog";
import { ConteudoDaBarraLateral } from "./barra-lateral";

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

export function GavetaDeDestinos(): ReactElement {
  const [aberta, setAberta] = useState(false);
  const location = useLocation();

  // motivo: fechar a partir de cada link da árvore de Espaços e dos destinos
  // duplicaria a mesma regra em todo lugar que navega; observar a rota cobre
  // qualquer caminho de saída num só ponto.
  useEffect(() => {
    setAberta(false);
  }, [location.pathname]);

  return (
    <Dialog.Root
      open={aberta}
      onOpenChange={(detalhe) => setAberta(detalhe.open)}
    >
      <Dialog.Trigger
        aria-label="Abrir navegação"
        className="desde-tablet:hidden h-10 w-10 bg-transparent px-0 text-tinta hover:bg-fio"
      >
        <MenuMark />
      </Dialog.Trigger>

      <Dialog.Backdrop className="desde-tablet:hidden" />
      <Dialog.Positioner className="desde-tablet:hidden items-stretch justify-start p-0">
        <Dialog.Content className="h-dvh w-64 max-w-none flex-none flex-col gap-0 rounded-none p-0">
          <Dialog.Title className="sr-only">Destinos do produto</Dialog.Title>
          <div className="flex h-full flex-col">
            <Dialog.CloseTrigger
              aria-label="Fechar navegação"
              className="m-2 self-end bg-transparent px-2 text-tinta hover:bg-fio"
            >
              <FecharMark />
            </Dialog.CloseTrigger>
            <ConteudoDaBarraLateral />
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
