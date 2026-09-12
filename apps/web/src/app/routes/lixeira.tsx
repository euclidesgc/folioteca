import type { ReactElement } from "react";
import { DocumentList, useTrashedDocuments } from "@/features/documents";

export function LixeiraRoute(): ReactElement {
  const { data: documentos } = useTrashedDocuments();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">Lixeira</h1>
      <DocumentList
        documents={documentos ?? []}
        variant="lixeira"
        emptyState={{
          title: "A lixeira está vazia",
          description: "Documentos apagados ficam aqui até você restaurar ou excluir de vez.",
        }}
      />
    </div>
  );
}
