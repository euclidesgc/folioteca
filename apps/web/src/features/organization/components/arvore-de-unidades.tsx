import type { ReactElement } from "react";
import { useUnitsTree } from "../hooks/use-units-tree";
import { UnidadeNo } from "./unidade-no";

export function ArvoreDeUnidades({ isAdmin }: { isAdmin: boolean }): ReactElement {
  const { data, isPending, isError } = useUnitsTree();

  if (isPending) {
    return <p role="status">carregando a estrutura…</p>;
  }

  if (isError || !data) {
    return (
      <p role="alert" className="text-sm text-carimbo">
        Não foi possível carregar a estrutura agora.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      <UnidadeNo unit={data} isAdmin={isAdmin} />
    </ul>
  );
}
