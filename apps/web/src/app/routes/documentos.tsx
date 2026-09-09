import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function DocumentosRoute() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">
        Documentos
      </h1>
      <EmptyState
        titleAs="h2"
        title="Nenhum documento publicado aqui ainda"
        description="Publique o primeiro documento para que ele apareça nesta lista."
        action={<Button type="button">Publicar um documento</Button>}
      />
    </div>
  );
}
