import type { ReactElement, ReactNode } from "react";

export function PerfilSecao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="rounded-padrao border border-fio p-4 desde-tablet:p-6">
      <h2 className="font-display text-lg font-semibold text-tinta">
        {titulo}
      </h2>
      <p className="mt-1 text-sm text-grafite">{descricao}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
