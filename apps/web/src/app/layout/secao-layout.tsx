import type { ReactElement } from "react";
import { Outlet } from "react-router";

export function SecaoLayout(): ReactElement {
  return (
    <main
      id="conteudo"
      tabIndex={-1}
      // motivo: `scroll-mt-16` é a altura da barra compacta fixa, que só existe
      // abaixo de 768px; a partir daí a barra lateral ocupa a própria coluna e
      // não há mais cabeçalho cobrindo o conteúdo para o salto evitar.
      className="min-w-0 flex-1 max-desde-tablet:scroll-mt-16 px-4 py-8 desde-tablet:px-8"
    >
      <div className="mx-auto max-w-4xl">
        <Outlet />
      </div>
    </main>
  );
}
