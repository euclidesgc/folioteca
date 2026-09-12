import type { ReactElement } from "react";
import { useMe } from "@/features/organization";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function LotacoesLista(): ReactElement {
  const { data, isPending, isError } = useMe();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6" />
        <Skeleton className="h-6" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p role="alert" className="text-sm text-carimbo">
        Não conseguimos ler suas lotações agora.
      </p>
    );
  }

  if (data.units.length === 0) {
    return (
      <p className="text-sm text-grafite">
        Você ainda não está lotada em nenhuma unidade.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.units.map((unidade) => (
        <li key={unidade.id} className="text-sm text-tinta">
          {unidade.path.join(" › ")}
        </li>
      ))}
    </ul>
  );
}
