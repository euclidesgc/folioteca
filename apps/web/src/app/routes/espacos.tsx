import type { ReactElement } from "react";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  CreateSpaceDialog,
  SpaceCard,
  useSpaceTree,
} from "@/features/spaces";

export function EspacosRoute(): ReactElement {
  const { data: espacos, isPending, isError, refetch } = useSpaceTree();
  const espacosDeTopo = (espacos ?? []).filter(
    (espaco) => espaco.parentId === null,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-4xl font-semibold text-tinta">
            Espaços
          </h1>
          <p className="text-sm text-grafite">
            As unidades da organização e os espaços que as pessoas criam.
          </p>
        </div>
        <CreateSpaceDialog />
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : isError ? (
        <EmptyState
          titleAs="h2"
          title="Não foi possível carregar os espaços"
          action={
            <Button variant="secondary" onClick={() => void refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 desde-tablet:grid-cols-2">
          {espacosDeTopo.map((espaco) => (
            <SpaceCard key={espaco.id} espaco={espaco} />
          ))}
        </ul>
      )}
    </div>
  );
}
