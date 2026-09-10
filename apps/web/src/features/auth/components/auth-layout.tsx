import type { ReactElement, ReactNode } from "react";
import { AlternadorDeTema } from "@/shared/components/alternador-de-tema";

export function AuthLayout({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
  rodape?: ReactNode;
}): ReactElement {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-papel px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="block h-5 w-1.5 rounded-sutil bg-verdete" />
            <span className="font-display text-lg font-semibold text-tinta">
              Folioteca
            </span>
          </div>
          <AlternadorDeTema />
        </div>
        <h1 className="font-display text-2xl font-semibold text-balance text-tinta">
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-grafite">{descricao}</p>
        <div className="mt-8">{children}</div>
        {rodape ? (
          <div className="mt-6 text-sm text-grafite">{rodape}</div>
        ) : null}
      </div>
    </main>
  );
}
