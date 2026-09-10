import type { ReactElement, ReactNode } from "react";
import { Outlet } from "react-router";
import { Sublateral } from "./sublateral";

export function SecaoLayout({
  sublateral,
}: {
  sublateral?: { rotulo: string; conteudo: ReactNode };
}): ReactElement {
  return (
    <>
      {sublateral ? (
        <Sublateral rotulo={sublateral.rotulo}>
          {sublateral.conteudo}
        </Sublateral>
      ) : null}
      <main
        id="conteudo"
        tabIndex={-1}
        // motivo: `scroll-mt-16` é a altura do cabeçalho fixo. Sem ele, o salto
        // para o conteúdo leva o foco a um ponto que o topo cobre, e quem usa
        // teclado chega numa área que não consegue ver.
        className="min-w-0 flex-1 scroll-mt-16 px-4 py-8 desde-tablet:px-8"
      >
        <div className="mx-auto max-w-4xl">
          <Outlet />
        </div>
      </main>
    </>
  );
}
