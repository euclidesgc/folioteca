import { HealthStatus } from "@/features/health";
import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function OrganizacaoRoute() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">
        Organização
      </h1>
      <HealthStatus />
      <EmptyState
        titleAs="h2"
        title="Nenhum membro convidado aqui ainda"
        description="Convide as primeiras pessoas para que a organização ganhe forma."
        action={<Button type="button">Convidar um membro</Button>}
      />
    </div>
  );
}
