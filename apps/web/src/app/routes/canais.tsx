import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function CanaisRoute() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">Canais</h1>
      <EmptyState
        titleAs="h2"
        title="Nenhum canal criado aqui ainda"
        description="Crie o primeiro canal para reunir as pessoas em torno de um acesso."
        action={<Button type="button">Criar um canal</Button>}
      />
    </div>
  );
}
