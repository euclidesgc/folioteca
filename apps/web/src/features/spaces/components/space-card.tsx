import type { ReactElement } from "react";
import { Link } from "react-router";
import { SpaceMark } from "@/shared/components/access/marks/space";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useSpaceMembers } from "../hooks/use-space-members";
import type { EspacoResumido } from "../hooks/use-space-tree";

function contagemDePessoas(total: number): string {
  return total === 1 ? "1 pessoa" : `${total} pessoas`;
}

export function SpaceCard({ espaco }: { espaco: EspacoResumido }): ReactElement {
  // motivo: só o espaço livre tem membros contáveis — o de unidade lista quem
  // está lotado, e a legenda dele é fixa; buscar membros ali seria requisição
  // sem uso.
  const membros = useSpaceMembers(espaco.id, espaco.kind === "free");

  return (
    <Card as="li" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <SpaceMark aria-hidden="true" className="shrink-0 text-verdete" />
        <Link
          to={`/espacos/${espaco.id}`}
          className="font-display text-lg font-semibold text-tinta hover:underline"
        >
          {espaco.name}
        </Link>
        {espaco.restricted ? <Badge size="reduzida">Restrito</Badge> : null}
      </div>
      {espaco.kind === "unit" ? (
        <p className="text-sm text-grafite">Espaço de unidade</p>
      ) : membros.isPending ? (
        <Skeleton className="h-4 w-32" />
      ) : (
        <p className="text-sm text-grafite">
          Espaço livre · {contagemDePessoas(membros.data?.length ?? 0)}
        </p>
      )}
    </Card>
  );
}
