import type { ReactElement, ReactNode } from "react";

export function Sublateral({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}): ReactElement {
  return (
    // decisão: abaixo de 768px ela empilha acima do conteúdo em vez de virar
    // gaveta — uma segunda gaveta traria outro gatilho competindo com "Abrir
    // navegação" no primeiro Tab, e empilhar mantém a página sem rolagem
    // horizontal.
    <aside className="border-b border-fio p-4 desde-tablet:w-64 desde-tablet:shrink-0 desde-tablet:border-r desde-tablet:border-b-0">
      <h2 className="sr-only">{rotulo}</h2>
      <nav aria-label={rotulo}>{children}</nav>
    </aside>
  );
}
