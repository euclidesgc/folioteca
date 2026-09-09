import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function PesquisaRoute() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">
        Pesquisa
      </h1>
      <EmptyState
        titleAs="h2"
        title="Nenhuma pesquisa realizada ainda"
        description="Pesquise pelo nome ou pelo conteúdo de um documento para começar."
        action={<Button type="button">Pesquisar documentos</Button>}
      />
    </div>
  );
}
