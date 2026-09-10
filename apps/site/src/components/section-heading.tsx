import type { ReactElement, ReactNode } from "react";
import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  chapeu: string;
  titulo: ReactNode;
  tituloId?: string;
  apoio?: ReactNode;
  tituloEstreito?: boolean;
  apoioTamanho?: "sm" | "base";
};

export function SectionHeading({
  chapeu,
  titulo,
  tituloId,
  apoio,
  tituloEstreito = false,
  apoioTamanho = "sm",
}: SectionHeadingProps): ReactElement {
  return (
    <>
      <p className="font-mono text-xs font-semibold tracking-chapeu text-grafite uppercase">
        {chapeu}
      </p>
      <h2
        id={tituloId}
        className={cn(
          "mt-3 font-display text-2xl font-semibold text-balance",
          tituloEstreito && "max-w-titulo",
        )}
      >
        {titulo}
      </h2>
      {apoio ? (
        <p
          className={cn(
            "mt-3 max-w-prose text-grafite",
            apoioTamanho === "sm" ? "text-sm" : "text-base",
          )}
        >
          {apoio}
        </p>
      ) : null}
    </>
  );
}
