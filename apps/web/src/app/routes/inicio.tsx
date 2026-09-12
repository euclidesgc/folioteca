import type { ReactElement } from "react";
import { DocumentList, useRecentDocuments } from "@/features/documents";

export function InicioRoute(): ReactElement {
  const { data: documentos } = useRecentDocuments();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">
        Início
      </h1>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-lg font-semibold text-tinta">
          Atualizados recentemente
        </h2>
        <DocumentList documents={documentos ?? []} />
      </section>
    </div>
  );
}
