import type { ReactElement } from "react";
import { DocumentList, NewDocumentButton, useOwnedDocuments } from "@/features/documents";

export function DocumentosRoute(): ReactElement {
  const { data: documentos } = useOwnedDocuments();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">Meus documentos</h1>
      <DocumentList
        documents={documentos ?? []}
        emptyState={{
          title: "Nenhum documento ainda",
          description: "Os documentos que você criar aparecem aqui.",
          action: <NewDocumentButton />,
        }}
      />
    </div>
  );
}
