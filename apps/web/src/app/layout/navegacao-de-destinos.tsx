import { cva, type VariantProps } from "class-variance-authority";
import type { ReactElement, ReactNode } from "react";
import { NavLink } from "react-router";
import { cn } from "@/shared/lib/cn";

export const DESTINOS = [
  { rotulo: "Documentos", para: "/documentos" },
  { rotulo: "Canais", para: "/canais" },
  { rotulo: "Pesquisa", para: "/pesquisa" },
  { rotulo: "Organização", para: "/organizacao" },
] as const;

const listaVariants = cva("flex gap-1", {
  variants: {
    orientacao: {
      horizontal: "flex-row items-center",
      vertical: "flex-col",
    },
  },
  defaultVariants: { orientacao: "horizontal" },
});

export function NavegacaoDeDestinos({
  orientacao,
  className,
  antesDosDestinos,
}: {
  className?: string;
  antesDosDestinos?: ReactNode;
} & VariantProps<typeof listaVariants>): ReactElement {
  return (
    <nav
      aria-label="Destinos do produto"
      className={cn(listaVariants({ orientacao }), className)}
    >
      {antesDosDestinos}
      {DESTINOS.map((destino) => (
        <NavLink
          key={destino.para}
          to={destino.para}
          className={({ isActive }) =>
            cn(
              "rounded-padrao px-3 py-2 text-sm font-normal text-tinta no-underline hover:bg-fio",
              isActive && "bg-fio font-semibold",
            )
          }
        >
          {destino.rotulo}
        </NavLink>
      ))}
    </nav>
  );
}
