import type { ReactElement } from "react";
import { DocumentList, useSharedWithMe } from "@/features/documents";

export function CompartilhadosRoute(): ReactElement {
  const { data: documentos } = useSharedWithMe();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-4xl font-semibold text-tinta">
        Compartilhados comigo
      </h1>
      <DocumentList documents={documentos ?? []} />
    </div>
  );
}
